import { describe, expect, it } from 'vitest';
import { normalizeSearch, searchConcepts } from '../../src/features/learning/search';
import { CONCEPTS } from '../../src/data/exercises';

const ids = (q: string) => searchConcepts(q).map((c) => c.id);

describe('ricerca delle lezioni', () => {
  it('senza parole restituisce tutte le lezioni', () => {
    expect(searchConcepts('  ')).toHaveLength(CONCEPTS.length);
  });

  it('ignora maiuscole, accenti e apostrofi tipografici', () => {
    expect(normalizeSearch('Réti d’alfiere')).toBe("reti d'alfiere");
    expect(ids('RETI')).toContain('reti-maneuver');
    expect(ids("sacrificio d'alfiere")[0]).toBe('greek-gift');
  });

  it('mette prima le lezioni con la parola nel titolo', () => {
    const found = ids('matto');
    expect(found.length).toBeGreaterThan(5);
    const firstWithoutTitle = found.findIndex((id) => !CONCEPTS.find((c) => c.id === id)!.title.toLowerCase().includes('matto'));
    const lastWithTitle = found.map((id) => CONCEPTS.find((c) => c.id === id)!.title.toLowerCase().includes('matto')).lastIndexOf(true);
    if (firstWithoutTitle >= 0) expect(lastWithTitle).toBeLessThan(firstWithoutTitle);
  });

  it('richiede tutte le parole e cerca anche nella categoria', () => {
    expect(ids('affogato cavallo')).toEqual(['smothered-mate']);
    expect(ids('finali').length).toBeGreaterThan(5);
    expect(ids('zzzz')).toEqual([]);
  });
});
