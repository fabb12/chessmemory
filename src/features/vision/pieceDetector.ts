import { useSyncExternalStore } from 'react';

/**
 * Riconoscimento dei pezzi sul dispositivo con un modello YOLO (ONNX, eseguito
 * nel browser con onnxruntime-web in WebAssembly).
 *
 * YOLO vede tutti i pezzi in una sola passata (~0,1–0,4 s su un telefono) e
 * dice per ciascuno tipo, colore, riquadro e confidenza. Da solo non basta
 * (alfieri e pedoni lontani si somigliano), ma insieme a Claude e alle regole
 * degli scacchi rende la lettura molto più affidabile, e spesso evita del
 * tutto la chiamata a Claude (nessun costo, nessuna attesa).
 *
 * Il modello non è incluso nell'app: va messo in `public/models/` (vedi
 * `public/models/README.md`). Senza modello tutto funziona come prima, solo con Claude.
 */

export interface Detection {
  /** Riquadro in frazioni (0–1) dell'immagine analizzata. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Pezzo in notazione FEN: K Q R B N P (Bianco) o k q r b n p (Nero). */
  piece: string;
  score: number;
  /** Altre letture dello stesso pezzo, con classe diversa (es. alfiere/pedone). */
  alternatives: { piece: string; score: number }[];
}

const TYPE_WORDS: [RegExp, string][] = [
  [/king|\bre\b/, 'k'],
  [/queen|donna|regina/, 'q'],
  [/rook|castle|torre/, 'r'],
  [/bishop|alfiere/, 'b'],
  [/knight|horse|cavallo/, 'n'],
  [/pawn|pedone/, 'p'],
];

/**
 * Dal nome della classe del modello al pezzo FEN. Accetta i nomi dei dataset
 * più diffusi: «white-king», «black_pawn», «wK», «bp», «K» / «k»… Le classi che
 * non sono pezzi (es. «board», «bishop» senza colore) restituiscono null.
 */
export function classToPiece(name: string): string | null {
  const raw = name.trim();
  if (/^[KQRBNPkqrbnp]$/.test(raw)) return raw;
  const short = /^([wb])[-_ ]?([KQRBNPkqrbnp])$/.exec(raw);
  if (short) return short[1] === 'w' ? short[2]!.toUpperCase() : short[2]!.toLowerCase();
  const lower = raw.toLowerCase().replace(/[-_]+/g, ' ');
  const color = /\b(white|bianc[oa]|w)\b/.test(lower) ? 'w' : /\b(black|ner[oa]|b)\b/.test(lower) ? 'b' : null;
  if (!color) return null;
  const type = TYPE_WORDS.find(([re]) => re.test(lower))?.[1];
  if (!type) return null;
  return color === 'w' ? type.toUpperCase() : type;
}

export interface Letterbox {
  /** Lato dell'ingresso del modello (es. 640). */
  size: number;
  scale: number;
  padX: number;
  padY: number;
  /** Dimensioni dell'immagine originale. */
  width: number;
  height: number;
}

export function letterbox(width: number, height: number, size: number): Letterbox {
  const scale = Math.min(size / width, size / height);
  return { size, scale, padX: (size - width * scale) / 2, padY: (size - height * scale) / 2, width, height };
}

interface RawBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cls: number;
  score: number;
}

/**
 * Decodifica l'uscita del modello. Formati supportati:
 *  - YOLOv8/v11: [1, 4+nc, N] (o trasposto [1, N, 4+nc]), riquadri cx, cy, w, h;
 *  - YOLOv5: [1, N, 5+nc] con l'«objectness»;
 *  - end-to-end (YOLOv10/26, NMS già fatto): [1, N, 6] = x1, y1, x2, y2, score, classe.
 */
export function decodeOutput(data: ArrayLike<number>, dims: readonly number[], classCount: number, box: Letterbox, minScore = 0.25): RawBox[] {
  const [, a = 0, b = 0] = dims.length === 3 ? dims : [1, ...dims];
  const out: RawBox[] = [];
  const toImage = (x: number, y: number) => ({ x: (x - box.padX) / box.scale / box.width, y: (y - box.padY) / box.scale / box.height });
  const push = (cx: number, cy: number, w: number, h: number, cls: number, score: number) => {
    if (score < minScore) return;
    const p1 = toImage(cx - w / 2, cy - h / 2);
    const p2 = toImage(cx + w / 2, cy + h / 2);
    out.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, cls, score });
  };

  if (b === 6 && classCount !== 2) {
    for (let i = 0; i < a; i++) {
      const o = i * 6;
      const [x1, y1, x2, y2, score, cls] = [data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!, data[o + 4]!, data[o + 5]!];
      push((x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1, Math.round(cls), score);
    }
    return out;
  }
  const v5 = b === 5 + classCount;
  const transposed = a === 4 + classCount; // [1, 4+nc, N]
  const n = transposed ? b : a;
  const stride = transposed ? 1 : b;
  const at = (i: number, f: number) => (transposed ? data[f * b + i]! : data[i * stride + f]!);
  const offset = v5 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < classCount; c++) {
      const s = at(i, offset + c);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (v5) bestScore *= at(i, 4);
    if (best >= 0) push(at(i, 0), at(i, 1), at(i, 2), at(i, 3), best, bestScore);
  }
  return out;
}

