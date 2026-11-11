/** Tipi di dominio condivisi da dataset, logica didattica e persistenza. */

/** Le quattro categorie del profilo Memory DNA. */
export type Category = 'openings' | 'tactics' | 'strategy' | 'calculation';

export const CATEGORIES: readonly Category[] = ['openings', 'tactics', 'strategy', 'calculation'];

/** Difficoltà didattica (non è un rating Elo). */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type Side = 'w' | 'b';

/** Mossa in notazione UCI, es. "g1f3" o "e7e8q". */
export type Uci = string;

export interface SolutionStep {
  /** Mossa preferita. */
  move: Uci;
  /** Mosse alternative esplicitamente accettate per questo passo. */
  alternatives?: Uci[];
  /** Risposta dell'avversario giocata automaticamente dopo la mossa (sequenze). */
  reply?: Uci;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface ComprehensionQuestion {
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
}

/** Verifica semantica automatica eseguita dai test sul dataset. */
export type ExpectedOutcome = 'checkmate' | 'check' | 'capture' | 'castle' | 'promotion-race';

export interface Exercise {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  conceptId: string;
  /** Posizione iniziale. */
  fen: string;
  sideToMove: Side;
  /** Una o più mosse del giocatore (con eventuali risposte avversarie). */
  solution: SolutionStep[];
  /** Fase OSSERVA: obiettivo concreto della mossa. */
  goal: string;
  /** Fase OSSERVA: minacce o debolezze da considerare. */
  watchOut: string;
  /** Spiegazione completa mostrata dopo la risposta. */
  explanation: string;
  /** Indizi strategici progressivi (l'indicazione del pezzo è generata dalla mossa). */
  hints: string[];
  question: ComprehensionQuestion;
  /** Esercizio che applica lo stesso principio in una posizione diversa. */
  transferExerciseId?: string;
  /** Esito atteso dell'ultima mossa della soluzione, verificato dai test. */
  expect?: ExpectedOutcome;
}

export interface Concept {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  /** Descrizione breve per la libreria. */
  summary: string;
  /** Principio strategico applicato (fase OSSERVA). */
  principle: string;
  /** Consegna mostrata nelle fasi RICORDA e RICONOSCI per i concetti non forzati. */
  taskPrompt: string;
}

export type DeclaredLevel = 'beginner' | 'intermediate' | 'unsure';

export type Activity = 'recall' | 'explain' | 'transfer' | 'placement';

/** Esito di un compito di mossa. */
export interface MoveTaskResult {
  exerciseId: string;
  /** true se risolto senza che la soluzione venisse mostrata. */
  correct: boolean;
  /** Numero di tentativi (mosse provate, comprese quelle errate). */
  attempts: number;
  /** Mosse errate giocate prima della soluzione. */
  mistakes: number;
  hintsUsed: number;
  responseMs: number;
}

export interface QuestionResult {
  exerciseId: string;
  correct: boolean;
  selectedOptionId: string;
  responseMs: number;
}

export type SessionItemKind = 'review' | 'weakness' | 'new';

export interface SessionItem {
  conceptId: string;
  kind: SessionItemKind;
  /** Esercizio per OSSERVA / RICORDA / SPIEGA. */
  exerciseId: string;
  /** Esercizio per RICONOSCI (posizione diversa, stesso principio). */
  transferExerciseId?: string;
}

/** Risultato completo di un concetto all'interno di una sessione. */
export interface ConceptResult {
  conceptId: string;
  kind: SessionItemKind;
  recall: MoveTaskResult;
  explain: QuestionResult;
  transfer?: MoveTaskResult;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type BoardOrientationPreference = 'auto' | 'white' | 'black';
