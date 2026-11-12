import type { Grade } from 'ts-fsrs';
import { findConcept } from '../data/exercises';
import { db, type ChessMemoryDB } from '../db/database';
import {
  PROFILE_ID,
  type MistakeRecord,
  type MistakeResult,
  type PhotoRecord,
} from '../db/schema';
import { createCard, isDue, reviewCard } from '../features/memory/scheduler';
import { taskQuality } from '../features/learning/moveTask';
import { registerTrainingDay } from '../features/progress/streak';
import type { Exercise, MoveTaskResult, Uci } from '../types';
import { applyUci, isValidFen, sideToMove } from '../utils/chess';
import { createId } from '../utils/id';

/** Operazioni sugli errori delle partite. Ogni funzione accetta il database per i test. */

export const MAX_NOTE_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 120;
/** Mosse della continuazione salvate al massimo (semimosse). */
export const MAX_LINE_PLIES = 16;

export type MistakeDraft = Pick<
  MistakeRecord,
  | 'title'
  | 'fen'
  | 'playedMove'
  | 'bestMove'
  | 'alternatives'
  | 'line'
  | 'whatWentWrong'
  | 'howToContinue'
  | 'conceptId'
  | 'source'
  | 'gameInfo'
  | 'moveNumber'
  | 'severity'
  | 'engine'
>;

export class MistakeValidationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'MistakeValidationError';
  }
}

/** Mantiene solo il prefisso legale di una variante. */
export function legalPrefix(fen: string, line: readonly Uci[]): Uci[] {
  const out: Uci[] = [];
  let current = fen;
  for (const uci of line) {
    const applied = applyUci(current, uci);
    if (!applied) break;
    out.push(applied.uci);
    current = applied.fen;
  }
  return out;
}

/** Controlla e normalizza una bozza prima del salvataggio. */
export function normalizeDraft(draft: MistakeDraft): MistakeDraft {
  if (!isValidFen(draft.fen)) throw new MistakeValidationError('posizione non valida');
  if (!applyUci(draft.fen, draft.bestMove)) throw new MistakeValidationError('la mossa corretta non è legale');
  if (draft.playedMove !== null && !applyUci(draft.fen, draft.playedMove)) {
    throw new MistakeValidationError('la mossa giocata non è legale');
  }
  if (draft.playedMove !== null && draft.playedMove === draft.bestMove) {
    throw new MistakeValidationError('la mossa corretta coincide con quella giocata');
  }
  let line = legalPrefix(draft.fen, draft.line).slice(0, MAX_LINE_PLIES);
  if (line[0] !== draft.bestMove) line = [draft.bestMove];
  const alternatives = [...new Set(draft.alternatives)].filter(
    (m) => m !== draft.bestMove && m !== draft.playedMove && applyUci(draft.fen, m) !== null,
  );
  return {
    ...draft,
    title: draft.title.trim().slice(0, MAX_TITLE_LENGTH) || 'Errore senza titolo',
    whatWentWrong: draft.whatWentWrong.trim().slice(0, MAX_NOTE_LENGTH),
    howToContinue: draft.howToContinue.trim().slice(0, MAX_NOTE_LENGTH),
    line,
    alternatives,
    conceptId: draft.conceptId && findConcept(draft.conceptId) ? draft.conceptId : null,
    gameInfo: draft.gameInfo?.trim().slice(0, 200) || null,
  };
}

export async function createMistake(
  draft: MistakeDraft,
  photo: Omit<PhotoRecord, 'id' | 'createdAt'> | null,
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<MistakeRecord> {
  const clean = normalizeDraft(draft);
  const id = createId();
  const photoId = photo ? createId() : null;
  const record: MistakeRecord = {
    ...clean,
    id,
    createdAt: now,
    updatedAt: now,
    photoId,
    card: createCard(id, now),
    reviewCount: 0,
    lastResult: null,
  };
  await database.transaction('rw', database.mistakes, database.photos, async () => {
    if (photo && photoId) await database.photos.put({ ...photo, id: photoId, createdAt: now });
    await database.mistakes.put(record);
  });
  return record;
}

export type MistakeNotesPatch = Partial<Pick<MistakeRecord, 'title' | 'whatWentWrong' | 'howToContinue' | 'conceptId'>>;

export async function updateMistakeNotes(
  id: string,
  patch: MistakeNotesPatch,
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<void> {
  await database.transaction('rw', database.mistakes, async () => {
    const existing = await database.mistakes.get(id);
    if (!existing) return;
    const merged = normalizeDraft({ ...existing, ...patch });
    await database.mistakes.put({ ...existing, ...merged, updatedAt: now });
  });
}

export async function deleteMistake(id: string, database: ChessMemoryDB = db): Promise<void> {
  await database.transaction('rw', database.mistakes, database.photos, async () => {
    const existing = await database.mistakes.get(id);
    if (!existing) return;
    if (existing.photoId) await database.photos.delete(existing.photoId);
    await database.mistakes.delete(id);
  });
}

/**
 * Valutazione FSRS di un ripasso, con le stesse regole dei concetti:
 * soluzione mostrata → Again; risolto con aiuti o errori → Hard;
 * risolto pulito → Good (Easy se era già stato ripassato almeno una volta).
 */
export function rateMistakeReview(result: Pick<MoveTaskResult, 'correct' | 'mistakes' | 'hintsUsed'>, reviewCount: number): Grade {
  const quality = taskQuality(result);
  if (quality === 'failed') return 1;
  if (quality === 'assisted') return 2;
  return reviewCount > 0 ? 4 : 3;
}

export async function recordMistakeReview(
  id: string,
  result: MoveTaskResult,
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<MistakeRecord | null> {
  return database.transaction('rw', database.mistakes, database.profile, async () => {
    const existing = await database.mistakes.get(id);
    if (!existing) return null;
    const rating = rateMistakeReview(result, existing.reviewCount);
    const { card } = reviewCard(existing.card, rating, now);
    const updated: MistakeRecord = {
      ...existing,
      card,
      reviewCount: existing.reviewCount + 1,
      lastResult: taskQuality(result) satisfies MistakeResult,
    };
    await database.mistakes.put(updated);
    // Ripassare i propri errori conta come allenamento del giorno.
    const profile = await database.profile.get(PROFILE_ID);
    if (profile) await database.profile.put({ ...profile, streak: registerTrainingDay(profile.streak, now) });
    return updated;
  });
}

export function dueMistakes(mistakes: readonly MistakeRecord[], now: number): MistakeRecord[] {
  return mistakes.filter((m) => isDue(m.card, now)).sort((a, b) => a.card.due - b.card.due);
}

/**
 * Trasforma un errore in un «esercizio» per il compito di mossa già usato
 * negli allenamenti: stessa scacchiera, stessa scala di aiuti.
 * Il primo indizio è la nota dell'utente («cosa ho sbagliato»).
 */
export function mistakeToExercise(mistake: MistakeRecord, fallbackHint: string): Exercise {
  const hints = mistake.whatWentWrong ? [mistake.whatWentWrong] : [fallbackHint];
  return {
    id: mistake.id,
    title: mistake.title,
    category: 'tactics',
    difficulty: 2,
    conceptId: mistake.conceptId ?? 'mistake',
    fen: mistake.fen,
    sideToMove: sideToMove(mistake.fen),
    solution: [{ move: mistake.bestMove, alternatives: mistake.alternatives }],
    goal: '',
    watchOut: '',
    explanation: mistake.howToContinue,
    hints,
    question: { prompt: '', options: [], correctOptionId: '' },
  };
}
