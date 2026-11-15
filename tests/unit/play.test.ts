import { describe, expect, it } from 'vitest';
import type { Analysis } from '../../src/features/engine/engine';
import { explainAiMove, explainUserMove, plyOf } from '../../src/features/play/coach';
import { pickAiMove, PLAY_LEVELS, suggestedLevel } from '../../src/features/play/levels';

const analysis = (fen: string, lines: [string[], number | { mate: number }][]): Analysis => {
  const conv = (s: number | { mate: number }) => (typeof s === 'number' ? { kind: 'cp' as const, value: s } : { kind: 'mate' as const, value: s.mate });
  return {
    fen,
    depth: 12,
    bestMove: lines[0]?.[0][0] ?? null,
    score: conv(lines[0]?.[1] ?? 0),
    lines: lines.map(([pv, s], i) => ({ multipv: i + 1, depth: 12, score: conv(s), pv })),
  };
};

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('livelli dell’AI', () => {
  const start = analysis(START, [[['e2e4'], 40], [['d2d4'], 35], [['g1f3'], 30], [['a2a3'], -60], [['g2g4'], -300]]);

  it('l’esperto gioca sempre la mossa migliore', () => {
    for (let i = 0; i < 20; i++) expect(pickAiMove(start, PLAY_LEVELS[5])).toBe('e2e4');
  });

  it('l’avanzato resta entro una piccola perdita', () => {
    const seen = new Set<string>();
    for (const r of [0, 0.3, 0.6, 0.99]) seen.add(pickAiMove(start, PLAY_LEVELS[4], seq(r))!);
    expect([...seen].every((m) => ['e2e4', 'd2d4', 'g1f3'].includes(m))).toBe(true);
  });

  it('il principiante a volte si distrae con una mossa qualsiasi', () => {
    const move = pickAiMove(start, PLAY_LEVELS[1], seq(0.01, 0.5));
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8]$/);
  });

  it('dal livello 2 un matto in una mossa non sfugge', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const a = analysis(fen, [[['a1a8'], { mate: 1 }], [['g1f1'], 0]]);
    expect(pickAiMove(a, PLAY_LEVELS[2], seq(0))).toBe('a1a8');
  });

  it('il livello proposto tiene conto del profilo', () => {
    expect(suggestedLevel(1, 'beginner')).toBe(1);
    expect(suggestedLevel(1, 'intermediate')).toBe(3);
    expect(suggestedLevel(4, null)).toBe(4);
  });
});

describe('tutor nella partita contro l’AI', () => {
  it('conta le semimosse dal FEN', () => {
    expect(plyOf(START)).toBe(1);
    expect(plyOf('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(2);
  });

  it('loda una buona mossa e spiega perché', () => {
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const f = explainUserMove(START, 'e2e4', analysis(START, [[['e2e4'], 30], [['d2d4'], 28]]), analysis(after, [[['e7e5'], -30]]))!;
    expect(f.grade).toBe('best');
    expect(f.better).toBeNull();
    expect(f.why).toContain('centro');
  });

  it('spiega perché un pezzo lasciato in presa è un errore e cosa era meglio', () => {
    // Il Bianco porta la donna in g4 dove il cavallo f6 la cattura.
    const before = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 2 3';
    const after = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P1Q1/8/PPPP1PPP/RNB1KBNR b KQkq - 3 3';
    const f = explainUserMove(
      before,
      'd1g4',
      analysis(before, [[['g1f3'], 30], [['b1c3'], 25], [['d2d3'], 20]]),
      analysis(after, [[['f6g4'], 880]]),
    )!;
    expect(f.grade).toBe('blunder');
    expect(f.why).toContain('Il pezzo che hai mosso resta indifeso');
    expect(f.why).toContain('la donna');
    expect(f.better).toContain('Era meglio Cf3');
    expect(f.refutationUci).toBe('f6g4');
  });

  it('avvisa se l’errore concede uno scacco matto', () => {
    const before = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const after = 'rnbqkbnr/pppp1ppp/8/4p3/4P1P1/8/PPPP1P1P/RNBQKBNR b KQkq - 0 2';
    const f = explainUserMove(before, 'g2g4', analysis(before, [[['g1f3'], 40]]), analysis(after, [[['d8h4'], 300]]))!;
    expect(f.grade).not.toBe('best');
  });

  it('spiega la mossa dell’AI e segnala un suo errore', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterAi = 'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2';
    const note = explainAiMove(fen, 'g8f6', analysis(fen, [[['e7e5'], -30]]), analysis(afterAi, [[['e4e5'], 250]]))!;
    expect(note.text).toContain('L’AI gioca Cf6.');
    expect(note.text).toContain('Attacca il pedone in e4');
    expect(note.opportunity).toBe(true);
  });
});
