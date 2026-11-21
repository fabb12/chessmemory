import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATH_LEVELS, passedLessons, pathState } from '../../features/learning/path';
import { searchConcepts } from '../../features/learning/search';
import { useAttempts } from '../../hooks/useData';
import { t } from '../../i18n';
import type { Concept } from '../../types';
import { Button, buttonClass } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { SearchField } from '../ui/SearchField';

interface LessonPathProps {
  onStart: (conceptId: string) => void;
}

/**
 * Percorso a step: le lezioni in fila per livello, dalla più facile al livello
 * Maestro. Una lezione si sblocca quando la precedente è superata.
 */
export function LessonPath({ onStart }: LessonPathProps) {
  const attempts = useAttempts();
  const state = useMemo(() => pathState(passedLessons(attempts ?? [])), [attempts]);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? searchConcepts(query) : null), [query]);
  if (!attempts) return null;
  const position = new Map(PATH_LEVELS.flatMap((l) => l.lessons).map((c, i) => [c.id, i + 1]));

  const row = (lesson: Concept, showLevel = false) => {
    const status = state.status.get(lesson.id) ?? 'locked';
    return (
      <li key={lesson.id} className="flex min-h-14 items-center gap-3 px-3 py-2" data-testid={`path-lesson-${lesson.id}`} data-status={status}>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            status === 'done' ? 'bg-ok-soft text-ok' : status === 'current' ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted'
          }`}
          aria-label={status === 'done' ? t.path.done : status === 'current' ? t.path.current : t.path.locked}
        >
          <Icon name={status === 'done' ? 'check' : status === 'current' ? 'play' : 'lock'} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-medium ${status === 'locked' ? 'text-muted' : ''}`}>
            {position.get(lesson.id)}. {lesson.title}
          </span>
          <span className="block text-xs text-muted">
            {showLevel ? `${t.path.levelTitle(lesson.difficulty, t.level.names[lesson.difficulty])} · ` : ''}
            {t.categories[lesson.category]}
          </span>
        </span>
        {status !== 'locked' ? (
          <Button variant={status === 'current' ? 'primary' : 'ghost'} size="sm" onClick={() => onStart(lesson.id)}>
            {status === 'current' ? t.path.start : t.path.redo}
          </Button>
        ) : (
          showLevel && (
            // Una lezione ancora bloccata si può comunque leggere e provare dalla sua pagina.
            <Link to={`/strategie/${lesson.id}`} className={buttonClass('ghost', 'sm')} data-testid={`path-explore-${lesson.id}`}>
              {t.path.explore}
            </Link>
          )
        )}
      </li>
    );
  };

  return (
    <Card className="space-y-4" data-testid="lesson-path">
      <div>
        <SectionTitle>{t.path.title}</SectionTitle>
        <p className="mt-1 text-sm text-muted">{t.path.intro}</p>
      </div>
      <div>
        <p className="text-sm font-semibold tabular-nums" data-testid="path-progress">
          {t.path.progress(state.done, state.total)}
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.done}>
          <div className="cm-bar h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(state.done / state.total) * 100}%` }} />
        </div>
      </div>

      {state.next ? (
        <div className="rounded-2xl border-2 border-accent bg-accent-soft p-4" data-testid="path-next">
          <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">
            {t.path.next} · {t.path.lessonOf(position.get(state.next.id) ?? 1, state.total)}
          </p>
          <p className="mt-1 font-display text-xl font-semibold">{state.next.title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {t.path.levelTitle(state.next.difficulty, t.level.names[state.next.difficulty])} · {t.categories[state.next.category]}
          </p>
          <p className="mt-2 text-sm">{state.next.summary}</p>
          <Button size="lg" block className="mt-3" icon={<Icon name="play" />} onClick={() => onStart(state.next!.id)} data-testid="path-start">
            {t.path.start}
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-ok bg-ok-soft p-4 font-semibold" data-testid="path-completed">
          {t.path.completed}
        </p>
      )}

      <SearchField value={query} onChange={setQuery} label={t.path.search} placeholder={t.path.searchPlaceholder} testId="lesson-search" />

      {results ? (
        <div data-testid="lesson-search-results">
          <p className="text-sm text-muted" aria-live="polite">
            {results.length ? t.path.results(results.length) : t.path.noResults}
          </p>
          {results.length > 0 && <ol className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">{results.map((lesson) => row(lesson, true))}</ol>}
        </div>
      ) : (
        <div className="space-y-2">
          {PATH_LEVELS.map(({ level, lessons }) => {
            const done = lessons.filter((c) => state.status.get(c.id) === 'done').length;
            const open = lessons.some((c) => state.status.get(c.id) === 'current');
            return (
              <details key={level} open={open} className="rounded-xl border border-line bg-surface" data-testid={`path-level-${level}`}>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-3 font-semibold">
                  <span>{t.path.levelTitle(level, t.level.names[level])}</span>
                  <span className={`text-sm tabular-nums ${done === lessons.length ? 'text-ok' : 'text-muted'}`}>{t.path.levelCount(done, lessons.length)}</span>
                </summary>
                <ol className="divide-y divide-line border-t border-line">
                  {lessons.map((lesson) => row(lesson))}
                </ol>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
