/**
 * Stabilizzazione: si riconosce una mossa solo quando l'immagine è di nuovo
 * ferma. Finché una mano è sulla scacchiera i fotogrammi cambiano molto
 * l'uno dall'altro e vengono ignorati; quando la differenza resta sotto la
 * soglia per almeno `stableMs` (350 ms) la scena è «stabile» e si confronta.
 */

export type MotionState = 'moving' | 'settling' | 'stable';

export interface MotionOptions {
  /** Differenza (frazione di pixel cambiati) oltre la quale qualcosa si muove. */
  moving: number;
  /** Sotto questa differenza l'immagine è ferma. */
  still: number;
  /** Per quanto deve restare ferma prima di essere stabile. */
  stableMs: number;
}

export const DEFAULT_MOTION: MotionOptions = { moving: 0.035, still: 0.012, stableMs: 350 };

/** Frazione (0–1) di pixel cambiati tra due miniature in scala di grigi, al netto dell'esposizione. */
export function thumbnailDifference(a: Uint8Array, b: Uint8Array, threshold = 26): number {
  if (a.length !== b.length || a.length === 0) return 1;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < a.length; i++) {
    meanA += a[i]!;
    meanB += b[i]!;
  }
  const shift = (meanB - meanA) / a.length;
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(b[i]! - a[i]! - shift) > threshold) changed++;
  return changed / a.length;
}

export class StabilityTracker {
  private state: MotionState = 'stable';
  private stillSince: number | null = null;
  private previous: Uint8Array | null = null;

  constructor(private readonly options: MotionOptions = DEFAULT_MOTION) {}

  get current(): MotionState {
    return this.state;
  }

  /**
   * Nuova miniatura al tempo `now` (ms). Restituisce lo stato e `settled`:
   * true una sola volta, nel momento in cui la scena torna stabile dopo un movimento.
   */
  push(thumb: Uint8Array, now: number): { state: MotionState; settled: boolean; difference: number } {
    const difference = this.previous ? thumbnailDifference(this.previous, thumb) : 0;
    this.previous = thumb;
    let settled = false;
    if (difference > this.options.moving) {
      this.state = 'moving';
      this.stillSince = null;
    } else if (difference < this.options.still) {
      if (this.state !== 'stable') {
        this.stillSince ??= now;
        this.state = 'settling';
        if (now - this.stillSince >= this.options.stableMs) {
          this.state = 'stable';
          settled = true;
        }
      }
    } else {
      // Un cambiamento piccolo ma reale (un pezzo spostato senza che la mano si veda,
      // o una mano che si sta ritirando): si aspetta che l'immagine resti ferma.
      this.state = 'settling';
      this.stillSince = now;
    }
    return { state: this.state, settled, difference };
  }

  reset(): void {
    this.state = 'stable';
    this.stillSince = null;
    this.previous = null;
  }
}
