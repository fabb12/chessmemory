import { homography, plausibleCorners, type Corners } from './geometry';
import { refineCorners, type GrayImage, type GridFit } from './gridFit';

/**
 * Calibrazione della scacchiera nell'inquadratura: i 4 angoli dell'area di gioco.
 *
 * - Si salvano in localStorage: se la fotocamera non si sposta, alla prossima
 *   apertura la griglia è già al suo posto.
 * - Il rilevamento automatico prova alcune ipotesi (quadrati centrati e trapezi,
 *   come appare la scacchiera inquadrata di sbieco a ~45°) e le aggancia al
 *   reticolo degli incroci interni (punti di sella, `gridFit`): vince l'ipotesi
 *   con più incroci ritrovati. L'utente rifinisce poi trascinando gli angoli.
 */

const KEY = 'cm.vision.calibration.v1';
/** La calibrazione salvata vale solo con lo stesso formato del video (stessa fotocamera/risoluzione). */
const ASPECT_TOLERANCE = 0.03;

export interface SavedCalibration {
  corners: Corners;
  /** Larghezza / altezza del video quando è stata salvata. */
  aspect: number;
  savedAt: number;
}

export function saveCalibration(corners: Corners, aspect: number): void {
  try {
    const value: SavedCalibration = { corners, aspect, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // archiviazione non disponibile: la calibrazione vale solo per questa pagina
  }
}

export function loadCalibration(aspect: number): Corners | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedCalibration>;
    if (!Array.isArray(saved.corners) || saved.corners.length !== 4 || typeof saved.aspect !== 'number') return null;
    if (Math.abs(saved.aspect - aspect) / aspect > ASPECT_TOLERANCE) return null;
    const corners = saved.corners.map((p) => ({ x: Number(p?.x), y: Number(p?.y) })) as Corners;
    return plausibleCorners(corners, 0.02) ? corners : null;
  } catch {
    return null;
  }
}

export function clearCalibration(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // niente da fare
  }
}

/**
 * Ipotesi iniziali per il rilevamento automatico, in frazioni del fotogramma.
 * `aspect` = larghezza / altezza del video. Con la fotocamera inclinata la
 * scacchiera è un trapezio: lato lontano (in alto) più corto e altezza schiacciata.
 */
export function candidateQuads(aspect: number): Corners[] {
  const out: Corners[] = [];
  const shapes: { top: number; height: number }[] = [
    { top: 1, height: 1 },
    { top: 0.8, height: 0.75 },
    { top: 0.65, height: 0.55 },
  ];
  for (const side of [0.9, 0.75, 0.6]) {
    for (const shape of shapes) {
      // Lato inferiore lungo `side` volte il lato corto del fotogramma (in frazioni della larghezza)…
      const bottomW = Math.min(0.98, aspect >= 1 ? side / aspect : side);
      const topW = bottomW * shape.top;
      // …e altezza (in frazioni dell'altezza) schiacciata dalla prospettiva.
      const height = Math.min(0.96, (aspect >= 1 ? side : side * aspect) * shape.height);
      const cy = 0.52;
      const y0 = Math.max(0.02, cy - height / 2);
      const y1 = Math.min(0.98, cy + height / 2);
      out.push([
        { x: 0.5 - topW / 2, y: y0 },
        { x: 0.5 + topW / 2, y: y0 },
        { x: 0.5 + bottomW / 2, y: y1 },
        { x: 0.5 - bottomW / 2, y: y1 },
      ]);
    }
  }
  return out;
}

/**
 * Il reticolo degli incroci interni è uguale a sé stesso spostato di una casa:
 * l'aggancio può cadere sfasato di una riga o di una colonna. Si distingue
 * guardando FUORI dalla griglia: attorno alla scacchiera giusta c'è la cornice
 * o il tavolo (uniforme), mentre una griglia sfasata ha da un lato una fila di
 * case vere (chiare/scure, con pezzi). Punteggio più basso = bordo più uniforme
 * rispetto all'interno. Il lato lontano non si guarda: i pezzi dell'ultima
 * traversa, alti, sporgono oltre il bordo.
 */
export function borderScore(gray: GrayImage, corners: Corners): number {
  const map = homography(corners);
  const sample = (u: number, v: number): number | null => {
    const p = map(u, v);
    const x = Math.round(p.x * gray.width);
    const y = Math.round(p.y * gray.height);
    if (x < 0 || y < 0 || x >= gray.width || y >= gray.height) return null;
    return gray.data[y * gray.width + x]!;
  };
  const std = (values: number[]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  };
  // Fasce appena fuori dai lati vicino, destro e sinistro (a un terzo di casa dal bordo), 16 punti per lato.
  const sides: (number | null)[][] = [[], [], []];
  for (let k = 0; k < 16; k++) {
    const t = (k + 0.5) / 16;
    sides[0]!.push(sample(1 + 1 / 24, t));
    sides[1]!.push(sample(t, 1 + 1 / 24));
    sides[2]!.push(sample(-1 / 24, t));
  }
  const usable = sides.map((side) => side.filter((v): v is number => v !== null)).filter((side) => side.length >= 12);
  if (usable.length < 2) return Infinity;
  const inner: number[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const v = sample((j + 0.5) / 8, (i + 0.5) / 8);
    if (v !== null) inner.push(v);
  }
  if (inner.length < 48) return Infinity;
  // Il lato peggiore conta di più: basta una fila di case fuori per tradire lo sfasamento.
  const worst = Math.max(...usable.map(std));
  const mean = usable.reduce((s, side) => s + std(side), 0) / usable.length;
  return (0.6 * worst + 0.4 * mean) / Math.max(1, std(inner));
}

/** La stessa griglia spostata di (du, dv) case. */
function shifted(corners: Corners, du: number, dv: number): Corners {
  const map = homography(corners);
  return [map(du / 8, dv / 8), map(1 + du / 8, dv / 8), map(1 + du / 8, 1 + dv / 8), map(du / 8, 1 + dv / 8)];
}

/** Rilevamento automatico degli angoli: la migliore delle ipotesi agganciate al reticolo. */
export function autoDetectCorners(gray: GrayImage, aspect: number): GridFit | null {
  let best: GridFit | null = null;
  for (const quad of candidateQuads(aspect)) {
    const fit = refineCorners(gray, quad);
    if (!fit || !plausibleCorners(fit.corners, 0.03)) continue;
    if (!best || fit.matched > best.matched || (fit.matched === best.matched && fit.residual < best.residual)) best = fit;
  }
  if (!best) return null;
  // Il reticolo potrebbe essere agganciato sfasato di una casa: vince la variante con il bordo più uniforme.
  // La scacchiera deve stare tutta nell'inquadratura: le varianti che escono sono scartate.
  const inside = (c: Corners) => c.every((p) => p.x >= -0.01 && p.x <= 1.01 && p.y >= -0.01 && p.y <= 1.01);
  let corners = best.corners;
  let score = inside(corners) ? borderScore(gray, corners) : Infinity;
  for (const du of [-1, 0, 1]) {
    for (const dv of [-1, 0, 1]) {
      if (!du && !dv) continue;
      const candidate = shifted(best.corners, du, dv);
      if (!inside(candidate) || !plausibleCorners(candidate, 0.03)) continue;
      const s = borderScore(gray, candidate);
      if (s < score * 0.85) {
        score = s;
        corners = candidate;
      }
    }
  }
  return { ...best, corners };
}
