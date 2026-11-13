import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { placementToRanks, ranksToGrid, type BoardView } from '../../src/features/assistant/boardReading';
import { cellToSquare, cropAround, homography, plausibleCorners, type Corners } from '../../src/features/vision/geometry';
import { cellChanges, changesBySquare, inferMove, SAMPLES_PER_SIDE } from '../../src/features/vision/localMove';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SQUARE: Corners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
// Scacchiera vista inclinata: il lato lontano (in alto) è più stretto.
const TILTED: Corners = [
  { x: 0.3, y: 0.2 },
  { x: 0.7, y: 0.2 },
  { x: 0.9, y: 0.85 },
  { x: 0.1, y: 0.85 },
];

describe('geometria della scacchiera', () => {
  it('l\'omografia porta gli angoli del quadrato unitario sugli angoli visti', () => {
    for (const corners of [SQUARE, TILTED]) {
      const h = homography(corners);
      const unit = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as const;
      unit.forEach(([u, v], k) => {
        const p = h(u, v);
        expect(p.x).toBeCloseTo(corners[k]!.x, 9);
        expect(p.y).toBeCloseTo(corners[k]!.y, 9);
      });
    }
  });

  it('in prospettiva il centro della scacchiera è più vicino al lato lontano', () => {
    const center = homography(TILTED)(0.5, 0.5);
    expect(center.x).toBeCloseTo(0.5, 6);
    // Il lato lontano è più corto: le traverse lontane appaiono schiacciate, il centro sale.
    expect(center.y).toBeLessThan((0.2 + 0.85) / 2);
  });

  it('riconosce gli angoli plausibili', () => {
    expect(plausibleCorners(TILTED)).toBe(true);
    expect(plausibleCorners([TILTED[0], TILTED[2], TILTED[1], TILTED[3]])).toBe(false); // intrecciato
    expect(plausibleCorners([{ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }, { x: 0.52, y: 0.52 }, { x: 0.5, y: 0.52 }])).toBe(false); // minuscolo
  });

  it('ritaglia attorno alla scacchiera con più margine in alto', () => {
    const rect = cropAround(TILTED, 4 / 3);
    expect(rect.x).toBeLessThan(0.1);
    expect(rect.y).toBeLessThan(0.2 - 0.1);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1);
    expect(rect.y + rect.h).toBeGreaterThan(0.85);
  });

  it('le celle della foto corrispondono alle case, in ogni orientamento', () => {
    const ranks = placementToRanks(START_FEN.split(' ')[0]!);
    const chess = new Chess(START_FEN);
    for (const view of ['bottom', 'top', 'left', 'right'] as BoardView[]) {
      const grid = ranksToGrid(ranks, view);
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = chess.get(cellToSquare(i, j, view) as 'a1');
          const expected = piece ? (piece.color === 'w' ? piece.type.toUpperCase() : piece.type) : '.';
          expect(grid[i]![j]).toBe(expected);
        }
      }
    }
  });
});

/** Campionamento finto: ogni casa ha un «colore» uniforme; i pezzi lo cambiano. */
function fakeSamples(fen: string, view: BoardView, light = 0): Float32Array {
  const chess = new Chess(fen);
  const perCell = SAMPLES_PER_SIDE * SAMPLES_PER_SIDE * 3;
  const out = new Float32Array(64 * perCell);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const sq = cellToSquare(i, j, view);
      const piece = chess.get(sq as 'a1');
      const base = (i + j) % 2 === 0 ? 200 : 110;
      const value = piece ? (piece.color === 'w' ? 235 : 40) + 'pnbrqk'.indexOf(piece.type) * 3 : base;
      out.fill(value + light, (i * 8 + j) * perCell, (i * 8 + j + 1) * perCell);
    }
  }
  return out;
}

describe('mossa riconosciuta senza Claude', () => {
  const play = (moves: string[]) => {
    const chess = new Chess();
    moves.forEach((m) => chess.move(m));
    return chess.fen();
  };

  it('riconosce una mossa semplice, anche con la luce cambiata', () => {
    const before = START_FEN;
    const after = play(['e4']);
    const changes = changesBySquare(cellChanges(fakeSamples(before, 'bottom'), fakeSamples(after, 'bottom', 12)), 'bottom');
    const result = inferMove(before, changes);
    expect(result).toMatchObject({ kind: 'move', uci: 'e2e4', san: 'e4' });
  });

  it('riconosce arrocco e cattura con la foto presa dal lato del Nero', () => {
    const base = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    const castled = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
    let changes = changesBySquare(cellChanges(fakeSamples(base, 'top'), fakeSamples(castled, 'top')), 'top');
    expect(inferMove(base, changes)).toMatchObject({ kind: 'move', san: 'O-O' });

    const beforeCapture = play(['e4', 'd5']);
    const afterCapture = play(['e4', 'd5', 'exd5']);
    changes = changesBySquare(cellChanges(fakeSamples(beforeCapture, 'left'), fakeSamples(afterCapture, 'left')), 'left');
    expect(inferMove(beforeCapture, changes)).toMatchObject({ kind: 'move', san: 'exd5' });
  });

  it('tollera le teste dei pezzi che coprono un po\' le case dietro', () => {
    const changes = changesBySquare(cellChanges(fakeSamples(START_FEN, 'bottom'), fakeSamples(play(['e4']), 'bottom')), 'bottom');
    changes.set('e3', 14);
    changes.set('e5', 14);
    expect(inferMove(START_FEN, changes)).toMatchObject({ kind: 'move', san: 'e4' });
  });

  it('nessun cambiamento: niente mossa', () => {
    const changes = changesBySquare(cellChanges(fakeSamples(START_FEN, 'bottom'), fakeSamples(START_FEN, 'bottom', 20)), 'bottom');
    expect(inferMove(START_FEN, changes)).toEqual({ kind: 'none' });
  });

  it('se cambia una sola casa (o qualcosa di estraneo) chiede a Claude', () => {
    const changes = new Map<string, number>([['e2', 60]]);
    expect(inferMove(START_FEN, changes).kind).toBe('unsure');
    const odd = changesBySquare(cellChanges(fakeSamples(START_FEN, 'bottom'), fakeSamples(play(['e4']), 'bottom')), 'bottom');
    odd.set('a8', 200);
    expect(inferMove(START_FEN, odd)).toEqual({ kind: 'unsure', reason: 'other-changes' });
  });
});
