import { Link } from 'react-router-dom';
import { buttonClass } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import type { MistakeRecord } from '../db/schema';
import { isDue } from '../features/memory/scheduler';
import { useMistakes, useNow } from '../hooks/useData';
import { dateFormatter, formatRelativeDay, t } from '../i18n';
import { dueMistakes } from '../services/mistakes';
import { applyUci } from '../utils/chess';
import { sanToLocal } from '../utils/notation';

function san(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  const move = applyUci(fen, uci);
  return move ? sanToLocal(move.san) : null;
}

function MistakeRow({ mistake, now }: { mistake: MistakeRecord; now: number }) {
  const played = san(mistake.fen, mistake.playedMove);
  const best = san(mistake.fen, mistake.bestMove);
  const due = isDue(mistake.card, now);
  return (
    <li>
      <Link
        to={`/errori/${mistake.id}`}
        className="flex min-h-16 flex-col gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent hover:bg-accent-soft sm:flex-row sm:items-center sm:justify-between"
        data-testid="mistake-row"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{mistake.title}</span>
          <span className="block text-sm text-muted">
            {mistake.gameInfo ? `${mistake.gameInfo} · ` : ''}
            {t.mistakes.source[mistake.source]} · {dateFormatter.format(new Date(mistake.createdAt))}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
          {mistake.severity && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${mistake.severity === 'blunder' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
              {t.mistakes.severity[mistake.severity]}
            </span>
          )}
          <span>
            <span className="text-bad line-through decoration-2">{played ?? '—'}</span>
            {' → '}
            <strong className="text-ok">{best}</strong>
          </span>
          {due ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-strong">{t.mistakes.dueToday}</span>
          ) : (
            <span className="text-xs text-muted">{t.mistakes.nextReview(formatRelativeDay(mistake.card.due, now))}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function MistakesPage() {
  const now = useNow();
  const mistakes = useMistakes();
  const due = mistakes ? dueMistakes(mistakes, now) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="mistakes-page">
      <header>
        <PageTitle>{t.mistakes.title}</PageTitle>
        <p className="mt-1 text-muted">{t.mistakes.intro}</p>
      </header>

      <Card className="border-accent/40 bg-accent-soft">
        <div className="flex flex-col gap-2 sm:flex-row">
          {due.length > 0 ? (
            <Link to="/errori/ripasso" className={buttonClass('primary', 'lg', true)} data-testid="review-mistakes">
              <Icon name="train" />
              {t.mistakes.review(due.length)}
            </Link>
          ) : (
            <p className="flex min-h-14 flex-1 items-center gap-2 font-semibold" data-testid="no-due-mistakes">
              <Icon name="check" className="text-ok" />
              {t.mistakes.reviewNone}
            </p>
          )}
          <Link to="/errori/nuovo" className={buttonClass(due.length > 0 ? 'secondary' : 'primary', 'lg', true)} data-testid="add-mistake">
            <Icon name="camera" />
            {t.mistakes.add}
          </Link>
        </div>
      </Card>

      {mistakes === undefined ? (
        <p className="text-muted">{t.app.loading}</p>
      ) : mistakes.length === 0 ? (
        <Card>
          <p className="text-muted" data-testid="mistakes-empty">
            {t.mistakes.empty}
          </p>
        </Card>
      ) : (
        <section>
          <p className="mb-2 text-sm text-muted" data-testid="mistakes-total">
            {t.mistakes.total(mistakes.length)}
          </p>
          <ul className="space-y-2">
            {mistakes.map((m) => (
              <MistakeRow key={m.id} mistake={m} now={now} />
            ))}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 text-sm text-muted">
        <Icon name="flag" size={16} className="mt-0.5 shrink-0" />
        {t.mistakes.fairPlay}
      </p>
    </div>
  );
}
