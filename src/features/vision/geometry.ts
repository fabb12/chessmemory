import type { BoardView } from '../assistant/boardReading';

/**
 * Geometria della scacchiera nell'inquadratura.
 *
 * I quattro angoli dell'area di gioco (in coordinate normalizzate 0–1 del
 * fotogramma) bastano a sapere dove sta ogni casa anche con la fotocamera
 * inclinata: un'omografia porta il quadrato unitario (u, v) sul quadrilatero
 * visto. Con questo si ritaglia la foto attorno alla scacchiera (più pixel per
 * casa) e si confrontano le singole case tra due fotogrammi.
 */

export interface Point {
  x: number;
  y: number;
}

/** Angoli dell'area di gioco come appaiono nel fotogramma: in alto a sinistra, in alto a destra, in basso a destra, in basso a sinistra. */
export type Corners = [Point, Point, Point, Point];

export type Homography = (u: number, v: number) => Point;

/** Omografia dal quadrato unitario ai quattro angoli: (0,0)→tl, (1,0)→tr, (1,1)→br, (0,1)→bl. */
export function homography([p0, p1, p2, p3]: Corners): Homography {
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    // Parallelogramma: trasformazione affine.
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    f = p0.y;
    g = 0;
    h = 0;
  } else {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Area del quadrilatero (formula di Gauss). */
export function quadArea(corners: Corners): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const p = corners[i]!;
    const q = corners[(i + 1) % 4]!;
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
}

/** Angoli plausibili: quadrilatero convesso, non troppo piccolo, dentro (o quasi) l'immagine. */
export function plausibleCorners(corners: Corners, minArea = 0.05): boolean {
  if (corners.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1)) return false;
  const signs = corners.map((_, i) => Math.sign(cross(corners[i]!, corners[(i + 1) % 4]!, corners[(i + 2) % 4]!)));
  if (signs.some((s) => s === 0 || s !== signs[0])) return false;
  return quadArea(corners) >= minArea;
}

/** Rettangolo (frazioni del fotogramma) da inviare a Claude: la scacchiera più un margine, più ampio in alto per le teste dei pezzi lontani. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cropAround(corners: Corners, aspect: number): Rect {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  let x0 = minX - 0.06 * w;
  let x1 = maxX + 0.06 * w;
  let y0 = minY - 0.2 * h;
  let y1 = maxY + 0.06 * h;
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(1, x1);
  y1 = Math.min(1, y1);
  // Mai troppo stretto (in pixel reali): almeno metà del lato corto.
  const minSide = 0.5;
  if ((x1 - x0) * aspect < minSide && aspect > 0) {
    const grow = (minSide / aspect - (x1 - x0)) / 2;
    x0 = Math.max(0, x0 - grow);
    x1 = Math.min(1, x1 + grow);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Riporta nel fotogramma un punto espresso in frazioni del ritaglio. */
export function fromCrop(rect: Rect, p: Point): Point {
  return { x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h };
}

const FILES = 'abcdefgh';

/**
 * Casa della scacchiera che corrisponde alla cella (riga i dall'alto, colonna j
 * da sinistra) della griglia vista nella foto, dato l'orientamento.
 * È l'inverso di `gridToRanks` in boardReading.
 */
export function cellToSquare(i: number, j: number, view: BoardView): string {
  let r: number;
  let f: number;
  switch (view) {
    case 'bottom':
      r = i;
      f = j;
      break;
    case 'top':
      r = 7 - i;
      f = 7 - j;
      break;
    case 'left':
      r = 7 - j;
      f = i;
      break;
    case 'right':
      r = j;
      f = 7 - i;
      break;
  }
  return `${FILES[f]}${8 - r}`;
}
