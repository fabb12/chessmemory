import { BOARD_VIEWS, type BoardView } from '../assistant/boardReading';
import { cellToSquare } from './geometry';
import { appearanceFromFen, geometryForView, type FootprintName } from './perspective';
import { squareSummary } from './squareFeatures';

/**
 * Classificatore leggero a 3 classi per ogni casa: vuota, pezzo bianco, pezzo nero.
 *
 * Non serve un modello addestrato: l'app conosce la posizione (FEN) e quindi
 * sa, per la scacchiera che ha davanti, che aspetto hanno una casa chiara
 * vuota, una casa scura vuota, un pezzo bianco e un pezzo nero su ciascuna.
 * Si impara un «prototipo» per ciascuna combinazione dal fotogramma della
 * posizione nota (sotto la stessa luce, con gli stessi pezzi; le etichette
 * tengono conto della prospettiva: una casa vuota dietro un pezzo alto «si vede»
 * del colore di quel pezzo) e, dopo una
 * mossa, ogni casa va alla classe del prototipo più vicino. Dopo ogni mossa
 * accettata i prototipi si reimparano: il classificatore segue i cambi di luce.
 */

export type Occupant = 'empty' | 'white' | 'black';

export interface SquareOccupancy {
  occupant: Occupant;
  /** 0–1: quanto il prototipo più vicino è più vicino del secondo. */
  confidence: number;
}

interface Prototype {
  occupant: Occupant;
  light: boolean;
  mean: [number, number, number, number];
  count: number;
}

export interface OccupancyModel {
  prototypes: Prototype[];
  /** Scala di ogni dimensione (deviazione standard su tutte le case): le distanze sono normalizzate. */
  scale: [number, number, number, number];
}

const FILES = 'abcdefgh';

export function isLightSquare(square: string): boolean {
  const f = FILES.indexOf(square[0]!);
  const r = Number(square[1]);
  return (f + r) % 2 === 0;
}

/** Occupazione delle 64 case secondo la FEN. */
export function occupancyFromFen(fen: string): Map<string, Occupant> {
  const out = new Map<string, Occupant>();
  const rows = (fen.split(' ')[0] ?? '').split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r] ?? '') {
      if (/\d/.test(ch)) {
        for (let k = 0; k < Number(ch); k++) out.set(`${FILES[f++]}${8 - r}`, 'empty');
      } else {
        out.set(`${FILES[f++]}${8 - r}`, ch === ch.toUpperCase() ? 'white' : 'black');
      }
    }
  }
  return out;
}

function summaries(features: Float32Array): [number, number, number, number][] {
  return Array.from({ length: 64 }, (_, cell) => squareSummary(features, cell));
}

function scaleOf(all: [number, number, number, number][]): [number, number, number, number] {
  const scale: [number, number, number, number] = [1, 1, 1, 1];
  for (let d = 0; d < 4; d++) {
    const values = all.map((s) => s[d]!);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    scale[d] = Math.max(4, Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length));
  }
  return scale;
}

function distance(a: readonly number[], b: readonly number[], scale: readonly number[]): number {
  let sum = 0;
  for (let d = 0; d < 4; d++) sum += ((a[d]! - b[d]!) / scale[d]!) ** 2;
  return Math.sqrt(sum);
}

/** Impara i prototipi dal fotogramma di una posizione nota. Null se mancano le classi di base. */
export function learnOccupancy(features: Float32Array, fen: string, view: BoardView, footprint: FootprintName = 'steep'): OccupancyModel | null {
  const occupancy = appearanceFromFen(fen, geometryForView(view, footprint));
  const all = summaries(features);
  const groups = new Map<string, Prototype>();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const square = cellToSquare(i, j, view);
      const occupant = occupancy.get(square) ?? 'empty';
      const light = isLightSquare(square);
      const key = `${occupant}-${light}`;
      const s = all[i * 8 + j]!;
      const g = groups.get(key) ?? { occupant, light, mean: [0, 0, 0, 0], count: 0 };
      for (let d = 0; d < 4; d++) g.mean[d] = g.mean[d]! + s[d]!;
      g.count++;
      groups.set(key, g);
    }
  }
  const prototypes = [...groups.values()].map((g) => ({ ...g, mean: g.mean.map((v) => v / g.count) as Prototype['mean'] }));
  const has = (o: Occupant) => prototypes.some((p) => p.occupant === o);
  if (!has('empty') || (!has('white') && !has('black'))) return null;
  return { prototypes, scale: scaleOf(all) };
}

