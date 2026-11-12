import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LineViewer } from '../components/mistakes/LineViewer';
import { MoveTask } from '../components/training/MoveTask';
import { Button, buttonClass } from '../components/ui/Button';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { db } from '../db/database';
import type { MistakeRecord, Profile } from '../db/schema';
import { useNow } from '../hooks/useData';
import { formatRelativeDay, t } from '../i18n';
import { dueMistakes, mistakeToExercise, recordMistakeReview } from '../services/mistakes';
import { MistakeNotes, mistakeOrientation } from './MistakeDetailPage';

export function MistakeReviewPage({ profile }: { profile: Profile }) {
  const [params] = useSearchParams();
  const onlyId = params.get('id');
  const now = useNow();
  /** Coda fissata all'apertura: i ripassi appena fatti non devono sparire a metà. */
  const [queue, setQueue] = useState<MistakeRecord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState<MistakeRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await db.mistakes.toArray();
      const list = onlyId ? all.filter((m) => m.id === onlyId) : dueMistakes(all, Date.now());
      if (!cancelled) {
        setQueue(list);
        setIndex(0);
        setReviewed(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onlyId]);

  const current = queue?.[index];
  const exercise = useMemo(() => (current ? mistakeToExercise(current, t.mistakes.reviewFallbackHint) : null), [current]);

  if (!queue) return <p className="text-muted">{t.app.loading}</p>;

  if (queue.length === 0 || index >= queue.length) {
    const done = queue.length > 0;
    return (
      <Card className="mx-auto max-w-xl space-y-3" data-testid="mistake-review-done">
        <PageTitle className="flex items-center gap-2">
          {done && <Icon name="check" className="text-ok" />}
          {done ? t.mistakes.reviewDone : t.mistakes.reviewTitle}
        </PageTitle>
        <p>{done ? t.mistakes.reviewDoneText(queue.length) : t.mistakes.reviewEmpty}</p>
        <Link to="/errori" className={buttonClass('primary', 'lg', true)}>
          {t.mistakes.backToList}
        </Link>
      </Card>
    );
  }

  if (!current || !exercise) return null;
  const orientation = mistakeOrientation(profile, current);

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="mistake-review">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <PageTitle>{t.mistakes.reviewTitle}</PageTitle>
        <span className="text-sm font-semibold text-muted tabular-nums" data-testid="review-progress">
          {t.mistakes.reviewProgress(index + 1, queue.length)}
        </span>
      </header>
      <p className="text-sm text-muted">
        {current.title}
        {current.gameInfo ? ` · ${current.gameInfo}` : ''}
      </p>

      {reviewed ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)] md:items-start" data-testid="mistake-review-after">
          <LineViewer fen={current.fen} line={current.line} playedMove={current.playedMove} orientation={orientation} />
          <div className="space-y-4">
            <Card>
              <SectionTitle>{t.mistakes.reviewAfterTitle}</SectionTitle>
              <div className="mt-2">
                <MistakeNotes mistake={current} />
              </div>
              <p className="mt-3 text-sm font-semibold" data-testid="review-next-due">
                {t.mistakes.nextReview(formatRelativeDay(reviewed.card.due, now))}
              </p>
            </Card>
            <Button
              block
              size="lg"
              icon={<Icon name="arrowRight" />}
              onClick={() => {
                setReviewed(null);
                setIndex((i) => i + 1);
                window.scrollTo(0, 0);
              }}
              data-testid="review-continue"
            >
              {index + 1 < queue.length ? t.mistakes.reviewNext : t.app.continue}
            </Button>
          </div>
        </div>
      ) : (
        <MoveTask
          key={current.id}
          exercise={exercise}
          title={t.task.recallTitle}
          prompt={t.mistakes.reviewPrompt}
          orientation={orientation}
          testId="mistake-task"
          onComplete={(result) => {
            void recordMistakeReview(current.id, result).then((updated) => setReviewed(updated ?? current));
          }}
        />
      )}
    </div>
  );
}
