import { CONCEPTS } from '../../data/exercises';
import type { Concept, Difficulty } from '../../types';
import { CATEGORIES } from '../../types';

/**
 * Percorso a step: tutte le lezioni (un concetto ciascuna) in fila, dalla più
 * facile alla più difficile. Si sblocca una lezione alla volta: la successiva
 * si apre quando la precedente è superata (mossa trovata da soli in RICORDA o
 * in RICONOSCI). Si arriva così al livello 5, «Maestro».
 */

export interface PathLevel {
  level: Difficulty;
  lessons: Concept[];
}

/** Dentro un livello: prima le aperture, poi tattica, strategia, calcolo e finali. */
const categoryRank = (c: Concept) => CATEGORIES.indexOf(c.category);

export const LESSON_PATH: readonly Concept[] = [...CONCEPTS].sort(
  (a, b) => a.difficulty - b.difficulty || categoryRank(a) - categoryRank(b),
);

export const PATH_LEVELS: readonly PathLevel[] = ([1, 2, 3, 4, 5] as const).map((level) => ({
  level,
  lessons: LESSON_PATH.filter((c) => c.difficulty === level),
}));

/** Risposte registrate: bastano concetto, attività ed esito. */
export interface AttemptLike {
  conceptId: string;
  activity: string;
  correct: boolean;
}

/** Lezioni superate: la mossa è stata trovata senza vedere la soluzione. */
export function passedLessons(attempts: readonly AttemptLike[]): Set<string> {
  const passed = new Set<string>();
  for (const a of attempts) if (a.correct && (a.activity === 'recall' || a.activity === 'transfer')) passed.add(a.conceptId);
  return passed;
}

export type LessonStatus = 'done' | 'current' | 'locked';

export interface PathState {
  status: Map<string, LessonStatus>;
  /** Prossima lezione da fare (null = percorso completato). */
  next: Concept | null;
  done: number;
  total: number;
  /** Livello raggiunto: il più alto con almeno una lezione sbloccata. */
  level: Difficulty;
}

export function pathState(passed: ReadonlySet<string>): PathState {
  const status = new Map<string, LessonStatus>();
  let next: Concept | null = null;
  let done = 0;
  for (const lesson of LESSON_PATH) {
    if (passed.has(lesson.id)) {
      status.set(lesson.id, 'done');
      done++;
    } else if (!next) {
      status.set(lesson.id, 'current');
      next = lesson;
    } else status.set(lesson.id, 'locked');
  }
  return { status, next, done, total: LESSON_PATH.length, level: next?.difficulty ?? 5 };
}

/** Lezione successiva a quella indicata, nel percorso. */
export function lessonAfter(conceptId: string): Concept | null {
  const index = LESSON_PATH.findIndex((c) => c.id === conceptId);
  return index >= 0 ? (LESSON_PATH[index + 1] ?? null) : null;
}
