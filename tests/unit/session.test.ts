import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { CONCEPTS, getExercise } from '../../src/data/exercises';
import { buildItem, buildSessionPlan, DEFAULT_SESSION_CONFIG, rankNewConcepts } from '../../src/features/learning/sessionBuilder';
import { createCard, reviewCard, type StoredCard } from '../../src/features/memory/scheduler';
import { currentStreak, dayKey, daysBetween, initialStreak, registerTrainingDay, trainedToday } from '../../src/features/progress/streak';
import { DAY, T0 } from './helpers';

function learned(conceptId: string, at: number, rating: 1 | 2 | 3 | 4 = Rating.Good): StoredCard {
  return reviewCard(createCard(conceptId, at), rating, at, true).card;
}

describe('allenamento quotidiano', () => {
  it('per un nuovo utente propone concetti nuovi adatti al livello', () => {
    const plan = buildSessionPlan({ cards: [], level: 1, now: T0 });
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items.length).toBeLessThanOrEqual(DEFAULT_SESSION_CONFIG.maxNew);
    for (const item of plan.items) {
      expect(item.kind).toBe('new');
      expect(CONCEPTS.find((c) => c.id === item.conceptId)!.difficulty).toBe(1);
      expect(item.transferExerciseId).toBeDefined();
      expect(item.transferExerciseId).not.toBe(item.exerciseId);
    }
    expect(plan.estimatedSeconds).toBeLessThanOrEqual(DEFAULT_SESSION_CONFIG.budgetSeconds);
  });

  it('mescola ripassi in scadenza e almeno un concetto nuovo entro il budget', () => {
    const ids = CONCEPTS.slice(0, 8).map((c) => c.id);
    const cards = ids.map((id) => learned(id, T0 - 30 * DAY));
    const plan = buildSessionPlan({ cards, level: 3, now: T0 });
    const kinds = plan.items.map((i) => i.kind);
    expect(kinds.filter((k) => k === 'review').length).toBeGreaterThanOrEqual(3);
    expect(kinds.filter((k) => k === 'new').length).toBeGreaterThanOrEqual(1);
    expect(plan.estimatedSeconds).toBeLessThanOrEqual(DEFAULT_SESSION_CONFIG.budgetSeconds);
    expect(new Set(plan.items.map((i) => i.conceptId)).size).toBe(plan.items.length);
    // i ripassi vengono prima dei concetti nuovi
    expect(kinds.lastIndexOf('review')).toBeLessThan(kinds.indexOf('new'));
  });

  it('dà la precedenza ai ripassi più arretrati', () => {
    const cards = CONCEPTS.slice(0, 10).map((c, i) => learned(c.id, T0 - (40 - i) * DAY));
    const plan = buildSessionPlan({ cards, level: 5, now: T0 });
    const reviewIds = plan.items.filter((i) => i.kind === 'review').map((i) => i.conceptId);
    const byDue = [...cards].sort((a, b) => a.due - b.due).map((c) => c.conceptId);
    expect(reviewIds).toEqual(byDue.slice(0, reviewIds.length));
  });

  it('non ripropone i concetti il cui ripasso non è ancora previsto', () => {
    const cards = [learned('center-pawn', T0)];
    const plan = buildSessionPlan({ cards, level: 1, now: T0 });
    expect(plan.items.some((i) => i.conceptId === 'center-pawn')).toBe(false);
  });

  it('aggiunge esercizi mirati sui concetti con molti errori', () => {
    const cards = [learned('center-pawn', T0), learned('develop-knights', T0)];
    const accuracy = new Map([
      ['center-pawn', { answers: 6, correct: 2 }],
      ['develop-knights', { answers: 6, correct: 6 }],
    ]);
    const plan = buildSessionPlan({ cards, level: 1, now: T0, accuracy });
    const weak = plan.items.filter((i) => i.kind === 'weakness');
    expect(weak.map((i) => i.conceptId)).toEqual(['center-pawn']);
  });

  it('non giudica debole un concetto con poche risposte', () => {
    const cards = [learned('center-pawn', T0)];
    const accuracy = new Map([['center-pawn', { answers: 2, correct: 0 }]]);
    const plan = buildSessionPlan({ cards, level: 1, now: T0, accuracy });
    expect(plan.items.some((i) => i.kind === 'weakness')).toBe(false);
  });

  it('quando il livello è esaurito propone il gradino successivo', () => {
    const levelOne = CONCEPTS.filter((c) => c.difficulty === 1).map((c) => learned(c.id, T0));
    const plan = buildSessionPlan({ cards: levelOne, level: 1, now: T0 });
    const fresh = plan.items.filter((i) => i.kind === 'new');
    expect(fresh.length).toBeGreaterThan(0);
    for (const item of fresh) expect(CONCEPTS.find((c) => c.id === item.conceptId)!.difficulty).toBe(2);
  });

  it('con tutto studiato e nulla in scadenza propone un rinforzo, mai una sessione vuota', () => {
    const all = CONCEPTS.map((c) => learned(c.id, T0));
    const plan = buildSessionPlan({ cards: all, level: 5, now: T0 });
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items.every((i) => i.kind === 'weakness')).toBe(true);
  });

  it('non propone concetti sopra il livello finché ce ne sono alla portata', () => {
    const ranked = rankNewConcepts(CONCEPTS, [], 2);
    expect(ranked.every((c) => c.difficulty <= 2)).toBe(true);
    expect(ranked[0]!.difficulty).toBe(2);
  });

  it('alterna gli esercizi a ogni ripasso e usa l’altro per il trasferimento', () => {
    const first = buildItem('pin', 'review', 1)!;
    const second = buildItem('pin', 'review', 2)!;
    expect(first.exerciseId).not.toBe(second.exerciseId);
    expect(first.transferExerciseId).toBe(second.exerciseId);
    expect(getExercise(first.exerciseId).conceptId).toBe('pin');
    expect(buildItem('pin', 'new')!.exerciseId).toBe('pin-a');
    expect(buildItem('sconosciuto', 'new')).toBeNull();
  });

  it('ignora schede di concetti non più presenti nel dataset', () => {
    const ghost = { ...learned('pin', T0 - 30 * DAY), conceptId: 'rimosso' };
    const plan = buildSessionPlan({ cards: [ghost], level: 1, now: T0 });
    expect(plan.items.some((i) => i.conceptId === 'rimosso')).toBe(false);
  });
});

