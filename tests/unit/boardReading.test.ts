import { describe, expect, it } from 'vitest';
import {
  BOARD_VIEWS,
  changedSquares,
  countPieces,
  gridToRanks,
  nextView,
  normalizeGrid,
  placementProblems,
  placementToRanks,
  ranksToGrid,
  ranksToPlacement,
} from '../../src/features/assistant/boardReading';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

describe('lettura della scacchiera: controlli locali', () => {
  it('converte le traverse in FEN e ritorno', () => {
    const ranks = placementToRanks(START);
    expect(ranks).toHaveLength(8);
    expect(ranks[2]).toBe('........');
    expect(ranksToPlacement(ranks)).toBe(START);
    expect(ranksToPlacement(['r..qk..r', 'pp1-_ ppp'.replace(' ', ''), ...placementToRanks(START).slice(2)])).toBe(
      'r2qk2r/pp3ppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    );
  });

  it('rifiuta traverse di lunghezza sbagliata o con caratteri strani', () => {
    expect(ranksToPlacement(placementToRanks(START).slice(0, 7))).toBeNull();
    expect(ranksToPlacement(['rnbqkbn', ...placementToRanks(START).slice(1)])).toBeNull();
    expect(ranksToPlacement(['rnbqkbnx', ...placementToRanks(START).slice(1)])).toBeNull();
  });

  it('trova le posizioni impossibili', () => {
    expect(placementProblems(START)).toEqual([]);
    expect(placementProblems('rnbqqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toEqual(['Black has 0 kings (must be exactly 1)']);
    expect(placementProblems('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKKBNR').join()).toMatch(/White has 2 kings/);
    expect(placementProblems('rnbqkbnr/pppppppp/8/8/8/P7/PPPPPPPP/RNBQKBNR').join()).toMatch(/9 pawns/);
    expect(placementProblems('Pnbqkbnr/1ppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR').join()).toMatch(/rank 1 or rank 8/);
  });

  it('elenca le case cambiate dopo una mossa', () => {
    expect(changedSquares(START, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')).toEqual(['e4', 'e2']);
  });
});

describe('orientamento della foto', () => {
  const MIDGAME = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R';

  /** Ruota la griglia di 90° in senso orario, come farebbe una foto scattata da un altro lato. */
  const clockwise = (g: string[]) => g[0]!.split('').map((_, j) => g.map((row) => row[j]).reverse().join(''));

  it('la griglia con il Bianco in basso coincide con le traverse', () => {
    const ranks = placementToRanks(MIDGAME);
    expect(gridToRanks(ranks, 'bottom')).toEqual(ranks);
    expect(ranksToGrid(ranks, 'bottom')).toEqual(ranks);
  });

  it('riporta al punto di vista del Bianco una foto scattata da qualunque lato', () => {
    const ranks = placementToRanks(MIDGAME);
    // Bianco in basso → ruotando la foto in senso orario il Bianco finisce a sinistra, poi in alto, poi a destra.
    const left = clockwise(ranks);
    const top = clockwise(left);
    const right = clockwise(top);
    expect(gridToRanks(left, 'left')).toEqual(ranks);
    expect(gridToRanks(top, 'top')).toEqual(ranks);
    expect(gridToRanks(right, 'right')).toEqual(ranks);
    for (const view of BOARD_VIEWS) expect(gridToRanks(ranksToGrid(ranks, view), view)).toEqual(ranks);
  });

  it('con il Bianco a sinistra la prima traversa è il bordo sinistro e la colonna a è in alto', () => {
    // Re bianco in e1 e donna nera in a8: nella foto con il Bianco a sinistra e1 sta a sinistra (colonna 0), 5ª riga dall'alto.
    const ranks = placementToRanks('q7/8/8/8/8/8/8/4K3');
    const grid = ranksToGrid(ranks, 'left');
    expect(grid[4]![0]).toBe('K');
    expect(grid[0]![7]).toBe('q');
  });

  it('un orientamento sbagliato dà una posizione diversa', () => {
    const ranks = placementToRanks(MIDGAME);
    expect(gridToRanks(ranks, 'top')).not.toEqual(ranks);
  });

  it('ruota gli orientamenti in ciclo e conta i pezzi', () => {
    expect(nextView('bottom')).toBe('top');
    expect(nextView('right')).toBe('bottom');
    expect(countPieces(placementToRanks(START))).toEqual({ white: 16, black: 16 });
  });

  it('normalizza la griglia: 8 righe da 8 caratteri', () => {
    expect(normalizeGrid(placementToRanks(START))).toHaveLength(8);
    expect(normalizeGrid(['rnbqkbnr'])).toBeNull();
    expect(normalizeGrid([...placementToRanks(START).slice(0, 7), 12 as unknown as string])).toBeNull();
    expect(normalizeGrid([...placementToRanks(START).slice(0, 7), 'RNBQKBN'])).toBeNull();
  });
});
