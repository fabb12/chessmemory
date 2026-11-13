import type { Corners, Point } from './geometry';

/**
 * Rifinitura degli angoli della scacchiera con la visione classica.
 *
 * Idea ripresa da chessAutomation_CV (simarmehta): gli incroci interni della
 * scacchiera (dove si toccano quattro case, «X-corner») sono punti di sella
 * dell'immagine in scala di grigi (luminosità che sale in una diagonale e
 * scende nell'altra). Si cercano i punti di sella, si confrontano con il
 * reticolo 7×7 degli incroci previsto dagli angoli approssimativi (quelli di
 * Claude, o quelli del fotogramma precedente) e si ricalcola l'omografia con i
 * punti trovati, scartando quelli fuori posto (come RANSAC). Il risultato:
 * angoli precisi al pixel, quindi case campionate al posto giusto e pezzi
 * assegnati alla casa giusta.
 */

/** Omografia come matrice 3×3 per righe (h[8] = 1). */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];

export function applyMatrix(h: Matrix3, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

export function invertMatrix(h: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, i, k] = h;
  const A = e * k - f * i;
  const B = -(d * k - f * g);
  const C = d * i - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv: Matrix3 = [A, -(b * k - c * i), b * f - c * e, B, a * k - c * g, -(a * f - c * d), C, -(a * i - b * g), a * e - b * d];
  return inv.map((v) => v / det) as Matrix3;
}

/** Risolve un sistema lineare n×n (eliminazione di Gauss con pivot). */
function solve(m: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = m.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r]![col]! / a[col]![col]!;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) a[r]![c]! -= factor * a[col]![c]!;
    }
  }
  return a.map((row, i) => row[n]! / row[i]!);
}

/**
 * Omografia da src a dst con i minimi quadrati (almeno 4 coppie).
 * Le coordinate vengono normalizzate per la stabilità numerica.
 */
export function fitHomography(src: readonly Point[], dst: readonly Point[]): Matrix3 | null {
  const n = src.length;
  if (n < 4 || dst.length !== n) return null;
  const norm = (pts: readonly Point[]) => {
    const cx = pts.reduce((s, p) => s + p.x, 0) / n;
    const cy = pts.reduce((s, p) => s + p.y, 0) / n;
    const d = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / n || 1;
    const k = Math.SQRT2 / d;
    return { t: [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1] as Matrix3, pts: pts.map((p) => ({ x: k * (p.x - cx), y: k * (p.y - cy) })) };
  };
  const s = norm(src);
  const d = norm(dst);
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const add = (row: number[], b: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i]! += row[i]! * b;
      for (let j = 0; j < 8; j++) ata[i]![j]! += row[i]! * row[j]!;
    }
  };
  for (let i = 0; i < n; i++) {
    const { x, y } = s.pts[i]!;
    const { x: X, y: Y } = d.pts[i]!;
    add([x, y, 1, 0, 0, 0, -x * X, -y * X], X);
    add([0, 0, 0, x, y, 1, -x * Y, -y * Y], Y);
  }
  const sol = solve(ata, atb);
  if (!sol) return null;
  const hn: Matrix3 = [sol[0]!, sol[1]!, sol[2]!, sol[3]!, sol[4]!, sol[5]!, sol[6]!, sol[7]!, 1];
  // H = Td⁻¹ · Hn · Ts
  const tdInv = invertMatrix(d.t);
  if (!tdInv) return null;
  const h = multiply(multiply(tdInv, hn), s.t);
  return h[8] !== 0 ? (h.map((v) => v / h[8]) as Matrix3) : null;
}

function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) out[r * 3 + c]! += a[r * 3 + k]! * b[k * 3 + c]!;
  return out as Matrix3;
}

/** Omografia dal quadrato unitario (u, v) agli angoli. */
export function cornersMatrix(corners: Corners): Matrix3 | null {
  return fitHomography(
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    corners,
  );
}