export function iou(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): number {
  const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = w * h;
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Soppressione dei non massimi indipendente dalla classe: un pezzo è uno solo.
 * Le letture scartate di classe diversa restano come «alternative» (utili per
 * le probabilità: alfiere 0,55 / pedone 0,40 è diverso da alfiere 0,95).
 */
export function nonMaxSuppression(boxes: readonly RawBox[], classes: readonly (string | null)[], threshold = 0.5): Detection[] {
  const sorted = boxes.filter((b) => classes[b.cls]).sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const box of sorted) {
    const piece = classes[box.cls]!;
    const overlap = kept.find((k) => iou(k, box) > threshold);
    if (overlap) {
      if (overlap.piece !== piece && !overlap.alternatives.some((a) => a.piece === piece)) overlap.alternatives.push({ piece, score: box.score });
      continue;
    }
    kept.push({ x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, piece, score: box.score, alternatives: [] });
  }
  return kept;
}

// ───── Modello ─────

export interface DetectorMeta {
  /** Nomi delle classi nell'ordine del modello. */
  classes: string[];
  /** Lato dell'ingresso (default 640). */
  inputSize?: number;
}

/** Classi del dataset «Chess Pieces» di Roboflow (ordine alfabetico, come lo esporta Ultralytics). */
export const DEFAULT_CLASSES = [
  'black-bishop',
  'black-king',
  'black-knight',
  'black-pawn',
  'black-queen',
  'black-rook',
  'white-bishop',
  'white-king',
  'white-knight',
  'white-pawn',
  'white-queen',
  'white-rook',
];

const MODEL_URL_KEY = 'cm.vision.modelUrl';

/** Indirizzo del modello: quello scelto dall'utente oppure `models/chess-pieces.onnx` dell'app. */
export function modelUrl(): string {
  try {
    const custom = localStorage.getItem(MODEL_URL_KEY);
    if (custom) return custom;
  } catch {
    // archivio non disponibile
  }
  return `${import.meta.env.BASE_URL}models/chess-pieces.onnx`;
}

export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface Loaded {
  run: (input: Float32Array, size: number) => Promise<{ data: Float32Array; dims: readonly number[] }>;
  classes: (string | null)[];
  inputSize: number;
}

let status: DetectorStatus = 'idle';
let loading: Promise<Loaded | null> | null = null;
const statusListeners = new Set<() => void>();

function setStatus(next: DetectorStatus): void {
  status = next;
  statusListeners.forEach((l) => l());
}

export function detectorStatus(): DetectorStatus {
  return status;
}

export function useDetectorStatus(): DetectorStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => 'idle' as DetectorStatus,
  );
}

/** Carica il modello (una volta sola). Restituisce null se non c'è o non si carica. */
export function loadDetector(): Promise<Loaded | null> {
  loading ??= (async () => {
    setStatus('loading');
    try {
      const url = modelUrl();
      const response = await fetch(url);
      const type = response.headers.get('content-type') ?? '';
      // Senza modello il server di sviluppo risponde con index.html: niente modello.
      if (!response.ok || type.includes('text/html')) {
        setStatus('missing');
        return null;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let meta: DetectorMeta = { classes: DEFAULT_CLASSES };
      try {
        const metaResponse = await fetch(url.replace(/\.onnx$/, '.json'));
        if (metaResponse.ok && (metaResponse.headers.get('content-type') ?? '').includes('json')) meta = (await metaResponse.json()) as DetectorMeta;
      } catch {
        // si usano le classi predefinite
      }
      // Caricato solo quando serve: chi non usa la fotocamera non scarica il runtime
      // (il file WebAssembly, ~15 MB, lo emette Vite tra gli asset e viene messo in cache al primo uso).
      const ort = await import('onnxruntime-web/wasm');
      // GitHub Pages non è «cross-origin isolated»: niente thread.
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      const inputName = session.inputNames[0]!;
      const outputName = session.outputNames[0]!;
      const loaded: Loaded = {
        classes: meta.classes.map(classToPiece),
        inputSize: meta.inputSize ?? 640,
        run: async (input, size) => {
          const result = await session.run({ [inputName]: new ort.Tensor('float32', input, [1, 3, size, size]) });
          const tensor = result[outputName]!;
          return { data: tensor.data as Float32Array, dims: tensor.dims };
        },
      };
      setStatus('ready');
      return loaded;
    } catch (error) {
      console.warn('[vision] modello YOLO non disponibile', error);
      setStatus('error');
      return null;
    }
  })();
  return loading;
}

/** Converte l'immagine nell'ingresso del modello: letterbox su sfondo grigio, RGB 0–1, CHW. */
function toTensor(source: CanvasImageSource, width: number, height: number, size: number): { input: Float32Array; box: Letterbox } | null {
  const box = letterbox(width, height, size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(source, box.padX, box.padY, width * box.scale, height * box.scale);
  const { data } = ctx.getImageData(0, 0, size, size);
  const plane = size * size;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 4]! / 255;
    input[plane + i] = data[i * 4 + 1]! / 255;
    input[2 * plane + i] = data[i * 4 + 2]! / 255;
  }
  return { input, box };
}

/** Pezzi visti nell'immagine, o null se il modello non è disponibile. */
export async function detectPieces(source: CanvasImageSource, width: number, height: number): Promise<Detection[] | null> {
  const model = await loadDetector();
  if (!model) return null;
  const prepared = toTensor(source, width, height, model.inputSize);
  if (!prepared) return null;
  try {
    const output = await model.run(prepared.input, model.inputSize);
    const raw = decodeOutput(output.data, output.dims, model.classes.length, prepared.box, 0.2);
    return nonMaxSuppression(raw, model.classes, 0.5);
  } catch (error) {
    console.warn('[vision] errore del modello YOLO', error);
    return null;
  }
}
