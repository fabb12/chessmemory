import type { RgbaImage } from './rectify';

/**
 * Descrittori delle 64 case, calcolati sull'immagine raddrizzata (top-down).
 *
 * Inquadrata a ~45° la scacchiera non è vista dall'alto: ogni pezzo «sale»
 * nell'immagine e, raddrizzato, si allunga verso il lato LONTANO dalla
 * fotocamera. Un pezzo copre quindi la propria casa e la parte vicina della
 * casa dietro; la parte vicina di ogni casa è sporcata dal pezzo davanti.
 * L'unica fascia che mostra solo il proprio pezzo è quella LONTANA della casa:
 * è lì che si campiona (v da 0,04 a 0,36 del lato, con v piccoli = lontano).
 * Ciò che resta di occlusione (pezzi molto alti) lo gestisce il matcher, che
 * sa quale casa sta dietro a quale.
 *
 * Per ogni casa: colore medio di 3×3 celle della finestra (27 valori) ed
 * energia dei bordi (gradiente di luminosità) delle stesse 9 celle: il
 * contorno di un pezzo si vede anche quando il colore è quasi uguale a quello
 * della casa (pezzo bianco su casa chiara).
 * Cella 0 = in alto a sinistra della finestra; casa (i, j) = riga i dall'alto
 * del quadrato raddrizzato, colonna j da sinistra.
 */

export const GRID_CELLS = 3;
const COLOR_VALUES = GRID_CELLS * GRID_CELLS * 3;
const EDGE_VALUES = GRID_CELLS * GRID_CELLS;
export const FEATURES_PER_SQUARE = COLOR_VALUES + EDGE_VALUES;
/** Peso dei bordi rispetto al colore nel confronto tra fotogrammi. */
const EDGE_GAIN = 2.5;

/** Finestra dentro la casa (frazioni del lato): orizzontalmente centrata, verticalmente nella fascia lontana. */
export const WINDOW = { u0: 0.22, u1: 0.78, v0: 0.04, v1: 0.36 } as const;

function luminance(img: RgbaImage): Float32Array {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * img.data[i * 4]! + 0.587 * img.data[i * 4 + 1]! + 0.114 * img.data[i * 4 + 2]!;
  return out;
}

export function squareFeatures(img: RgbaImage): Float32Array {
  const out = new Float32Array(64 * FEATURES_PER_SQUARE);
  const lum = luminance(img);
  const w = img.width;
  const gradient = (x: number, y: number): number => {
    const x0 = Math.max(0, x - 1);
    const x1 = Math.min(w - 1, x + 1);
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(img.height - 1, y + 1);
    return Math.abs(lum[y * w + x1]! - lum[y * w + x0]!) + Math.abs(lum[y1 * w + x]! - lum[y0 * w + x]!);
  };
  const side = img.width / 8;
  const cellW = ((WINDOW.u1 - WINDOW.u0) * side) / GRID_CELLS;
  const cellH = ((WINDOW.v1 - WINDOW.v0) * side) / GRID_CELLS;
  let k = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const ox = j * side + WINDOW.u0 * side;
      const oy = i * side + WINDOW.v0 * side;
      const edgeBase = k + COLOR_VALUES;
      let cellIndex = 0;
      for (let a = 0; a < GRID_CELLS; a++) {
        for (let b = 0; b < GRID_CELLS; b++) {
          const x0 = Math.floor(ox + b * cellW);
          const y0 = Math.floor(oy + a * cellH);
          const x1 = Math.max(x0 + 1, Math.floor(ox + (b + 1) * cellW));
          const y1 = Math.max(y0 + 1, Math.floor(oy + (a + 1) * cellH));
          let r = 0;
          let g = 0;
          let bl = 0;
          let edge = 0;
          let n = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const p = (y * img.width + x) * 4;
              r += img.data[p]!;
              g += img.data[p + 1]!;
              bl += img.data[p + 2]!;
              edge += gradient(x, y);
              n++;
            }
          }
          out[k++] = r / n;
          out[k++] = g / n;
          out[k++] = bl / n;
          out[edgeBase + cellIndex++] = edge / n;
        }
      }
      k += EDGE_VALUES;
    }
  }
  return out;
}

/**
 * Quanto è cambiata ogni casa (0–255 circa) tra due descrittori. Si toglie lo
 * spostamento medio di ogni canale: l'esposizione automatica cambia la luce di
 * tutta l'immagine, non di una casa.
 */
export function featureChanges(before: Float32Array, after: Float32Array): Float32Array {
  const out = new Float32Array(64);
  if (before.length !== after.length || before.length !== 64 * FEATURES_PER_SQUARE) return out.fill(255);
  const shift = [0, 0, 0];
  let edgeScale = 0;
  let edgeScaleBefore = 0;
  for (let cell = 0; cell < 64; cell++) {
    const base = cell * FEATURES_PER_SQUARE;
    for (let k = 0; k < COLOR_VALUES; k++) shift[k % 3]! += after[base + k]! - before[base + k]!;
    for (let k = COLOR_VALUES; k < FEATURES_PER_SQUARE; k++) {
      edgeScale += after[base + k]!;
      edgeScaleBefore += before[base + k]!;
    }
  }
  const n = (64 * COLOR_VALUES) / 3;
  for (let c = 0; c < 3; c++) shift[c] = shift[c]! / n;
  // I bordi cambiano in proporzione al contrasto generale (esposizione): si normalizzano.
  const edgeRatio = edgeScaleBefore > 0 ? edgeScale / edgeScaleBefore : 1;
  for (let cell = 0; cell < 64; cell++) {
    const base = cell * FEATURES_PER_SQUARE;
    let color = 0;
    for (let k = 0; k < COLOR_VALUES; k++) color += Math.abs(after[base + k]! - before[base + k]! - shift[k % 3]!);
    let edge = 0;
    for (let k = COLOR_VALUES; k < FEATURES_PER_SQUARE; k++) edge += Math.abs(after[base + k]! - before[base + k]! * edgeRatio);
    out[cell] = Math.max(color / COLOR_VALUES, (EDGE_GAIN * edge) / EDGE_VALUES);
  }
  return out;
}

/** Riassunto di una casa per il classificatore a 3 classi: colore medio (R, G, B) e «trama» (dispersione della luminosità). */
export function squareSummary(features: Float32Array, cell: number): [number, number, number, number] {
  const base = cell * FEATURES_PER_SQUARE;
  let r = 0;
  let g = 0;
  let b = 0;
  const lum: number[] = [];
  for (let c = 0; c < GRID_CELLS * GRID_CELLS; c++) {
    const R = features[base + c * 3]!;
    const G = features[base + c * 3 + 1]!;
    const B = features[base + c * 3 + 2]!;
    r += R;
    g += G;
    b += B;
    lum.push(0.299 * R + 0.587 * G + 0.114 * B);
  }
  const n = GRID_CELLS * GRID_CELLS;
  const mean = lum.reduce((s, v) => s + v, 0) / n;
  const spread = Math.sqrt(lum.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return [r / n, g / n, b / n, spread];
}
