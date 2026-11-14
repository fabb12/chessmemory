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

describe('allineamento dopo un salto', () => {
  it('riconosce la posizione di arrivo anche dopo più mosse sistemate insieme', async () => {
    const { touchedSquares } = await import('../../src/features/engine/moveMatcher');
    // Dall'inizio a dopo 1.e4 e5 2.Cf3: cambiano e2, e4, e7, e5, g1, f3.
    const after = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const changed = Object.fromEntries(touchedSquares(START, after).map((sq) => [sq, 200]));
    const align = { id: 'align', fen: after, kind: 'takeback' as const };
    const result = matchTransition({ fen: START, candidates: [...legalTransitions(START), align], changes: changes(changed), preferred: 'align', lenient: true });
    expect(result.kind).toBe('match');
    expect(result.kind === 'match' && result.transition.id).toBe('align');
  });

  it('a pezzi sistemati solo in parte non si allinea', () => {
    const after = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const align = { id: 'align', fen: after, kind: 'takeback' as const };
    const result = matchTransition({ fen: START, candidates: [...legalTransitions(START), align], changes: changes({ e2: 200, e4: 200 }), preferred: 'align', lenient: true });
    expect(result.kind === 'match' && result.transition.id).not.toBe('align');
  });
});
