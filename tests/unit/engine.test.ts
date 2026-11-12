import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';
import { terminalAnalysis, type Analyser, type Analysis } from '../../src/features/engine/engine';
import {
  MATE_CP,
  classifyMove,
  formatScore,
  negateScore,
  parseBestMove,
  parseInfoLine,
  scoreToCp,
  winningChances,
} from '../../src/features/engine/uci';
import { parsePgn, scanGameForMistakes } from '../../src/features/mistakes/game';

describe('lettura dell’output UCI', () => {
  it('interpreta le righe info con punteggio e variante', () => {
    expect(
      parseInfoLine('info depth 6 seldepth 8 multipv 2 score cp 665 nodes 952 nps 86545 hashfull 0 time 11 pv a1b1 f7f6 b1b8 g8f7'),
    ).toEqual({ multipv: 2, depth: 6, score: { kind: 'cp', value: 665 }, pv: ['a1b1', 'f7f6', 'b1b8', 'g8f7'] });
    expect(parseInfoLine('info depth 6 seldepth 2 multipv 1 score mate 1 nodes 952 pv a1a8')).toEqual({
      multipv: 1,
      depth: 6,
      score: { kind: 'mate', value: 1 },
      pv: ['a1a8'],
    });
    expect(parseInfoLine('info depth 3 score cp -20 pv e7e8q')?.pv).toEqual(['e7e8q']);
  });

  it('scarta righe senza variante, punteggi provvisori e altre risposte', () => {
    expect(parseInfoLine('info string NNUE evaluation using nn-xxx.nnue')).toBeNull();
    expect(parseInfoLine('info depth 10 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfoLine('info depth 10 score cp 30 lowerbound nodes 10 pv e2e4')).toBeNull();
    expect(parseInfoLine('uciok')).toBeNull();
  });

  it('legge bestmove', () => {
    expect(parseBestMove('bestmove a1a8 ponder g8h7')).toBe('a1a8');
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeUndefined();
  });
});

describe('punteggi e classificazione', () => {
  it('un matto vale più di qualunque vantaggio, e un matto vicino più di uno lontano', () => {
    expect(scoreToCp({ kind: 'mate', value: 1 })).toBeGreaterThan(scoreToCp({ kind: 'mate', value: 5 }));
    expect(scoreToCp({ kind: 'mate', value: 5 })).toBeGreaterThan(scoreToCp({ kind: 'cp', value: 5000 }));
    expect(scoreToCp({ kind: 'mate', value: 0 })).toBe(-MATE_CP);
    expect(scoreToCp({ kind: 'mate', value: -2 })).toBeLessThan(scoreToCp({ kind: 'cp', value: -5000 }));
    expect(negateScore({ kind: 'cp', value: 40 })).toEqual({ kind: 'cp', value: -40 });
  });

  it('classifica il calo delle probabilità di vittoria', () => {
    expect(winningChances(0)).toBe(0);
    expect(classifyMove(20, 0)).toBeNull();
    expect(classifyMove(0, -100)).toBe('inaccuracy');
    expect(classifyMove(0, -150)).toBe('mistake');
    expect(classifyMove(0, -300)).toBe('blunder');
    expect(classifyMove(scoreToCp({ kind: 'mate', value: 2 }), -50)).toBe('blunder');
    // In una posizione già vinta perdere un pedone non è un errore grave.
    expect(classifyMove(1500, 1400)).toBeNull();
  });

  it('mostra la valutazione dal punto di vista del Bianco', () => {
    expect(formatScore({ kind: 'cp', value: 125 }, true)).toBe('+1,25');
    expect(formatScore({ kind: 'cp', value: 125 }, false)).toBe('−1,25');
    expect(formatScore({ kind: 'cp', value: 0 }, true)).toBe('0,00');
    expect(formatScore({ kind: 'mate', value: 3 }, true)).toBe('M3');
    expect(formatScore({ kind: 'mate', value: 3 }, false)).toBe('−M3');
  });

  it('riconosce le posizioni finali senza interrogare il motore', () => {
    const mate = terminalAnalysis('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(mate?.score).toEqual({ kind: 'mate', value: 0 });
    expect(terminalAnalysis('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')?.score).toEqual({ kind: 'cp', value: 0 });
    expect(terminalAnalysis('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });
});

// ───────── Stockfish reale (stessa build WebAssembly usata nel browser) ─────────

type NodeEngine = { processCommand(cmd: string): void; terminate(): void };
const require = createRequire(import.meta.url);
let listener: ((line: string) => void) | null = null;
const engine = (require('stockfish') as (flavor: string, cb: (line: string) => void) => NodeEngine)('lite-single', (line) =>
  listener?.(line),
);
afterAll(() => engine.terminate());

/** Stessa logica del client del browser, sopra il motore di Node. */
const nodeAnalyser: Analyser = {
  analyse(fen, { depth, multiPv = 1 }) {
    const terminal = terminalAnalysis(fen);
    if (terminal) return Promise.resolve(terminal);
    return new Promise<Analysis>((resolve) => {
      const lines = new Map<number, NonNullable<ReturnType<typeof parseInfoLine>>>();
      listener = (line) => {
        const info = parseInfoLine(line);
        if (info) lines.set(info.multipv, info);
        const best = parseBestMove(line);
        if (best === undefined) return;
        listener = null;
        const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
        resolve({ fen, depth: sorted[0]?.depth ?? 0, lines: sorted, bestMove: best, score: sorted[0]!.score });
      };
      engine.processCommand(`setoption name MultiPV value ${multiPv}`);
      engine.processCommand(`position fen ${fen}`);
      engine.processCommand(`go depth ${depth}`);
    });
  },
};

describe('Stockfish', () => {
  it('trova il matto in una mossa con l’output UCI reale', async () => {
    engine.processCommand('uci');
    const analysis = await nodeAnalyser.analyse('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', { depth: 8, multiPv: 2 });
    expect(analysis.bestMove).toBe('a1a8');
    expect(analysis.score).toEqual({ kind: 'mate', value: 1 });
    expect(analysis.lines).toHaveLength(2);
  }, 30_000);

  it('trova l’errore grave del Nero nel matto del barbiere', async () => {
    const game = parsePgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0');
    const mistakes = await scanGameForMistakes(game.moves, 'b', nodeAnalyser, { depth: 8 });
    const nf6 = mistakes.find((m) => m.move.san === 'Nf6');
    expect(nf6).toBeDefined();
    expect(nf6!.severity).toBe('blunder');
    expect(nf6!.move.moveNumber).toBe(3);
    // Qualunque difesa di f7 va bene: l'importante è che non sia la mossa giocata.
    expect(nf6!.bestMove).not.toBe('g8f6');
    expect(['d8e7', 'g7g6', 'd8f6'].includes(nf6!.bestMove)).toBe(true);
  }, 60_000);
});
