import { Chess } from 'chess.js';
import type { Uci } from '../../types';
import type { SquareOccupancy } from '../vision/occupancy';
import { appearanceFromFen, coverage, FOOTPRINTS, type BoardGeometry, type FootprintName } from '../vision/perspective';

export type { BoardGeometry } from '../vision/perspective';

/**
 * Riconoscimento della mossa basato sullo stato («state-based move tracking»).
 *
 * Non si chiede alla visione di riconoscere 12 tipi di pezzo su 64 case:
 * l'app conosce già la posizione. Basta sapere QUALI case sono cambiate (e,
 * se disponibile, se ora sono vuote, con un pezzo bianco o con un pezzo nero)
 * e cercare, tra le posizioni raggiungibili, quella che spiega esattamente
 * quei cambiamenti. Le posizioni candidate sono di solito le mosse legali di
 * chess.js (2 case per mosse e catture, 3 per l'en passant, 4 per l'arrocco),
 * ma possono essere anche altre transizioni note, come «riporta indietro la
 * mossa sbagliata». La confusione pedone/alfiere sparisce: il tipo di pezzo
 * lo dice la regola, non l'immagine.
 */

export interface Transition {
  id: string;
  /** Posizione dopo la transizione. */
  fen: string;
  kind: 'move' | 'takeback';
  uci?: Uci;
  san?: string;
}

export interface RankedTransition {
  transition: Transition;
  /** Case che cambiano con questa transizione. */
  touched: string[];
  /** Intensità del cambiamento che spiega meglio l'osservazione (circa 1 = case del tutto coperte/scoperte). */
  scale: number;
  /** Parte dei cambiamenti osservati NON spiegata (0 = spiegati tutti, 1 = nessuno). */
  error: number;
  /** Accordo con il classificatore vuota/bianco/nero (positivo = d'accordo). */
  occupancy: number;
}

export type MatchResult =
  | { kind: 'none' }
  | { kind: 'match'; transition: Transition; ranked: RankedTransition[]; viaPreferred: boolean; footprint: FootprintName | null }
  | { kind: 'unsure'; reason: 'weak' | 'ambiguous' | 'other-changes'; ranked: RankedTransition[]; footprint: FootprintName | null };

/** Sotto questo cambiamento (0–255, al netto del rumore) nessuna casa è davvero cambiata. */
export const CHANGE_MIN = 10;
/**
 * Cambiamento (0–255) oltre il quale una casa si considera del tutto cambiata.
 * Il contrasto varia molto (pezzo nero su casa chiara: enorme; pezzo bianco su
 * casa chiara: piccolo): i cambiamenti si saturano a questo valore, così conta
 * QUALI case cambiano, non quanto è forte il contrasto.
 */
export const SATURATION = 30;
/** La scala di cambiamento che spiega l'osservazione deve essere almeno questa (0–1). */
export const MIN_SCALE = 0.35;
/** Oltre questa parte di cambiamenti non spiegati la transizione non convince. */
export const MAX_ERROR = 0.5;
/** Distacco minimo (in errore) tra la migliore e la seconda. */
export const MIN_MARGIN = 0.1;
/** Peso dell'accordo con il classificatore a 3 classi. */
const OCCUPANCY_WEIGHT = 0.15;

const FILES = 'abcdefgh';

function pieceMap(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  const rows = (fen.split(' ')[0] ?? '').split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r] ?? '') {
      if (/\d/.test(ch)) f += Number(ch);
      else out.set(`${FILES[f++]}${8 - r}`, ch);
    }
  }
  return out;
}

/** Case in cui la disposizione dei pezzi è diversa tra due posizioni. */
export function touchedSquares(fromFen: string, toFen: string): string[] {
  const a = pieceMap(fromFen);
  const b = pieceMap(toFen);
  const out: string[] = [];
  for (let r = 1; r <= 8; r++) {
    for (const f of FILES) {
      const sq = `${f}${r}`;
      if (a.get(sq) !== b.get(sq)) out.push(sq);
    }
  }
  return out;
}

/** Le mosse legali come transizioni (una per coppia partenza-arrivo: nelle promozioni la donna). */
export function legalTransitions(fen: string): Transition[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const byKey = new Map<string, Transition>();
  for (const move of chess.moves({ verbose: true })) {
    const key = `${move.from}${move.to}`;
    if (byKey.has(key) && move.promotion !== 'q') continue;
    byKey.set(key, { id: `${key}${move.promotion ?? ''}`, fen: move.after, kind: 'move', uci: `${key}${move.promotion ?? ''}`, san: move.san });
  }
  return [...byKey.values()];
}

export interface MatchInput {
  fen: string;
  candidates: readonly Transition[];
  /** Quanto è cambiata ogni casa rispetto al fotogramma della posizione `fen`. */
  changes: Map<string, number>;
  /** Classe vuota/bianco/nero di ogni casa nel fotogramma nuovo, se disponibile. */
  occupancy?: Map<string, SquareOccupancy> | null;
  /** Transizione attesa (es. la mossa del Maestro): vince se spiega i cambiamenti quasi quanto la migliore. */
  preferred?: string | null;
  /** Prospettiva: senza, si assume la scacchiera vista dall'alto (ogni pezzo copre solo la sua casa). */
  geometry?: BoardGeometry | null;
}

const ALL_SQUARES: string[] = [];
for (let r = 1; r <= 8; r++) for (const f of FILES) ALL_SQUARES.push(`${f}${r}`);

