import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { BoardView } from '../../src/features/assistant/boardReading';
import { legalTransitions, matchTransition, touchedSquares } from '../../src/features/engine/moveMatcher';
import { autoDetectCorners, candidateQuads, loadCalibration, saveCalibration } from '../../src/features/vision/calibration';
import { cellToSquare, type Corners } from '../../src/features/vision/geometry';
import { appearanceFromFen, FootprintLock, geometryForView } from '../../src/features/vision/perspective';
import { StabilityTracker } from '../../src/features/vision/motion';
import { classifyOccupancy, detectView, learnOccupancy, occupancyFromFen } from '../../src/features/vision/occupancy';
import { analyzeFrame, toGray } from '../../src/features/vision/pipeline';
import { featureChanges } from '../../src/features/vision/squareFeatures';
import { renderBoard, TILTED } from './helpers/syntheticBoard';

const START = new Chess().fen();

function after(fen: string, ...sans: string[]): string {
  const chess = new Chess(fen);
  for (const san of sans) chess.move(san);
  return chess.fen();
}

function features(fen: string, corners: Corners = TILTED, opts: Parameters<typeof renderBoard>[2] = {}) {
  return analyzeFrame(renderBoard(fen, corners, opts), corners, false).features;
}

function detect(beforeFen: string, afterFen: string, view: BoardView = 'bottom', preferred: string | null = null, extra = [] as Parameters<typeof matchTransition>[0]['candidates'][number][]) {
  const before = features(beforeFen, TILTED, { whiteAtBottom: view === 'bottom' });
  const now = features(afterFen, TILTED, { whiteAtBottom: view === 'bottom', brightness: 0.93 });
  const cells = featureChanges(before, now);
  const changes = new Map<string, number>();
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) changes.set(cellToSquare(i, j, view), cells[i * 8 + j]!);
  const model = learnOccupancy(before, beforeFen, view);
  const occupancy = model ? classifyOccupancy(model, now, view) : null;
  return matchTransition({ fen: beforeFen, candidates: [...legalTransitions(beforeFen), ...extra], changes, occupancy, preferred, geometry: geometryForView(view) });
}

