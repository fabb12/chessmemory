import type { ConceptResult, MoveTaskResult, SessionItemKind } from '../../src/types';

export const DAY = 86_400_000;
/** Mezzogiorno locale di una data fissa, per test indipendenti dall'orario. */
export const T0 = new Date(2026, 0, 10, 12, 0, 0).getTime();

export function task(exerciseId: string, quality: 'clean' | 'assisted' | 'failed'): MoveTaskResult {
  return {
    exerciseId,
    correct: quality !== 'failed',
    attempts: quality === 'clean' ? 1 : 3,
    mistakes: quality === 'clean' ? 0 : 2,
    hintsUsed: quality === 'clean' ? 0 : 2,
    responseMs: 4000,
  };
}

export function conceptResult(
  conceptId: string,
  kind: SessionItemKind,
  recall: 'clean' | 'assisted' | 'failed',
  explainCorrect = true,
  transfer: 'clean' | 'assisted' | 'failed' | null = 'clean',
): ConceptResult {
  return {
    conceptId,
    kind,
    recall: task(`${conceptId}-a`, recall),
    explain: { exerciseId: `${conceptId}-a`, correct: explainCorrect, selectedOptionId: 'a', responseMs: 3000 },
    ...(transfer ? { transfer: task(`${conceptId}-b`, transfer) } : {}),
  };
}
