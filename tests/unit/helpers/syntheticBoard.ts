import { cornersMatrix, invertMatrix, applyMatrix } from '../../../src/features/vision/gridFit';
import type { Corners } from '../../../src/features/vision/geometry';
import type { RgbaImage } from '../../../src/features/vision/rectify';

/**
 * Fotogramma sintetico di una scacchiera vista di sbieco: case chiare/scure
 * nel quadrilatero `corners` e pezzi come «cilindri» che salgono dall'appoggio
 * (alti 1,3 case): coprono la casa dietro, come i pezzi veri a ~45°.
 * `whiteAtBottom`: il Bianco sta dal lato vicino alla fotocamera.
 */
export function renderBoard(
  fen: string,
  corners: Corners,
  options: { width?: number; height?: number; whiteAtBottom?: boolean; brightness?: number; pieceHeight?: number } = {},
): RgbaImage {
  const width = options.width ?? 640;
  const height = options.height ?? 480;
  const whiteAtBottom = options.whiteAtBottom ?? true;
  const gain = options.brightness ?? 1;
  const data = new Uint8ClampedArray(width * height * 4);
  const px = corners.map((p) => ({ x: p.x * width, y: p.y * height })) as Corners;
  const H = cornersMatrix(px)!;
  const inv = invertMatrix(H)!;
  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const k = (y * width + x) * 4;
    data[k] = r * gain;
    data[k + 1] = g * gain;
    data[k + 2] = b * gain;
    data[k + 3] = 255;
  };
  // Sfondo e case.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const q = applyMatrix(inv, { x: x + 0.5, y: y + 0.5 });
      if (q.x >= 0 && q.x < 1 && q.y >= 0 && q.y < 1) {
        const i = Math.floor(q.y * 8);
        const j = Math.floor(q.x * 8);
        const dark = (i + j) % 2 === 1;
        if (dark) put(x, y, 118, 150, 86);
        else put(x, y, 238, 238, 210);
      } else {
        put(x, y, 90, 80, 70);
      }
    }
  }
  // Pezzi, dal lontano al vicino (quelli davanti coprono quelli dietro).
  const rows = (fen.split(' ')[0] ?? '').split('/');
  const pieces: { i: number; j: number; white: boolean }[] = [];
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      // Cella dell'immagine (riga dall'alto, colonna da sinistra).
      const i = whiteAtBottom ? r : 7 - r;
      const j = whiteAtBottom ? f : 7 - f;
      pieces.push({ i, j, white: ch === ch.toUpperCase() });
      f++;
    }
  });
  pieces.sort((a, b) => a.i - b.i);
  for (const { i, j, white } of pieces) {
    const flat = (options.pieceHeight ?? 1.3) < 0.7;
    const baseV = flat ? 0.8 : 0.62;
    const base = applyMatrix(H, { x: (j + 0.5) / 8, y: (i + baseV) / 8 });
    const left = applyMatrix(H, { x: (j + 0.22) / 8, y: (i + baseV) / 8 });
    const right = applyMatrix(H, { x: (j + 0.78) / 8, y: (i + baseV) / 8 });
    const far = applyMatrix(H, { x: (j + 0.5) / 8, y: (i - 0.38) / 8 });
    const squareH = base.y - far.y;
    const top = base.y - (options.pieceHeight ?? 1.3) * squareH;
    const x0 = Math.round(left.x);
    const x1 = Math.round(right.x);
    for (let y = Math.round(top); y <= Math.round(base.y); y++) {
      for (let x = x0; x <= x1; x++) {
        const shade = 1 - 0.25 * Math.abs((x - base.x) / Math.max(1, x1 - x0));
        if (white) put(x, y, 250 * shade, 245 * shade, 235 * shade);
        else put(x, y, 45 * shade, 40 * shade, 38 * shade);
      }
    }
  }
  return { data, width, height };
}

/** Quadrilatero tipico di una scacchiera inquadrata a ~45°: lato lontano più corto. */
export const TILTED: Corners = [
  { x: 0.3, y: 0.18 },
  { x: 0.7, y: 0.18 },
  { x: 0.86, y: 0.86 },
  { x: 0.14, y: 0.86 },
];
