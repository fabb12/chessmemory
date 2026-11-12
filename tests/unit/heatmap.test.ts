import { describe, expect, it } from 'vitest';
import type { AttemptRecord } from '../../src/db/schema';
import { computeHeatmap } from '../../src/features/progress/heatmap';

function attempt(over: Partial<AttemptRecord>): AttemptRecord {
  return {
    userId: 'u',
    sessionId: 's',
    conceptId: 'develop-knights',
    exerciseId: 'develop-knights-a',
    category: 'openings',
    activity: 'recall',
    correct: true,
    attempts: 1,
    hintsUsed: 0,
    responseMs: 1000,
    answeredAt: 0,
    nextReviewAt: null,
    rating: 3,
    learningState: null,
    ...over,
  };
}

describe('computeHeatmap', () => {
  it('senza errori la mappa è vuota', () => {
    const heat = computeHeatmap([attempt({})], 'missed');
    expect(heat.total).toBe(0);
    expect(heat.top).toEqual([]);
  });

  it('mosse sfuggite: usa la mossa giusta anche nei dati senza dettaglio degli errori', () => {
    const heat = computeHeatmap(
      [attempt({ correct: false, attempts: 4 }), attempt({ hintsUsed: 1 }), attempt({ activity: 'explain', correct: false })],
      'missed',
    );
    // g1f3: casa di arrivo f3, due volte (la domanda SPIEGA non conta).
    expect(heat.counts).toEqual({ f3: 2 });
    expect(heat.max).toBe(2);
    expect(heat.topPiece).toEqual({ type: 'n', count: 2 });
    expect(heat.kingside).toBe(1);
    expect(heat.center).toBe(1);
  });

  it('mosse sbagliate: conta le case di arrivo e il pezzo mosso', () => {
    const heat = computeHeatmap(
      [
        attempt({ attempts: 3, wrongMoves: [{ move: 'd2d4', step: 0 }, { move: 'f1c4', step: 0 }] }),
        attempt({ attempts: 2, wrongMoves: [{ move: 'd2d4', step: 0 }] }),
      ],
      'wrong',
    );
    expect(heat.counts).toEqual({ d4: 2, c4: 1 });
    expect(heat.top[0]).toEqual({ square: 'd4', count: 2 });
    expect(heat.topPiece).toEqual({ type: 'p', count: 2 });
    expect(heat.kingside).toBe(0);
  });

  it('filtra per categoria', () => {
    const rows = [attempt({ correct: false })];
    expect(computeHeatmap(rows, 'missed', 'tactics').total).toBe(0);
    expect(computeHeatmap(rows, 'missed', 'openings').total).toBe(1);
  });

  it('ignora esercizi sconosciuti e mosse non valide', () => {
    const heat = computeHeatmap(
      [attempt({ exerciseId: 'non-esiste', correct: false }), attempt({ wrongMoves: [{ move: 'zz99', step: 0 }] })],
      'wrong',
    );
    expect(heat.total).toBe(0);
  });
});
