import type { Transition } from '../engine/moveMatcher';
import type { GameMove, ParsedGame } from '../games/pgn';
import type { Side, Uci } from '../../types';

/**
 * Stato del «Tutor delle Grandi Partite»: l'utente rigioca sulla scacchiera
 * reale una partita storica di cui il PGN dà in anticipo tutte le mosse.
 *
 * Validazione locale e istantanea: la mossa vista dalla fotocamera si
 * confronta con quella del Maestro (stringhe UCI, microsecondi). Se coincide
 * la partita avanza; se no si registra la deviazione e si chiede di riportare
 * indietro il pezzo (la fotocamera riconosce anche il ritorno alla posizione).
 */

/** Con quale colore l'utente «indovina» le mosse del Maestro; l'altro colore lo muove su indicazione. */
export type UserSide = Side | 'both';

export interface Deviation {
  uci: Uci;
  san: string;
  /** Posizione sulla scacchiera dopo la mossa sbagliata. */
  fen: string;
}

export interface SessionState {
  /** Mosse del PGN già giocate (0 = posizione iniziale). */
  ply: number;
  /** Posizione attuale secondo la partita. */
  fen: string;
  deviation: Deviation | null;
  /** Mosse del Maestro trovate al primo colpo / tentate. */
  found: number;
  attempted: number;
  /** La mossa attuale ha già avuto un tentativo sbagliato. */
  missedCurrent: boolean;
}

export function startSession(game: ParsedGame, ply = 0): SessionState {
  return { ply, fen: fenAt(game, ply), deviation: null, found: 0, attempted: 0, missedCurrent: false };
}

export function fenAt(game: ParsedGame, ply: number): string {
  return ply === 0 ? game.startFen : (game.moves[ply - 1]?.fen ?? game.startFen);
}

export function expectedMove(game: ParsedGame, state: SessionState): GameMove | null {
  return game.moves[state.ply] ?? null;
}

export function isFinished(game: ParsedGame, state: SessionState): boolean {
  return state.ply >= game.moves.length;
}

/** Tocca all'utente indovinare (true) o deve solo eseguire la mossa indicata (false)? */
export function isGuessTurn(game: ParsedGame, state: SessionState, side: UserSide): boolean {
  const next = expectedMove(game, state);
  return next !== null && (side === 'both' || next.color === side);
}

/** Stessa mossa? (da-a uguali; la promozione conta solo se indicata da entrambe.) */
export function sameMove(a: Uci, b: Uci): boolean {
  if (a.slice(0, 4) !== b.slice(0, 4)) return false;
  const pa = a.slice(4);
  const pb = b.slice(4);
  return !pa || !pb || pa === pb;
}

export type BoardOutcome = { kind: 'match'; move: GameMove; firstTry: boolean } | { kind: 'deviation'; deviation: Deviation } | { kind: 'takeback' } | { kind: 'ignored' };

/**
 * Mossa riconosciuta sulla scacchiera (o scelta a mano). `guess` = la mossa
 * era da indovinare (conta nel punteggio); false = eseguita su indicazione.
 */
export function playOnBoard(
  game: ParsedGame,
  state: SessionState,
  uci: Uci,
  san: string,
  fenAfter: string,
  guess = true,
): { state: SessionState; outcome: BoardOutcome } {
  const expected = expectedMove(game, state);
  if (!expected || state.deviation) return { state, outcome: { kind: 'ignored' } };
  if (sameMove(uci, expected.uci)) {
    const firstTry = !state.missedCurrent;
    return {
      state: {
        ply: state.ply + 1,
        fen: expected.fen,
        deviation: null,
        found: state.found + (guess && firstTry ? 1 : 0),
        attempted: state.attempted + (guess ? 1 : 0),
        missedCurrent: false,
      },
      outcome: { kind: 'match', move: expected, firstTry },
    };
  }
  const deviation = { uci, san, fen: fenAfter };
  return { state: { ...state, deviation, missedCurrent: true }, outcome: { kind: 'deviation', deviation } };
}

/** Il pezzo è tornato indietro: di nuovo la posizione della partita. */
export function takeBack(state: SessionState): SessionState {
  return { ...state, deviation: null };
}

/** Avanza di una mossa senza la fotocamera (correzione manuale). */
export function skipMove(game: ParsedGame, state: SessionState): SessionState {
  const expected = expectedMove(game, state);
  if (!expected) return state;
  return { ...state, ply: state.ply + 1, fen: expected.fen, deviation: null, missedCurrent: false };
}

/** Torna indietro di una mossa (se la fotocamera ne ha accettata una per errore). */
export function undoMove(game: ParsedGame, state: SessionState): SessionState {
  if (state.ply === 0) return { ...state, deviation: null };
  return { ...state, ply: state.ply - 1, fen: fenAt(game, state.ply - 1), deviation: null, missedCurrent: false };
}

/** Posizione che la fotocamera deve aspettarsi sulla scacchiera. */
export function boardFen(state: SessionState): string {
  return state.deviation?.fen ?? state.fen;
}

/** Transizioni in più da riconoscere: dopo una mossa sbagliata, il ritorno alla posizione della partita. */
export function extraTransitions(state: SessionState): Transition[] {
  return state.deviation ? [{ id: 'takeback', fen: state.fen, kind: 'takeback' }] : [];
}

/** Transizione attesa: la mossa del Maestro, oppure il ritorno indietro dopo una deviazione. */
export function preferredTransition(game: ParsedGame, state: SessionState): string | null {
  if (state.deviation) return 'takeback';
  const expected = expectedMove(game, state);
  // Le transizioni legali hanno come id l'UCI (con la promozione, sempre a donna).
  if (!expected) return null;
  return expected.uci.length > 4 ? `${expected.uci.slice(0, 4)}q` : expected.uci;
}
