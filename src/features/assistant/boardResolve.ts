import { Chess } from 'chess.js';
import type { Side } from '../../types';
import { fenToPosition, validatePosition } from '../mistakes/position';
import {
  BOARD_VIEWS,
  changedSquares,
  gridToPlacement,
  placementProblems,
  placementToRanks,
  type BoardView,
} from './boardReading';

/**
 * Dalla lettura grezza della foto alla posizione più credibile.
 *
 * Il riconoscimento visivo sbaglia ogni tanto un pezzo (alfiere/pedone,
 * re/donna…), ma una scacchiera cambia poco tra due letture: una mossa, a volte
 * due. Quindi la lettura viene confrontata con le posizioni RAGGIUNGIBILI con
 * mosse legali da quella precedente (o dalla posizione iniziale): se una di
 * quelle differisce solo di pochissime case, è quella giusta e gli errori di
 * riconoscimento spariscono. In più:
 *  - si ricava il tratto dalla mossa riconosciuta, senza doverlo chiedere;
 *  - se la lettura corrisponde a una posizione nota solo ruotando la foto,
 *    l'orientamento sbagliato viene corretto.
 */

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Massimo di case diverse dalla posizione legale più vicina perché la si adotti. */
const TOLERANCE = [3, 3, 2] as const;
/** Massimo di semimosse tra la posizione precedente e quella letta. */
const MAX_PLIES = 2;

export interface ReadingReference {
  /** Posizione precedente (FEN completa, con il tratto). */
  fen: string;
  /** Corretta a mano dall'utente: una lettura diversa non la sostituisce, a meno di una mossa legale. */
  locked: boolean;
}

interface Candidate {
  flat: string;
  placement: string;
  turn: Side;
  plies: number;
  san: string[];
  /** Posizione ottenuta ipotizzando che il tratto fosse dell'altro colore. */
  flipped: boolean;
  source: 'reference' | 'start';
}

const flatOf = (placement: string): string => placementToRanks(placement).join('');

/** Tutte le posizioni raggiungibili con al massimo `maxPlies` semimosse legali (la partenza compresa). */
function reachable(fen: string, source: Candidate['source'], flipped: boolean, maxPlies: number): Candidate[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const found = new Map<string, Candidate>();
  const record = (plies: number, san: string[]) => {
    const [placement = '', turn = 'w'] = chess.fen().split(' ');
    const key = `${placement} ${turn}`;
    const known = found.get(key);
    if (known && known.plies <= plies) return;
    found.set(key, { flat: flatOf(placement), placement, turn: turn as Side, plies, san, flipped, source });
  };
  const walk = (plies: number, san: string[]) => {
    record(plies, san);
    if (plies === maxPlies) return;
    for (const move of chess.moves({ verbose: true })) {
      chess.move(move);
      walk(plies + 1, [...san, move.san]);
      chess.undo();
    }
  };
  walk(0, []);
  return [...found.values()];
}

/** Stessa posizione con il tratto passato all'altro colore (se resta una posizione valida). */
function withTurnFlipped(fen: string): string | null {
  const fields = fen.split(' ');
  fields[1] = fields[1] === 'w' ? 'b' : 'w';
  fields[3] = '-';
  const flipped = fields.join(' ');
  try {
    const chess = new Chess(flipped);
    // Se chi non dovrebbe muovere è sotto scacco, il re sarebbe catturabile: tratto impossibile.
    return chess.moves().length > 0 ? flipped : null;
  } catch {
    return null;
  }
}

let startCache: Candidate[] | null = null;
let referenceCache: { fen: string; list: Candidate[] } | null = null;

function startCandidates(): Candidate[] {
  startCache ??= reachable(START_FEN, 'start', false, MAX_PLIES);
  return startCache;
}

function referenceCandidates(reference: ReadingReference): Candidate[] {
  if (referenceCache?.fen === reference.fen) return referenceCache.list;
  const list = reachable(reference.fen, 'reference', false, MAX_PLIES);
  const flipped = withTurnFlipped(reference.fen);
  // Il tratto della posizione precedente è spesso solo un'ipotesi: si prova anche l'altro colore.
  if (flipped) list.push(...reachable(flipped, 'reference', true, MAX_PLIES));
  referenceCache = { fen: reference.fen, list };
  return list;
}

function mismatch(a: string, b: string, limit: number): number {
  let n = 0;
  for (let i = 0; i < 64; i++) {
    if (a[i] !== b[i] && ++n > limit) return n;
  }
  return n;
}

interface Fit {
  candidate: Candidate;
  mismatch: number;
  cost: number;
}

