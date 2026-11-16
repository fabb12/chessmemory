import { describe, expect, it } from 'vitest';
import { announceOwnMove, greeting, idleLine, outcomeLine, pick, reactToGrade, reactToUserMove } from '../../src/features/play/robot';
import { applyUci } from '../../src/utils/chess';

describe('Benbot, il robot di «Gioca con l’AI»', () => {
  it('sceglie le battute in modo ripetibile e le varia con il seme', () => {
    const list = ['a', 'b', 'c'];
    expect(pick(list, 4)).toBe('b');
    expect(pick(list, 4)).toBe(pick(list, 4));
    expect(pick(list, -1)).toBe('b');
  });

  it('saluta dicendo chi muove per primo', () => {
    expect(greeting('w', true).text).toContain('muovi tu per primo');
    expect(greeting('b', false).text).toContain('comincio io');
    expect(greeting('w', true).mood).toBe('happy');
  });

  it('cambia espressione secondo il giudizio della mossa', () => {
    expect(reactToGrade('best', 1).mood).toBe('wow');
    expect(reactToGrade('good', 1).mood).toBe('happy');
    expect(reactToGrade('blunder', 1).mood).toBe('sad');
    expect(reactToGrade('mistake', 3).text).not.toBe('');
  });

  it('reagisce quando gli catturi la donna, gli dai scacco o arrocchi', () => {
    const queenFen = 'rnb1kbnr/pppp1ppp/8/4p1q1/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 1 3';
    const takesQueen = applyUci(queenFen, 'c1g5')!;
    expect(reactToUserMove(queenFen, takesQueen, 0)).toMatchObject({ mood: 'sad' });
    expect(reactToUserMove(queenFen, takesQueen, 0)!.text).toMatch(/donna/i);

    const checkFen = 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';
    const check = applyUci(checkFen, 'f1b5')!;
    expect(reactToUserMove(checkFen, check, 0)).toMatchObject({ mood: 'worried' });

    const castleFen = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(reactToUserMove(castleFen, applyUci(castleFen, 'e1g1')!, 0)).toMatchObject({ mood: 'happy' });

    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(reactToUserMove(start, applyUci(start, 'e2e4')!, 0)).toBeNull();
  });

  it('annuncia la propria mossa con la notazione italiana', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const line = announceOwnMove(applyUci(fen, 'g8f6')!, 0);
    expect(line.text).toBe('Io gioco Cf6.');
    expect(line.mood).toBe('idle');
  });

  it('commenta la fine della partita e riempie i silenzi', () => {
    expect(outcomeLine('win')).toMatchObject({ mood: 'wow' });
    expect(outcomeLine('loss').text).toContain('ho vinto io');
    expect(idleLine(true, 0)).not.toBe(idleLine(false, 0));
  });

  it('parla nel tono scelto nelle Impostazioni, con le frasi normali come riserva', () => {
    expect(greeting('w', false, 'formal').text).toContain('Lei ha il Bianco');
    expect(greeting('b', false, 'master').text).toContain('comincio io');
    expect(reactToGrade('best', 0, 'playful').text).not.toBe(reactToGrade('best', 0).text);
    expect(reactToGrade('blunder', 0, 'rude').mood).toBe('sad');
    expect(outcomeLine('win', 'youthful').text).toContain('GG');
    // Il tono «amichevole» non ridefinisce lo scacco: resta la frase normale.
    const checkFen = 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';
    const check = applyUci(checkFen, 'f1b5')!;
    expect(reactToUserMove(checkFen, check, 0, 'friendly')!.text).toBe(reactToUserMove(checkFen, check, 0)!.text);
    expect(idleLine(false, 0, 'formal')).toBe('Tocca a Lei.');
  });
});