export interface GrayImage {
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Punti di sella (incroci della scacchiera): dove il determinante dell'hessiana
 * è molto negativo. Restituisce i punti più forti dopo la soppressione dei non massimi.
 */
export function saddlePoints(img: GrayImage, maxPoints = 600, nmsRadius = 3): Point[] {
  const { width: w, height: h } = img;
  // Sfocatura (tre passate di box 3×3): toglie il rumore e la grana del legno.
  const blurred = boxBlur(boxBlur(boxBlur(img.data, w, h), w, h), w, h);
  const at = (x: number, y: number) => blurred[y * w + x]!;
  const response = new Float32Array(w * h);
  let max = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const gxx = at(x + 2, y) - 2 * at(x, y) + at(x - 2, y);
      const gyy = at(x, y + 2) - 2 * at(x, y) + at(x, y - 2);
      const gxy = (at(x + 2, y + 2) - at(x + 2, y - 2) - at(x - 2, y + 2) + at(x - 2, y - 2)) / 4;
      const s = gxy * gxy - gxx * gyy;
      if (s > 0) {
        response[y * w + x] = s;
        if (s > max) max = s;
      }
    }
  }
  if (max === 0) return [];
  const threshold = max * 0.005;
  const found: { p: Point; s: number }[] = [];
  for (let y = nmsRadius; y < h - nmsRadius; y++) {
    for (let x = nmsRadius; x < w - nmsRadius; x++) {
      const v = response[y * w + x]!;
      if (v < threshold) continue;
      let isMax = true;
      for (let dy = -nmsRadius; dy <= nmsRadius && isMax; dy++) {
        for (let dx = -nmsRadius; dx <= nmsRadius; dx++) {
          const u = response[(y + dy) * w + x + dx]!;
          // A parità di valore vince il primo nell'ordine di scansione (niente buchi sui plateau).
          if ((dx || dy) && (u > v || (u === v && (dy < 0 || (dy === 0 && dx < 0))))) {
            isMax = false;
            break;
          }
        }
      }
      if (!isMax) continue;
      // Posizione al sotto-pixel: media pesata nell'intorno 3×3.
      let sx = 0;
      let sy = 0;
      let sw = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r = response[(y + dy) * w + x + dx]!;
          sx += (x + dx) * r;
          sy += (y + dy) * r;
          sw += r;
        }
      }
      found.push({ p: { x: sx / sw, y: sy / sw }, s: v });
    }
  }
  found.sort((a, b) => b.s - a.s);
  return found.slice(0, maxPoints).map((f) => f.p);
}

function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx]!;
          n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

export interface GridFit {
  /** Angoli rifiniti (frazioni 0–1 dell'immagine). */
  corners: Corners;
  /** Incroci interni (su 49) ritrovati nell'immagine. */
  matched: number;
  /** Errore medio dei punti usati, in frazioni del lato di una casa. */
  residual: number;
}

/** Minimo di incroci ritrovati perché la rifinitura sia credibile (i pezzi ne coprono molti). */
export const MIN_MATCHED = 14;

/**
 * Rifinisce gli angoli approssimativi agganciando il reticolo 7×7 degli
 * incroci interni ai punti di sella dell'immagine. Restituisce null se gli
 * incroci ritrovati sono troppo pochi (meglio tenere gli angoli di partenza).
 */
export function refineCorners(img: GrayImage, approx: Corners): GridFit | null {
  const { width: w, height: h } = img;
  const px = approx.map((p) => ({ x: p.x * w, y: p.y * h })) as Corners;
  const start = cornersMatrix(px);
  if (!start) return null;
  const saddles = saddlePoints(img);
  if (saddles.length < MIN_MATCHED) return null;
  // Gli angoli iniziali possono essere sbagliati di mezza casa o più: un aggancio
  // diretto al punto più vicino mescolerebbe file diverse. Come cv2.findHomography
  // con RANSAC nel progetto di riferimento: si estraggono quattro abbinamenti
  // incrocio↔punto di sella plausibili, si calcola l'omografia e si conta quanti
  // incroci del reticolo trovano un punto di sella vicino; vince l'ipotesi migliore.
  const lattice: Point[] = [];
  for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) lattice.push({ x: b / 8, y: a / 8 });
  const options = lattice.map((q) => {
    const p = applyMatrix(start, q);
    const side = Math.min(dist2(p, applyMatrix(start, { x: q.x + 1 / 8, y: q.y })), dist2(p, applyMatrix(start, { x: q.x, y: q.y + 1 / 8 })));
    return saddles
      .map((s) => ({ s, d: dist2(s, p) }))
      .filter((c) => c.d < 0.7 * side)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((c) => c.s);
  });
  const usable = lattice.map((_, k) => k).filter((k) => options[k]!.length > 0);
  if (usable.length < MIN_MATCHED) return null;
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  let hypothesis: Matrix3 = start;
  let bestCount = matches(start, saddles, 0.15).length;
  for (let iter = 0; iter < 400; iter++) {
    const picks = new Set<number>();
    while (picks.size < 4) picks.add(usable[Math.floor(random() * usable.length)]!);
    const ks = [...picks];
    const qs = ks.map((k) => lattice[k]!);
    // Quattro incroci quasi allineati non determinano l'omografia.
    if (polyArea(hullOrder(qs)) < 0.04) continue;
    const ps = ks.map((k) => {
      const list = options[k]!;
      return list[Math.floor(random() * list.length)]!;
    });
    const H = fitHomography(qs, ps);
    if (!H || !plausible(H)) continue;
    const count = matches(H, saddles, 0.15).length;
    if (count > bestCount) {
      bestCount = count;
      hypothesis = H;
    }
  }
  const best = snap(hypothesis, saddles);
  return best ? toFit(best, w, h) : null;
}

