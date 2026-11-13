import { describe, expect, it } from 'vitest';
import { gradeLastMove, tutorSpeech } from '../../src/features/analysis/tutor';
import type { Analysis } from '../../src/features/engine/engine';

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
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('frasi del tutor (senza Claude)', () => {
  it('quando tocca a te consiglia la mossa, in notazione italiana', () => {
    const text = tutorSpeech({ fen: START, analysis: analysis(START, [[['g1f3'], 30]]), myColor: 'w', lastMove: null, previous: null });
    expect(text).toBe('Tocca a te: ti consiglio Cf3.');
  });

  it('annuncia la mossa dell\'avversario e dice cosa prendi', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const text = tutorSpeech({
      fen,
      analysis: analysis(fen, [[['e4d5'], 40]]),
      myColor: 'w',
      lastMove: { san: 'd5', color: 'b' },
      previous: null,
    });
    expect(text).toBe('Il Nero ha giocato d5. Tocca a te: ti consiglio exd5: prendi il pedone.');
  });

  it('giudica la tua mossa appena giocata', () => {
    const before = analysis(START, [[['e2e4'], 30], [['d2d4'], 28]]);
    const good = tutorSpeech({ fen: AFTER_E4, analysis: analysis(AFTER_E4, [[['e7e5'], -30]]), myColor: 'w', lastMove: { san: 'e4', color: 'w' }, previous: before });
    expect(good).toBe('Ottima mossa! Tocca all’avversario.');
    const afterF3 = 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1';
    const bad = gradeLastMove(before, 'f3', analysis(afterF3, [[['e7e5'], 250]]));
    expect(bad?.bestSan).toBe('e4');
    expect(['mistake', 'blunder']).toContain(bad?.grade);
  });

  it('avvisa della minaccia di matto dell\'avversario', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 1'.replace(' b ', ' w ');
    const text = tutorSpeech({ fen, analysis: analysis(fen, [[['h5f7'], { mate: 1 }]]), myColor: 'b', lastMove: null, previous: null });
    expect(text).toBe('Tocca all’avversario. Attenzione: minaccia matto con Dxf7#.');
  });

  it('con «prima prova tu» non svela la mossa', () => {
    const text = tutorSpeech({ fen: START, analysis: analysis(START, [[['g1f3'], 30]]), myColor: 'w', lastMove: null, previous: null, hideBest: true });
    expect(text).toBe('Tocca a te: qual è la mossa migliore?');
  });

  it('annuncia il matto in più mosse', () => {
    const fen = '6k1/5ppp/8/8/8/8/1Q6/K2R4 w - - 0 1';
    const text = tutorSpeech({ fen, analysis: analysis(fen, [[['d1d8'], { mate: 1 }]]), myColor: 'w', lastMove: null, previous: null });
    expect(text).toContain('ed è scacco matto');
  });
});
