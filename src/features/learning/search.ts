import { CONCEPTS, conceptIntro } from '../../data/exercises';
import { t } from '../../i18n';
import type { Concept } from '../../types';

/** Minuscole, senza accenti e apostrofi tipografici: «Réti» = «reti», «d’alfiere» = «d'alfiere». */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[«»"]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Cerca tra le lezioni: ogni parola digitata deve comparire nel titolo, nella
 * descrizione, nella categoria o nella spiegazione. I risultati nel titolo vengono prima.
 */
export function searchConcepts(query: string, concepts: readonly Concept[] = CONCEPTS): Concept[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...concepts];
  const scored: { concept: Concept; score: number }[] = [];
  for (const concept of concepts) {
    const title = normalizeSearch(concept.title);
    const rest = normalizeSearch(
      [concept.summary, t.categories[concept.category], t.categoriesLong[concept.category], concept.principle, conceptIntro(concept.id)].join(' '),
    );
    if (!words.every((w) => title.includes(w) || rest.includes(w))) continue;
    const score = words.reduce((s, w) => s + (title.includes(w) ? 2 : 0), 0);
    scored.push({ concept, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.concept);
}
