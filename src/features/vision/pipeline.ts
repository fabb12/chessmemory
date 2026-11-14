import type { Corners } from './geometry';
import type { GrayImage } from './gridFit';
import { grayThumbnail, rectify, type RgbaImage } from './rectify';
import { squareFeatures } from './squareFeatures';

/**
 * Elaborazione di un fotogramma, la stessa nel Web Worker e (se il worker non
 * c'è) sul thread principale: raddrizzamento top-down, miniatura per il
 * movimento e descrittori delle 64 case.
 */

/** Lato del quadrato raddrizzato: 32 px per casa. */
export const RECTIFIED_SIDE = 256;
/** Lato della miniatura per il rilevamento del movimento (solo l'area della scacchiera). */
export const THUMB_SIDE = 48;
/** Larghezza massima a cui si riduce il fotogramma prima di elaborarlo. */
export const WORK_WIDTH = 640;

export interface FrameAnalysis {
  thumb: Uint8Array;
  features: Float32Array;
  /** Immagine raddrizzata (solo se richiesta, per l'anteprima). */
  rectified: RgbaImage | null;
}

export function analyzeFrame(frame: RgbaImage, corners: Corners, withPreview: boolean): FrameAnalysis {
  const top = rectify(frame, corners, RECTIFIED_SIDE);
  return { thumb: grayThumbnail(top, THUMB_SIDE), features: squareFeatures(top), rectified: withPreview ? top : null };
}

export function toGray(frame: RgbaImage): GrayImage {
  const gray = new Float32Array(frame.width * frame.height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * frame.data[i * 4]! + 0.587 * frame.data[i * 4 + 1]! + 0.114 * frame.data[i * 4 + 2]!;
  return { data: gray, width: frame.width, height: frame.height };
}

/** Dimensioni di lavoro (riduzione proporzionale a WORK_WIDTH). */
export function workSize(width: number, height: number, maxWidth = WORK_WIDTH): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
