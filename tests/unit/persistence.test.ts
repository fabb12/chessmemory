import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChessMemoryDB } from '../../src/db/database';
import { ACTIVE_SESSION_ID, PROFILE_ID } from '../../src/db/schema';
import { buildSessionPlan } from '../../src/features/learning/sessionBuilder';
import { computeCategoryStats, computeConceptAccuracy, computeInsight } from '../../src/features/progress/stats';
import {
  BackupValidationError,
  exportBackup,
  importBackup,
  parseBackupText,
  resetProgress,
  validateBackup,
} from '../../src/services/backup';
import {
  completePlacement,
  ensureProfile,
  finishSession,
  recordConceptResult,
  startSession,
  updateSettings,
} from '../../src/services/progress';
import { conceptResult, DAY, T0, task } from './helpers';

let name = '';
let database: ChessMemoryDB;
let counter = 0;

beforeEach(async () => {
  name = `test-db-${++counter}`;
  database = new ChessMemoryDB(name);
  await database.open();
});
afterEach(async () => {
  database.close();
  await ChessMemoryDB.delete(name);
});

/** Simula un primo allenamento completo. */
async function trainOnce(now = T0) {
  await ensureProfile(database, now);
  await completePlacement(
    {
      declaredLevel: 'beginner',
      level: 2,
      answers: [{ level: 1, quality: 'clean', conceptId: 'center-pawn', result: task('center-pawn-a', 'clean') }],
    },
    database,
    now,
  );
  const plan = buildSessionPlan({ cards: [], level: 2, now });
  await startSession(plan, database, now);
  await recordConceptResult(conceptResult('knight-fork', 'new', 'clean'), database, now + 60_000);
  await recordConceptResult(conceptResult('castle-early', 'new', 'assisted', false, 'failed'), database, now + 120_000);
  return finishSession(database, now + 180_000);
}

describe('persistenza dei progressi', () => {
  it('crea un solo profilo locale, senza dati personali', async () => {
    const first = await ensureProfile(database, T0);
    const second = await ensureProfile(database, T0 + 1000);
    expect(second.userId).toBe(first.userId);
    expect(await database.profile.count()).toBe(1);
    expect(Object.keys(first).sort()).toEqual(
      ['adaptive', 'createdAt', 'declaredLevel', 'id', 'lastCategory', 'placementDone', 'settings', 'streak', 'userId'].sort(),
    );
  });

  it('registra risposte, scheda di ripasso e cronologia per ogni concetto', async () => {
    const record = await trainOnce();
    expect(record).toMatchObject({ correctAnswers: 4, totalAnswers: 6, newConcepts: 2, reviewedConcepts: 0, hintsUsed: 4 });

    const cards = await database.cards.toArray();
    expect(cards.map((c) => c.conceptId).sort()).toEqual(['castle-early', 'knight-fork']);
    const fork = cards.find((c) => c.conceptId === 'knight-fork')!;
    expect(fork.due).toBeGreaterThan(T0 + DAY / 2);
    expect(fork.lastTransferCorrect).toBe(true);

    const attempts = await database.attempts.where('conceptId').equals('knight-fork').toArray();
    expect(attempts.map((a) => a.activity).sort()).toEqual(['explain', 'recall', 'transfer']);
    for (const a of attempts) {
      expect(a).toMatchObject({
        category: 'tactics',
        nextReviewAt: fork.due,
        rating: 3,
        learningState: fork.state,
        answeredAt: T0 + 60_000,
      });
      expect(a.userId.length).toBeGreaterThan(5);
      expect(a.sessionId).toBe(record!.id);
    }
    const recall = attempts.find((a) => a.activity === 'recall')!;
    expect(recall).toMatchObject({ exerciseId: 'knight-fork-a', correct: true, attempts: 1, hintsUsed: 0, responseMs: 4000 });

    const logs = await database.reviewLogs.toArray();
    expect(logs).toHaveLength(2);
    expect(logs.find((l) => l.conceptId === 'castle-early')!.rating).toBe(2);

    const profile = await database.profile.get(PROFILE_ID);
    expect(profile!.lastCategory).toBe('openings');
    expect(profile!.streak).toMatchObject({ current: 1, lastActiveDay: '2026-01-10' });
    expect(profile!.adaptive.recentScores).toHaveLength(2);
    expect(await database.activeSession.get(ACTIVE_SESSION_ID)).toBeUndefined();
  });

  it('ritrova i progressi dopo chiusura e riapertura del database', async () => {
    const record = await trainOnce();
    await updateSettings({ theme: 'dark', boardOrientation: 'black' }, database);
    database.close();

    const reopened = new ChessMemoryDB(name);
    await reopened.open();
    try {
      const profile = await reopened.profile.get(PROFILE_ID);
      expect(profile).toMatchObject({ placementDone: true, declaredLevel: 'beginner' });
      expect(profile!.adaptive.level).toBe(2);
      expect(profile!.settings).toEqual({ theme: 'dark', boardOrientation: 'black', analysisDepth: 'quick', playerName: '' });
      expect(await reopened.cards.count()).toBe(2);
      expect(await reopened.attempts.count()).toBe(7); // 1 valutazione iniziale + 6 risposte
      expect((await reopened.sessions.toArray())[0]!.id).toBe(record!.id);
    } finally {
      reopened.close();
    }
    database = new ChessMemoryDB(name);
    await database.open();
  });

  it('una sessione interrotta resta ripristinabile con i concetti già completati', async () => {
    await ensureProfile(database, T0);
    const plan = buildSessionPlan({ cards: [], level: 1, now: T0 });
    const started = await startSession(plan, database, T0);
    await recordConceptResult(conceptResult(plan.items[0]!.conceptId, 'new', 'clean'), database, T0 + 1000);
    database.close();

    database = new ChessMemoryDB(name);
    await database.open();
    const active = await database.activeSession.get(ACTIVE_SESSION_ID);
    expect(active!.sessionId).toBe(started.sessionId);
    expect(active!.results).toHaveLength(1);
    expect(active!.items).toEqual(plan.items);
    expect(await database.cards.count()).toBe(1);
  });

  it('una sessione senza risultati non viene archiviata né conta per la sequenza', async () => {
    await ensureProfile(database, T0);
    await startSession(buildSessionPlan({ cards: [], level: 1, now: T0 }), database, T0);
    expect(await finishSession(database, T0 + 1000)).toBeNull();
    expect(await database.sessions.count()).toBe(0);
    expect((await database.profile.get(PROFILE_ID))!.streak.current).toBe(0);
  });

  it('il ripasso successivo aggiorna la stessa scheda e sale di intervallo', async () => {
    await trainOnce();
    const before = (await database.cards.get('knight-fork'))!;
    await recordConceptResult(conceptResult('knight-fork', 'review', 'clean'), database, before.due);
    const after = (await database.cards.get('knight-fork'))!;
    expect(after.reps).toBe(2);
    expect(after.due - before.due).toBeGreaterThan(before.due - T0);
    expect(await database.cards.count()).toBe(2);
  });
});