/** Che cosa si vede in ogni casa (vuota / colore del pezzo che la copre) secondo il modello. */
export function classifyOccupancy(model: OccupancyModel, features: Float32Array, view: BoardView): Map<string, SquareOccupancy> {
  const out = new Map<string, SquareOccupancy>();
  const all = summaries(features);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const square = cellToSquare(i, j, view);
      const light = isLightSquare(square);
      const s = all[i * 8 + j]!;
      const best = new Map<Occupant, number>();
      for (const occupant of ['empty', 'white', 'black'] as const) {
        // Prima il prototipo sullo stesso colore di casa; se manca, quello sull'altro colore.
        const same = model.prototypes.find((p) => p.occupant === occupant && p.light === light);
        const other = model.prototypes.find((p) => p.occupant === occupant && p.light !== light);
        const proto = same ?? other;
        if (proto) best.set(occupant, distance(s, proto.mean, model.scale) * (same ? 1 : 1.15));
      }
      const ranked = [...best].sort((a, b) => a[1] - b[1]);
      const [first, second] = ranked;
      if (!first) continue;
      const confidence = second ? (second[1] - first[1]) / (second[1] + first[1] + 1e-6) : 0;
      out.set(square, { occupant: first[0], confidence });
    }
  }
  return out;
}

/**
 * Quanto bene la posizione nota spiega il fotogramma con un dato orientamento
 * (più basso = meglio): distanza media di ogni casa dal proprio prototipo,
 * rispetto a quella dal prototipo di un'altra classe. In più i pezzi «bianchi»
 * devono risultare più chiari di quelli «neri»: è ciò che distingue il Bianco
 * in basso dal Bianco in alto quando la posizione è simmetrica.
 */
export function viewFit(features: Float32Array, fen: string, view: BoardView): number {
  const model = learnOccupancy(features, fen, view);
  if (!model) return Infinity;
  const occupancy = appearanceFromFen(fen, geometryForView(view));
  const all = summaries(features);
  let own = 0;
  let others = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const square = cellToSquare(i, j, view);
      const occupant = occupancy.get(square) ?? 'empty';
      const light = isLightSquare(square);
      const s = all[i * 8 + j]!;
      const mine = model.prototypes.find((p) => p.occupant === occupant && p.light === light)!;
      const rivals = model.prototypes.filter((p) => p.occupant !== occupant && p.light === light);
      own += distance(s, mine.mean, model.scale);
      others += rivals.length ? Math.min(...rivals.map((p) => distance(s, p.mean, model.scale))) : 1;
    }
  }
  let fit = own / Math.max(1e-6, others);
  const lum = (p: Prototype) => 0.299 * p.mean[0] + 0.587 * p.mean[1] + 0.114 * p.mean[2];
  for (const light of [true, false]) {
    const white = model.prototypes.find((p) => p.occupant === 'white' && p.light === light);
    const black = model.prototypes.find((p) => p.occupant === 'black' && p.light === light);
    if (white && black && lum(white) < lum(black)) fit += 1;
  }
  return fit;
}

/** Orientamento della scacchiera nell'inquadratura dedotto dalla posizione nota. */
export function detectView(features: Float32Array, fen: string): { view: BoardView; margin: number } {
  const ranked = BOARD_VIEWS.map((view) => ({ view, fit: viewFit(features, fen, view) })).sort((a, b) => a.fit - b.fit);
  const best = ranked[0]!;
  const second = ranked[1];
  return { view: best.view, margin: second && Number.isFinite(second.fit) ? second.fit - best.fit : 0 };
}
