import { findConcept, findExercise } from '../data/exercises';
import { db, type ChessMemoryDB } from '../db/database';
import {
  DEFAULT_SETTINGS,
  PROFILE_ID,
  type AttemptRecord,
  type MistakeRecord,
  type PhotoRecord,
  type Profile,
  type ReviewLogRecord,
  type SessionRecord,
  type StoredCard,
} from '../db/schema';
import { CATEGORIES, type WrongMove } from '../types';
import { isUci, isValidFen } from '../utils/chess';
import { MAX_LINE_PLIES, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH } from './mistakes';
import { createProfile } from './progress';

/**
 * Esportazione, importazione e ripristino dei progressi.
 * I dati importati sono considerati non attendibili: ogni campo viene
 * controllato e copiato esplicitamente prima di essere salvato.
 */
export const BACKUP_APP = 'chessmemory-ai';
export const BACKUP_VERSION = 2;
/** Versioni leggibili: la 1 non contiene gli errori delle partite. */
const SUPPORTED_VERSIONS = [1, 2];
/** Limite di sicurezza sulla dimensione del file importato (comprese le foto). */
export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;
/** Dimensione massima di una singola foto (data URL). */
export const MAX_PHOTO_CHARS = 4 * 1024 * 1024;
const MAX_ROWS = 50_000;

