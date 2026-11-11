import { Rating, type Grade } from 'ts-fsrs';
import type { ConceptResult } from '../../types';
import { taskQuality } from '../learning/moveTask';

/**
 * Regole che trasformano il risultato di un concetto nella valutazione FSRS.
 *
 * | Valutazione | Condizione                                                              |
 * |-------------|-------------------------------------------------------------------------|
 * | Again (1)   | RICORDA fallita: la soluzione è stata mostrata.                          |
 * | Hard (2)    | RICORDA riuscita ma con indizi o più tentativi, oppure SPIEGA errata,    |
 * |             | oppure RICONOSCI fallita.                                                |
 * | Good (3)    | RICORDA al primo tentativo senza indizi, SPIEGA corretta, RICONOSCI      |
 * |             | riuscita (anche con aiuti) o non prevista.                               |
 * | Easy (4)    | Come Good, in un ripasso (non al primo studio), con RICONOSCI riuscita   |
 * |             | al primo tentativo senza indizi.                                         |
 *
 * Il tempo di risposta è registrato ma NON entra nella valutazione: chi
 * riflette a lungo e risponde bene non viene penalizzato.
 */
export function rateConceptResult(result: ConceptResult): Grade {
  const recall = taskQuality(result.recall);
  if (recall === 'failed') return Rating.Again;

  const transfer = result.transfer ? taskQuality(result.transfer) : null;
  if (recall === 'assisted' || !result.explain.correct || transfer === 'failed') {
    return Rating.Hard;
  }
  if (result.kind !== 'new' && transfer === 'clean') return Rating.Easy;
  return Rating.Good;
}

/**
 * Punteggio 0–1 della prestazione, usato dal modulo di difficoltà adattiva
 * (distinto da FSRS, che decide soltanto *quando* ripassare).
 */
export function performanceScore(result: ConceptResult): number {
  const recall = taskQuality(result.recall);
  if (recall === 'failed') return 0;
  let score = recall === 'clean' ? 0.6 : 0.35;
  if (result.explain.correct) score += 0.15;
  if (result.transfer) {
    const transfer = taskQuality(result.transfer);
    score += transfer === 'clean' ? 0.25 : transfer === 'assisted' ? 0.12 : 0;
  } else {
    score += 0.25 * (score / 0.75);
  }
  return Math.min(1, Number(score.toFixed(3)));
}