describe('statistiche su dati reali', () => {
  it('calcola Memory DNA dalle risposte registrate, escludendo la valutazione iniziale', async () => {
    await trainOnce();
    const attempts = await database.attempts.toArray();
    const cards = await database.cards.toArray();
    const stats = computeCategoryStats(attempts, cards, T0 + DAY);

    const tactics = stats.find((s) => s.category === 'tactics')!;
    expect(tactics).toMatchObject({ answers: 3, correct: 3, successRate: 1, exercisesCompleted: 2, studiedConcepts: 1, consolidated: 0, toReview: 1 });
    expect(tactics.trend).toEqual([{ day: '2026-01-10', answers: 3, rate: 1 }]);

    const openings = stats.find((s) => s.category === 'openings')!;
    expect(openings.answers).toBe(3); // la risposta di valutazione su center-pawn non conta
    expect(openings.successRate).toBeCloseTo(1 / 3);

    const strategy = stats.find((s) => s.category === 'strategy')!;
    expect(strategy).toMatchObject({ answers: 0, successRate: null, trend: [] });

    const insight = computeInsight(stats, computeConceptAccuracy(attempts));
    expect(insight).toEqual({ kind: 'strong-weak', strong: 'tactics', weakConceptId: 'castle-early' });
  });

  it('senza risposte non inventa alcun dato', () => {
    const stats = computeCategoryStats([], [], T0);
    expect(stats).toHaveLength(4);
    expect(stats.every((s) => s.successRate === null && s.answers === 0 && s.trend.length === 0)).toBe(true);
    expect(computeInsight(stats, new Map())).toEqual({ kind: 'empty' });
  });
});

