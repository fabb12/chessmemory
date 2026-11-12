import { Chess } from 'chess.js';
import type { Uci } from '../../types';
import { parseBestMove, parseInfoLine, type EngineLine, type Score } from './uci';

/**
 * Stockfish nel browser (WebAssembly, versione «lite» a thread singolo).
 * Il motore gira in un Web Worker servito da /engine/: nessun server, funziona
 * anche offline dopo il primo caricamento.
 */

export interface AnalyseOptions {
  depth: number;
  /** Numero di varianti da calcolare (1–5). */
  multiPv?: number;
}

export interface Analysis {
  fen: string;
  depth: number;
  /** Varianti ordinate dalla migliore. Vuoto se la partita è finita. */
  lines: EngineLine[];
  bestMove: Uci | null;
  /** Punteggio della posizione per chi muove (anche a partita finita). */
  score: Score;
}

/** Interfaccia minima: permette di sostituire il motore nei test. */
export interface Analyser {
  analyse(fen: string, options: AnalyseOptions): Promise<Analysis>;
}

export class EngineUnavailableError extends Error {
  constructor(message = 'Motore di analisi non disponibile') {
    super(message);
    this.name = 'EngineUnavailableError';
  }
}

/** Posizioni di fine partita: non serve interrogare il motore. */
export function terminalAnalysis(fen: string): Analysis | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { fen, depth: 0, lines: [], bestMove: null, score: { kind: 'mate', value: 0 } };
  if (chess.isStalemate() || chess.isInsufficientMaterial()) {
    return { fen, depth: 0, lines: [], bestMove: null, score: { kind: 'cp', value: 0 } };
  }
  return null;
}

const LOAD_TIMEOUT_MS = 20_000;

export class StockfishEngine implements Analyser {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listener: ((line: string) => void) | null = null;

  constructor(private readonly url: string) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
        reject(new EngineUnavailableError());
        return;
      }
      let worker: Worker;
      try {
        worker = new Worker(this.url);
      } catch {
        reject(new EngineUnavailableError());
        return;
      }
      this.worker = worker;
      const timeout = window.setTimeout(() => fail(), LOAD_TIMEOUT_MS);
      const fail = () => {
        window.clearTimeout(timeout);
        this.dispose();
        reject(new EngineUnavailableError());
      };
      worker.onerror = fail;
      worker.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return;
        if (event.data === 'readyok' && this.listener === null) {
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        this.listener?.(event.data);
      };
      worker.postMessage('uci');
      worker.postMessage('isready');
    });
    return this.ready;
  }

  analyse(fen: string, options: AnalyseOptions): Promise<Analysis> {
    const run = async (): Promise<Analysis> => {
      const terminal = terminalAnalysis(fen);
      if (terminal) return terminal;
      await this.start();
      const worker = this.worker;
      if (!worker) throw new EngineUnavailableError();
      const multiPv = Math.max(1, Math.min(5, options.multiPv ?? 1));
      return new Promise<Analysis>((resolve) => {
        const lines = new Map<number, EngineLine>();
        this.listener = (line) => {
          const info = parseInfoLine(line);
          if (info) {
            lines.set(info.multipv, info);
            return;
          }
          const best = parseBestMove(line);
          if (best === undefined) return;
          this.listener = null;
          const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          const top = sorted[0];
          resolve({
            fen,
            depth: top?.depth ?? 0,
            lines: sorted,
            bestMove: best ?? top?.pv[0] ?? null,
            score: top?.score ?? { kind: 'cp', value: 0 },
          });
        };
        worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${Math.max(1, Math.min(30, Math.round(options.depth)))}`);
      });
    };
    // Le analisi sono eseguite una alla volta, nell'ordine di richiesta.
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.listener = null;
  }
}

let shared: StockfishEngine | null = null;

/** Motore condiviso dall'app, avviato alla prima analisi. */
export function getEngine(): StockfishEngine {
  shared ??= new StockfishEngine(`${import.meta.env.BASE_URL}engine/stockfish.js`);
  return shared;
}

/** Profondità di analisi associate alla preferenza dell'utente. */
export const ANALYSIS_DEPTH = { quick: 12, deep: 18 } as const;
export type AnalysisDepth = keyof typeof ANALYSIS_DEPTH;
