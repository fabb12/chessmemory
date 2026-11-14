import { afterEach, describe, expect, it } from 'vitest';
import { flipSquare, localSquares, sanToLocal, setFlippedSquares } from '../../src/utils/notation';

describe('numerazione invertita (Nero sulle righe 1-2)', () => {
  afterEach(() => setFlippedSquares(false));

  it('rinomina le case ruotando la scacchiera di 180°', () => {
    expect(flipSquare('a1')).toBe('h8');
    expect(flipSquare('e4')).toBe('d5');
    expect(flipSquare('h8')).toBe('a1');
  });

  it('sanToLocal rinomina le case solo se la numerazione è invertita', () => {
    expect(sanToLocal('Nf3')).toBe('Cf3');
    setFlippedSquares(true);
    expect(sanToLocal('Nf3')).toBe('Cc6');
    expect(sanToLocal('exd5')).toBe('dxe4');
    expect(sanToLocal('e8=Q+')).toBe('d1=D+');
    expect(sanToLocal('O-O')).toBe('O-O');
    expect(sanToLocal('Nf3', false)).toBe('Cf3');
  });

  it('nel testo libero cambia solo le mosse e le case', () => {
    setFlippedSquares(true);
    expect(localSquares('Gioca Cf3 per controllare e5 e la casa d4, poi exd5.')).toBe('Gioca Cc6 per controllare d4 e la casa e5, poi dxe4.');
    expect(localSquares('Gioca Cf3', false)).toBe('Gioca Cf3');
  });
});
