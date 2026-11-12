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

/** Generatore di numeri casuali in [0, 1): permette allenamenti sempre diversi ma ripetibili nei test. */
export type Rng = () => number;

/** Generatore deterministico (mulberry32): lo stesso seme dà sempre la stessa sequenza. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

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
  /** Se presente, concetti ed esercizi vengono variati a ogni allenamento. */
  rng?: Rng;
}

export interface SessionPlan {
  items: SessionItem[];
  estimatedSeconds: number;
}

/**
 * Sceglie gli esercizi per un concetto. Senza `rng` li alterna a ogni ripasso;
 * con `rng` sceglie a caso, così lo stesso concetto non ha sempre lo stesso esercizio.
 */
export function buildItem(conceptId: string, kind: SessionItemKind, reps = 0, rng?: Rng): SessionItem | null {
  const exercises = getConceptExercises(conceptId);
  const start = rng
    ? Math.floor(rng() * exercises.length)
    : kind === 'new'
      ? 0
      : reps % Math.max(1, exercises.length);
  const first = exercises[start];
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
  rng?: Rng,
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
  // Con `rng` i pari merito (stesso livello e stessa categoria) si decidono a sorte.
  const tieBreak = rng
    ? new Map(shuffled(pool, rng).map((c, i) => [c.id, i]))
    : new Map(pool.map((c) => [c.id, concepts.indexOf(c)]));
  return [...pool].sort(
    (a, b) =>
      // prima i concetti più vicini al livello, poi le categorie meno studiate
      b.difficulty - a.difficulty ||
      (perCategory.get(a.category) ?? 0) - (perCategory.get(b.category) ?? 0) ||
      tieBreak.get(a.id)! - tieBreak.get(b.id)!,
  );
}

/** Quanti concetti si mostrano in tutto, tra quelli del piano e le alternative. */
export const PROPOSAL_COUNT = 8;

/**
 * Alternative tra cui scegliere per il livello richiesto: concetti di quel
 * livello (nuovi o già studiati), di categorie diverse e in ordine casuale.
 * Se ce ne sono poche, si completa con i livelli vicini.
 */
export function buildProposals(input: {
  cards: StoredCard[];
  level: Difficulty;
  rng: Rng;
  /** Concetti già nel piano: non vengono riproposti. */
  exclude: ReadonlySet<string>;
  count: number;
  concepts?: readonly Concept[];
}): SessionItem[] {
  const concepts = input.concepts ?? CONCEPTS;
  const cardOf = new Map(input.cards.map((c) => [c.conceptId, c]));
  const pool = concepts.filter((c) => !input.exclude.has(c.id) && getConceptExercises(c.id).length > 0);
  const byDistance = (maxGap: number) => pool.filter((c) => Math.abs(c.difficulty - input.level) <= maxGap);

  // Si prende il livello scelto, poi i vicini finché non basta.
  const picked: Concept[] = [];
  for (let gap = 0; gap <= 4 && picked.length < input.count; gap++) {
    const ring = byDistance(gap).filter((c) => !picked.includes(c));
    // a ogni giro: una per categoria prima, poi le altre
    const groups = new Map<string, Concept[]>();
    for (const c of shuffled(ring, input.rng)) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
    const lists = shuffled([...groups.values()], input.rng);
    for (let round = 0; picked.length < input.count; round++) {
      const batch = lists.map((l) => l[round]).filter((c): c is Concept => Boolean(c));
      if (batch.length === 0) break;
      for (const c of batch) if (picked.length < input.count) picked.push(c);
    }
  }

  const items: SessionItem[] = [];
  for (const c of picked) {
    const card = cardOf.get(c.id);
    const item = buildItem(c.id, card ? 'review' : 'new', card?.reps ?? 0, input.rng);
    if (item) items.push(item);
  }
  return items;
}

export function buildSessionPlan(input: SessionPlanInput): SessionPlan {
  const cfg = input.config ?? DEFAULT_SESSION_CONFIG;
  const concepts = input.concepts ?? CONCEPTS;
  const known = new Set(concepts.map((c) => c.id));
  const cards = input.cards.filter((c) => known.has(c.conceptId));
  const items: SessionItem[] = [];
  let used = 0;

  const push = (conceptId: string, kind: SessionItemKind, reps: number, cost: number) => {
    const item = buildItem(conceptId, kind, reps, input.rng);
    if (!item) return false;
    items.push(item);
    used += cost;
    return true;
  };

  const newCandidates = rankNewConcepts(concepts, cards, input.level, input.rng);
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
