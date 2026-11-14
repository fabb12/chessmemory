import { describe, expect, it } from 'vitest';
import { FAMOUS_GAMES } from '../../src/data/games';
import { parseGame } from '../../src/features/games/pgn';
import { fenAt, isGuessTurn, startSession } from '../../src/features/tutor/gameSession';
import { instruction, reasonOf } from '../../src/features/tutor/moveReason';

const opera = parseGame(FAMOUS_GAMES.find((g) => g.id === 'opera-game')!.pgn);
const at = (ply: number) => ({ fen: fenAt(opera, ply - 1), move: opera.moves[ply - 1]!, prev: opera.moves[ply - 2] });

describe('istruzione e perché di ogni mossa (senza Claude)', () => {
  it('dice quale pezzo muovere, da dove e dove', () => {
    expect(instruction(at(1).fen, at(1).move)).toBe('Il Bianco muove il pedone da e2 a e4.');
    expect(instruction(at(2).fen, at(2).move)).toBe('Il Nero muove il pedone da e7 a e5.');
    expect(instruction(at(3).fen, at(3).move)).toBe('Il Bianco muove il cavallo da g1 a f3.');
  });

  it('spiega le catture, il centro e lo sviluppo; usa il commento del PGN quando c’è', () => {
    expect(reasonOf(at(1).fen, at(1).move)).toContain('centro');
    expect(reasonOf(at(3).fen, at(3).move, at(3).prev)).toMatch(/attacca il pedone in e5|Sviluppa il cavallo/);
    expect(reasonOf(at(4).fen, at(4).move, at(4).prev)).toContain('Philidor');
    const capture = opera.moves.findIndex((m) => m.san.includes('x') && !m.comment) + 1;
    expect(reasonOf(at(capture).fen, at(capture).move, at(capture).prev)).toMatch(/Cattura|Riprende/);
  });

  it('ogni mossa della partita ha una spiegazione', () => {
    for (let ply = 1; ply <= opera.moves.length; ply++) {
      expect(reasonOf(at(ply).fen, at(ply).move, at(ply).prev).length).toBeGreaterThan(10);
    }
    expect(reasonOf(at(opera.moves.length).fen, at(opera.moves.length).move)).toMatch(/matto|\w/);
  });

  it('in modalità guidata nessuna mossa va indovinata', () => {
    expect(isGuessTurn(opera, startSession(opera), 'none')).toBe(false);
  });
});
