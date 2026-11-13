/**
 * Fotogrammi della fotocamera per la lettura della scacchiera.
 *
 * - `captureFrame`: ritaglia la scacchiera (se gli angoli sono noti) o il quadrato
 *   centrale, e lo riduce a bassa risoluzione: meno pixel di sfondo, più pixel
 *   per ogni casa, immagine leggera e veloce.
 * - `sampleSquares`: colori del centro di ogni casa, per vedere quali case sono
 *   cambiate tra due fotogrammi (mossa riconosciuta senza Claude).
 * - `frameSignature` / `frameDifference`: miniatura in scala di grigi 48×48 per
 *   capire, senza chiamare Claude, se qualcosa si muove (una mano sulla
 *   scacchiera) o se la posizione è cambiata rispetto all'ultima lettura.
 */

import { cropAround, homography, type Corners, type Rect } from '../features/vision/geometry';
import { samplePoints, SAMPLES_PER_SIDE } from '../features/vision/localMove';

/** Lato massimo dell'immagine inviata a Claude: ~100 px per casa. */
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

export interface CapturedFrame {
  /** JPEG base64 senza prefisso. */
  data: string;
  /** Zona del fotogramma inviata (frazioni di larghezza e altezza). */
  rect: Rect;
}

/** Quadrato centrale come rettangolo in frazioni del fotogramma. */
export function centerRect(video: HTMLVideoElement): Rect | null {
  const square = centerSquare(video);
  if (!square) return null;
  return { x: square.sx / video.videoWidth, y: square.sy / video.videoHeight, w: square.side / video.videoWidth, h: square.side / video.videoHeight };
}

/**
 * Fotogramma da inviare a Claude: se gli angoli della scacchiera sono noti, solo
 * la scacchiera (con un margine per le teste dei pezzi lontani), così ogni casa
 * ha più pixel e l'immagine pesa meno; altrimenti il quadrato centrale.
 */
export function captureFrame(video: HTMLVideoElement, corners: Corners | null): CapturedFrame | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const rect = corners ? cropAround(corners, w / h) : centerRect(video);
  if (!rect) return null;
  const sw = rect.w * w;
  const sh = rect.h * h;
  const scale = Math.min(1, BOARD_FRAME_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, rect.x * w, rect.y * h, sw, sh, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
  return data ? { data, rect } : null;
}

const SAMPLING_WIDTH = 480;

/**
 * Colori della parte centrale di ciascuna delle 64 case (cella i*8+j della
 * griglia vista nella foto), per riconoscere la mossa confrontando due fotogrammi.
 */
export function sampleSquares(video: HTMLVideoElement, corners: Corners): Float32Array | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLING_WIDTH;
  canvas.height = Math.max(1, Math.round((SAMPLING_WIDTH * h) / w));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const map = homography(corners);
  const out = new Float32Array(64 * SAMPLES_PER_SIDE * SAMPLES_PER_SIDE * 3);
  let k = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      for (const [u, v] of samplePoints(i, j)) {
        const p = map(u, v);
        const x = Math.min(canvas.width - 1, Math.max(0, Math.round(p.x * canvas.width)));
        const y = Math.min(canvas.height - 1, Math.max(0, Math.round(p.y * canvas.height)));
        const at = (y * canvas.width + x) * 4;
        out[k++] = data[at]!;
        out[k++] = data[at + 1]!;
        out[k++] = data[at + 2]!;
      }
    }
  }
  return out;
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
