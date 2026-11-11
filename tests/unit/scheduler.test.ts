import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { rateConceptResult } from '../../src/features/memory/rating';
import { createCard, endOfDay, isConsolidated, isDue, reviewCard } from '../../src/features/memory/scheduler';
import { conceptResult, DAY, T0 } from './helpers';

describe('regole di valutazione FSRS', () => {
  it('Again quando la mossa non viene ricordata', () => {
    expect(rateConceptResult(conceptResult('pin', 'review', 'failed'))).toBe(Rating.Again);
  });
  it('Hard con indizi, spiegazione errata o trasferimento fallito', () => {
    expect(rateConceptResult(conceptResult('pin', 'review', 'assisted'))).toBe(Rating.Hard);
    expect(rateConceptResult(conceptResult('pin', 'review', 'clean', false))).toBe(Rating.Hard);
    expect(rateConceptResult(conceptResult('pin', 'review', 'clean', true, 'failed'))).toBe(Rating.Hard);
  });
  it('Good al primo studio riuscito o con trasferimento aiutato', () => {
    expect(rateConceptResult(conceptResult('pin', 'new', 'clean'))).toBe(Rating.Good);
    expect(rateConceptResult(conceptResult('pin', 'review', 'clean', true, 'assisted'))).toBe(Rating.Good);
    expect(rateConceptResult(conceptResult('pin', 'review', 'clean', true, null))).toBe(Rating.Good);
  });
  it('Easy solo per un ripasso perfetto in tutte le fasi', () => {
    expect(rateConceptResult(conceptResult('pin', 'review', 'clean'))).toBe(Rating.Easy);
    expect(rateConceptResult(conceptResult('pin', 'weakness', 'clean'))).toBe(Rating.Easy);
  });
  it('il tempo di risposta non cambia la valutazione', () => {
    const r = conceptResult('pin', 'review', 'clean');
    const slow = { ...r, recall: { ...r.recall, responseMs: 900_000 }, explain: { ...r.explain, responseMs: 900_000 } };
    expect(rateConceptResult(slow)).toBe(rateConceptResult(r));
  });
});

describe('programmazione dei ripassi', () => {
  it('una nuova scheda è subito in scadenza', () => {
    const card = createCard('pin', T0);
    expect(card.state).toBe('new');
    expect(isDue(card, T0)).toBe(true);
  });

  it('dopo una buona risposta il ripasso è programmato nei giorni successivi', () => {
    const { card, log } = reviewCard(createCard('pin', T0), Rating.Good, T0, true);
    expect(card.due).toBeGreaterThan(endOfDay(T0));
    expect(isDue(card, T0)).toBe(false);
    expect(card.reps).toBe(1);
    expect(card.state).toBe('review');
    expect(card.lastReview).toBe(T0);
    expect(log).toMatchObject({ conceptId: 'pin', rating: Rating.Good, state: 'new', reviewedAt: T0, nextDue: card.due });
    expect(log.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it('valutazioni migliori producono intervalli più lunghi', () => {
    const base = createCard('pin', T0);
    const due = (rating: 1 | 2 | 3 | 4) => reviewCard(base, rating, T0).card.due;
    expect(due(Rating.Again)).toBeLessThanOrEqual(due(Rating.Hard));
    expect(due(Rating.Hard)).toBeLessThanOrEqual(due(Rating.Good));
    expect(due(Rating.Good)).toBeLessThan(due(Rating.Easy));
  });

  it('le conoscenze consolidate vengono riproposte sempre meno spesso', () => {
    let card = createCard('pin', T0);
    let now = T0;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      card = reviewCard(card, Rating.Good, now, true).card;
      intervals.push(card.due - now);
      now = card.due;
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]!);
    }
    expect(intervals[3]).toBeGreaterThan(7 * DAY);
  });

  it('un concetto dimenticato torna in allenamento prima', () => {
    let card = createCard('pin', T0);
    let now = T0;
    for (let i = 0; i < 3; i++) {
      card = reviewCard(card, Rating.Good, now, true).card;
      now = card.due;
    }
    const remembered = reviewCard(card, Rating.Good, now, true).card;
    const forgotten = reviewCard(card, Rating.Again, now, false).card;
    expect(forgotten.due - now).toBeLessThan(remembered.due - now);
    expect(forgotten.due - now).toBeLessThan((remembered.due - now) / 2);
    expect(forgotten.lapses).toBe(card.lapses + 1);
    expect(forgotten.stability).toBeLessThan(card.stability);
  });

  it('consolidato richiede memoria stabile E trasferimento riuscito', () => {
    let card = createCard('pin', T0);
    let now = T0;
    for (let i = 0; i < 4; i++) {
      card = reviewCard(card, Rating.Good, now, true).card;
      now = card.due;
    }
    expect(card.stability).toBeGreaterThanOrEqual(7);
    expect(isConsolidated(card)).toBe(true);
    expect(card.transferAttempts).toBe(4);
    expect(card.transferSuccesses).toBe(4);

    // stessa memoria della mossa, ma l'idea non viene riconosciuta altrove
    const noTransfer = reviewCard(card, Rating.Hard, now, false).card;
    expect(noTransfer.lastTransferCorrect).toBe(false);
    expect(isConsolidated(noTransfer)).toBe(false);

    const fresh = reviewCard(createCard('pin', T0), Rating.Easy, T0, true).card;
    expect(fresh.stability < 7 ? isConsolidated(fresh) : true).toBe(fresh.stability >= 7);
  });

  it('senza prova di trasferimento conserva l’esito precedente', () => {
    const first = reviewCard(createCard('pin', T0), Rating.Good, T0, true).card;
    const second = reviewCard(first, Rating.Good, first.due).card;
    expect(second.transferAttempts).toBe(1);
    expect(second.lastTransferCorrect).toBe(true);
  });
});
