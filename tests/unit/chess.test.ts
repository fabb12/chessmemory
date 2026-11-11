import { describe, expect, it } from 'vitest';
import { getExercise } from '../../src/data/exercises';
import { evaluateMove } from '../../src/features/learning/evaluateMove';
import { allLegalUci, applyUci, fenAtStep, kingSquareInCheck, legalTargets, solutionLine } from '../../src/utils/chess';
import { describeMove, formatLine, sanToLocal } from '../../src/utils/notation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('legalità delle mosse (chess.js)', () => {
  it('accetta mosse legali e rifiuta quelle illegali', () => {
    expect(applyUci(START, 'e2e4')?.san).toBe('e4');
    expect(applyUci(START, 'e2e5')).toBeNull();
    expect(applyUci(START, 'e7e5')).toBeNull(); // non è il turno del Nero
    expect(applyUci(START, 'zz')).toBeNull();
  });

  it('elenca le case legali di un pezzo', () => {
    expect(legalTargets(START, 'g1').map((x) => x.to).sort()).toEqual(['f3', 'h3']);
    expect(legalTargets(START, 'e1')).toEqual([]);
    expect(legalTargets(START, 'e5')).toEqual([]);
  });

  it('gestisce l’arrocco muovendo anche la torre', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const short = applyUci(fen, 'e1g1');
    expect(short?.isCastle).toBe(true);
    expect(short?.fen.startsWith('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R4RK1')).toBe(true);
    expect(applyUci(fen, 'e1c1')?.san).toBe('O-O-O');
  });

  it('non permette l’arrocco attraverso una casa attaccata', () => {
    const fen = 'r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1';
    expect(allLegalUci(fen)).not.toContain('e1g1');
    expect(allLegalUci(fen)).toContain('e1c1');
  });

  it('gestisce la presa en passant', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3';
    const move = applyUci(fen, 'd4e3');
    expect(move?.isEnPassant).toBe(true);
    expect(move?.isCapture).toBe(true);
    expect(move?.fen.split(' ')[0]).toBe('rnbqkbnr/ppp1pppp/8/8/8/4p3/PPPP1PPP/RNBQKBNR');
  });

  it('gestisce la promozione e la sottopromozione', () => {
    const fen = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
    expect(legalTargets(fen, 'a7')[0]?.isPromotion).toBe(true);
    expect(applyUci(fen, 'a7a8q')?.fen.startsWith('Q7/')).toBe(true);
    expect(applyUci(fen, 'a7a8n')?.fen.startsWith('N7/')).toBe(true);
    expect(applyUci(fen, 'a7a8')).toBeNull();
  });

  it('riconosce scacco e scacco matto', () => {
    const mate = applyUci('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8');
    expect(mate?.isCheckmate).toBe(true);
    expect(kingSquareInCheck(mate!.fen)).toBe('g8');
    const check = applyUci('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8');
    expect(check?.isCheck).toBe(true);
    expect(check?.isCheckmate).toBe(false);
    expect(kingSquareInCheck(START)).toBeNull();
  });

  it('sotto scacco consente solo le mosse che lo parano', () => {
    const fen = '4k3/8/8/8/8/8/4r3/4K2R w K - 0 1';
    expect(allLegalUci(fen).sort()).toEqual(['e1d1', 'e1e2', 'e1f1']);
  });
});

describe('linea della soluzione', () => {
  it('ricostruisce le posizioni comprese le risposte avversarie', () => {
    const e = getExercise('pawn-breakthrough-a');
    const frames = solutionLine(e);
    expect(frames).toHaveLength(6);
    expect(frames.filter((f) => f.byPlayer)).toHaveLength(3);
    expect(fenAtStep(e, 0)).toBe(e.fen);
    expect(fenAtStep(e, 1)).toBe(frames[2]!.fen);
    expect(fenAtStep(e, 2)).toBe(frames[4]!.fen);
  });

  it('formatta notazione e descrizioni in italiano', () => {
    expect(sanToLocal('Nf3')).toBe('Cf3');
    expect(sanToLocal('Qxf7#')).toBe('Dxf7#');
    expect(sanToLocal('O-O')).toBe('O-O');
    const white = solutionLine(getExercise('count-exchange-a')).flatMap((f) => (f.move ? [f.move] : []));
    expect(formatLine(white)).toBe('1.Cxd5 Cxd5 2.Txd5');
    const black = solutionLine(getExercise('pawn-breakthrough-b')).flatMap((f) => (f.move ? [f.move] : []));
    expect(formatLine(black)).toBe('1…g3 2.hxg3 f3 3.gxf3 h3');
    expect(describeMove(applyUci(START, 'g1f3')!)).toBe('Il Bianco muove il cavallo da g1 a f3.');
  });
});

describe('valutazione delle risposte', () => {
  it('distingue mossa preferita, alternativa, errata e illegale', () => {
    const e = getExercise('center-pawn-a');
    expect(evaluateMove(e, 0, 'e2e4')).toBe('best');
    expect(evaluateMove(e, 0, 'd2d4')).toBe('alternative');
    expect(evaluateMove(e, 0, 'a2a3')).toBe('wrong');
    expect(evaluateMove(e, 0, 'e2e5')).toBe('illegal');
    expect(evaluateMove(e, 3, 'e2e4')).toBe('illegal');
  });

  it('accetta tutte le alternative dichiarate negli esercizi con più risposte valide', () => {
    const e = getExercise('defend-f7-a');
    for (const move of ['g7g6', 'd8e7', 'd8f6']) {
      expect(['best', 'alternative']).toContain(evaluateMove(e, 0, move));
    }
    expect(evaluateMove(e, 0, 'g8f6')).toBe('wrong'); // permette Dxf7#
  });

  it('valuta ogni passo di una sequenza nella posizione corretta', () => {
    const e = getExercise('knight-fork-a');
    expect(evaluateMove(e, 0, 'd5e7')).toBe('best');
    expect(evaluateMove(e, 1, 'e7c6')).toBe('best');
    expect(evaluateMove(e, 1, 'd5e7')).toBe('illegal');
    expect(evaluateMove(e, 1, 'e7g6')).toBe('wrong');
  });
});
