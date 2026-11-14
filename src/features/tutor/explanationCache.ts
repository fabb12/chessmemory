import Dexie, { type Table } from 'dexie';

/**
 * Cache delle spiegazioni del tutor: in memoria (lettura sincrona, 0 ms) e in
 * IndexedDB (sopravvive alla chiusura della pagina: rigiocando la stessa
 * partita le spiegazioni sono già pronte, senza rete né token).
 */

interface CachedExplanation {
  key: string;
  text: string;
  createdAt: number;
}

class TutorCacheDb extends Dexie {
  explanations!: Table<CachedExplanation, string>;

  constructor() {
    super('chessmemory-tutor-cache');
    this.version(1).stores({ explanations: 'key' });
  }
}

/** Versione del prompt: cambiandola le vecchie spiegazioni vengono ignorate. */
const PROMPT_VERSION = 1;

export function explanationKey(gameId: string, ply: number): string {
  return `${gameId}:${ply}:v${PROMPT_VERSION}`;
}

export class ExplanationCache {
  private readonly memory = new Map<string, string>();
  private db: TutorCacheDb | null | undefined;

  private database(): TutorCacheDb | null {
    if (this.db !== undefined) return this.db;
    try {
      this.db = typeof indexedDB === 'undefined' ? null : new TutorCacheDb();
    } catch {
      this.db = null;
    }
    return this.db;
  }

  /** Lettura immediata dalla memoria. */
  peek(key: string): string | undefined {
    return this.memory.get(key);
  }

  async get(key: string): Promise<string | undefined> {
    const hit = this.memory.get(key);
    if (hit !== undefined) return hit;
    try {
      const row = await this.database()?.explanations.get(key);
      if (row) this.memory.set(key, row.text);
      return row?.text;
    } catch {
      return undefined;
    }
  }

  async put(key: string, text: string): Promise<void> {
    this.memory.set(key, text);
    try {
      await this.database()?.explanations.put({ key, text, createdAt: Date.now() });
    } catch {
      // resta in memoria
    }
  }

  /** Carica in memoria le spiegazioni già salvate (es. all'apertura della partita). */
  async warm(keys: readonly string[]): Promise<number> {
    try {
      const rows = await this.database()?.explanations.bulkGet([...keys]);
      let n = 0;
      rows?.forEach((row) => {
        if (row) {
          this.memory.set(row.key, row.text);
          n++;
        }
      });
      return n;
    } catch {
      return 0;
    }
  }
}

let shared: ExplanationCache | null = null;

export function getExplanationCache(): ExplanationCache {
  shared ??= new ExplanationCache();
  return shared;
}