/** Posizione legale più vicina alla lettura (entro la tolleranza), o null. */
function bestFit(flat: string, candidates: readonly Candidate[]): Fit | null {
  let best: Fit | null = null;
  for (const candidate of candidates) {
    const tolerance = TOLERANCE[candidate.plies] ?? 0;
    const diff = mismatch(flat, candidate.flat, tolerance);
    if (diff > tolerance) continue;
    // Ogni casa sbagliata pesa più di una semimossa: si preferisce la spiegazione più semplice.
    const cost = 2 * diff + candidate.plies + (candidate.flipped ? 0.5 : 0) + (candidate.source === 'start' ? 0.25 : 0);
    if (!best || cost < best.cost) best = { candidate, mismatch: diff, cost };
  }
  return best;
}

/** Il tratto compatibile con la posizione: se uno dei due re è sotto scacco, muove chi lo subisce. */
export function inferTurn(placement: string, preferred: Side): Side {
  const plausible = (turn: Side): boolean => {
    const position = fenToPosition(`${placement} ${turn} -`);
    return position !== null && validatePosition(position) === null;
  };
  if (plausible(preferred)) return preferred;
  const other: Side = preferred === 'w' ? 'b' : 'w';
  return plausible(other) ? other : preferred;
}

export interface ResolveInput {
  /** Griglia letta, come appare nella foto. */
  grid: readonly string[];
  /** Orientamento dichiarato da Claude. */
  claimedView: BoardView;
  /** Orientamento imposto dall'utente: se presente non viene mai cambiato. */
  forcedView?: BoardView | null;
  /** Posizione precedente, se nota. */
  reference?: ReadingReference | null;
  /** Lettura grezza precedente (per riconoscere una lettura stabile). */
  lastRawPlacement?: string | null;
}

export interface ResolvedReading {
  placement: string;
  /** Tratto dedotto dalla mossa riconosciuta; null se non si può dedurre. */
  turn: Side | null;
  view: BoardView;
  /** Disposizione letta senza alcuna correzione, con l'orientamento scelto. */
  rawPlacement: string;
  /** Case sistemate in base alle mosse legali. */
  corrected: string[];
  /** Mosse (SAN) trovate rispetto alla posizione di riferimento. */
  moves: string[];
  /** Problemi della posizione risultante (vuoto = plausibile). */
  problems: string[];
}

export function resolveReading(input: ResolveInput): ResolvedReading {
  const order: BoardView[] = input.forcedView
    ? [input.forcedView]
    : [input.claimedView, ...BOARD_VIEWS.filter((v) => v !== input.claimedView)];
  const reference = input.reference ?? null;
  const candidates = [...(reference ? referenceCandidates(reference) : []), ...startCandidates()];

  let chosen: { view: BoardView; placement: string; fit: Fit | null } | null = null;
  for (const view of order) {
    const placement = gridToPlacement(input.grid, view);
    if (!placement) continue;
    const fit = bestFit(flatOf(placement), candidates);
    if (!chosen) {
      chosen = { view, placement, fit };
      continue;
    }
    // Un altro orientamento sostituisce quello dichiarato solo se spiega la foto molto meglio.
    if (fit && (!chosen.fit || fit.cost + 1 < chosen.fit.cost)) chosen = { view, placement, fit };
  }
  if (!chosen) {
    // Griglia non valida (non dovrebbe succedere: viene verificata a monte).
    return { placement: '8/8/8/8/8/8/8/8', turn: null, view: order[0] ?? 'bottom', rawPlacement: '8/8/8/8/8/8/8/8', corrected: [], moves: [], problems: ['empty'] };
  }

  const raw = chosen.placement;
  const fit = chosen.fit;
  const rawProblems = placementProblems(raw);

  let placement = raw;
  let turn: Side | null = null;
  let corrected: string[] = [];
  let moves: string[] = [];

  if (fit) {
    // Due letture uguali di seguito che differiscono dalla posizione precedente: quella era sbagliata
    // (a meno che non l'abbia corretta a mano l'utente: allora vale solo una mossa legale).
    const stable = fit.mismatch > 0 && rawProblems.length === 0 && input.lastRawPlacement === raw && !reference?.locked;
    if (!stable) {
      placement = fit.candidate.placement;
      turn = fit.candidate.turn;
      corrected = fit.mismatch > 0 ? changedSquares(raw, placement) : [];
      moves = fit.candidate.san;
    }
  }
  return { placement, turn, view: chosen.view, rawPlacement: raw, corrected, moves, problems: placementProblems(placement) };
}
