import type { Category, Concept, Exercise } from '../../types';
import { CONCEPTS } from './concepts';
import { OPENING_EXERCISES } from './openings';
import { TACTIC_EXERCISES } from './tactics';
import { STRATEGY_EXERCISES } from './strategy';
import { CALCULATION_EXERCISES } from './calculation';
import { OPENING_PLAN_EXERCISES } from './openingPlans';
import { ENDGAME_EXERCISES } from './endgames';

/**
 * Libreria didattica (lingua: italiano).
 * Per aggiungere una lingua basta fornire un secondo set di file con gli
 * stessi ID: posizioni e mosse non dipendono dalla lingua.
 */
export const EXERCISES: readonly Exercise[] = [
  ...OPENING_EXERCISES,
  ...OPENING_PLAN_EXERCISES,
  ...TACTIC_EXERCISES,
  ...STRATEGY_EXERCISES,
  ...CALCULATION_EXERCISES,
  ...ENDGAME_EXERCISES,
];

export { CONCEPTS };

const exerciseById = new Map(EXERCISES.map((e) => [e.id, e]));
const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));
const exercisesByConcept = new Map<string, Exercise[]>();
for (const e of EXERCISES) {
  const list = exercisesByConcept.get(e.conceptId) ?? [];
  list.push(e);
  exercisesByConcept.set(e.conceptId, list);
}

export function findExercise(id: string): Exercise | undefined {
  return exerciseById.get(id);
}

export function getExercise(id: string): Exercise {
  const e = exerciseById.get(id);
  if (!e) throw new Error(`Esercizio sconosciuto: ${id}`);
  return e;
}

export function findConcept(id: string): Concept | undefined {
  return conceptById.get(id);
}

export function getConcept(id: string): Concept {
  const c = conceptById.get(id);
  if (!c) throw new Error(`Concetto sconosciuto: ${id}`);
  return c;
}

export function getConceptExercises(conceptId: string): readonly Exercise[] {
  return exercisesByConcept.get(conceptId) ?? [];
}

export function conceptsByCategory(category: Category): Concept[] {
  return CONCEPTS.filter((c) => c.category === category);
}
