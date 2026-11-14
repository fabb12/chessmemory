import { describe, expect, it, vi } from 'vitest';
import { FAMOUS_GAMES } from '../../src/data/games';
import { parseGame } from '../../src/features/games/pgn';
import { ExplanationCache, explanationKey } from '../../src/features/tutor/explanationCache';
import {
  boardFen,
  extraTransitions,
  isGuessTurn,
  playOnBoard,
  preferredTransition,
  sameMove,
  skipMove,
  startSession,
  takeBack,
  undoMove,
} from '../../src/features/tutor/gameSession';
import { PrefetchQueue } from '../../src/features/tutor/prefetchQueue';
import { applyUci } from '../../src/utils/chess';

const opera = parseGame(FAMOUS_GAMES.find((g) => g.id === 'opera-game')!.pgn);

function play(state: ReturnType<typeof startSession>, uci: string) {
  const move = applyUci(boardFen(state), uci)!;
  return playOnBoard(opera, state, uci, move.san, move.fen);
}

describe('sessione del tutor delle grandi partite', () => {
  it('la mossa del Maestro fa avanzare subito la partita', () => {
    const start = startSession(opera);
    expect(preferredTransition(opera, start)).toBe('e2e4');
    const { state, outcome } = play(start, 'e2e4');
    expect(outcome.kind).toBe('match');
    expect(state.ply).toBe(1);
    expect(state.found).toBe(1);
  });

  it('una mossa diversa è una deviazione: si aspetta il ritorno indietro', () => {
    const { state, outcome } = play(startSession(opera), 'd2d4');
    expect(outcome.kind).toBe('deviation');
    expect(state.ply).toBe(0);
    expect(boardFen(state)).toContain('3P4');
    expect(extraTransitions(state)).toEqual([{ id: 'takeback', fen: opera.startFen, kind: 'takeback' }]);
    expect(preferredTransition(opera, state)).toBe('takeback');
    // Mentre c'è una deviazione le altre mosse sono ignorate.
    expect(play(state, 'e7e5').outcome.kind).toBe('ignored');
    const back = takeBack(state);
    expect(back.deviation).toBeNull();
    const retry = play(back, 'e2e4');
    expect(retry.outcome).toMatchObject({ kind: 'match', firstTry: false });
    expect(retry.state.found).toBe(0);
  });

  it('colore dell’utente, avanti e indietro a mano', () => {
    const start = startSession(opera);
    expect(isGuessTurn(opera, start, 'w')).toBe(true);
    expect(isGuessTurn(opera, start, 'b')).toBe(false);
    const next = skipMove(opera, start);
    expect(next.ply).toBe(1);
    expect(undoMove(opera, next).ply).toBe(0);
  });

  it('confronto delle mosse UCI con la promozione', () => {
    expect(sameMove('e7e8q', 'e7e8')).toBe(true);
    expect(sameMove('e7e8q', 'e7e8n')).toBe(false);
    expect(sameMove('e2e4', 'e2e3')).toBe(false);
  });
});

describe('pre-fetching delle spiegazioni', () => {
  it('prepara le prossime mosse in anticipo, una alla volta, e le serve dalla cache', async () => {
    const cache = new ExplanationCache();
    const fetch = vi.fn(async (ply: number) => `spiegazione ${ply}`);
    const queue = new PrefetchQueue({ cache, key: (ply) => explanationKey('test-game', ply), fetch, total: 10, lookahead: 3 });
    queue.advance(1);
    expect(await queue.get(3)).toBe('spiegazione 3');
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    // Già pronte: lettura sincrona, nessuna nuova richiesta.
    expect(queue.peek(2)).toBe('spiegazione 2');
    expect(queue.readyAhead(1)).toBe(3);
    queue.advance(2);
    expect(await queue.get(4)).toBe('spiegazione 4');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('le spiegazioni restano in IndexedDB per la prossima volta', async () => {
    const key = explanationKey('persist-game', 5);
    await new ExplanationCache().put(key, 'salvata');
    const fresh = new ExplanationCache();
    expect(fresh.peek(key)).toBeUndefined();
    expect(await fresh.warm([key])).toBe(1);
    expect(fresh.peek(key)).toBe('salvata');
  });

  it('un errore di rete non blocca la coda', async () => {
    const cache = new ExplanationCache();
    const fetch = vi.fn(async (ply: number) => {
      if (ply === 1) throw new Error('rete');
      return `ok ${ply}`;
    });
    const queue = new PrefetchQueue({ cache, key: (ply) => explanationKey('err-game', ply), fetch, total: 5, lookahead: 2 });
    queue.advance(1);
    expect(await queue.get(2)).toBe('ok 2');
    expect(queue.peek(1)).toBeUndefined();
  });
});
