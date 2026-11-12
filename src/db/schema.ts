import type {
  Activity,
  BoardOrientationPreference,
  Category,
  ConceptResult,
  DeclaredLevel,
  SessionItem,
  SessionItemKind,
  ThemePreference,
  WrongMove,
} from '../types';
import type { AdaptiveState } from '../features/adaptation/difficulty';
import type { LearningState, StoredCard, StoredReviewLog } from '../features/memory/scheduler';

export const PROFILE_ID = 'local';
export const ACTIVE_SESSION_ID = 'current';

export interface Streak {
  current: number;
  best: number;
  /** Ultimo giorno di allenamento, formato locale YYYY-MM-DD. */
  lastActiveDay: string | null;
}

export interface Settings {
  theme: ThemePreference;
  boardOrientation: BoardOrientationPreference;
}

export interface Profile {
  id: typeof PROFILE_ID;
  /** Identificativo locale casuale: non contiene dati personali. */
  userId: string;
  declaredLevel: DeclaredLevel | null;
  placementDone: boolean;
  adaptive: AdaptiveState;
  settings: Settings;
  streak: Streak;
  lastCategory: Category | null;
  createdAt: number;
}

/** Una risposta dell'utente (riga della cronologia). */
export interface AttemptRecord {
  id?: number;
  userId: string;
  sessionId: string;
  conceptId: string;
  exerciseId: string;
  category: Category;
  activity: Activity;
  correct: boolean;
  attempts: number;
  hintsUsed: number;
  responseMs: number;
  /** Mosse errate (solo RICORDA/RICONOSCI; assente nei dati più vecchi). */
  wrongMoves?: WrongMove[];
  answeredAt: number;
  /** Prossimo ripasso programmato per il concetto (null nella valutazione iniziale). */
  nextReviewAt: number | null;
  /** Valutazione di memorizzazione FSRS 1–4 assegnata al concetto. */
  rating: number | null;
  learningState: LearningState | null;
}

export interface ReviewLogRecord extends StoredReviewLog {
  id?: number;
  userId: string;
}

export interface SessionItemSummary {
  conceptId: string;
  kind: SessionItemKind;
  rating: number;
  score: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  startedAt: number;
  finishedAt: number;
  items: SessionItemSummary[];
  correctAnswers: number;
  totalAnswers: number;
  hintsUsed: number;
  reviewedConcepts: number;
  newConcepts: number;
}

export interface ActiveSession {
  id: typeof ACTIVE_SESSION_ID;
  sessionId: string;
  startedAt: number;
  /** Livello didattico all'inizio della sessione (per segnalare i cambi). */
  levelAtStart: number;
  items: SessionItem[];
  results: ConceptResult[];
  summaries: SessionItemSummary[];
}

export type { StoredCard };
