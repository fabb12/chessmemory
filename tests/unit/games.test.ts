import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { FAMOUS_GAMES, findGame } from '../../src/data/games';
import { parseGame } from '../../src/features/games/pgn';

describe('partite famose', () => {
  it('ha identificativi unici, almeno quindici partite e diverse di Carlsen', () => {
    expect(FAMOUS_GAMES.length).toBeGreaterThanOrEqual(15);
    expect(FAMOUS_GAMES.filter((g) => `${g.white} ${g.black}`.includes('Carlsen')).length).toBeGreaterThanOrEqual(5);
    expect(new Set(FAMOUS_GAMES.map((g) => g.id)).size).toBe(FAMOUS_GAMES.length);
    expect(findGame('opera-game')?.white).toBe('Paul Morphy');
  });

  describe.each(FAMOUS_GAMES.map((g) => [g.id, g] as const))('%s', (_id, game) => {
    const parsed = parseGame(game.pgn);

    it('contiene solo mosse legali', () => {
      expect(parsed.moves.length).toBeGreaterThan(10);
      expect(parsed.moves.map((m) => m.ply)).toEqual(parsed.moves.map((_, i) => i + 1));
    });

    it('termina con il risultato dichiarato', () => {
      const last = parsed.moves[parsed.moves.length - 1]!;
      const chess = new Chess(last.fen);
      if (last.san.includes('#')) {
        expect(chess.isCheckmate()).toBe(true);
        expect(game.result).toBe(last.color === 'w' ? '1-0' : '0-1');
      } else {
        expect(chess.isGameOver()).toBe(false);
      }
      // la partita abbandonata: l'ultima mossa è del vincitore
      if (game.result !== '1/2-1/2') expect(last.color).toBe(game.result === '1-0' ? 'w' : 'b');
    });

    it('ha commenti e testi didattici', () => {
      expect(parsed.moves.filter((m) => m.comment).length).toBeGreaterThanOrEqual(3);
      expect(game.summary.length).toBeGreaterThan(40);
      expect(game.lessons.length).toBeGreaterThanOrEqual(2);
      expect(game.themes.length).toBeGreaterThan(0);
    });
  });

  it('riconosce numeri di mossa, annotazioni e commenti', () => {
    const { moves } = parseGame('1.e4 {centro} e5 2.Nf3! Nc6?! 3.Bb5 {la Spagnola}');
    expect(moves.map((m) => m.uci)).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    expect(moves[0]!.comment).toBe('centro');
    expect(moves[3]!.san).toBe('Nc6?!');
    expect(moves[4]!.moveNumber).toBe(3);
    expect(() => parseGame('1.e4 e5 2.Ke3')).toThrow(/illegale/);
  });
});
