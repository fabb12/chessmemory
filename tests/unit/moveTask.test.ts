import { describe, expect, it } from 'vitest';
import { getExercise } from '../../src/data/exercises';
import {
  canRequestHint,
  hintPlan,
  hintedSquare,
  initialMoveTaskState,
  moveTaskReducer,
  taskQuality,
  toResult,
  visibleHints,
  type MoveTaskAction,
} from '../../src/features/learning/moveTask';

const easy = getExercise('develop-knights-a'); // difficoltà 1
const hard = getExercise('pawn-breakthrough-a'); // difficoltà 5

function run(exercise: typeof easy, actions: MoveTaskAction[]) {
  return actions.reduce((s, a) => moveTaskReducer(s, a, exercise), initialMoveTaskState());
}
const wrong = (uci = 'a2a3'): MoveTaskAction => ({ type: 'move', uci, verdict: 'wrong' });
const undo: MoveTaskAction = { type: 'undo' };

describe('suggerimenti progressivi', () => {
  it('offre più aiuti ai livelli bassi e meno a quelli alti', () => {
    expect(hintPlan(easy).map((h) => h.kind)).toEqual(['strategy', 'strategy', 'piece']);
    expect(hintPlan(getExercise('pin-a')).map((h) => h.kind)).toEqual(['strategy', 'piece']);
    expect(hintPlan(hard).map((h) => h.kind)).toEqual(['strategy']);
  });

  it('al primo errore mostra un indizio strategico, non la soluzione', () => {
    const s = run(easy, [wrong()]);
    expect(s.status).toBe('wrong');
    expect(visibleHints(s, easy)).toEqual([{ kind: 'strategy', text: easy.hints[0] }]);
    expect(hintedSquare(s, easy)).toBeNull();
  });

  it('indica il pezzo solo dopo gli indizi strategici e la soluzione solo alla fine', () => {
    let s = run(easy, [wrong(), undo, wrong(), undo]);
    expect(visibleHints(s, easy)).toHaveLength(2);
    expect(hintedSquare(s, easy)).toBeNull();

    s = run(easy, [wrong(), undo, wrong(), undo, wrong(), undo]);
    expect(visibleHints(s, easy).at(-1)).toEqual({ kind: 'piece' });
    expect(hintedSquare(s, easy)).toBe('g1');
    expect(s.status).toBe('awaiting');

    s = moveTaskReducer(s, wrong(), easy);
    expect(s.status).toBe('failed');
    expect(toResult(s, easy.id, 1000)).toMatchObject({ correct: false, attempts: 4, hintsUsed: 3 });
  });

  it('ignora nuove mosse finché l’errore non viene annullato', () => {
    const s = run(easy, [wrong()]);
    const again = moveTaskReducer(s, { type: 'move', uci: 'g1f3', verdict: 'best' }, easy);
    expect(again).toBe(s);
    const afterUndo = moveTaskReducer(s, undo, easy);
    expect(afterUndo.status).toBe('awaiting');
    expect(afterUndo.wrongMove).toBeUndefined();
  });

  it('permette di chiedere un indizio volontariamente e lo conta', () => {
    let s = run(easy, [{ type: 'hint' }]);
    expect(s.hintsShown).toBe(1);
    expect(canRequestHint(s, easy)).toBe(true);
    s = run(easy, [{ type: 'hint' }, { type: 'hint' }, { type: 'hint' }, { type: 'hint' }]);
    expect(s.hintsShown).toBe(3);
    expect(canRequestHint(s, easy)).toBe(false);
    const solved = moveTaskReducer(s, { type: 'move', uci: 'g1f3', verdict: 'best' }, easy);
    expect(toResult(solved, easy.id, 5)).toMatchObject({ correct: true, attempts: 1, hintsUsed: 3 });
    expect(taskQuality(toResult(solved, easy.id, 5))).toBe('assisted');
  });

  it('non conta le mosse illegali come tentativi', () => {
    const s = run(easy, [{ type: 'move', uci: 'e2e5', verdict: 'illegal' }]);
    expect(s).toEqual(initialMoveTaskState());
  });
});

describe('sequenze e alternative', () => {
  it('avanza passo dopo passo e si risolve all’ultima mossa', () => {
    let s = run(hard, [{ type: 'move', uci: 'b5b6', verdict: 'best' }]);
    expect(s).toMatchObject({ stepIndex: 1, status: 'awaiting' });
    s = moveTaskReducer(s, { type: 'move', uci: 'a5a6', verdict: 'best' }, hard);
    s = moveTaskReducer(s, { type: 'move', uci: 'c5c6', verdict: 'best' }, hard);
    expect(s).toMatchObject({ stepIndex: 2, status: 'solved', attempts: 3, wrongAttempts: 0 });
    expect(taskQuality(toResult(s, hard.id, 1))).toBe('clean');
  });

  it('con pochi aiuti disponibili la soluzione arriva al secondo errore', () => {
    const s = run(hard, [wrong('h1g1'), undo, wrong('h1g2')]);
    expect(s.status).toBe('failed');
    expect(s.hintsShown).toBe(1);
  });

  it('segnala quando è stata giocata un’alternativa valida', () => {
    const s = run(easy, [{ type: 'move', uci: 'b1c3', verdict: 'alternative' }]);
    expect(s.status).toBe('solved');
    expect(s.usedAlternative).toBe(true);
    expect(taskQuality(toResult(s, easy.id, 1))).toBe('clean');
  });
});
