import { describe, expect, it } from 'vitest';
import { CONCEPTS, getConcept, getConceptExercises } from '../../src/data/exercises';
import { lessonWhy } from '../../src/features/learning/lessonWhy';
import { LESSON_PATH, lessonAfter, PATH_LEVELS, passedLessons, pathState } from '../../src/features/learning/path';

describe('percorso a step', () => {
  it('contiene tutte le lezioni, dalla più facile alla più difficile, fino al livello 5', () => {
    expect(LESSON_PATH).toHaveLength(CONCEPTS.length);
    const levels = LESSON_PATH.map((c) => c.difficulty);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(PATH_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    for (const l of PATH_LEVELS) expect(l.lessons.length, `livello ${l.level}`).toBeGreaterThanOrEqual(5);
    expect(LESSON_PATH.at(-1)!.difficulty).toBe(5);
  });

  it('si sblocca una lezione alla volta, solo se superata da soli', () => {
    const start = pathState(new Set());
    expect(start.next?.id).toBe(LESSON_PATH[0]!.id);
    expect(start.status.get(LESSON_PATH[1]!.id)).toBe('locked');
    const first = LESSON_PATH[0]!.id;
    const passed = passedLessons([
      { conceptId: first, activity: 'explain', correct: true },
      { conceptId: LESSON_PATH[1]!.id, activity: 'recall', correct: false },
      { conceptId: first, activity: 'recall', correct: true },
    ]);
    expect([...passed]).toEqual([first]);
    const after = pathState(passed);
    expect(after.status.get(first)).toBe('done');
    expect(after.next?.id).toBe(LESSON_PATH[1]!.id);
    expect(after.done).toBe(1);
    expect(lessonAfter(first)?.id).toBe(LESSON_PATH[1]!.id);
    const all = pathState(new Set(LESSON_PATH.map((c) => c.id)));
    expect(all.next).toBeNull();
    expect(all.level).toBe(5);
  });

  it('il tutor spiega il perché mossa per mossa, con le risposte forzate e il principio', () => {
    const concept = getConcept('anastasia-mate');
    const exercise = getConceptExercises('anastasia-mate')[0]!;
    const why = lessonWhy(exercise, concept);
    expect(why.steps).toHaveLength(5);
    expect(why.steps[0]).toContain('cavallo');
    expect(why.steps[0]).toContain('scacco');
    expect(why.steps[1]).toMatch(/^Risposta: /);
    expect(why.steps.at(-1)).toContain('Scacco matto');
    expect(why.principle).toBe(concept.principle);
    // Ogni lezione ha una spiegazione completa.
    for (const c of CONCEPTS) for (const e of getConceptExercises(c.id)) expect(lessonWhy(e, c).steps.length).toBeGreaterThan(0);
  });
});
