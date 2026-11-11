import type { Exercise, MoveTaskResult, Uci } from '../../types';
import { parseUci } from '../../utils/chess';
import { isAccepted, type MoveVerdict } from './evaluateMove';

/**
 * Macchina a stati di un compito «trova la mossa» (fasi RICORDA e RICONOSCI).
 *
 * Scala degli aiuti dopo una risposta errata:
 *   1. indizio sulla strategia   2. (eventuale secondo indizio)
 *   3. indicazione del pezzo     4. soluzione spiegata
 * La soluzione non viene mai mostrata al primo errore.
 */

export type Hint =
  | { kind: 'strategy'; text: string }
  /** Indica il pezzo da muovere nel passo corrente. */
  | { kind: 'piece' };

/**
 * Aiuti disponibili in base alla difficoltà dell'esercizio:
 * molti ai livelli bassi, pochi ai livelli alti.
 */
export function hintPlan(exercise: Pick<Exercise, 'hints' | 'difficulty'>): Hint[] {
  const strategy: Hint[] = exercise.hints.map((text) => ({ kind: 'strategy', text }));
  if (exercise.difficulty <= 2) return [...strategy, { kind: 'piece' }];
  if (exercise.difficulty <= 4) return [...strategy.slice(0, 1), { kind: 'piece' }];
  return strategy.slice(0, 1);
}

export type MoveTaskStatus =
  /** In attesa della mossa dell'utente. */
  | 'awaiting'
  /** Mossa errata mostrata sulla scacchiera: l'utente deve annullarla. */
  | 'wrong'
  /** Risolto senza che la soluzione venisse mostrata. */
  | 'solved'
  /** Soluzione mostrata dopo aver esaurito gli aiuti. */
  | 'failed';

export interface MoveTaskState {
  stepIndex: number;
  status: MoveTaskStatus;
  attempts: number;
  wrongAttempts: number;
  /** Numero di aiuti già rivelati (indice nella scala degli aiuti). */
  hintsShown: number;
  /** Ultima mossa errata, mostrata finché non viene annullata. */
  wrongMove?: Uci;
  /** true se almeno una mossa accettata era un'alternativa. */
  usedAlternative: boolean;
}

export type MoveTaskAction =
  | { type: 'move'; uci: Uci; verdict: MoveVerdict }
  | { type: 'undo' }
  | { type: 'hint' };

export function initialMoveTaskState(): MoveTaskState {
  return {
    stepIndex: 0,
    status: 'awaiting',
    attempts: 0,
    wrongAttempts: 0,
    hintsShown: 0,
    usedAlternative: false,
  };
}

export function moveTaskReducer(
  state: MoveTaskState,
  action: MoveTaskAction,
  exercise: Pick<Exercise, 'solution' | 'hints' | 'difficulty'>,
): MoveTaskState {
  const totalHints = hintPlan(exercise).length;

  switch (action.type) {
    case 'move': {
      if (state.status !== 'awaiting' || action.verdict === 'illegal') return state;
      const attempts = state.attempts + 1;
      if (isAccepted(action.verdict)) {
        const isLast = state.stepIndex >= exercise.solution.length - 1;
        return {
          ...state,
          attempts,
          usedAlternative: state.usedAlternative || action.verdict === 'alternative',
          stepIndex: isLast ? state.stepIndex : state.stepIndex + 1,
          status: isLast ? 'solved' : 'awaiting',
          wrongMove: undefined,
        };
      }
      // Errore: se restano aiuti se ne rivela uno, altrimenti si mostra la soluzione.
      const hasMoreHints = state.hintsShown < totalHints;
      return {
        ...state,
        attempts,
        wrongAttempts: state.wrongAttempts + 1,
        hintsShown: hasMoreHints ? state.hintsShown + 1 : state.hintsShown,
        status: hasMoreHints ? 'wrong' : 'failed',
        wrongMove: action.uci,
      };
    }
    case 'undo':
      if (state.status !== 'wrong') return state;
      return { ...state, status: 'awaiting', wrongMove: undefined };
    case 'hint':
      if (state.status !== 'awaiting' || state.hintsShown >= totalHints) return state;
      return { ...state, hintsShown: state.hintsShown + 1 };
  }
}

/** Aiuti attualmente visibili. */
export function visibleHints(state: MoveTaskState, exercise: Pick<Exercise, 'hints' | 'difficulty'>): Hint[] {
  return hintPlan(exercise).slice(0, state.hintsShown);
}

/** Casa del pezzo da muovere, se l'aiuto «pezzo» è già stato rivelato. */
export function hintedSquare(state: MoveTaskState, exercise: Pick<Exercise, 'solution' | 'hints' | 'difficulty'>): string | null {
  const pieceShown = visibleHints(state, exercise).some((h) => h.kind === 'piece');
  const step = exercise.solution[state.stepIndex];
  return pieceShown && step ? parseUci(step.move).from : null;
}

export function canRequestHint(state: MoveTaskState, exercise: Pick<Exercise, 'hints' | 'difficulty'>): boolean {
  return state.status === 'awaiting' && state.hintsShown < hintPlan(exercise).length;
}

export function isFinished(state: MoveTaskState): boolean {
  return state.status === 'solved' || state.status === 'failed';
}

export function toResult(state: MoveTaskState, exerciseId: string, responseMs: number): MoveTaskResult {
  return {
    exerciseId,
    correct: state.status === 'solved',
    attempts: state.attempts,
    mistakes: state.wrongAttempts,
    hintsUsed: state.hintsShown,
    responseMs,
  };
}

/** Classificazione sintetica di un risultato, usata da adattamento e valutazione FSRS. */
export type TaskQuality = 'clean' | 'assisted' | 'failed';

export function taskQuality(result: Pick<MoveTaskResult, 'correct' | 'mistakes' | 'hintsUsed'>): TaskQuality {
  if (!result.correct) return 'failed';
  return result.hintsUsed === 0 && result.mistakes === 0 ? 'clean' : 'assisted';
}