describe('pipeline di visione su scacchiera inclinata (~45°)', () => {
  it('riconosce 1.e4 confrontando le case (anche con la luce cambiata)', () => {
    const result = detect(START, after(START, 'e4'));
    expect(result.kind).toBe('match');
    if (result.kind === 'match') expect(result.transition.uci).toBe('e2e4');
  });

  it('riconosce le catture e l’arrocco (4 case)', () => {
    const before = after(START, 'e4', 'd5');
    const capture = detect(before, after(before, 'exd5'));
    expect(capture.kind === 'match' && capture.transition.uci).toBe('e4d5');
    const castlingFrom = after(START, 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5');
    const castle = detect(castlingFrom, after(castlingFrom, 'O-O'));
    expect(castle.kind === 'match' && castle.transition.uci).toBe('e1g1');
  });

  it('funziona con il Nero dal lato della fotocamera', () => {
    const before = after(START, 'e4');
    const result = detect(before, after(before, 'Nf6'), 'top');
    expect(result.kind === 'match' && result.transition.uci).toBe('g8f6');
  });

  it('funziona anche con la fotocamera dall’alto (pezzi che non coprono le case dietro)', () => {
    const square: Corners = [
      { x: 0.2, y: 0.1 },
      { x: 0.8, y: 0.1 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ];
    const fen = after(START, 'e4', 'e5');
    const next = after(fen, 'Nf3');
    const before = analyzeFrame(renderBoard(fen, square, { pieceHeight: 0.6 }), square, false).features;
    const now = analyzeFrame(renderBoard(next, square, { pieceHeight: 0.6 }), square, false).features;
    const cells = featureChanges(before, now);
    const changes = new Map<string, number>();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) changes.set(cellToSquare(i, j, 'bottom'), cells[i * 8 + j]!);
    const result = matchTransition({ fen, candidates: legalTransitions(fen), changes, geometry: geometryForView('bottom') });
    expect(result.kind === 'match' && result.transition.uci).toBe('g1f3');
    expect(result.kind === 'match' && result.footprint).toBe('flat');
  });

  it('stesso pezzo su un’altra casa: la mossa attesa NON deve risultare giusta', () => {
    const fen = after(START, 'e4', 'e5');
    // Il Maestro gioca Cf3, l'utente mette il cavallo in h3.
    const result = detect(fen, after(fen, 'Nh3'), 'bottom', 'g1f3');
    expect(result.kind === 'match' && result.transition.uci).not.toBe('g1f3');
    expect(result.kind === 'match' && result.transition.uci).toBe('g1h3');
    // E con la mossa giusta la precedenza funziona.
    const right = detect(fen, after(fen, 'Nf3'), 'bottom', 'g1f3');
    expect(right.kind === 'match' && right.transition.uci).toBe('g1f3');
  });

  it('cambiamenti estranei alla mossa (pezzo urtato): meglio chiedere che indovinare', () => {
    const before = features(START);
    const now = features(after(START, 'e4'), TILTED, { brightness: 0.93 });
    const cells = featureChanges(before, now);
    const changes = new Map<string, number>();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) changes.set(cellToSquare(i, j, 'bottom'), cells[i * 8 + j]!);
    // Due case lontane dalla mossa cambiano molto (un pezzo spostato, un riflesso).
    changes.set('a5', 80);
    changes.set('h4', 80);
    const result = matchTransition({ fen: START, candidates: legalTransitions(START), changes, geometry: geometryForView('bottom'), preferred: 'e2e4' });
    expect(result.kind).toBe('unsure');
  });

  it('nessun cambiamento: «none»', () => {
    expect(detect(START, START).kind).toBe('none');
  });

  it('riconosce il ritorno indietro dopo una mossa sbagliata', () => {
    const game = after(START, 'e4');
    const wrong = after(game, 'a6');
    const result = detect(wrong, game, 'bottom', 'takeback', [{ id: 'takeback', fen: game, kind: 'takeback' }]);
    expect(result.kind === 'match' && result.transition.id).toBe('takeback');
  });

  it('il classificatore a 3 classi vede vuota/bianco/nero dopo la mossa', () => {
    const before = features(START);
    const model = learnOccupancy(before, START, 'bottom')!;
    const next = after(START, 'e4');
    const seen = classifyOccupancy(model, features(next), 'bottom');
    // Ciò che si vede in ogni casa, impronta prospettica compresa (e2 è coperta dal re in e1).
    const truth = appearanceFromFen(next, geometryForView('bottom'));
    let correct = 0;
    for (const [sq, occ] of truth) if (seen.get(sq)?.occupant === occ) correct++;
    expect(correct).toBeGreaterThanOrEqual(60);
    expect(seen.get('e4')?.occupant).toBe('white');
    expect(seen.get('e3')?.occupant).toBe('empty');
    expect(occupancyFromFen(next).get('e2')).toBe('empty');
  });

  it('deduce l’orientamento dalla posizione nota', () => {
    expect(detectView(features(START), START).view).toBe('bottom');
    expect(detectView(features(START, TILTED, { whiteAtBottom: false }), START).view).toBe('top');
  });
});

