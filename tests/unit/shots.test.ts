import { describe, expect, it } from 'vitest';
import { placementToRanks, ranksToGrid, type BoardView } from '../../src/features/assistant/boardReading';
import type { BoardReading, ReadOptions } from '../../src/features/assistant/claude';
import { bestSymbol, fuseViews, gridEvidence, peaked, type Evidence } from '../../src/features/vision/evidence';
import type { VisionResult } from '../../src/features/vision/hybrid';
import { alignView, combineShots, isSure, ShotSession, toBoardReading, type ShotReading } from '../../src/features/vision/shots';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR';
/** Partita a metà: nessuna posizione nota da cui arrivarci con 1–2 mosse. */
const MIDGAME = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R';

const grid = (placement: string, view: BoardView) => ranksToGrid(placementToRanks(placement), view);
/** Evidenza «YOLO» di una foto: sicura sulle case, con l'orientamento dato. */
const yolo = (placement: string, view: BoardView, confidence = 0.9): Evidence => gridEvidence(grid(placement, view), confidence);
const vision = (evidence: Evidence | null): VisionResult => ({ corners: evidence ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] : null, refined: true, evidence });

function claudeReading(placement: string, view: BoardView, gridOverride?: string[]): BoardReading {
  return {
    placement,
    fen: null,
    sideToMove: 'unknown',
    turnKnown: false,
    confidence: 'high',
    notes: '',
    grid: gridOverride ?? grid(placement, view),
    view,
    rawPlacement: placement,
    corrected: [],
    moves: [],
    corners: null,
    source: 'claude',
  };
}

/** Toglie il pezzo da una casa della griglia vista nella foto (pezzo coperto). */
function hide(g: string[], i: number, j: number): string[] {
  return g.map((row, r) => (r === i ? row.slice(0, j) + '.' + row.slice(j + 1) : row));
}

const ctx = { reference: null, forcedView: null, lastView: null };

describe('fusione di più foto della stessa posizione', () => {
  it('un pezzo coperto in una vista resta, un falso pezzo in una sola vista sparisce', () => {
    const a: Evidence = Array.from({ length: 64 }, () => peaked('.', 0.9));
    const b = a.map((p) => ({ ...p }));
    const c = a.map((p) => ({ ...p }));
    a[0] = peaked('n', 0.9);
    b[0] = peaked('n', 0.9);
    c[1] = peaked('Q', 0.6);
    const fused = fuseViews([a, b, c])!;
    expect(bestSymbol(fused[0]!).symbol).toBe('n');
    expect(bestSymbol(fused[1]!).symbol).toBe('.');
  });

  it('trova da solo da che lato è stata scattata la seconda foto', () => {
    const ranks = gridEvidence(placementToRanks(MIDGAME));
    for (const view of ['bottom', 'top', 'left', 'right'] as const) expect(alignView(yolo(MIDGAME, view), ranks)).toBe(view);
  });

  it('dalla foto laterale recupera il pezzo coperto nella prima', () => {
    // Foto 1 dal lato del Bianco: Claude non vede il cavallo in c6 (coperto). Foto 2 dal lato destro: c'è.
    const first = hide(grid(MIDGAME, 'bottom'), 2, 2);
    const shots: ShotReading[] = [
      { vision: vision(null), claude: claudeReading(MIDGAME, 'bottom', first) },
      { vision: vision(yolo(MIDGAME, 'left')), claude: null },
    ];
    const combined = combineShots(shots, ctx)!;
    expect(combined.resolved.placement).toBe(MIDGAME);
    expect(combined.view).toBe('bottom');
    expect(combined.shots).toBe(2);
    const reading = toBoardReading(combined, shots);
    expect(reading.source).toBe('hybrid');
    expect(reading.grid).toEqual(grid(MIDGAME, 'bottom'));
  });
});

describe('quante foto servono', () => {
  it('posizione spiegata da mosse legali con YOLO: basta una foto, senza Claude', () => {
    const combined = combineShots([{ vision: vision(yolo(AFTER_E4_E5, 'bottom')), claude: null }], ctx)!;
    expect(combined.resolved.placement).toBe(AFTER_E4_E5);
    expect(isSure(combined)).toBe(true);
  });

  it('a metà partita una sola lettura di Claude non basta: serve la seconda foto', () => {
    const combined = combineShots([{ vision: vision(null), claude: claudeReading(MIDGAME, 'bottom') }], ctx)!;
    expect(isSure(combined)).toBe(false);
  });

  it('Claude e YOLO d\'accordo sulla stessa foto: basta così', () => {
    const combined = combineShots([{ vision: vision(yolo(MIDGAME, 'bottom')), claude: claudeReading(MIDGAME, 'bottom') }], ctx)!;
    expect(isSure(combined)).toBe(true);
  });
});

describe('sessione di foto guidate', () => {
  const options = { ...ctx, flippedCoordinates: false, lastRawPlacement: null };

  it('YOLO sicuro: Claude non viene chiamato', async () => {
    const calls: string[] = [];
    const session = new ShotSession(options, {
      local: async () => vision(yolo(START, 'bottom')),
      claude: async (image) => {
        calls.push(image);
        return claudeReading(START, 'bottom');
      },
    });
    const combined = await session.add('foto1');
    expect(combined && isSure(combined)).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('foto 2: se YOLO conferma la lettura di Claude della foto 1, niente seconda chiamata', async () => {
    const seen: string[] = [];
    const session = new ShotSession(options, {
      local: async (image) => vision(image === 'foto2' ? yolo(MIDGAME, 'right') : null),
      claude: async (image) => {
        seen.push(image);
        return claudeReading(MIDGAME, 'bottom');
      },
    });
    await session.add('foto1');
    const combined = await session.add('foto2');
    expect(seen).toEqual(['foto1']);
    expect(combined!.resolved.placement).toBe(MIDGAME);
    expect(isSure(combined!)).toBe(true);
  });

  it('YOLO in disaccordo: Claude legge anche la foto 2, con l\'evidenza di YOLO come indizio', async () => {
    // YOLO sulla foto 2 scambia due pezzi (cavallo/alfiere, cavallo/pedone).
    const wrong = 'r1bq1rk1/pp2bppp/2b1pp2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R';
    const seen: { image: string; options: ReadOptions }[] = [];
    const session = new ShotSession(options, {
      local: async (image) => vision(image === 'foto2' ? yolo(wrong, 'right', 0.7) : null),
      claude: async (image, opts) => {
        seen.push({ image, options: opts });
        return claudeReading(MIDGAME, image === 'foto1' ? 'bottom' : 'right');
      },
    });
    await session.add('foto1');
    const combined = await session.add('foto2');
    expect(seen.map((s) => s.image)).toEqual(['foto1', 'foto2']);
    // Foto 1: scacchiera non trovata da YOLO → la cerca Claude, poi YOLO con i suoi angoli.
    expect(seen[0]!.options.vision).toBeNull();
    expect(seen[0]!.options.analyze).toBeTypeOf('function');
    expect(seen[1]!.options.vision?.evidence).toBeTruthy();
    expect(combined!.resolved.placement).toBe(MIDGAME);
    expect(combined!.shots).toBe(2);
  });

  it('senza chiave API legge solo YOLO', async () => {
    const session = new ShotSession(options, { local: async () => vision(yolo(MIDGAME, 'bottom')), claude: null });
    const combined = await session.add('foto1');
    expect(combined!.resolved.placement).toBe(MIDGAME);
    expect(toBoardReading(combined!, await session.all()).source).toBe('local');
  });
});
