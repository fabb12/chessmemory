import { describe, expect, it } from 'vitest';
import { winningLine } from '../../src/features/analysis/winningLine';

describe('linea vincente', () => {
  it('con un matto forzato mostra tutta la sequenza fino al matto', () => {
    // Matto del barbiere: Dxf7#.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1'.replace('2n5/4p2Q', '2n2n2/4p2Q');
    const line = winningLine(fen, { multipv: 1, depth: 10, score: { kind: 'mate', value: 1 }, pv: ['h5f7', 'e8f7'] });
    expect(line?.kind).toBe('mate');
    expect(line?.mateIn).toBe(1);
    expect(line?.moves.map((m) => m.san)).toEqual(['Qxf7#']);
  });

  it('senza matto si ferma al primo scacco proprio', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const line = winningLine(fen, { multipv: 1, depth: 10, score: { kind: 'cp', value: 40 }, pv: ['g1f3', 'b8c6', 'f1b5', 'g8f6', 'b5c6', 'd7c6', 'f3e5', 'd8d4', 'e5f7'] });
    expect(line?.kind).toBe('plan');
    const check = winningLine('rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3', {
      multipv: 1,
      depth: 10,
      score: { kind: 'cp', value: 20 },
      pv: ['g1f3', 'g8f6', 'f1b5', 'c7c6'],
    });
    expect(check?.kind).toBe('check');
    expect(check?.checkIn).toBe(2);
    expect(check?.moves.map((m) => m.san)).toEqual(['Nf3', 'Nf6', 'Bb5+']);
  });

  it('nessuna variante: nulla da mostrare', () => {
    expect(winningLine('8/8/8/8/8/8/8/K6k w - - 0 1', undefined)).toBeNull();
  });
});
