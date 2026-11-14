import type { ExplanationCache } from './explanationCache';

/**
 * Coda di pre-fetching delle spiegazioni: resta sempre qualche mossa avanti
 * rispetto all'utente. Mentre l'utente pensa alla mossa N, le spiegazioni
 * delle mosse N…N+lookahead-1 vengono generate (una richiesta alla volta,
 * in ordine) e salvate in cache: quando la fotocamera vede la mossa la
 * spiegazione si mostra subito, senza attesa di rete.
 */

export interface PrefetchOptions {
  cache: ExplanationCache;
  key: (ply: number) => string;
  /** Genera la spiegazione della mossa numero `ply` (1 = prima mossa). */
  fetch: (ply: number) => Promise<string>;
  total: number;
  lookahead?: number;
  onReady?: (ply: number, text: string) => void;
}

export class PrefetchQueue {
  private readonly inFlight = new Map<number, Promise<string | null>>();
  private readonly failed = new Set<number>();
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private readonly lookahead: number;

  constructor(private readonly options: PrefetchOptions) {
    this.lookahead = options.lookahead ?? 3;
  }

  /** L'utente deve giocare la mossa `nextPly`: si preparano questa e le successive. */
  advance(nextPly: number): void {
    for (let ply = nextPly; ply < nextPly + this.lookahead && ply <= this.options.total; ply++) {
      if (ply < 1) continue;
      this.schedule(ply);
    }
  }

  peek(ply: number): string | undefined {
    return this.options.cache.peek(this.options.key(ply));
  }

  /** Spiegazione della mossa, aspettandola se è in preparazione (o chiedendola ora). */
  get(ply: number): Promise<string | null> {
    const ready = this.peek(ply);
    if (ready !== undefined) return Promise.resolve(ready);
    this.failed.delete(ply);
    return this.schedule(ply);
  }

  /** Mosse successive a `nextPly` già pronte (per mostrare quanto è avanti la coda). */
  readyAhead(nextPly: number): number {
    let n = 0;
    while (nextPly + n <= this.options.total && this.peek(nextPly + n) !== undefined) n++;
    return n;
  }

  dispose(): void {
    this.disposed = true;
  }

  private schedule(ply: number): Promise<string | null> {
    const running = this.inFlight.get(ply);
    if (running) return running;
    if (this.failed.has(ply) || this.peek(ply) !== undefined) return Promise.resolve(this.peek(ply) ?? null);
    const task = this.chain.then(async () => {
      if (this.disposed) return null;
      const key = this.options.key(ply);
      try {
        const stored = await this.options.cache.get(key);
        if (stored !== undefined) {
          this.options.onReady?.(ply, stored);
          return stored;
        }
        const text = await this.options.fetch(ply);
        if (this.disposed) return null;
        await this.options.cache.put(key, text);
        this.options.onReady?.(ply, text);
        return text;
      } catch {
        this.failed.add(ply);
        return null;
      } finally {
        this.inFlight.delete(ply);
      }
    });
    this.inFlight.set(ply, task);
    this.chain = task;
    return task;
  }
}
