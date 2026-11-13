import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { placementToRanks, ranksToGrid } from '../../src/features/assistant/boardReading';
import { resolveReading } from '../../src/features/assistant/boardResolve';
import {
  bestSymbol,
  detectionsToEvidence,
  evidenceGrid,
  fuseEvidence,
  gridEvidence,
  temper,
  YOLO_WEIGHT,
  hintGrid,
  informative,
  peaked,
  uncertainCount,
  type Evidence,
} from '../../src/features/vision/evidence';
import type { Corners } from '../../src/features/vision/geometry';
import { applyMatrix, cornersMatrix } from '../../src/features/vision/gridFit';
import { resolveLocal, trustLocal } from '../../src/features/vision/hybrid';
import { classToPiece, decodeOutput, letterbox, nonMaxSuppression, type Detection } from '../../src/features/vision/pieceDetector';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START = START_FEN.split(' ')[0]!;
const photo = (placement: string) => ranksToGrid(placementToRanks(placement), 'bottom');

/** Evidenza «YOLO» simulata: ogni casa sicura al `confidence`, con eccezioni. */
function yolo(placement: string, confidence = 0.95, overrides: Record<number, Record<string, number>> = {}): Evidence {
  const grid = photo(placement);
  const out: Evidence = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) out.push(overrides[i * 8 + j] ?? peaked(grid[i]![j]!, confidence));
  return out;
}
const cell = (square: string) => (8 - Number(square[1])) * 8 + 'abcdefgh'.indexOf(square[0]!);

describe('classi del modello YOLO', () => {
  it('riconosce i nomi dei dataset più diffusi', () => {
    expect(classToPiece('white-king')).toBe('K');
    expect(classToPiece('black_pawn')).toBe('p');
    expect(classToPiece('Black Knight')).toBe('n');
    expect(classToPiece('wQ')).toBe('Q');
    expect(classToPiece('br')).toBe('r');
    expect(classToPiece('B')).toBe('B');
    expect(classToPiece('white-rook')).toBe('R');
    expect(classToPiece('board')).toBeNull();
    expect(classToPiece('bishop')).toBeNull();
  });
});

describe('decodifica dell\'uscita YOLO', () => {
  const classes = ['white-king', 'black-pawn'].map(classToPiece);
  const box = letterbox(640, 480, 640); // padY = 80

  it('formato YOLOv8 [1, 4+nc, N]', () => {
    // Due riquadri: il primo re bianco 0.9, il secondo sotto soglia.
    const n = 2;
    const data = new Float32Array((4 + 2) * n);
    const set = (f: number, i: number, v: number) => (data[f * n + i] = v);
    set(0, 0, 320); set(1, 0, 320); set(2, 0, 64); set(3, 0, 128); set(4, 0, 0.9); set(5, 0, 0.05);
    set(0, 1, 100); set(1, 1, 100); set(2, 1, 10); set(3, 1, 10); set(4, 1, 0.1); set(5, 1, 0.1);
    const raw = decodeOutput(data, [1, 6, n], 2, box, 0.25);
    expect(raw).toHaveLength(1);
    expect(raw[0]!.cls).toBe(0);
    expect(raw[0]!.x1).toBeCloseTo((320 - 32) / 640, 5);
    // y: (256 - 80) / 480
    expect(raw[0]!.y1).toBeCloseTo((256 - 80) / 480, 5);
    const dets = nonMaxSuppression(raw, classes);
    expect(dets[0]!.piece).toBe('K');
  });

  it('formato end-to-end [1, N, 6]', () => {
    const data = new Float32Array([100, 180, 200, 300, 0.8, 1, 0, 0, 0, 0, 0.01, 0]);
    const raw = decodeOutput(data, [1, 2, 6], 2, box, 0.25);
    expect(raw).toHaveLength(1);
    expect(nonMaxSuppression(raw, classes)[0]!.piece).toBe('p');
  });

  it('la soppressione tiene il riquadro migliore e ricorda l\'alternativa', () => {
    const dets = nonMaxSuppression(
      [
        { x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.3, cls: 0, score: 0.6 },
        { x1: 0.11, y1: 0.1, x2: 0.2, y2: 0.31, cls: 1, score: 0.4 },
        { x1: 0.5, y1: 0.5, x2: 0.6, y2: 0.7, cls: 1, score: 0.9 },
      ],
      classes,
    );
    expect(dets).toHaveLength(2);
    expect(dets[1]!.piece).toBe('K');
    expect(dets[1]!.alternatives).toEqual([{ piece: 'p', score: 0.4 }]);
  });
});

