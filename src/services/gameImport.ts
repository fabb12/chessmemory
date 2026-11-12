import { gameLabel, parsePgn, splitPgnGames } from '../features/mistakes/game';

/**
 * Importazione delle ultime partite pubbliche da Lichess o Chess.com, tramite
 * le loro API pubbliche (nessuna chiave). La richiesta parte solo quando
 * l'utente la avvia, e contiene solo il nome utente indicato.
 */

export type GameSite = 'lichess' | 'chesscom';

export interface RemoteGame {
  pgn: string;
  label: string;
}

const MAX_GAMES = 10;
const USERNAME_RE = /^[A-Za-z0-9_-]{2,40}$/;

export class GameImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameImportError';
  }
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim());
}

function toRemote(pgn: string): RemoteGame | null {
  try {
    const parsed = parsePgn(pgn);
    return { pgn, label: gameLabel(parsed.headers) };
  } catch {
    return null;
  }
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new GameImportError(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchRecentGames(
  site: GameSite,
  username: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RemoteGame[]> {
  const user = username.trim();
  if (!isValidUsername(user)) throw new GameImportError('nome utente non valido');

  if (site === 'lichess') {
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${MAX_GAMES}&clocks=false&evals=false`;
    const response = await fetchImpl(url, { headers: { Accept: 'application/x-chess-pgn' } });
    if (!response.ok) throw new GameImportError(`HTTP ${response.status}`);
    const text = await response.text();
    return splitPgnGames(text)
      .map(toRemote)
      .filter((g): g is RemoteGame => g !== null);
  }

  const archives = await getJson(
    `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`,
    fetchImpl,
  );
  const list = (archives as { archives?: unknown }).archives;
  if (!Array.isArray(list) || list.length === 0) return [];
  const games: RemoteGame[] = [];
  // Si parte dal mese più recente; se ha poche partite si aggiunge il precedente.
  for (const archiveUrl of list.slice(-2).reverse()) {
    if (typeof archiveUrl !== 'string' || !archiveUrl.startsWith('https://api.chess.com/')) continue;
    const month = await getJson(archiveUrl, fetchImpl);
    const items = (month as { games?: unknown }).games;
    if (!Array.isArray(items)) continue;
    for (const item of [...items].reverse()) {
      const pgn = (item as { pgn?: unknown }).pgn;
      const rules = (item as { rules?: unknown }).rules;
      if (typeof pgn !== 'string' || (rules !== undefined && rules !== 'chess')) continue;
      const game = toRemote(pgn);
      if (game) games.push(game);
      if (games.length >= MAX_GAMES) return games;
    }
  }
  return games;
}
