import { describe, expect, it } from 'vitest';
import { changedSquares, placementProblems, placementToRanks, ranksToPlacement } from '../../src/features/assistant/boardReading';

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
