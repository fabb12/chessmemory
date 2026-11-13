/**
 * Fotogrammi della fotocamera per la lettura della scacchiera.
 *
 * - `captureBoardFrame`: ritaglia il quadrato centrale (dove l'utente allinea la
 *   scacchiera, come mostra la guida sul video) e lo riduce a bassa risoluzione:
 *   meno pixel di sfondo, più pixel per ogni casa, immagine leggera e veloce.
 * - `frameSignature` / `frameDifference`: miniatura in scala di grigi 48×48 per
 *   capire, senza chiamare Claude, se qualcosa si muove (una mano sulla
 *   scacchiera) o se la posizione è cambiata rispetto all'ultima lettura.
 */

/** Lato del quadrato inviato a Claude: ~100 px per casa. */
export const BOARD_FRAME_SIDE = 896;
const JPEG_QUALITY = 0.8;
const SIGNATURE_SIDE = 48;
/** Differenza di luminosità (0–255) oltre la quale un pixel della miniatura è «cambiato». */
const PIXEL_THRESHOLD = 28;

/** Quadrato centrale del video (lato = lato corto del fotogramma). */
function centerSquare(video: HTMLVideoElement): { sx: number; sy: number; side: number } | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const side = Math.min(w, h);
  return { sx: (w - side) / 2, sy: (h - side) / 2, side };
}

function drawSquare(video: HTMLVideoElement, size: number): CanvasRenderingContext2D | null {
  const square = centerSquare(video);
  if (!square) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: size === SIGNATURE_SIDE });
  if (!ctx) return null;
  ctx.drawImage(video, square.sx, square.sy, square.side, square.side, 0, 0, size, size);
  return ctx;
}

/** Fotogramma corrente: quadrato centrale in JPEG (base64 senza prefisso). */
export function captureBoardFrame(video: HTMLVideoElement): string | null {
  const square = centerSquare(video);
  if (!square) return null;
  const ctx = drawSquare(video, Math.min(BOARD_FRAME_SIDE, Math.round(square.side)));
  return ctx ? (ctx.canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] ?? null) : null;
}

/** Miniatura in scala di grigi del quadrato centrale (48×48 valori 0–255). */
export function frameSignature(video: HTMLVideoElement): Uint8Array | null {
  const ctx = drawSquare(video, SIGNATURE_SIDE);
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, SIGNATURE_SIDE, SIGNATURE_SIDE);
  const out = new Uint8Array(SIGNATURE_SIDE * SIGNATURE_SIDE);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!);
  }
  return out;
}

/** Frazione (0–1) di pixel cambiati tra due miniature. */
export function frameDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) return 1;
  // La luminosità media può cambiare (esposizione automatica): si confrontano i valori centrati.
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < a.length; i++) {
    meanA += a[i]!;
    meanB += b[i]!;
  }
  const shift = (meanB - meanA) / a.length;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(b[i]! - a[i]! - shift) > PIXEL_THRESHOLD) changed++;
  }
  return changed / a.length;
}

/**
 * Decide quando rileggere la scacchiera nell'analisi continua.
 * Una mossa sposta 2 case su 64 (~3% dell'immagine); una mano sopra la
 * scacchiera ne copre molto di più. Si legge quando l'immagine è di nuovo
 * ferma e diversa dall'ultima lettura.
 */
export const MOTION = {
  /** Tra due campioni consecutivi: sopra questa soglia qualcosa si muove. */
  moving: 0.04,
  /** Tra due campioni consecutivi: sotto questa soglia l'immagine è ferma. */
  still: 0.012,
  /** Rispetto all'ultima lettura: sopra questa soglia la posizione è probabilmente cambiata. */
  changed: 0.008,
} as const;