describe('sequenza giornaliera', () => {
  it('conta i giorni di calendario', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // attraversa il cambio dell'ora
    expect(dayKey(T0)).toBe('2026-01-10');
  });

  it('cresce allenandosi in giorni consecutivi e non conta due volte lo stesso giorno', () => {
    let s = registerTrainingDay(initialStreak(), T0);
    expect(s).toEqual({ current: 1, best: 1, lastActiveDay: '2026-01-10' });
    expect(registerTrainingDay(s, T0 + 3_600_000)).toBe(s);
    s = registerTrainingDay(s, T0 + DAY);
    expect(s.current).toBe(2);
    expect(trainedToday(s, T0 + DAY)).toBe(true);
    expect(trainedToday(s, T0 + 2 * DAY)).toBe(false);
  });

  it('saltare un solo giorno non azzera la sequenza', () => {
    let s = registerTrainingDay(initialStreak(), T0);
    s = registerTrainingDay(s, T0 + DAY);
    expect(currentStreak(s, T0 + 3 * DAY)).toBe(2); // ieri saltato: ancora valida
    s = registerTrainingDay(s, T0 + 3 * DAY);
    expect(s.current).toBe(3);
  });

  it('riparte da 1 dopo due o più giorni saltati, conservando il record', () => {
    let s = registerTrainingDay(initialStreak(), T0);
    s = registerTrainingDay(s, T0 + DAY);
    expect(currentStreak(s, T0 + 5 * DAY)).toBe(0);
    s = registerTrainingDay(s, T0 + 5 * DAY);
    expect(s).toMatchObject({ current: 1, best: 2 });
  });
});