describe('dai riquadri alle case', () => {
  // Scacchiera vista inclinata (lato lontano in alto, più stretto).
  const corners: Corners = [
    { x: 0.3, y: 0.2 },
    { x: 0.7, y: 0.2 },
    { x: 0.9, y: 0.85 },
    { x: 0.1, y: 0.85 },
  ];
  const H = cornersMatrix(corners)!;
  /** Riquadro di un pezzo alto in piedi sulla cella (i, j): base al centro della casa, testa sulla casa dietro. */
  const pieceBox = (i: number, j: number, piece: string, score = 0.9): Detection => {
    const base = applyMatrix(H, { x: (j + 0.5) / 8, y: (i + 0.75) / 8 });
    const left = applyMatrix(H, { x: (j + 0.15) / 8, y: (i + 0.75) / 8 });
    const width = 2 * (base.x - left.x);
    const top = applyMatrix(H, { x: (j + 0.5) / 8, y: (i - 0.6) / 8 });
    return { x1: base.x - width / 2, x2: base.x + width / 2, y1: top.y, y2: base.y, piece, score, alternatives: [] };
  };

  it('assegna ogni pezzo alla casa sotto la sua base, non a quella coperta dalla testa', () => {
    const evidence = detectionsToEvidence([pieceBox(0, 4, 'k'), pieceBox(6, 4, 'P', 0.8), pieceBox(7, 0, 'R')], corners)!;
    const grid = evidenceGrid(evidence);
    expect(grid[0]![4]).toBe('k');
    expect(grid[6]![4]).toBe('P');
    expect(grid[5]![4]).toBe('.');
    expect(grid[7]![0]).toBe('R');
    expect(bestSymbol(evidence[6 * 8 + 4]!).probability).toBeGreaterThan(0.7);
  });

  it('ignora i pezzi presi appoggiati fuori dalla scacchiera', () => {
    const outside: Detection = { x1: 0.92, y1: 0.7, x2: 0.97, y2: 0.8, piece: 'q', score: 0.9, alternatives: [] };
    const evidence = detectionsToEvidence([outside], corners)!;
    expect(evidenceGrid(evidence).join('')).toBe('.'.repeat(64));
  });
});

describe('fusione YOLO + Claude + mosse legali', () => {
  it('due fonti d\'accordo danno una casa più sicura di una sola', () => {
    const fused = fuseEvidence(Array(64).fill(peaked('B', 0.8)), Array(64).fill(peaked('B', 0.85)))!;
    expect(bestSymbol(fused[0]!).probability).toBeGreaterThan(0.99);
    expect(fuseEvidence(null, undefined)).toBeNull();
  });

  it('un YOLO sicuro ma sbagliato non smentisce da solo Claude', () => {
    // YOLO dice «cavallo bianco 0,73» dove Claude vede un pedone nero.
    const yoloCell = { N: 0.73, '.': 0.135, p: 0.0113 };
    const fused = fuseEvidence(gridEvidence(['p'.repeat(8), ...Array(7).fill('.'.repeat(8))]), temper(Array(64).fill(yoloCell), YOLO_WEIGHT))!;
    expect(bestSymbol(fused[0]!).symbol).toBe('p');
  });

  it('dove Claude sbaglia un pezzo e YOLO è sicuro, le mosse legali danno ragione a YOLO', () => {
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
    // Claude legge il pedone in e4 come alfiere e l'alfiere in c1 come pedone.
    const claude = photo(after).map((row, i) => (i === 4 ? row.replace('P', 'B') : i === 7 ? 'RNPQKBNR' : row));
    const fused = fuseEvidence(gridEvidence(claude), temper(yolo(after), YOLO_WEIGHT))!;
    const result = resolveReading({ grid: claude, evidence: fused, claimedView: 'bottom', reference: { fen: START_FEN, locked: false } });
    expect(result.placement).toBe(after);
    expect(result.moves).toEqual(['e4']);
    expect(result.fen).toContain(' b KQkq ');
  });

  it('una casa incerta per YOLO si corregge quasi gratis con le mosse legali', () => {
    const chess = new Chess();
    chess.move('e4');
    const after = chess.fen().split(' ')[0]!;
    // YOLO non è sicuro del pedone in e4: alfiere 0,5 / pedone 0,4.
    const evidence = yolo(after, 0.95, { [cell('e4')]: { B: 0.5, P: 0.4, '.': 0.1 } });
    const local = resolveLocal({ evidence, reference: { fen: START_FEN, locked: false }, forcedView: null, lastView: 'bottom', lastRawPlacement: null });
    expect(local.placement).toBe(after);
    expect(local.fitCost).toBeLessThan(0.3);
    expect(trustLocal(local, evidence)).toBe(true);
  });

  it('non si fida della sola visione locale se la lettura non è una mossa legale', () => {
    // Un pedone comparso dal nulla in e5 con grande sicurezza: nessuna mossa lo spiega.
    const weird = 'rnbqkbnr/pppppppp/8/4P3/8/8/PPPPPPPP/RNBQKBNR';
    const evidence = yolo(weird, 0.97);
    const local = resolveLocal({ evidence, reference: { fen: START_FEN, locked: false }, forcedView: null, lastView: 'bottom', lastRawPlacement: null });
    expect(trustLocal(local, evidence)).toBe(false);
  });

  it('non si fida della sola visione locale con troppe case incerte', () => {
    const overrides: Record<number, Record<string, number>> = {};
    for (const sq of ['a2', 'b2', 'c2', 'd2', 'f2']) overrides[cell(sq)] = { P: 0.5, B: 0.4, '.': 0.1 };
    const evidence = yolo(START, 0.95, overrides);
    expect(uncertainCount(evidence)).toBe(5);
    const local = resolveLocal({ evidence, reference: null, forcedView: null, lastView: 'bottom', lastRawPlacement: null });
    expect(trustLocal(local, evidence)).toBe(false);
  });

  it('una lettura YOLO quasi vuota (pezzi che il modello non conosce) viene ignorata', () => {
    const blind = yolo('8/8/8/8/8/8/8/8', 0.9);
    expect(informative(blind, 32)).toBe(false);
    expect(informative(yolo(START), 32)).toBe(true);
  });

  it('nel suggerimento per Claude le case incerte sono «?»', () => {
    const evidence = yolo(START, 0.95, { [cell('e2')]: { P: 0.5, B: 0.45, '.': 0.05 } });
    expect(hintGrid(evidence)[6]).toBe('PPPP?PPP');
  });
});
