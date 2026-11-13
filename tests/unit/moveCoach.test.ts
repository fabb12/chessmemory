import { describe, expect, it } from 'vitest';
import { judgeMove, gradeMove } from '../../src/features/analysis/moveCoach';
import type { Analyser, Analysis } from '../../src/features/engine/engine';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const analysis: Analysis = {
  fen: FEN,
  depth: 12,
  bestMove: 'e2e4',
  score: { kind: 'cp', value: 30 },
  lines: [
    { multipv: 1, depth: 12, score: { kind: 'cp', value: 30 }, pv: ['e2e4', 'e7e5'] },
    { multipv: 2, depth: 12, score: { kind: 'cp', value: 25 }, pv: ['d2d4', 'd7d5'] },
    { multipv: 3, depth: 12, score: { kind: 'cp', value: 20 }, pv: ['g1f3', 'g8f6'] },
  ],
};

/** Motore finto: dice che dopo la mossa l'avversario sta meglio di `opponentCp`. */
const engineGiving = (opponentCp: number): Analyser & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    async analyse(fen) {
      calls.push(fen);
      return { fen, depth: 12, bestMove: null, score: { kind: 'cp', value: opponentCp }, lines: [] };
    },
  };
};

describe('giudizio sulla mossa provata', () => {
  it('la mossa migliore non richiede altre analisi', async () => {
    const engine = engineGiving(0);
    const result = await judgeMove(analysis, 'e2e4', engine, 12);
    expect(result).toMatchObject({ grade: 'best', rank: 1, lossCp: 0, san: 'e4', evaluation: '+0,30' });
    expect(engine.calls).toHaveLength(0);
  });

  it('una mossa tra le prime tre è buona e usa il punteggio già calcolato', async () => {
    const engine = engineGiving(0);
    const result = await judgeMove(analysis, 'g1f3', engine, 12);
    expect(result).toMatchObject({ grade: 'good', rank: 3, lossCp: 10 });
    expect(engine.calls).toHaveLength(0);
  });

  it('una mossa fuori dalle migliori viene valutata dal motore, con il segno dell\'avversario', async () => {
    // Dopo f3 il Nero sta meglio di 180: per il Bianco vale −1,80 (un grave errore rispetto a +0,30).
    const engine = engineGiving(180);
    const result = await judgeMove(analysis, 'f2f3', engine, 12);
    expect(engine.calls).toHaveLength(1);
    expect(result?.rank).toBeNull();
    expect(result?.lossCp).toBe(210);
    expect(['mistake', 'blunder']).toContain(result?.grade);
    expect(result?.evaluation).toBe('−1,80');
  });

  it('una mossa quasi equivalente a quella migliore è comunque buona', async () => {
    const engine = engineGiving(-15);
    const result = await judgeMove(analysis, 'b1c3', engine, 12);
    expect(result?.grade).toBe('good');
    expect(result?.lossCp).toBeGreaterThanOrEqual(0);
  });

  it('rifiuta le mosse illegali', async () => {
    expect(await judgeMove(analysis, 'e2e5', engineGiving(0), 12)).toBeNull();
  });

  it('dare matto è sempre la mossa migliore possibile', async () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1';
    const mate: Analysis = {
      fen,
      depth: 12,
      bestMove: 'a1a8',
      score: { kind: 'mate', value: 1 },
      lines: [{ multipv: 1, depth: 12, score: { kind: 'mate', value: 1 }, pv: ['a1a8'] }],
    };
    const result = await judgeMove(mate, 'a1a8', engineGiving(0), 12);
    expect(result?.grade).toBe('best');
    expect(result?.evaluation).toBe('M1');
  });

  it('classifica per perdita di probabilità di vittoria', () => {
    expect(gradeMove(30, 30, 1)).toBe('best');
    expect(gradeMove(30, 10, null)).toBe('good');
    expect(gradeMove(300, -300, null)).toBe('blunder');
  });
});