describe('matcher delle mosse', () => {
  it('le case toccate seguono le regole: 2, 3 (en passant), 4 (arrocco)', () => {
    expect(touchedSquares(START, after(START, 'e4'))).toEqual(['e2', 'e4']);
    const ep = after(START, 'e4', 'a6', 'e5', 'd5');
    expect(touchedSquares(ep, after(ep, 'exd6')).sort()).toEqual(['d5', 'd6', 'e5']);
    const castle = after(START, 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5');
    expect(touchedSquares(castle, after(castle, 'O-O')).sort()).toEqual(['e1', 'f1', 'g1', 'h1']);
  });

  it('la mossa attesa vince se è credibile quasi quanto la migliore', () => {
    const changes = new Map<string, number>();
    for (let r = 1; r <= 8; r++) for (const f of 'abcdefgh') changes.set(`${f}${r}`, 2);
    changes.set('e2', 40);
    changes.set('e4', 30);
    changes.set('e3', 26);
    const candidates = legalTransitions(START);
    const plain = matchTransition({ fen: START, candidates, changes });
    const guided = matchTransition({ fen: START, candidates, changes, preferred: 'e2e4' });
    expect(plain.kind).toBe('unsure');
    expect(guided.kind === 'match' && guided.transition.uci).toBe('e2e4');
  });
});

describe('blocco dell’inclinazione', () => {
  it('si blocca dopo 3 mosse con la stessa impronta e si riapre dopo 3 letture incerte', () => {
    const lock = new FootprintLock();
    lock.record('steep');
    lock.record('flat');
    lock.record('steep');
    lock.record('steep');
    expect(lock.locked).toBeNull();
    lock.record('steep');
    expect(lock.locked).toBe('steep');
    lock.record('flat');
    expect(lock.locked).toBe('steep');
    lock.record(null);
    lock.record(null);
    expect(lock.locked).toBe('steep');
    lock.record(null);
    expect(lock.locked).toBeNull();
  });

  it('con l’impronta bloccata il matcher usa solo quella; se è sbagliata chiede invece di indovinare', () => {
    const fen = after(START, 'e4');
    const before = features(fen);
    const now = features(after(fen, 'Nf6'));
    const cells = featureChanges(before, now);
    const changes = new Map<string, number>();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) changes.set(cellToSquare(i, j, 'bottom'), cells[i * 8 + j]!);
    const input = { fen, candidates: legalTransitions(fen), changes, geometry: geometryForView('bottom') };
    const free = matchTransition(input);
    expect(free.kind === 'match' && free.footprint).toBe('flat');
    const locked = matchTransition({ ...input, footprint: 'flat' });
    expect(locked.kind === 'match' && locked.transition.uci).toBe('g8f6');
    expect(locked.kind === 'match' && locked.footprint).toBe('flat');
    // Impronta bloccata sbagliata: nessuna mossa inventata (il blocco si riapre dopo 3 letture incerte).
    const wrong = matchTransition({ ...input, footprint: 'steep' });
    expect(wrong.kind === 'match' && wrong.transition.uci !== 'g8f6').toBe(false);
  });
});

describe('stabilizzazione', () => {
  it('diventa stabile solo dopo 350 ms di immagine ferma', () => {
    const motion = new StabilityTracker();
    const still = new Uint8Array(100).fill(100);
    const hand = new Uint8Array(100).fill(100).map((v, i) => (i < 30 ? 200 : v));
    motion.push(still, 0);
    expect(motion.push(hand, 100).state).toBe('moving');
    expect(motion.push(still, 200).state).toBe('moving');
    expect(motion.push(still, 300).state).toBe('settling');
    expect(motion.push(still, 500).settled).toBe(false);
    const done = motion.push(still, 700);
    expect(done.state).toBe('stable');
    expect(done.settled).toBe(true);
    expect(motion.push(still, 800).settled).toBe(false);
  });
});

describe('calibrazione', () => {
  it('salva e ritrova gli angoli solo con lo stesso formato del video', () => {
    saveCalibration(TILTED, 4 / 3);
    expect(loadCalibration(4 / 3)).toEqual(TILTED);
    expect(loadCalibration(16 / 9)).toBeNull();
  });

  it('le ipotesi iniziali sono quadrilateri dentro il fotogramma', () => {
    for (const quad of candidateQuads(4 / 3)) for (const p of quad) expect(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1).toBe(true);
  });

  it('trova da sola gli angoli di una scacchiera inclinata', () => {
    const frame = renderBoard(after(START, 'e4', 'e5'), TILTED);
    const fit = autoDetectCorners(toGray(frame), frame.width / frame.height);
    expect(fit).not.toBeNull();
    fit!.corners.forEach((p, k) => {
      expect(Math.abs(p.x - TILTED[k]!.x)).toBeLessThan(0.02);
      expect(Math.abs(p.y - TILTED[k]!.y)).toBeLessThan(0.02);
    });
  });
});
