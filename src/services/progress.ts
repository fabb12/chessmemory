import { getConcept } from '../data/exercises';
import { db, type ChessMemoryDB } from '../db/database';
import {
  ACTIVE_SESSION_ID,
  PROFILE_ID,
  type ActiveSession,
  type AttemptRecord,
  type Profile,
  type SessionItemSummary,
  type SessionRecord,
  type Settings,
} from '../db/schema';
import {
  initialAdaptiveState,
  updateDifficulty,
  type PlacementAnswer,
} from '../features/adaptation/difficulty';
import type { SessionPlan } from '../features/learning/sessionBuilder';
import { performanceScore, rateConceptResult } from '../features/memory/rating';
import { createCard, reviewCard } from '../features/memory/scheduler';
import { initialStreak, registerTrainingDay } from '../features/progress/streak';
import type { ConceptResult, DeclaredLevel, Difficulty, MoveTaskResult } from '../types';
import { createId } from '../utils/id';

/** Operazioni di scrittura sui progressi. Ogni funzione accetta il database per i test. */

export function createProfile(now: number): Profile {
  return {
    id: PROFILE_ID,
    userId: createId(),
    declaredLevel: null,
    placementDone: false,
    adaptive: initialAdaptiveState(1),
    settings: { theme: 'system', boardOrientation: 'auto' },
    streak: initialStreak(),
    lastCategory: null,
    createdAt: now,
  };
}

export async function ensureProfile(database: ChessMemoryDB = db, now = Date.now()): Promise<Profile> {
  return database.transaction('rw', database.profile, async () => {
    const existing = await database.profile.get(PROFILE_ID);
    if (existing) return existing;
    const profile = createProfile(now);
    await database.profile.put(profile);
    return profile;
  });
}

export async function updateSettings(patch: Partial<Settings>, database: ChessMemoryDB = db): Promise<void> {
  await database.transaction('rw', database.profile, async () => {
    const profile = await database.profile.get(PROFILE_ID);
    if (!profile) return;
    await database.profile.put({ ...profile, settings: { ...profile.settings, ...patch } });
  });
}

export interface PlacementOutcome {
  declaredLevel: DeclaredLevel;
  level: Difficulty;
  answers: (PlacementAnswer & { result: MoveTaskResult; conceptId: string })[];
}

