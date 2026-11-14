import { describe, expect, it } from 'vitest';
import { FAMOUS_PLAYERS, GAME_CATEGORIES, gamesIn, gamesOfPlayer, PLY_COUNTS, RANKINGS } from '../../src/data/gameCategories';
import { FAMOUS_GAMES } from '../../src/data/games';

describe('categorie delle partite famose', () => {
  it('le classifiche usano solo partite esistenti, senza doppioni', () => {
    const ids = new Set(FAMOUS_GAMES.map((g) => g.id));
    for (const [name, list] of Object.entries(RANKINGS)) {
      expect(new Set(list).size, name).toBe(list.length);
      for (const id of list) expect(ids.has(id), `${name}: ${id}`).toBe(true);
      expect(gamesIn(name as keyof typeof RANKINGS).games.length).toBe(list.length);
    }
  });

  it('più corte e più lunghe sono ordinate per numero di mosse', () => {
    const short = gamesIn('short').games.map((g) => PLY_COUNTS.get(g.id)!);
    const long = gamesIn('long').games.map((g) => PLY_COUNTS.get(g.id)!);
    expect(short).toEqual([...short].sort((a, b) => a - b));
    expect(long).toEqual([...long].sort((a, b) => b - a));
    expect(gamesIn('short').games[0]!.id).toBe('legal-mate-game');
    expect(gamesIn('long').games[0]!.id).toBe('carlsen-nepomniachtchi-2021-6');
  });

  it('ogni categoria ha delle partite', () => {
    for (const c of GAME_CATEGORIES) expect(gamesIn(c).games.length, c).toBeGreaterThan(0);
    expect(gamesIn('all').games.length).toBe(FAMOUS_GAMES.length);
  });

  it('ogni giocatore famoso ha almeno una partita, in ordine di anno', () => {
    for (const p of FAMOUS_PLAYERS) {
      const games = gamesOfPlayer(p.id);
      expect(games.length, p.id).toBeGreaterThan(0);
      expect(games.map((g) => g.year)).toEqual([...games.map((g) => g.year)].sort((a, b) => a - b));
    }
    expect(gamesOfPlayer('carlsen').length).toBeGreaterThanOrEqual(5);
    expect(gamesOfPlayer('kasparov').map((g) => g.id)).toEqual(['karpov-kasparov-1985-24', 'deep-blue-kasparov-6', 'kasparov-topalov']);
  });
});
