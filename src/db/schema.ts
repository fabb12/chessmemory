import type {
  Activity,
  BoardOrientationPreference,
  Category,
  ConceptResult,
  DeclaredLevel,
  SessionItem,
  SessionItemKind,
  ThemePreference,
} from '../types';
import type { AdaptiveState } from '../features/adaptation/difficulty';
import type { LearningState, StoredCard, StoredReviewLog } from '../features/memory/scheduler';
import type { AnalysisDepth } from '../features/engine/engine';
import type { Severity } from '../features/engine/uci';
import type { Uci } from '../types';

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
  /** Profondità dell'analisi con il motore (errori delle partite). */
  analysisDepth: AnalysisDepth;
  /** Nome usato nelle partite (PGN, Lichess, Chess.com): serve a riconoscere il colore. */
  playerName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  boardOrientation: 'auto',
  analysisDepth: 'quick',
  playerName: '',
};

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

// ───────────── I miei errori ─────────────

export type MistakeSource = 'photo' | 'pgn' | 'manual';
export type MistakeResult = 'clean' | 'assisted' | 'failed';

/** Valutazione del motore al momento del salvataggio, dal punto di vista di chi ha sbagliato. */
export interface MistakeEngineInfo {
  depth: number;
  /** Centipedoni (i matti sono convertiti con `scoreToCp`). */
  bestCp: number;
  playedCp: number | null;
}

/**
 * Un errore commesso in una partita reale, trasformato in una scheda di ripasso.
 * Il ripasso chiede di trovare `bestMove` (o una delle `alternatives`) nella
 * posizione `fen`, poi mostra la continuazione e le note dell'utente.
 */
export interface MistakeRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Posizione prima dell'errore (al tratto c'è chi ha sbagliato). */
  fen: string;
  /** Mossa giocata in partita, se nota. */
  playedMove: Uci | null;
  /** Mossa corretta. */
  bestMove: Uci;
  /** Altre mosse accettate nel ripasso (di valore simile secondo il motore). */
  alternatives: Uci[];
  /** Continuazione corretta, a partire da `bestMove` (mosse di entrambi i colori). */
  line: Uci[];
  /** Nota: cosa ho sbagliato. */
  whatWentWrong: string;
  /** Nota: come avrei dovuto proseguire. */
  howToContinue: string;
  /** Concetto della libreria collegato, facoltativo. */
  conceptId: string | null;
  source: MistakeSource;
  photoId: string | null;
  /** Descrizione della partita, ad esempio «Rossi – Bianchi, 2026-11-10». */
  gameInfo: string | null;
  moveNumber: number | null;
  severity: Severity | null;
  engine: MistakeEngineInfo | null;
  /** Scheda FSRS: il campo `conceptId` contiene l'identificativo dell'errore. */
  card: StoredCard;
  reviewCount: number;
  lastResult: MistakeResult | null;
}

/** Foto della scacchiera, compressa in JPEG e salvata solo sul dispositivo. */
export interface PhotoRecord {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
}
