import { homography, type Corners } from './geometry';

/**
 * Trasformazione prospettica: dal quadrilatero della scacchiera nel fotogramma
 * a un quadrato perfetto visto dall'alto (top-down), diviso in 8×8 case uguali.
 *
 * Per ogni pixel del quadrato si calcola con l'omografia il punto
 * corrispondente nel fotogramma e se ne legge il colore (interpolazione
 * bilineare). Funzione pura su buffer RGBA: gira identica nel Web Worker
 * della visione e, se il worker non è disponibile, sul thread principale.
 */

export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/**
 * Raddrizza l'area delimitata da `corners` (frazioni 0–1 di `src`) in un
 * quadrato `size`×`size`. Riga 0 = lato tra gli angoli in alto a sinistra e in
 * alto a destra del fotogramma (cioè il lato lontano dalla fotocamera).
 */
export function rectify(src: RgbaImage, corners: Corners, size: number): RgbaImage {
  const out = new Uint8ClampedArray(size * size * 4);
  const map = homography(corners);
  const { width: w, height: h, data } = src;
  const maxX = w - 1;
  const maxY = h - 1;
  let k = 0;
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const p = map((x + 0.5) / size, v);
      const fx = Math.min(maxX, Math.max(0, p.x * w - 0.5));
      const fy = Math.min(maxY, Math.max(0, p.y * h - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const ax = fx - x0;
      const ay = fy - y0;
      const i00 = (y0 * w + x0) * 4;
      const i10 = (y0 * w + x1) * 4;
      const i01 = (y1 * w + x0) * 4;
      const i11 = (y1 * w + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const top = data[i00 + c]! * (1 - ax) + data[i10 + c]! * ax;
        const bottom = data[i01 + c]! * (1 - ax) + data[i11 + c]! * ax;
        out[k + c] = top * (1 - ay) + bottom * ay;
      }
      out[k + 3] = 255;
      k += 4;
    }
  }
  return { data: out, width: size, height: size };
}

/** Miniatura in scala di grigi (lato `side`) di un'immagine quadrata, per il rilevamento del movimento. */
export function grayThumbnail(img: RgbaImage, side: number): Uint8Array {
  const out = new Uint8Array(side * side);
  const step = img.width / side;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      // Media di un piccolo blocco: meno rumore del singolo pixel.
      let sum = 0;
      let n = 0;
      const y0 = Math.floor(y * step);
      const x0 = Math.floor(x * step);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * step));
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * step));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4;
          sum += 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]!;
          n++;
        }
      }
      out[y * side + x] = Math.round(sum / Math.max(1, n));
    }
  }
  return out;
}
