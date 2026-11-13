import { Link } from 'react-router-dom';
import { findConcept } from '../../data/exercises';
import type { SessionRecord } from '../../db/schema';
import { t } from '../../i18n';
import type { Difficulty } from '../../types';
import { buttonClass } from '../ui/Button';
import { Card, PageTitle } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface SessionSummaryProps {
  session: SessionRecord;
  /** Sessioni precedenti (esclusa quella corrente). */
  previous: readonly SessionRecord[];
  streak: number;
  levelBefore: Difficulty;
  levelAfter: Difficulty;
}

export function accuracyOf(s: Pick<SessionRecord, 'correctAnswers' | 'totalAnswers'>): number {
  return s.totalAnswers === 0 ? 0 : Math.round((s.correctAnswers / s.totalAnswers) * 100);
}

/** Confronto con la media delle sessioni precedenti (dati reali, nessuna stima). */
export function comparisonText(session: SessionRecord, previous: readonly SessionRecord[]): string {
  if (previous.length === 0) return t.summary.compareFirst;
  const current = accuracyOf(session);
  const average = Math.round(previous.reduce((sum, s) => sum + accuracyOf(s), 0) / previous.length);
  if (current >= average + 5) return t.summary.compareBetter(current, average);
  if (current <= average - 5) return t.summary.compareWorse(current, average);
  return t.summary.compareSame(current);
}

export function SessionSummary({ session, previous, streak, levelBefore, levelAfter }: SessionSummaryProps) {
  const seconds = Math.max(0, Math.round((session.finishedAt - session.startedAt) / 1000));
  const stats = [
    { id: 'correct', label: t.summary.correct, value: t.summary.correctOf(session.correctAnswers, session.totalAnswers) },
    { id: 'reviewed', label: t.summary.reviewed, value: String(session.reviewedConcepts) },
    { id: 'learned', label: t.summary.learned, value: String(session.newConcepts) },
    { id: 'hints', label: t.summary.hints, value: String(session.hintsUsed) },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="session-summary">
      <header className="animate-pop text-center">
        <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-ok-soft text-ok shadow-[0_0_0_8px_color-mix(in_srgb,var(--ok)_12%,transparent)]">
          <Icon name="check" size={30} />
        </span>
        <PageTitle>{t.summary.title}</PageTitle>
        <p className="mt-1 text-muted">
          {t.summary.duration}: {t.train.elapsed(Math.floor(seconds / 60), seconds % 60)}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.id} data-testid={`summary-${s.id}`}>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{s.value}</dd>
          </Card>
        ))}
      </dl>

      <Card>
        <h2 className="font-semibold">{t.summary.compareTitle}</h2>
        <p className="mt-1" data-testid="summary-comparison">
          {comparisonText(session, previous)}
        </p>
        {levelAfter > levelBefore && <p className="mt-2 font-semibold text-ok">{t.summary.levelUp(levelAfter)}</p>}
        {levelAfter < levelBefore && <p className="mt-2">{t.summary.levelDown(levelAfter)}</p>}
        {streak > 0 && (
          <p className="mt-2 flex items-center gap-1.5">
            <Icon name="flame" size={18} className="text-wood" />
            {t.summary.streak(streak)}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">{t.summary.conceptsTitle}</h2>
        <ul className="mt-2 divide-y divide-line">
          {session.items.map((item, i) => (
            <li key={`${item.conceptId}-${i}`} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block font-medium">{findConcept(item.conceptId)?.title ?? item.conceptId}</span>
                <span className="text-sm text-muted">{t.train.kind[item.kind]}</span>
              </span>
              <span className="shrink-0 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
                {t.summary.ratingLabels[item.rating] ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link to="/" className={buttonClass('primary', 'lg', true)} data-testid="summary-home">
          <Icon name="home" />
          {t.summary.home}
        </Link>
        <Link to="/progressi" className={buttonClass('secondary', 'lg', true)}>
          <Icon name="dna" />
          {t.summary.dna}
        </Link>
      </div>
    </div>
  );
}
