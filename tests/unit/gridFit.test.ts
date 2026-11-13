import { describe, expect, it } from 'vitest';
import type { Corners } from '../../src/features/vision/geometry';
import { applyMatrix, cornersMatrix, fitHomography, invertMatrix, refineCorners, saddlePoints, type GrayImage } from '../../src/features/vision/gridFit';

const TRUE_CORNERS: Corners = [
  { x: 0.28, y: 0.18 },
  { x: 0.74, y: 0.2 },
  { x: 0.9, y: 0.86 },
  { x: 0.1, y: 0.84 },
];

/** Scacchiera sintetica vista in prospettiva, con qualche «pezzo» (dischi grigi) sopra. */
function renderBoard(corners: Corners, size = 320): GrayImage {
  const px = corners.map((p) => ({ x: p.x * size, y: p.y * size })) as Corners;
  const inv = invertMatrix(cornersMatrix(px)!)!;
  const data = new Float32Array(size * size);
  const pieces = [
    [0.5 / 8, 0.5 / 8],
    [3.5 / 8, 1.5 / 8],
    [6.5 / 8, 6.5 / 8],
    [4.5 / 8, 4.5 / 8],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const uv = applyMatrix(inv, { x: x + 0.5, y: y + 0.5 });
      let v = 90; // tavolo
      if (uv.x >= 0 && uv.x < 1 && uv.y >= 0 && uv.y < 1) {
        v = (Math.floor(uv.x * 8) + Math.floor(uv.y * 8)) % 2 === 0 ? 220 : 60;
        if (pieces.some(([pu, pv]) => Math.hypot(uv.x - pu!, uv.y - pv!) < 0.04)) v = 140;
      }
      data[y * size + x] = v;
    }
  }
  return { data, width: size, height: size };
}

describe('omografia con i minimi quadrati', () => {
  it('ritrova la trasformazione da punti esatti', () => {
    const H = cornersMatrix(TRUE_CORNERS)!;
    const src = [];
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) src.push({ x: j / 4, y: i / 4 });
    const dst = src.map((p) => applyMatrix(H, p));
    const fit = fitHomography(src, dst)!;
    for (const p of src) {
      expect(applyMatrix(fit, p).x).toBeCloseTo(applyMatrix(H, p).x, 6);
      expect(applyMatrix(fit, p).y).toBeCloseTo(applyMatrix(H, p).y, 6);
    }
  });

  it('l\'inversa riporta i punti al quadrato unitario', () => {
    const H = cornersMatrix(TRUE_CORNERS)!;
    const p = applyMatrix(invertMatrix(H)!, applyMatrix(H, { x: 0.3, y: 0.7 }));
    expect(p.x).toBeCloseTo(0.3, 9);
    expect(p.y).toBeCloseTo(0.7, 9);
  });
});

describe('rifinitura degli angoli con i punti di sella (X-corner)', () => {
  const img = renderBoard(TRUE_CORNERS);

  it('trova gli incroci interni come punti di sella', () => {
    expect(saddlePoints(img).length).toBeGreaterThanOrEqual(30);
  });

  it('corregge angoli sbagliati di quasi mezza casa', () => {
    const square = 0.6 / 8;
    const approx: Corners = [
      { x: TRUE_CORNERS[0].x + 0.35 * square, y: TRUE_CORNERS[0].y - 0.3 * square },
      { x: TRUE_CORNERS[1].x - 0.3 * square, y: TRUE_CORNERS[1].y + 0.25 * square },
      { x: TRUE_CORNERS[2].x + 0.3 * square, y: TRUE_CORNERS[2].y + 0.3 * square },
      { x: TRUE_CORNERS[3].x - 0.25 * square, y: TRUE_CORNERS[3].y - 0.35 * square },
    ];
    const fit = refineCorners(img, approx);
    expect(fit).not.toBeNull();
    expect(fit!.matched).toBeGreaterThanOrEqual(30);
    fit!.corners.forEach((p, k) => {
      expect(Math.abs(p.x - TRUE_CORNERS[k]!.x)).toBeLessThan(0.006);
      expect(Math.abs(p.y - TRUE_CORNERS[k]!.y)).toBeLessThan(0.006);
    });
  });

  it('senza scacchiera non inventa angoli', () => {
    const flat: GrayImage = { data: new Float32Array(200 * 200).fill(120), width: 200, height: 200 };
    expect(refineCorners(flat, TRUE_CORNERS)).toBeNull();
  });
});