describe('esportazione e importazione', () => {
  it('esporta e reimporta gli stessi dati in un database vuoto', async () => {
    await trainOnce();
    const backup = await exportBackup(database, T0 + DAY);
    expect(backup).toMatchObject({ app: 'chessmemory-ai', version: 2 });

    const data = parseBackupText(JSON.stringify(backup));
    const otherName = `${name}-import`;
    const other = new ChessMemoryDB(otherName);
    await other.open();
    try {
      await importBackup(data, other);
      const again = await exportBackup(other, T0 + DAY);
      const strip = (b: typeof backup) => ({
        ...b.data,
        attempts: b.data.attempts.map(({ id: _id, ...rest }) => rest),
        reviewLogs: b.data.reviewLogs.map(({ id: _id, ...rest }) => rest),
      });
      expect(strip(again)).toEqual(strip(backup));
    } finally {
      other.close();
      await ChessMemoryDB.delete(otherName);
    }
  });

  it('l’importazione sostituisce i dati esistenti, compresa la sessione in corso', async () => {
    await trainOnce();
    const backup = await exportBackup(database);
    await recordConceptResult(conceptResult('pin', 'new', 'clean'), database, T0 + DAY);
    await startSession(buildSessionPlan({ cards: [], level: 1, now: T0 }), database, T0);
    await importBackup(validateBackup(JSON.parse(JSON.stringify(backup))), database);
    expect(await database.cards.count()).toBe(2);
    expect(await database.activeSession.count()).toBe(0);
  });

  it('rifiuta file che non sono backup validi', async () => {
    await trainOnce();
    const good = JSON.parse(JSON.stringify(await exportBackup(database)));
    const broken = (mutate: (b: typeof good) => void) => {
      const copy = JSON.parse(JSON.stringify(good));
      mutate(copy);
      return () => validateBackup(copy);
    };

    expect(() => parseBackupText('non è json')).toThrow(BackupValidationError);
    expect(() => validateBackup(null)).toThrow(BackupValidationError);
    expect(() => validateBackup([])).toThrow(BackupValidationError);
    expect(broken((b) => (b.app = 'altra-app'))).toThrow(/non è un backup/);
    expect(broken((b) => (b.version = 99))).toThrow(/versione/);
    expect(broken((b) => delete b.data.profile)).toThrow(BackupValidationError);
    expect(broken((b) => (b.data.cards = 'x'))).toThrow(/elenco atteso/);
    expect(broken((b) => (b.data.cards[0].conceptId = 'inesistente'))).toThrow(/concetto sconosciuto/);
    expect(broken((b) => (b.data.cards[0].due = '2026-01-01'))).toThrow(/numero non valido/);
    expect(broken((b) => (b.data.cards[0].stability = -1))).toThrow(BackupValidationError);
    expect(broken((b) => b.data.cards.push(b.data.cards[0]))).toThrow(/duplicati/);
    expect(broken((b) => (b.data.attempts[0].exerciseId = '<script>'))).toThrow(/esercizio sconosciuto/);
    expect(broken((b) => (b.data.attempts[0].correct = 'yes'))).toThrow(BackupValidationError);
    expect(broken((b) => (b.data.attempts[1].rating = 9))).toThrow(BackupValidationError);
    expect(broken((b) => (b.data.profile.adaptive.level = 12))).toThrow(BackupValidationError);
    expect(broken((b) => (b.data.profile.settings.theme = 'neon'))).toThrow(/valore non ammesso/);
    expect(broken((b) => (b.data.profile.streak.lastActiveDay = 'ieri'))).toThrow(BackupValidationError);
    expect(broken((b) => (b.data.sessions[0].items[0].kind = 'boh'))).toThrow(BackupValidationError);
    expect(broken((b) => (b.data.reviewLogs[0].reviewedAt = 5))).toThrow(BackupValidationError);
  });

  it('scarta i campi sconosciuti invece di salvarli', async () => {
    await trainOnce();
    const raw = JSON.parse(JSON.stringify(await exportBackup(database)));
    raw.data.profile.__proto_hack = 'x';
    raw.data.cards[0].extra = { nested: true };
    const data = validateBackup(raw);
    expect('__proto_hack' in data.profile).toBe(false);
    expect('extra' in data.cards[0]!).toBe(false);
  });

  it('un backup non valido non modifica i dati presenti', async () => {
    await trainOnce();
    const raw = JSON.parse(JSON.stringify(await exportBackup(database)));
    raw.data.cards[0].conceptId = 'inesistente';
    expect(() => parseBackupText(JSON.stringify(raw))).toThrow(BackupValidationError);
    expect(await database.cards.count()).toBe(2);
  });

  it('il ripristino cancella i progressi ma conserva le preferenze', async () => {
    await trainOnce();
    await updateSettings({ theme: 'dark' }, database);
    const before = (await database.profile.get(PROFILE_ID))!;
    await resetProgress(database);
    const profile = (await database.profile.get(PROFILE_ID))!;
    expect(profile.placementDone).toBe(false);
    expect(profile.settings.theme).toBe('dark');
    expect(profile.userId).not.toBe(before.userId);
    expect(profile.streak.current).toBe(0);
    for (const table of [database.cards, database.attempts, database.reviewLogs, database.sessions, database.activeSession]) {
      expect(await table.count()).toBe(0);
    }
  });
});
