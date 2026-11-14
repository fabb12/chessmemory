import { autoDetectCorners } from './calibration';
import type { Corners } from './geometry';
import { analyzeFrame, toGray, workSize } from './pipeline';
import type { RgbaImage } from './rectify';

/**
 * Web Worker della visione: tutta l'elaborazione dei pixel (riduzione,
 * raddrizzamento prospettico, descrittori delle case, rilevamento degli
 * angoli) avviene qui, fuori dal thread dell'interfaccia.
 */

export type CvRequest =
  | { type: 'frame'; id: number; bitmap: ImageBitmap; corners: Corners; preview: boolean }
  | { type: 'detect'; id: number; bitmap: ImageBitmap };

export type CvResponse =
  | { type: 'frame'; id: number; thumb: Uint8Array; features: Float32Array; preview: ImageBitmap | null }
  | { type: 'detect'; id: number; corners: Corners | null; matched: number }
  | { type: 'error'; id: number; message: string };

interface WorkerScope {
  postMessage(message: CvResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<CvRequest>) => void) | null;
}
const scope = self as unknown as WorkerScope;
let canvas: OffscreenCanvas | null = null;

function pixels(bitmap: ImageBitmap): RgbaImage {
  const size = workSize(bitmap.width, bitmap.height);
  if (!canvas || canvas.width !== size.width || canvas.height !== size.height) canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context non disponibile');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return ctx.getImageData(0, 0, size.width, size.height);
}

scope.onmessage = async (event: MessageEvent<CvRequest>) => {
  const request = event.data;
  try {
    const frame = pixels(request.bitmap);
    if (request.type === 'frame') {
      const result = analyzeFrame(frame, request.corners, request.preview);
      let preview: ImageBitmap | null = null;
      if (result.rectified) {
        const { data, width, height } = result.rectified;
        preview = await createImageBitmap(new ImageData(new Uint8ClampedArray(data), width, height));
      }
      const response: CvResponse = { type: 'frame', id: request.id, thumb: result.thumb, features: result.features, preview };
      const transfer: Transferable[] = [result.thumb.buffer, result.features.buffer];
      if (preview) transfer.push(preview);
      scope.postMessage(response, transfer);
    } else {
      const fit = autoDetectCorners(toGray(frame), frame.width / frame.height);
      const response: CvResponse = { type: 'detect', id: request.id, corners: fit?.corners ?? null, matched: fit?.matched ?? 0 };
      scope.postMessage(response);
    }
  } catch (error) {
    scope.postMessage({ type: 'error', id: request.id, message: error instanceof Error ? error.message : String(error) } satisfies CvResponse);
  }
};
