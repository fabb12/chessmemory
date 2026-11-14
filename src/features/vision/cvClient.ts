import { autoDetectCorners } from './calibration';
import type { Corners } from './geometry';
import { analyzeFrame, toGray, workSize } from './pipeline';
import type { CvRequest, CvResponse } from './cv.worker';

/**
 * Accesso alla visione dal thread principale.
 *
 * Normalmente ogni fotogramma (ImageBitmap, trasferito senza copia) va al Web
 * Worker `cv.worker.ts`: il thread dell'interfaccia non tocca i pixel e resta
 * fluido. Un solo fotogramma alla volta: se il worker è occupato il nuovo
 * fotogramma viene scartato (meglio saltare un campione che accumulare ritardo).
 * Dove mancano Worker/OffscreenCanvas (browser vecchi, test) la stessa pipeline
 * gira sul thread principale.
 */

export interface FrameResult {
  thumb: Uint8Array;
  features: Float32Array;
  /** Anteprima raddrizzata top-down, se richiesta. */
  preview: ImageBitmap | ImageData | null;
}

export interface DetectResult {
  corners: Corners | null;
  matched: number;
}

type Pending = { resolve: (value: CvResponse) => void; reject: (error: Error) => void };

export class CvClient {
  private worker: Worker | null = null;
  private failed = false;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private busy = false;

  private ensureWorker(): Worker | null {
    if (this.failed) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      this.failed = true;
      return null;
    }
    try {
      const worker = new Worker(new URL('./cv.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<CvResponse>) => {
        const entry = this.pending.get(event.data.id);
        if (!entry) return;
        this.pending.delete(event.data.id);
        if (event.data.type === 'error') entry.reject(new Error(event.data.message));
        else entry.resolve(event.data);
      };
      worker.onerror = () => {
        // Worker non caricabile: da qui in poi si lavora sul thread principale.
        this.failed = true;
        this.worker?.terminate();
        this.worker = null;
        for (const entry of this.pending.values()) entry.reject(new Error('worker'));
        this.pending.clear();
      };
      this.worker = worker;
      return worker;
    } catch {
      this.failed = true;
      return null;
    }
  }

  private send(request: CvRequest, transfer: Transferable[]): Promise<CvResponse> {
    const worker = this.ensureWorker();
    if (!worker) return Promise.reject(new Error('worker'));
    return new Promise<CvResponse>((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      worker.postMessage(request, transfer);
    });
  }

  /** Elabora il fotogramma attuale del video. Null se il video non è pronto o se un fotogramma è già in lavorazione. */
  async process(video: HTMLVideoElement, corners: Corners, preview = false): Promise<FrameResult | null> {
    if (this.busy || !video.videoWidth || !video.videoHeight) return null;
    this.busy = true;
    try {
      if (this.ensureWorker()) {
        try {
          const size = workSize(video.videoWidth, video.videoHeight);
          const bitmap = await createImageBitmap(video, { resizeWidth: size.width, resizeHeight: size.height });
          const response = await this.send({ type: 'frame', id: this.nextId++, bitmap, corners, preview }, [bitmap]);
          if (response.type === 'frame') return { thumb: response.thumb, features: response.features, preview: response.preview };
        } catch {
          // si ripiega sul thread principale
        }
      }
      return this.processHere(video, corners, preview);
    } finally {
      this.busy = false;
    }
  }

  /** Rilevamento automatico degli angoli sul fotogramma attuale. */
  async detect(video: HTMLVideoElement): Promise<DetectResult> {
    if (!video.videoWidth || !video.videoHeight) return { corners: null, matched: 0 };
    if (this.ensureWorker()) {
      try {
        const bitmap = await createImageBitmap(video);
        const response = await this.send({ type: 'detect', id: this.nextId++, bitmap }, [bitmap]);
        if (response.type === 'detect') return { corners: response.corners, matched: response.matched };
      } catch {
        // si ripiega sul thread principale
      }
    }
    const frame = grab(video);
    if (!frame) return { corners: null, matched: 0 };
    const fit = autoDetectCorners(toGray(frame), frame.width / frame.height);
    return { corners: fit?.corners ?? null, matched: fit?.matched ?? 0 };
  }

  private processHere(video: HTMLVideoElement, corners: Corners, preview: boolean): FrameResult | null {
    const frame = grab(video);
    if (!frame) return null;
    const result = analyzeFrame(frame, corners, preview);
    const image =
      result.rectified && typeof ImageData !== 'undefined'
        ? new ImageData(new Uint8ClampedArray(result.rectified.data), result.rectified.width, result.rectified.height)
        : null;
    return { thumb: result.thumb, features: result.features, preview: image };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const entry of this.pending.values()) entry.reject(new Error('disposed'));
    this.pending.clear();
  }
}

function grab(video: HTMLVideoElement): ImageData | null {
  const size = workSize(video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, size.width, size.height);
  return ctx.getImageData(0, 0, size.width, size.height);
}
