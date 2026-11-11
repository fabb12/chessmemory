import { CONCEPTS, getConceptExercises } from '../../data/exercises';
import type { Concept, Difficulty, SessionItem, SessionItemKind } from '../../types';
import { isDue, type StoredCard } from '../memory/scheduler';

/**
 * Costruzione dell'allenamento quotidiano: ripassi in scadenza, esercizi
 * mirati sulle debolezze e almeno un concetto nuovo, entro un budget
 * indicativo di cinque minuti. Il budget decide quanti concetti proporre:
 * un esercizio iniziato non viene mai interrotto.
 */
export interface SessionConfig {
  budgetSeconds: number;
  secondsPerReview: number;
  secondsPerNew: number;
  maxNew: number;
  maxWeakness: number;
  /** Sotto questa percentuale di successo un concetto è considerato debole. */
  weaknessThreshold: number;
  /** Risposte minime prima di giudicare debole un concetto. */
  weaknessMinAnswers: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  budgetSeconds: 300,
  secondsPerReview: 50,
  secondsPerNew: 90,
  maxNew: 2,
  maxWeakness: 2,
  weaknessThreshold: 0.7,
  weaknessMinAnswers: 3,
};

export interface ConceptAccuracy {
  answers: number;
  correct: number;
}

export interface SessionPlanInput {
  cards: StoredCard[];
  level: Difficulty;
  now: number;
  /** Risultati per concetto, usati per trovare le debolezze. */
  accuracy?: ReadonlyMap<string, ConceptAccuracy>;
  concepts?: readonly Concept[];
  config?: SessionConfig;
}

export interface SessionPlan {
  items: SessionItem[];
  estimatedSeconds: number;
}

/** Sceglie gli esercizi per un concetto, alternandoli a ogni ripasso. */
export function buildItem(conceptId: string, kind: SessionItemKind, reps = 0): SessionItem | null {
  const exercises = getConceptExercises(conceptId);
  const first = exercises[kind === 'new' ? 0 : reps % Math.max(1, exercises.length)];
  if (!first) return null;
  const transfer =
    exercises.length > 1
      ? exercises[(exercises.indexOf(first) + 1) % exercises.length]
      : undefined;
  return {
    conceptId,
    kind,
    exerciseId: first.id,
    ...(transfer ? { transferExerciseId: transfer.id } : {}),
  };
}

/** Concetti non ancora studiati, ordinati per adeguatezza al livello. */
export function rankNewConcepts(
  concepts: readonly Concept[],
  cards: StoredCard[],
  level: Difficulty,
): Concept[] {
  const learned = new Set(cards.map((c) => c.conceptId));
  const perCategory = new Map<string, number>();
  for (const c of concepts) {
    if (learned.has(c.id)) perCategory.set(c.category, (perCategory.get(c.category) ?? 0) + 1);
  }
  const unlearned = concepts.filter((c) => !learned.has(c.id));
  const atOrBelow = unlearned.filter((c) => c.difficulty <= level);
  const pool =
    atOrBelow.length > 0
      ? atOrBelow
      : // Tutto ciò che è alla portata è già stato studiato: si propone il gradino successivo.
        unlearned.filter((c) => c.difficulty === Math.min(...unlearned.map((u) => u.difficulty)));
  return [...pool].sort(
    (a, b) =>
      // prima i concetti più vicini al livello, poi le categorie meno studiate
      b.difficulty - a.difficulty ||
      (perCategory.get(a.category) ?? 0) - (perCategory.get(b.category) ?? 0) ||
      concepts.indexOf(a) - concepts.indexOf(b),
  );
}

export function buildSessionPlan(input: SessionPlanInput): SessionPlan {
  const cfg = input.config ?? DEFAULT_SESSION_CONFIG;
  const concepts = input.concepts ?? CONCEPTS;
  const known = new Set(concepts.map((c) => c.id));
  const cards = input.cards.filter((c) => known.has(c.conceptId));
  const items: SessionItem[] = [];
  let used = 0;

  const push = (conceptId: string, kind: SessionItemKind, reps: number, cost: number) => {
    const item = buildItem(conceptId, kind, reps);
    if (!item) return false;
    items.push(item);
    used += cost;
    return true;
  };

  const newCandidates = rankNewConcepts(concepts, cards, input.level);
  const reserve = newCandidates.length > 0 ? cfg.secondsPerNew : 0;

  // 1. Ripassi in scadenza: prima i più arretrati.
  const due = cards.filter((c) => isDue(c, input.now)).sort((a, b) => a.due - b.due);
  for (const card of due) {
    if (used + cfg.secondsPerReview > cfg.budgetSeconds - reserve) break;
    push(card.conceptId, 'review', card.reps, cfg.secondsPerReview);
  }

  // 2. Esercizi mirati sulle debolezze (concetti già studiati con molti errori).
  const included = () => new Set(items.map((i) => i.conceptId));
  const weak = cards
    .filter((c) => !included().has(c.conceptId))
    .map((card) => {
      const acc = input.accuracy?.get(card.conceptId);
      const rate = acc && acc.answers >= cfg.weaknessMinAnswers ? acc.correct / acc.answers : 1;
      return { card, rate };
    })
    .filter((w) => w.rate < cfg.weaknessThreshold)
    .sort((a, b) => a.rate - b.rate);
  for (const { card } of weak.slice(0, cfg.maxWeakness)) {
    if (used + cfg.secondsPerReview > cfg.budgetSeconds - reserve) break;
    push(card.conceptId, 'weakness', card.reps, cfg.secondsPerReview);
  }

  // 3. Concetti nuovi: almeno uno, se disponibile.
  let added = 0;
  for (const concept of newCandidates) {
    if (added >= cfg.maxNew) break;
    if (added > 0 && used + cfg.secondsPerNew > cfg.budgetSeconds) break;
    if (push(concept.id, 'new', 0, cfg.secondsPerNew)) added += 1;
  }

  // 4. Nulla in scadenza e nulla di nuovo: rinforzo dei ricordi meno stabili.
  if (items.length === 0) {
    const weakest = [...cards].sort((a, b) => a.stability - b.stability).slice(0, 3);
    for (const card of weakest) push(card.conceptId, 'weakness', card.reps, cfg.secondsPerReview);
  }

  return { items, estimatedSeconds: used };
}
