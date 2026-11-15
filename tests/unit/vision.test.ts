import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { placementToRanks, ranksToGrid, type BoardView } from '../../src/features/assistant/boardReading';
import { cellToSquare, cropAround, homography, plausibleCorners, type Corners } from '../../src/features/vision/geometry';

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
