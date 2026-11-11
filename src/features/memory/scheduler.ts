import { createEmptyCard, fsrs, State, type Card, type FSRS, type Grade } from 'ts-fsrs';

/**
 * Programmazione dei ripassi con FSRS (ts-fsrs v5).
 *
 * Scelte di configurazione:
 * - `enable_short_term: false`: l'app è pensata per un allenamento al giorno,
 *   quindi gli intervalli sono sempre in giorni (niente passi da 1 o 10 minuti).
 * - `enable_fuzz: false`: intervalli deterministici e verificabili.
 * - `request_retention: 0.9`: valore predefinito di FSRS.
 */
export const SCHEDULER_CONFIG = {
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: false,
} as const;

/** Soglie per considerare un concetto «consolidato». */
export const MASTERY_CONFIG = {
  /** Stabilità FSRS minima, in giorni. */
  minStabilityDays: 7,
} as const;

const scheduler: FSRS = fsrs(SCHEDULER_CONFIG);

export type LearningState = 'new' | 'learning' | 'review' | 'relearning';

const STATE_NAMES: Record<State, LearningState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

/** Scheda di ripasso serializzabile (date in millisecondi). */
export interface StoredCard {
  conceptId: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: LearningState;
  lastReview?: number;
  /** Primo studio del concetto. */
  learnedAt: number;
  /** Fase RICONOSCI: registrata separatamente dalla memoria della mossa. */
  transferAttempts: number;
  transferSuccesses: number;
  lastTransferCorrect: boolean | null;
}

export interface StoredReviewLog {
  conceptId: string;
  rating: Grade;
  /** Stato della scheda prima della revisione. */
  state: LearningState;
  reviewedAt: number;
  /** Scadenza precedente. */
  previousDue: number;
  /** Nuova scadenza programmata. */
  nextDue: number;
  stability: number;
  difficulty: number;
  scheduledDays: number;
}

function stateFromName(name: LearningState): State {
  const entry = (Object.entries(STATE_NAMES) as [string, LearningState][]).find(([, n]) => n === name);
  return entry ? (Number(entry[0]) as State) : State.New;
}

function toFsrsCard(card: StoredCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: stateFromName(card.state),
    ...(card.lastReview !== undefined ? { last_review: new Date(card.lastReview) } : {}),
  };
}

export function createCard(conceptId: string, now: number): StoredCard {
  const empty = createEmptyCard(new Date(now));
  return {
    conceptId,
    due: empty.due.getTime(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsedDays: empty.elapsed_days,
    scheduledDays: empty.scheduled_days,
    learningSteps: empty.learning_steps,
    reps: empty.reps,
    lapses: empty.lapses,
    state: 'new',
    learnedAt: now,
    transferAttempts: 0,
    transferSuccesses: 0,
    lastTransferCorrect: null,
  };
}

export interface ReviewOutcome {
  card: StoredCard;
  log: StoredReviewLog;
}

/** Applica una valutazione alla scheda e calcola il prossimo ripasso. */
export function reviewCard(
  card: StoredCard,
  rating: Grade,
  now: number,
  transferCorrect?: boolean,
): ReviewOutcome {
  const { card: next, log } = scheduler.next(toFsrsCard(card), new Date(now), rating);
  const hasTransfer = transferCorrect !== undefined;
  const updated: StoredCard = {
    conceptId: card.conceptId,
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    learningSteps: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    state: STATE_NAMES[next.state],
    lastReview: now,
    learnedAt: card.learnedAt,
    transferAttempts: card.transferAttempts + (hasTransfer ? 1 : 0),
    transferSuccesses: card.transferSuccesses + (transferCorrect ? 1 : 0),
    lastTransferCorrect: hasTransfer ? transferCorrect : card.lastTransferCorrect,
  };
  return {
    card: updated,
    log: {
      conceptId: card.conceptId,
      rating,
      state: STATE_NAMES[log.state],
      reviewedAt: now,
      previousDue: card.due,
      nextDue: updated.due,
      stability: updated.stability,
      difficulty: updated.difficulty,
      scheduledDays: updated.scheduledDays,
    },
  };
}

/** Fine del giorno locale: un ripasso «di oggi» scade entro questa data. */
export function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Il ripasso è previsto per oggi (o è già scaduto). */
export function isDue(card: Pick<StoredCard, 'due'>, now: number): boolean {
  return card.due <= endOfDay(now);
}

/**
 * Un concetto è consolidato solo se la memoria è stabile E l'ultima prova di
 * trasferimento (RICONOSCI) è riuscita: saper ripetere la mossa non basta.
 */
export function isConsolidated(card: StoredCard): boolean {
  return (
    card.state === 'review' &&
    card.stability >= MASTERY_CONFIG.minStabilityDays &&
    card.lastTransferCorrect === true
  );
}