/** Cambiamento previsto (0–1) di ogni casa passando da `fromFen` a `toFen`. */
export function predictedChanges(fromFen: string, toFen: string, geometry: BoardGeometry | null | undefined): Map<string, number> {
  const a = coverage(fromFen, geometry);
  const b = coverage(toFen, geometry);
  const out = new Map<string, number>();
  for (const sq of ALL_SQUARES) {
    const d = Math.abs((a.white.get(sq) ?? 0) - (b.white.get(sq) ?? 0)) + Math.abs((a.black.get(sq) ?? 0) - (b.black.get(sq) ?? 0));
    out.set(sq, Math.min(1, d));
  }
  return out;
}

/** Cambiamenti osservati al netto del rumore di fondo (la mediana: quasi tutte le case non cambiano). */
function denoised(changes: Map<string, number>): Map<string, number> {
  const values = [...changes.values()].sort((a, b) => a - b);
  const floor = values[Math.floor(values.length / 2)] ?? 0;
  const out = new Map<string, number>();
  for (const [sq, v] of changes) out.set(sq, Math.max(0, v - floor));
  return out;
}

function saturated(changes: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [sq, v] of denoised(changes)) out.set(sq, Math.min(1, v / SATURATION));
  return out;
}

export function rankTransitions({ fen, candidates, changes, occupancy, geometry }: MatchInput): RankedTransition[] {
  const observed = saturated(changes);
  let energy = 0;
  for (const v of observed.values()) energy += v * v;
  return candidates
    .map((transition) => {
      const predicted = predictedChanges(fen, transition.fen, geometry);
      // Scala che spiega meglio l'osservazione (minimi quadrati), poi la parte non spiegata.
      let dot = 0;
      let norm = 0;
      for (const sq of ALL_SQUARES) {
        const p = predicted.get(sq) ?? 0;
        dot += p * (observed.get(sq) ?? 0);
        norm += p * p;
      }
      const scale = norm > 0 ? Math.max(0, dot / norm) : 0;
      let residual = 0;
      for (const sq of ALL_SQUARES) residual += ((observed.get(sq) ?? 0) - scale * (predicted.get(sq) ?? 0)) ** 2;
      let error = energy > 0 ? residual / energy : 1;
      let agreement = 0;
      const touched = touchedSquares(fen, transition.fen);
      if (occupancy) {
        // Si confronta ciò che si dovrebbe VEDERE (impronta compresa) sulle case che cambiano.
        const expected = appearanceFromFen(transition.fen, geometry);
        const before = appearanceFromFen(fen, geometry);
        const watched = ALL_SQUARES.filter((sq) => expected.get(sq) !== before.get(sq));
        for (const sq of watched) {
          const seen = occupancy.get(sq);
          if (!seen || seen.confidence < 0.2) continue;
          agreement += seen.occupant === expected.get(sq) ? seen.confidence : -seen.confidence;
        }
        agreement /= Math.max(1, watched.length);
        error -= OCCUPANCY_WEIGHT * agreement;
      }
      return { transition, touched, scale, error, occupancy: agreement };
    })
    .sort((a, b) => a.error - b.error);
}

/**
 * Con la prospettiva si provano le diverse impronte (fotocamera dall'alto,
 * inclinata, molto inclinata) e si tiene quella la cui transizione migliore
 * spiega meglio i cambiamenti.
 */
function rankWithBestFootprint(input: MatchInput): { ranked: RankedTransition[]; footprint: FootprintName | null } {
  if (!input.geometry) return { ranked: rankTransitions(input), footprint: null };
  let best: { ranked: RankedTransition[]; footprint: FootprintName | null } | null = null;
  for (const name of Object.keys(FOOTPRINTS) as FootprintName[]) {
    const ranked = rankTransitions({ ...input, geometry: { ...input.geometry, footprint: FOOTPRINTS[name] } });
    if (!best || (ranked[0]?.error ?? 1) < (best.ranked[0]?.error ?? 1)) best = { ranked, footprint: name };
  }
  return best!;
}

/** Decide quale transizione spiega i cambiamenti, oppure che non è cambiato nulla, oppure che non è sicuro. */
export function matchTransition(input: MatchInput): MatchResult {
  const strongest = Math.max(0, ...denoised(input.changes).values());
  if (strongest < CHANGE_MIN) return { kind: 'none' };
  const { ranked, footprint } = rankWithBestFootprint(input);
  const best = ranked[0];
  if (!best) return { kind: 'unsure', reason: 'weak', ranked, footprint };
  // Mossa attesa: basta che spieghi i cambiamenti quasi quanto la migliore (validazione istantanea).
  if (input.preferred) {
    const preferred = ranked.find((r) => r.transition.id === input.preferred);
    if (preferred && preferred.scale >= 0.8 * MIN_SCALE && preferred.error <= MAX_ERROR && preferred.error <= best.error + 0.08) {
      return { kind: 'match', transition: preferred.transition, ranked, viaPreferred: preferred !== best, footprint };
    }
  }
  if (best.scale < MIN_SCALE) return { kind: 'unsure', reason: 'weak', ranked, footprint };
  if (best.error > MAX_ERROR) return { kind: 'unsure', reason: 'other-changes', ranked, footprint };
  const second = ranked[1];
  if (second && second.error - best.error < MIN_MARGIN) return { kind: 'unsure', reason: 'ambiguous', ranked, footprint };
  return { kind: 'match', transition: best.transition, ranked, viaPreferred: false, footprint };
}
