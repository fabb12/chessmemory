import { Link } from 'react-router-dom';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { conceptsByCategory, getConceptExercises } from '../data/exercises';
import { isConsolidated, isDue, type StoredCard } from '../features/memory/scheduler';
import { useCards, useNow } from '../hooks/useData';
import { t } from '../i18n';
import { CATEGORIES } from '../types';

export type ConceptStatus = 'new' | 'learning' | 'consolidated' | 'due';

export function conceptStatus(card: StoredCard | undefined, now: number): ConceptStatus {
  if (!card) return 'new';
  if (isDue(card, now)) return 'due';
  return isConsolidated(card) ? 'consolidated' : 'learning';
}

const STATUS_STYLE: Record<ConceptStatus, string> = {
  new: 'border-line bg-surface-2 text-muted',
  learning: 'border-warn/50 bg-warn-soft text-warn',
  consolidated: 'border-ok/50 bg-ok-soft text-ok',
  due: 'border-accent/50 bg-accent-soft text-accent-strong',
};

export function StatusBadge({ status }: { status: ConceptStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {status === 'consolidated' && <Icon name="check" size={13} />}
      {status === 'due' && <Icon name="calendar" size={13} />}
      {t.strategies.status[status]}
    </span>
  );
}

export function StrategiesPage() {
  const cards = useCards();
  const now = useNow();
  const cardMap = new Map((cards ?? []).map((c) => [c.conceptId, c]));

  return (
    <div className="space-y-8">
      <header>
        <PageTitle>{t.strategies.title}</PageTitle>
        <p className="mt-1.5 text-lg text-muted">{t.strategies.intro}</p>
      </header>
      {CATEGORIES.map((category) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <SectionTitle id={`cat-${category}`} className="flex items-center gap-3 after:h-px after:flex-1 after:bg-line">{t.categoriesLong[category]}</SectionTitle>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {conceptsByCategory(category).map((concept) => (
              <li key={concept.id}>
                <Link to={`/strategie/${concept.id}`} className="block h-full rounded-3xl" data-testid={`concept-link-${concept.id}`}>
                  <Card className="cm-card-hover h-full hover:border-accent/50">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{concept.title}</h3>
                      <StatusBadge status={conceptStatus(cardMap.get(concept.id), now)} />
                    </div>
                    <p className="mt-1 text-sm text-muted">{concept.summary}</p>
                    <p className="mt-2 text-xs font-medium text-muted">
                      {t.level.difficulty(concept.difficulty)} · {t.strategies.exercisesCount(getConceptExercises(concept.id).length)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
