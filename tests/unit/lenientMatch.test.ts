import { describe, expect, it } from 'vitest';
import { legalTransitions, matchTransition } from '../../src/features/engine/moveMatcher';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function changes(values: Record<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) out.set(`${f}${r}`, values[`${f}${r}`] ?? 0);
  return out;
}

describe('mossa indicata dal tutor: riconoscimento tollerante', () => {
  // e2 cambia molto, e4 quasi niente (pezzo bianco su casa chiara, poco contrasto).
  const input = { fen: START, candidates: legalTransitions(START), changes: changes({ e2: 200, e4: 3 }), preferred: 'e2e4' };

  it('da indovinare: nel dubbio non si accetta', () => {
    expect(matchTransition(input).kind).not.toBe('match');
  });

  it('indicata all’utente: si accetta la mossa attesa', () => {
    const result = matchTransition({ ...input, lenient: true });
    expect(result.kind).toBe('match');
    expect(result.kind === 'match' && result.transition.uci).toBe('e2e4');
  });

  it('anche tollerante, una mossa del tutto diversa non diventa quella attesa', () => {
    const other = matchTransition({ ...input, changes: changes({ d2: 200, d4: 200 }), lenient: true });
    expect(other.kind === 'match' && other.transition.uci).not.toBe('e2e4');
  });
});