/** Quattro punti in ordine attorno al baricentro (per calcolarne l'area). */
function hullOrder(points: readonly Point[]): Corners {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)) as Corners;
}

/** L'omografia porta il quadrato unitario in un quadrilatero convesso, senza ribaltarlo. */
function plausible(H: Matrix3): boolean {
  const c = unitCorners(H);
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i]!;
    const b = c[(i + 1) % 4]!;
    const d = c[(i + 2) % 4]!;
    const cross = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
    if (!Number.isFinite(cross) || cross === 0) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign > 0;
}

/** Incroci del reticolo previsto da H che hanno un punto di sella entro `radius` case. */
function matches(H: Matrix3, saddles: readonly Point[], radius: number): { q: Point; p: Point }[] {
  const out: { q: Point; p: Point }[] = [];
  const used = new Set<number>();
  for (let a = 1; a <= 7; a++) {
    for (let b = 1; b <= 7; b++) {
      const q = { x: b / 8, y: a / 8 };
      const p = applyMatrix(H, q);
      const r = applyMatrix(H, { x: q.x + 1 / 8, y: q.y });
      const d = applyMatrix(H, { x: q.x, y: q.y + 1 / 8 });
      const limit = radius * Math.min(dist2(p, r), dist2(p, d));
      let nearest = -1;
      let dist = Infinity;
      saddles.forEach((s, k) => {
        const e = dist2(s, p);
        if (e < dist) {
          dist = e;
          nearest = k;
        }
      });
      if (nearest < 0 || dist > limit || used.has(nearest)) continue;
      used.add(nearest);
      out.push({ q, p: saddles[nearest]! });
    }
  }
  return out;
}

/** Aggancio iterativo, con raggio di ricerca decrescente. */
function snap(start: Matrix3, saddles: readonly Point[]): { H: Matrix3; matched: number; residual: number } | null {
  let H = start;
  let best: { H: Matrix3; matched: number; residual: number } | null = null;
  for (const radius of [0.3, 0.2, 0.15]) {
    const pairs = matches(H, saddles, radius);
    if (pairs.length < MIN_MATCHED) return best;
    // Fit, poi via i punti lontani dal modello (pezzi, riflessi) e di nuovo fit.
    let fitted = fitHomography(
      pairs.map((m) => m.q),
      pairs.map((m) => m.p),
    );
    if (!fitted) return best;
    const errors = pairs.map((m) => dist2(applyMatrix(fitted!, m.q), m.p));
    const sorted = [...errors].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const inliers = pairs.filter((_, k) => errors[k]! <= Math.max(2.5 * median, 1.5));
    if (inliers.length < MIN_MATCHED) return best;
    fitted =
      fitHomography(
        inliers.map((m) => m.q),
        inliers.map((m) => m.p),
      ) ?? fitted;
    const squareSide = Math.sqrt(polyArea(unitCorners(fitted))) / 8;
    const residual = inliers.reduce((s, m) => s + dist2(applyMatrix(fitted!, m.q), m.p), 0) / inliers.length / squareSide;
    H = fitted;
    best = { H: fitted, matched: inliers.length, residual };
  }
  return best;
}

function toFit(best: { H: Matrix3; matched: number; residual: number }, w: number, h: number): GridFit | null {
  if (best.residual > 0.12 || best.matched < MIN_MATCHED) return null;
  const corners = unitCorners(best.H).map((p) => ({ x: p.x / w, y: p.y / h })) as Corners;
  return { corners, matched: best.matched, residual: best.residual };
}

function unitCorners(H: Matrix3): Corners {
  return [applyMatrix(H, { x: 0, y: 0 }), applyMatrix(H, { x: 1, y: 0 }), applyMatrix(H, { x: 1, y: 1 }), applyMatrix(H, { x: 0, y: 1 })];
}

function polyArea(c: Corners): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += c[i]!.x * c[(i + 1) % 4]!.y - c[(i + 1) % 4]!.x * c[i]!.y;
  return Math.abs(sum) / 2;
}

const dist2 = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
