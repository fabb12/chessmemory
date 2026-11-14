import { parseGame } from '../features/games/pgn';
import { FAMOUS_GAMES, type FamousGame } from './games';

/**
 * Categorie delle partite famose. «Più corte» e «più lunghe» si calcolano dal
 * numero di mosse; le altre sono classifiche editoriali, in ordine (la prima è
 * la «più» della categoria).
 */

export type GameCategory = 'all' | 'short' | 'long' | 'elegant' | 'strategic' | 'shocking' | 'instructive' | 'important' | 'carlsen';

export const GAME_CATEGORIES: readonly GameCategory[] = ['all', 'short', 'long', 'elegant', 'strategic', 'shocking', 'instructive', 'important', 'carlsen'];

/** Quante partite mostrano le classifiche calcolate (più corte / più lunghe). */
const LENGTH_TOP = 6;

export const RANKINGS: Record<'elegant' | 'strategic' | 'shocking' | 'instructive' | 'important', readonly string[]> = {
  // Sacrifici a catena e matti con pochi pezzi: la bellezza pura delle combinazioni.
  elegant: ['immortal-game', 'evergreen-game', 'kasparov-topalov', 'opera-game', 'game-of-the-century', 'reti-tartakower', 'steinitz-bardeleben'],
  // Piani lunghi, piccoli vantaggi accumulati, finali tecnici.
  strategic: [
    'fischer-spassky-6',
    'carlsen-anand-2013-5',
    'carlsen-karjakin-2016-10',
    'spassky-fischer-3',
    'anand-carlsen-2013-6',
    'carlsen-anand-2014-6',
    'carlsen-nepomniachtchi-2021-6',
  ],
  // Colpi di scena: il computer che batte il campione, un tredicenne che sacrifica la donna, il re trascinato in d1.
  shocking: ['deep-blue-kasparov-6', 'kasparov-topalov', 'game-of-the-century', 'reti-tartakower', 'legal-mate-game', 'immortal-game', 'carlsen-nepomniachtchi-2021-6'],
  // Un'idea chiara da portarsi a casa: sviluppo, trappole, re al centro, finali.
  instructive: ['opera-game', 'legal-mate-game', 'carlsen-anand-2013-5', 'fischer-spassky-6', 'steinitz-bardeleben', 'evergreen-game', 'carlsen-anand-2014-6'],
  // Partite che hanno cambiato la storia degli scacchi o deciso un titolo mondiale.
  important: [
    'deep-blue-kasparov-6',
    'karpov-kasparov-1985-24',
    'fischer-spassky-6',
    'game-of-the-century',
    'carlsen-anand-2013-5',
    'carlsen-nepomniachtchi-2021-6',
    'immortal-game',
  ],
};

export const PLY_COUNTS: ReadonlyMap<string, number> = new Map(FAMOUS_GAMES.map((g) => [g.id, parseGame(g.pgn).moves.length]));

const byId = new Map(FAMOUS_GAMES.map((g) => [g.id, g]));

/** Le partite di una categoria, nell'ordine in cui mostrarle. `ranked` = l'ordine è una classifica. */
export function gamesIn(category: GameCategory): { games: FamousGame[]; ranked: boolean } {
  const plies = (g: FamousGame) => PLY_COUNTS.get(g.id) ?? 0;
  switch (category) {
    case 'all':
      return { games: [...FAMOUS_GAMES], ranked: false };
    case 'carlsen':
      return { games: FAMOUS_GAMES.filter((g) => `${g.white} ${g.black}`.includes('Carlsen')), ranked: false };
    case 'short':
      return { games: [...FAMOUS_GAMES].sort((a, b) => plies(a) - plies(b)).slice(0, LENGTH_TOP), ranked: true };
    case 'long':
      return { games: [...FAMOUS_GAMES].sort((a, b) => plies(b) - plies(a)).slice(0, LENGTH_TOP), ranked: true };
    default:
      return { games: RANKINGS[category].map((id) => byId.get(id)).filter((g): g is FamousGame => Boolean(g)), ranked: true };
  }
}

export function isGameCategory(value: string | null): value is GameCategory {
  return value !== null && (GAME_CATEGORIES as readonly string[]).includes(value);
}
