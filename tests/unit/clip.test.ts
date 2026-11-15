import { describe, expect, it } from 'vitest';
import { bestSymbol, fuseViews, peaked, type Evidence } from '../../src/features/vision/evidence';
import { pickClipFrames, sharpness, type ClipFrame } from '../../src/utils/frames';

const emptyBoard = (): Evidence => Array.from({ length: 64 }, () => peaked('.', 0.88));

describe('clip breve: più inquadrature della stessa posizione', () => {
  it('un pezzo coperto in una vista resta, un falso pezzo in una sola vista sparisce', () => {
    const a = emptyBoard();
    const b = emptyBoard();
    const c = emptyBoard();
    // Casa 10: c'è un alfiere, coperto da un pezzo più alto nella vista c.
    a[10] = peaked('B', 0.8);
    b[10] = peaked('B', 0.75);
    // Casa 20: riflesso scambiato per un pedone solo nella vista b.
    b[20] = peaked('P', 0.7);
    const fused = fuseViews([a, b, c])!;
    expect(bestSymbol(fused[10]!).symbol).toBe('B');
    expect(bestSymbol(fused[20]!).symbol).toBe('.');
    expect(bestSymbol(fused[0]!).symbol).toBe('.');
    expect(fuseViews([a])).toBe(a);
    expect(fuseViews([null, undefined])).toBeNull();
  });

  it('sceglie il fotogramma più nitido, scarta i mossi e indica la vista più diversa', () => {
    const side = 48;
    const checker = (shift: number, blur = false) => {
      const s = new Uint8Array(side * side);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) s[y * side + x] = blur ? 128 : ((Math.floor((x + shift) / 6) + Math.floor(y / 6)) % 2) * 200 + 20;
      return s;
    };
    const frame = (id: string, signature: Uint8Array): ClipFrame => ({ frame: { data: id, rect: { x: 0, y: 0, w: 1, h: 1 } }, signature });
    expect(sharpness(checker(0))).toBeGreaterThan(sharpness(checker(0, true)));
    const picked = pickClipFrames([frame('mosso', checker(0, true)), frame('a', checker(0)), frame('b', checker(1)), frame('c', checker(3))])!;
    expect(picked.others.map((o) => o.frame.data)).not.toContain('mosso');
    expect(picked.best.frame.data).not.toBe('mosso');
    expect(picked.others).toHaveLength(2);
    expect(picked.farthest).not.toBeNull();
    expect(pickClipFrames([])).toBeNull();
  });
});