export interface BackupData {
  profile: Profile;
  cards: StoredCard[];
  attempts: AttemptRecord[];
  reviewLogs: ReviewLogRecord[];
  sessions: SessionRecord[];
  mistakes: MistakeRecord[];
  /** null se il backup non contiene le foto (ad esempio il salvataggio nel cloud). */
  photos: PhotoRecord[] | null;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export class BackupValidationError extends Error {
  constructor(public readonly reason: string) {
    super(`Backup non valido: ${reason}`);
    this.name = 'BackupValidationError';
  }
}

export async function exportBackup(
  database: ChessMemoryDB = db,
  now = Date.now(),
  options: { includePhotos?: boolean } = {},
): Promise<BackupFile> {
  const profile = await database.profile.get(PROFILE_ID);
  if (!profile) throw new Error('Nessun profilo da esportare');
  const includePhotos = options.includePhotos ?? true;
  const [cards, attempts, reviewLogs, sessions, mistakes, photos] = await Promise.all([
    database.cards.toArray(),
    database.attempts.toArray(),
    database.reviewLogs.toArray(),
    database.sessions.toArray(),
    database.mistakes.toArray(),
    includePhotos ? database.photos.toArray() : Promise.resolve(null),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    data: { profile, cards, attempts, reviewLogs, sessions, mistakes, photos },
  };
}

// ───────────── Validazione ─────────────

type Obj = Record<string, unknown>;

function fail(reason: string): never {
  throw new BackupValidationError(reason);
}
function obj(v: unknown, where: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${where}: oggetto atteso`);
  return v as Obj;
}
function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: elenco atteso`);
  if (v.length > MAX_ROWS) fail(`${where}: troppi elementi`);
  return v;
}
function str(v: unknown, where: string, max = 200): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) fail(`${where}: testo non valido`);
  return v;
}
function num(v: unknown, where: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${where}: numero non valido`);
  return v;
}
function int(v: unknown, where: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = num(v, where, min, max);
  if (!Number.isInteger(n)) fail(`${where}: intero atteso`);
  return n;
}
function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') fail(`${where}: valore vero/falso atteso`);
  return v;
}
function oneOf<T extends string>(v: unknown, values: readonly T[], where: string): T {
  if (typeof v !== 'string' || !values.includes(v as T)) fail(`${where}: valore non ammesso`);
  return v as T;
}
function nullable<T>(v: unknown, parse: (v: unknown) => T): T | null {
  return v === null || v === undefined ? null : parse(v);
}
/** Timestamp plausibile (dal 2020 a 5 anni nel futuro). */
function time(v: unknown, where: string): number {
  return num(v, where, 1_577_836_800_000, Date.now() + 5 * 365 * 86_400_000);
}
function conceptId(v: unknown, where: string): string {
  const id = str(v, where);
  if (!findConcept(id)) fail(`${where}: concetto sconosciuto «${id.slice(0, 40)}»`);
  return id;
}
function exerciseId(v: unknown, where: string): string {
  const id = str(v, where);
  if (!findExercise(id)) fail(`${where}: esercizio sconosciuto «${id.slice(0, 40)}»`);
  return id;
}

const STATES = ['new', 'learning', 'review', 'relearning'] as const;
const KINDS = ['review', 'weakness', 'new'] as const;
const ACTIVITIES = ['recall', 'explain', 'transfer', 'placement'] as const;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(v: unknown, where: string, max: number): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > max) fail(`${where}: testo non valido`);
  return v;
}

function parseSettings(settings: Obj): Profile['settings'] {
  return {
    theme: oneOf(settings.theme, ['system', 'light', 'dark'] as const, 'profile.settings.theme'),
    boardOrientation: oneOf(
      settings.boardOrientation,
      ['auto', 'white', 'black'] as const,
      'profile.settings.boardOrientation',
    ),
    // Assenti nei backup della versione 1: si usano i valori predefiniti.
    analysisDepth:
      settings.analysisDepth === undefined
        ? DEFAULT_SETTINGS.analysisDepth
        : oneOf(settings.analysisDepth, ['quick', 'deep'] as const, 'profile.settings.analysisDepth'),
    playerName: text(settings.playerName, 'profile.settings.playerName', 60),
  };
}

function parseProfile(v: unknown): Profile {
  const p = obj(v, 'profile');
  const adaptive = obj(p.adaptive, 'profile.adaptive');
  const settings = obj(p.settings, 'profile.settings');
  const streak = obj(p.streak, 'profile.streak');
  const lastActiveDay = nullable(streak.lastActiveDay, (d) => {
    const s = str(d, 'profile.streak.lastActiveDay', 10);
    if (!DAY_RE.test(s)) fail('profile.streak.lastActiveDay: data non valida');
    return s;
  });
  return {
    id: PROFILE_ID,
    userId: str(p.userId, 'profile.userId', 80),
    declaredLevel: nullable(p.declaredLevel, (d) =>
      oneOf(d, ['beginner', 'intermediate', 'unsure'] as const, 'profile.declaredLevel'),
    ),
    placementDone: bool(p.placementDone, 'profile.placementDone'),
    adaptive: {
      level: int(adaptive.level, 'profile.adaptive.level', 1, 5) as Profile['adaptive']['level'],
      recentScores: arr(adaptive.recentScores, 'profile.adaptive.recentScores')
        .slice(-20)
        .map((s, i) => num(s, `profile.adaptive.recentScores[${i}]`, 0, 1)),
      resultsSinceChange: int(adaptive.resultsSinceChange, 'profile.adaptive.resultsSinceChange', 0, 1e6),
      lastChange: nullable(adaptive.lastChange, (c) => oneOf(c, ['up', 'down'] as const, 'profile.adaptive.lastChange')),
    },
    settings: parseSettings(settings),
    streak: {
      current: int(streak.current, 'profile.streak.current', 0, 1e5),
      best: int(streak.best, 'profile.streak.best', 0, 1e5),
      lastActiveDay,
    },
    lastCategory: nullable(p.lastCategory, (c) => oneOf(c, CATEGORIES, 'profile.lastCategory')),
    createdAt: time(p.createdAt, 'profile.createdAt'),
  };
}

function parseCard(v: unknown, i: number, where = `cards[${i}]`, ownerId?: string): StoredCard {
  const w = where;
  const c = obj(v, w);
  const lastReview = nullable(c.lastReview, (t) => time(t, `${w}.lastReview`));
  return {
    conceptId: ownerId ?? conceptId(c.conceptId, `${w}.conceptId`),
    due: time(c.due, `${w}.due`),
    stability: num(c.stability, `${w}.stability`, 0, 1e5),
    difficulty: num(c.difficulty, `${w}.difficulty`, 0, 10),
    elapsedDays: num(c.elapsedDays, `${w}.elapsedDays`, 0, 1e5),
    scheduledDays: num(c.scheduledDays, `${w}.scheduledDays`, 0, 1e5),
    learningSteps: int(c.learningSteps, `${w}.learningSteps`, 0, 100),
    reps: int(c.reps, `${w}.reps`, 0, 1e6),
    lapses: int(c.lapses, `${w}.lapses`, 0, 1e6),
    state: oneOf(c.state, STATES, `${w}.state`),
    ...(lastReview !== null ? { lastReview } : {}),
    learnedAt: time(c.learnedAt, `${w}.learnedAt`),
    transferAttempts: int(c.transferAttempts, `${w}.transferAttempts`, 0, 1e6),
    transferSuccesses: int(c.transferSuccesses, `${w}.transferSuccesses`, 0, 1e6),
    lastTransferCorrect: nullable(c.lastTransferCorrect, (b) => bool(b, `${w}.lastTransferCorrect`)),
  };
}

function parseWrongMoves(v: unknown, w: string): WrongMove[] {
  return arr(v, w)
    .slice(0, 100)
    .map((m, i) => {
      const o = obj(m, `${w}[${i}]`);
      const move = str(o.move, `${w}[${i}].move`, 5);
      if (!isUci(move)) fail(`${w}[${i}].move: mossa non valida`);
      return { move, step: int(o.step, `${w}[${i}].step`, 0, 50) };
    });
}

function parseAttempt(v: unknown, i: number): AttemptRecord {
  const w = `attempts[${i}]`;
  const a = obj(v, w);
  return {
    userId: str(a.userId, `${w}.userId`, 80),
    sessionId: str(a.sessionId, `${w}.sessionId`, 80),
    conceptId: conceptId(a.conceptId, `${w}.conceptId`),
    exerciseId: exerciseId(a.exerciseId, `${w}.exerciseId`),
    category: oneOf(a.category, CATEGORIES, `${w}.category`),
    activity: oneOf(a.activity, ACTIVITIES, `${w}.activity`),
    correct: bool(a.correct, `${w}.correct`),
    attempts: int(a.attempts, `${w}.attempts`, 0, 1000),
    hintsUsed: int(a.hintsUsed, `${w}.hintsUsed`, 0, 100),
    responseMs: num(a.responseMs, `${w}.responseMs`, 0, 86_400_000),
    ...(a.wrongMoves === undefined ? {} : { wrongMoves: parseWrongMoves(a.wrongMoves, `${w}.wrongMoves`) }),
    answeredAt: time(a.answeredAt, `${w}.answeredAt`),
    nextReviewAt: nullable(a.nextReviewAt, (t) => time(t, `${w}.nextReviewAt`)),
    rating: nullable(a.rating, (r) => int(r, `${w}.rating`, 1, 4)),
    learningState: nullable(a.learningState, (s) => oneOf(s, STATES, `${w}.learningState`)),
  };
}

function parseReviewLog(v: unknown, i: number): ReviewLogRecord {
  const w = `reviewLogs[${i}]`;
  const l = obj(v, w);
  return {
    userId: str(l.userId, `${w}.userId`, 80),
    conceptId: conceptId(l.conceptId, `${w}.conceptId`),
    rating: int(l.rating, `${w}.rating`, 1, 4) as ReviewLogRecord['rating'],
    state: oneOf(l.state, STATES, `${w}.state`),
    reviewedAt: time(l.reviewedAt, `${w}.reviewedAt`),
    previousDue: time(l.previousDue, `${w}.previousDue`),
    nextDue: time(l.nextDue, `${w}.nextDue`),
    stability: num(l.stability, `${w}.stability`, 0, 1e5),
    difficulty: num(l.difficulty, `${w}.difficulty`, 0, 10),
    scheduledDays: num(l.scheduledDays, `${w}.scheduledDays`, 0, 1e5),
  };
}

function parseSession(v: unknown, i: number): SessionRecord {
  const w = `sessions[${i}]`;
  const s = obj(v, w);
  return {
    id: str(s.id, `${w}.id`, 80),
    userId: str(s.userId, `${w}.userId`, 80),
    startedAt: time(s.startedAt, `${w}.startedAt`),
    finishedAt: time(s.finishedAt, `${w}.finishedAt`),
    items: arr(s.items, `${w}.items`).map((raw, j) => {
      const it = obj(raw, `${w}.items[${j}]`);
      return {
        conceptId: conceptId(it.conceptId, `${w}.items[${j}].conceptId`),
        kind: oneOf(it.kind, KINDS, `${w}.items[${j}].kind`),
        rating: int(it.rating, `${w}.items[${j}].rating`, 1, 4),
        score: num(it.score, `${w}.items[${j}].score`, 0, 1),
      };
    }),
    correctAnswers: int(s.correctAnswers, `${w}.correctAnswers`, 0, 1e5),
    totalAnswers: int(s.totalAnswers, `${w}.totalAnswers`, 0, 1e5),
    hintsUsed: int(s.hintsUsed, `${w}.hintsUsed`, 0, 1e5),
    reviewedConcepts: int(s.reviewedConcepts, `${w}.reviewedConcepts`, 0, 1e5),
    newConcepts: int(s.newConcepts, `${w}.newConcepts`, 0, 1e5),
  };
}

const SEVERITIES = ['inaccuracy', 'mistake', 'blunder'] as const;
const SOURCES = ['photo', 'pgn', 'manual'] as const;
const RESULTS = ['clean', 'assisted', 'failed'] as const;

function fen(v: unknown, where: string): string {
  const s = str(v, where, 100);
  if (!isValidFen(s)) fail(`${where}: posizione non valida`);
  return s;
}
function uci(v: unknown, where: string): string {
  const s = str(v, where, 5);
  if (!isUci(s)) fail(`${where}: mossa non valida`);
  return s;
}

function parseMistake(v: unknown, i: number): MistakeRecord {
  const w = `mistakes[${i}]`;
  const m = obj(v, w);
  const id = str(m.id, `${w}.id`, 80);
  const engine = nullable(m.engine, (e) => {
    const o = obj(e, `${w}.engine`);
    return {
      depth: int(o.depth, `${w}.engine.depth`, 0, 100),
      bestCp: num(o.bestCp, `${w}.engine.bestCp`, -1e6, 1e6),
      playedCp: nullable(o.playedCp, (c) => num(c, `${w}.engine.playedCp`, -1e6, 1e6)),
    };
  });
  return {
    id,
    title: text(m.title, `${w}.title`, MAX_TITLE_LENGTH) || 'Errore',
    createdAt: time(m.createdAt, `${w}.createdAt`),
    updatedAt: time(m.updatedAt, `${w}.updatedAt`),
    fen: fen(m.fen, `${w}.fen`),
    playedMove: nullable(m.playedMove, (x) => uci(x, `${w}.playedMove`)),
    bestMove: uci(m.bestMove, `${w}.bestMove`),
    alternatives: arr(m.alternatives ?? [], `${w}.alternatives`)
      .slice(0, 10)
      .map((x, j) => uci(x, `${w}.alternatives[${j}]`)),
    line: arr(m.line, `${w}.line`)
      .slice(0, MAX_LINE_PLIES)
      .map((x, j) => uci(x, `${w}.line[${j}]`)),
    whatWentWrong: text(m.whatWentWrong, `${w}.whatWentWrong`, MAX_NOTE_LENGTH),
    howToContinue: text(m.howToContinue, `${w}.howToContinue`, MAX_NOTE_LENGTH),
    conceptId: nullable(m.conceptId, (c) => conceptId(c, `${w}.conceptId`)),
    source: oneOf(m.source, SOURCES, `${w}.source`),
    photoId: nullable(m.photoId, (p) => str(p, `${w}.photoId`, 80)),
    gameInfo: nullable(m.gameInfo, (g) => str(g, `${w}.gameInfo`, 200)),
    moveNumber: nullable(m.moveNumber, (n) => int(n, `${w}.moveNumber`, 1, 10_000)),
    severity: nullable(m.severity, (s) => oneOf(s, SEVERITIES, `${w}.severity`)),
    engine,
    card: parseCard(m.card, i, `${w}.card`, id),
    reviewCount: int(m.reviewCount, `${w}.reviewCount`, 0, 1e6),
    lastResult: nullable(m.lastResult, (r) => oneOf(r, RESULTS, `${w}.lastResult`)),
  };
}

function parsePhoto(v: unknown, i: number): PhotoRecord {
  const w = `photos[${i}]`;
  const p = obj(v, w);
  const dataUrl = str(p.dataUrl, `${w}.dataUrl`, MAX_PHOTO_CHARS);
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) fail(`${w}.dataUrl: immagine non valida`);
  return {
    id: str(p.id, `${w}.id`, 80),
    dataUrl,
    width: int(p.width, `${w}.width`, 1, 20_000),
    height: int(p.height, `${w}.height`, 1, 20_000),
    createdAt: time(p.createdAt, `${w}.createdAt`),
  };
}

/** Controlla e normalizza un backup. Lancia BackupValidationError se non è valido. */
export function validateBackup(raw: unknown): BackupData {
  const file = obj(raw, 'file');
  if (file.app !== BACKUP_APP) fail('il file non è un backup di ChessMemoryBen');
  if (typeof file.version !== 'number' || !SUPPORTED_VERSIONS.includes(file.version)) {
    fail('versione del backup non supportata');
  }
  const data = obj(file.data, 'data');

  const cards = arr(data.cards, 'cards').map((c, i) => parseCard(c, i));
  if (new Set(cards.map((c) => c.conceptId)).size !== cards.length) fail('cards: concetti duplicati');
  const sessions = arr(data.sessions, 'sessions').map(parseSession);
  if (new Set(sessions.map((s) => s.id)).size !== sessions.length) fail('sessions: identificativi duplicati');
  const mistakes = data.mistakes === undefined ? [] : arr(data.mistakes, 'mistakes').map(parseMistake);
  if (new Set(mistakes.map((m) => m.id)).size !== mistakes.length) fail('mistakes: identificativi duplicati');
  const photos =
    data.photos === undefined || data.photos === null ? null : arr(data.photos, 'photos').map(parsePhoto);

  return {
    profile: parseProfile(data.profile),
    cards,
    attempts: arr(data.attempts, 'attempts').map(parseAttempt),
    reviewLogs: arr(data.reviewLogs, 'reviewLogs').map(parseReviewLog),
    sessions,
    mistakes,
    photos,
  };
}

export function parseBackupText(text: string): BackupData {
  if (text.length > MAX_BACKUP_BYTES) fail('file troppo grande');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    fail('il file non è un JSON valido');
  }
  return validateBackup(raw);
}

const ALL_TABLES = (database: ChessMemoryDB) => [
  database.profile,
  database.cards,
  database.attempts,
  database.reviewLogs,
  database.sessions,
  database.activeSession,
];

/**
 * Sostituisce tutti i progressi con quelli del backup (già validato).
 * Se il backup non contiene le foto, quelle già presenti sul dispositivo restano.
 */
export async function importBackup(data: BackupData, database: ChessMemoryDB = db): Promise<void> {
  const tables = [...ALL_TABLES(database), database.mistakes, database.photos];
  await database.transaction('rw', tables, async () => {
    await Promise.all(ALL_TABLES(database).map((t) => t.clear()));
    await database.mistakes.clear();
    await database.profile.put(data.profile);
    await database.cards.bulkPut(data.cards);
    await database.attempts.bulkAdd(data.attempts);
    await database.reviewLogs.bulkAdd(data.reviewLogs);
    await database.sessions.bulkPut(data.sessions);
    await database.mistakes.bulkPut(data.mistakes);
    if (data.photos) {
      await database.photos.clear();
      await database.photos.bulkPut(data.photos);
    } else {
      // Foto locali senza più un errore collegato: si eliminano.
      const used = new Set(data.mistakes.map((m) => m.photoId).filter(Boolean));
      const orphans = (await database.photos.toCollection().primaryKeys()).filter((id) => !used.has(id));
      await database.photos.bulkDelete(orphans);
    }
  });
}

/**
 * Cancella tutti i progressi di allenamento. Le preferenze e gli errori
 * salvati dalle partite (con foto e note) vengono mantenuti.
 */
export async function resetProgress(database: ChessMemoryDB = db): Promise<void> {
  await database.transaction('rw', ALL_TABLES(database), async () => {
    const previous = await database.profile.get(PROFILE_ID);
    await Promise.all(ALL_TABLES(database).map((t) => t.clear()));
    if (previous) {
      await database.profile.put({ ...createProfile(Date.now()), settings: previous.settings });
    }
  });
}