/** Salva livello dichiarato, esito della valutazione iniziale e relative risposte. */
export async function completePlacement(
  outcome: PlacementOutcome,
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<void> {
  await database.transaction('rw', database.profile, database.attempts, async () => {
    const profile = (await database.profile.get(PROFILE_ID)) ?? createProfile(now);
    const sessionId = `placement-${createId()}`;
    const rows: AttemptRecord[] = outcome.answers.map((a) => ({
      userId: profile.userId,
      sessionId,
      conceptId: a.conceptId,
      exerciseId: a.result.exerciseId,
      category: getConcept(a.conceptId).category,
      activity: 'placement',
      correct: a.result.correct,
      attempts: a.result.attempts,
      hintsUsed: a.result.hintsUsed,
      responseMs: a.result.responseMs,
      answeredAt: now,
      nextReviewAt: null,
      rating: null,
      learningState: null,
    }));
    await database.attempts.bulkAdd(rows);
    await database.profile.put({
      ...profile,
      declaredLevel: outcome.declaredLevel,
      placementDone: true,
      adaptive: initialAdaptiveState(outcome.level),
    });
  });
}

export async function startSession(
  plan: SessionPlan,
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<ActiveSession> {
  const profile = await database.profile.get(PROFILE_ID);
  const session: ActiveSession = {
    id: ACTIVE_SESSION_ID,
    sessionId: createId(),
    startedAt: now,
    levelAtStart: profile?.adaptive.level ?? 1,
    items: plan.items,
    results: [],
    summaries: [],
  };
  await database.activeSession.put(session);
  return session;
}

export async function abandonSession(database: ChessMemoryDB = db): Promise<void> {
  await database.activeSession.delete(ACTIVE_SESSION_ID);
}

/**
 * Registra un concetto completato: aggiorna la scheda FSRS, la cronologia
 * delle risposte e delle revisioni, il livello adattivo e la sessione in corso.
 * Tutto in un'unica transazione, così una chiusura improvvisa non lascia dati a metà.
 */
export async function recordConceptResult(
  result: ConceptResult,
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<SessionItemSummary> {
  return database.transaction(
    'rw',
    [database.profile, database.cards, database.attempts, database.reviewLogs, database.activeSession],
    async () => {
      const profile = (await database.profile.get(PROFILE_ID)) ?? createProfile(now);
      const active = await database.activeSession.get(ACTIVE_SESSION_ID);
      const concept = getConcept(result.conceptId);

      const rating = rateConceptResult(result);
      const score = performanceScore(result);
      const existing = await database.cards.get(result.conceptId);
      const { card, log } = reviewCard(
        existing ?? createCard(result.conceptId, now),
        rating,
        now,
        result.transfer?.correct,
      );
      await database.cards.put(card);
      await database.reviewLogs.add({ ...log, userId: profile.userId });

      const common = {
        userId: profile.userId,
        sessionId: active?.sessionId ?? 'standalone',
        conceptId: result.conceptId,
        category: concept.category,
        answeredAt: now,
        nextReviewAt: card.due,
        rating,
        learningState: card.state,
      };
      const rows: AttemptRecord[] = [
        {
          ...common,
          exerciseId: result.recall.exerciseId,
          activity: 'recall',
          correct: result.recall.correct,
          attempts: result.recall.attempts,
          hintsUsed: result.recall.hintsUsed,
          responseMs: result.recall.responseMs,
        },
        {
          ...common,
          exerciseId: result.explain.exerciseId,
          activity: 'explain',
          correct: result.explain.correct,
          attempts: 1,
          hintsUsed: 0,
          responseMs: result.explain.responseMs,
        },
      ];
      if (result.transfer) {
        rows.push({
          ...common,
          exerciseId: result.transfer.exerciseId,
          activity: 'transfer',
          correct: result.transfer.correct,
          attempts: result.transfer.attempts,
          hintsUsed: result.transfer.hintsUsed,
          responseMs: result.transfer.responseMs,
        });
      }
      await database.attempts.bulkAdd(rows);

      await database.profile.put({
        ...profile,
        adaptive: updateDifficulty(profile.adaptive, score),
        lastCategory: concept.category,
      });

      const summary: SessionItemSummary = { conceptId: result.conceptId, kind: result.kind, rating, score };
      if (active) {
        await database.activeSession.put({
          ...active,
          results: [...active.results, result],
          summaries: [...active.summaries, summary],
        });
      }
      return summary;
    },
  );
}

export function summarizeResults(results: readonly ConceptResult[]) {
  let correctAnswers = 0;
  let totalAnswers = 0;
  let hintsUsed = 0;
  for (const r of results) {
    const tasks = [r.recall, ...(r.transfer ? [r.transfer] : [])];
    totalAnswers += tasks.length + 1;
    correctAnswers += tasks.filter((t) => t.correct).length + (r.explain.correct ? 1 : 0);
    hintsUsed += tasks.reduce((sum, t) => sum + t.hintsUsed, 0);
  }
  return {
    correctAnswers,
    totalAnswers,
    hintsUsed,
    reviewedConcepts: results.filter((r) => r.kind !== 'new').length,
    newConcepts: results.filter((r) => r.kind === 'new').length,
  };
}

/** Chiude la sessione in corso, la archivia e aggiorna la sequenza giornaliera. */
export async function finishSession(
  database: ChessMemoryDB = db,
  now = Date.now(),
): Promise<SessionRecord | null> {
  return database.transaction(
    'rw',
    [database.profile, database.sessions, database.activeSession],
    async () => {
      const active = await database.activeSession.get(ACTIVE_SESSION_ID);
      if (!active) return null;
      await database.activeSession.delete(ACTIVE_SESSION_ID);
      if (active.results.length === 0) return null;

      const profile = (await database.profile.get(PROFILE_ID)) ?? createProfile(now);
      const record: SessionRecord = {
        id: active.sessionId,
        userId: profile.userId,
        startedAt: active.startedAt,
        finishedAt: now,
        items: active.summaries,
        ...summarizeResults(active.results),
      };
      await database.sessions.put(record);
      await database.profile.put({ ...profile, streak: registerTrainingDay(profile.streak, now) });
      return record;
    },
  );
}
