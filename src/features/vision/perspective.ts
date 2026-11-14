import type { BoardView } from '../assistant/boardReading';
import { cellToSquare } from './geometry';
import type { Occupant } from './occupancy';

/**
 * Prospettiva: inquadrata di sbieco (~45°), ogni pezzo copre nell'immagine la
 * propria casa e, salendo, anche le case DIETRO (più lontane dalla fotocamera).
 * Invece di ignorarlo, il riconoscimento lo prevede: dalla FEN si calcola che
 * cosa copre ogni casa (l'«impronta» dei pezzi) e quindi che cosa deve
 * cambiare nell'immagine con ciascuna mossa. Un pezzo alto davanti che resta
 * fermo copre la casa dietro prima e dopo: nessun cambiamento previsto, e
 * nessuna confusione.
 */

export interface BoardGeometry {
  /** La casa `k` righe più lontana dalla fotocamera rispetto a `square` (stessa colonna dell'immagine). */
  behind: (square: string, k: number) => string | null;
  /** Quanto un pezzo copre la propria casa e le case dietro (dipende da inclinazione e altezza dei pezzi). */
  footprint?: readonly number[];
}

/**
 * Impronte possibili: fotocamera quasi dall'alto (ogni pezzo copre solo la sua
 * casa), inclinata, molto inclinata (~45° con pezzi alti). Il matcher prova
 * tutte e tiene quella che spiega meglio ciò che vede.
 */
export const FOOTPRINTS = {
  flat: [1],
  tilted: [1, 0.6],
  steep: [1, 0.85, 0.35],
} as const satisfies Record<string, readonly number[]>;
export type FootprintName = keyof typeof FOOTPRINTS;
export const FOOTPRINT = FOOTPRINTS.steep;

const FILES = 'abcdefgh';

/** Geometria per un orientamento: la riga 0 del quadrato raddrizzato è il lato lontano. */
export function geometryForView(view: BoardView, footprint: FootprintName = 'steep'): BoardGeometry {
  const cells = new Map<string, { i: number; j: number }>();
  const squares: string[][] = [];
  for (let i = 0; i < 8; i++) {
    squares.push([]);
    for (let j = 0; j < 8; j++) {
      const sq = cellToSquare(i, j, view);
      cells.set(sq, { i, j });
      squares[i]!.push(sq);
    }
  }
  return {
    footprint: FOOTPRINTS[footprint],
    behind: (square, k) => {
      const cell = cells.get(square);
      if (!cell || cell.i - k < 0) return null;
      return squares[cell.i - k]![cell.j] ?? null;
    },
  };
}

function pieces(fen: string): [string, string][] {
  const out: [string, string][] = [];
  const rows = (fen.split(' ')[0] ?? '').split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r] ?? '') {
      if (/\d/.test(ch)) f += Number(ch);
      else out.push([`${FILES[f++]}${8 - r}`, ch]);
    }
  }
  return out;
}

/** Copertura prevista di ogni casa da parte dei pezzi bianchi e neri. Senza geometria: solo la propria casa. */
export function coverage(fen: string, geometry: BoardGeometry | null | undefined): { white: Map<string, number>; black: Map<string, number> } {
  const white = new Map<string, number>();
  const black = new Map<string, number>();
  for (const [square, piece] of pieces(fen)) {
    const target = piece === piece.toUpperCase() ? white : black;
    (geometry?.footprint ?? FOOTPRINT).forEach((weight, k) => {
      const sq = k === 0 ? square : (geometry?.behind(square, k) ?? null);
      if (sq) target.set(sq, Math.max(target.get(sq) ?? 0, weight));
    });
  }
  return { white, black };
}

/**
 * Che cosa si vede nella finestra di ogni casa: il colore del pezzo che la
 * copre di più (il proprio, o quello davanti che sale), oppure la casa vuota.
 */
export function appearanceFromFen(fen: string, geometry: BoardGeometry | null | undefined): Map<string, Occupant> {
  const { white, black } = coverage(fen, geometry);
  const out = new Map<string, Occupant>();
  for (let r = 1; r <= 8; r++) {
    for (const f of FILES) {
      const sq = `${f}${r}`;
      const w = white.get(sq) ?? 0;
      const b = black.get(sq) ?? 0;
      out.set(sq, Math.max(w, b) < 0.5 ? 'empty' : w >= b ? 'white' : 'black');
    }
  }
  return out;
}
