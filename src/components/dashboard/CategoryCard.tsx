import { formatPercent, t } from '../../i18n';
import type { CategoryStats } from '../../features/progress/stats';
import { Card } from '../ui/Card';
import { TrendChart } from './TrendChart';

export function CategoryCard({ stats }: { stats: CategoryStats }) {
  const rate = stats.successRate;
  const rows = [
    { label: t.dna.exercises, value: String(stats.exercisesCompleted) },
    { label: t.dna.due, value: String(stats.dueReviews) },
    { label: t.dna.consolidated, value: t.dna.ofTotal(stats.consolidated, stats.totalConcepts) },
    { label: t.dna.toReview, value: String(stats.toReview) },
  ];
  return (
    <Card className="cm-card-hover" data-testid={`dna-${stats.category}`}>
      <h2 className="font-display text-xl font-semibold">{t.categoriesLong[stats.category]}</h2>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t.dna.success}</p>
          <p className="mt-1 font-display text-5xl font-semibold tabular-nums leading-none tracking-tight" data-testid="success-rate">
            {rate === null ? '—' : formatPercent(rate)}
          </p>
          {rate === null && <p className="mt-1 text-sm text-muted">{t.dna.noData}</p>}
        </div>
        {rate !== null && (
          <p className="text-sm text-muted tabular-nums">
            {stats.correct}/{stats.answers}
          </p>
        )}
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label={`${t.dna.success}: ${t.categoriesLong[stats.category]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate === null ? 0 : Math.round(rate * 100)}
        aria-valuetext={rate === null ? t.dna.noData : formatPercent(rate)}
      >
        <div className="cm-bar h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${rate === null ? 0 : Math.round(rate * 100)}%` }} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-line/70 bg-surface-2/60 px-3 py-2">
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t.dna.trend}</h3>
      <div className="mt-1">
        <TrendChart points={stats.trend} label={t.categoriesLong[stats.category]} />
      </div>
    </Card>
  );
}
