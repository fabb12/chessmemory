import { useMemo } from 'react';
import { CategoryCard } from '../components/dashboard/CategoryCard';
import { ErrorHeatmap } from '../components/dashboard/ErrorHeatmap';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { findConcept } from '../data/exercises';
import { computeCategoryStats, computeConceptAccuracy, computeInsight, type Insight } from '../features/progress/stats';
import { useAttempts, useCards, useNow } from '../hooks/useData';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { t } from '../i18n';

function insightText(insight: Insight, targeted: number): string {
  const concept = 'weakConceptId' in insight ? (findConcept(insight.weakConceptId)?.title ?? '') : '';
  const tail = targeted > 0 ? t.dna.insight.targeted(targeted) : '';
  switch (insight.kind) {
    case 'empty':
      return t.dna.insight.empty;
    case 'strong-weak':
      return t.dna.insight.strongWeak(t.categoriesObject[insight.strong], concept) + tail;
    case 'weak':
      return t.dna.insight.weak(concept) + tail;
    case 'strong':
      return t.dna.insight.strong(t.categoriesObject[insight.strong]);
    case 'steady':
      return t.dna.insight.steady;
  }
}

export function MemoryDnaPage() {
  const now = useNow();
  const attempts = useAttempts();
  const cards = useCards();
  const plan = useTrainingPlan(now);

  const view = useMemo(() => {
    if (!attempts || !cards) return null;
    const stats = computeCategoryStats(attempts, cards, now);
    const insight = computeInsight(stats, computeConceptAccuracy(attempts));
    return { stats, insight };
  }, [attempts, cards, now]);

  if (!view) return <p>{t.app.loading}</p>;
  const targeted = plan?.items.filter((i) => i.kind !== 'new').length ?? 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="animate-rise">
        <PageTitle>{t.dna.title}</PageTitle>
        <p className="mt-1.5 text-lg text-muted">{t.dna.intro}</p>
      </header>

      <Card className="cm-hero animate-rise sm:p-8" data-testid="dna-insight">
        <h2 className="flex items-center gap-3 font-display text-2xl font-semibold">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-gold ring-1 ring-white/15">
            <Icon name="target" size={22} />
          </span>
          {t.dna.insightTitle}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-white/85">{insightText(view.insight, targeted)}</p>
      </Card>

      <ErrorHeatmap attempts={attempts ?? []} />

      <div className="grid gap-4 md:grid-cols-2">
        {view.stats.map((s) => (
          <CategoryCard key={s.category} stats={s} />
        ))}
      </div>

      <p className="text-sm text-muted">{t.dna.conceptsMastered}</p>
      <p className="text-sm text-muted">{t.dna.disclaimer}</p>
    </div>
  );
}
