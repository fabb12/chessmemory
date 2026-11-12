import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ObservePhase } from '../components/training/ObservePhase';
import { buttonClass } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { SpeakButton } from '../components/ui/SpeakButton';
import type { Profile } from '../db/schema';
import { findConcept, getConceptExercises } from '../data/exercises';
import { useCards, useNow } from '../hooks/useData';
import { formatRelativeDay, t } from '../i18n';
import { resolveOrientation } from '../utils/orientation';
import { conceptStatus, StatusBadge } from './StrategiesPage';

export function ConceptPage({ profile }: { profile: Profile }) {
  const { id } = useParams();
  const now = useNow();
  const cards = useCards();
  const concept = id ? findConcept(id) : undefined;
  const exercises = concept ? getConceptExercises(concept.id) : [];
  const [selected, setSelected] = useState(0);

  if (!concept) {
    return (
      <div>
        <p>{t.strategies.notFound}</p>
        <Link to="/strategie" className={`${buttonClass('secondary')} mt-3`}>
          {t.app.back}
        </Link>
      </div>
    );
  }

  const card = cards?.find((c) => c.conceptId === concept.id);
  const exercise = exercises[selected] ?? exercises[0];

  return (
    <div className="space-y-4">
      <Link to="/strategie" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} />
        {t.strategies.title}
      </Link>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <PageTitle>{concept.title}</PageTitle>
          <StatusBadge status={conceptStatus(card, now)} />
        </div>
        <p className="mt-1 text-muted">
          {t.categoriesLong[concept.category]} · {t.level.difficulty(concept.difficulty)}
        </p>
        <p className="mt-2">{concept.summary}</p>
      </header>

      <Card>
        {card ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">{t.strategies.nextReview}</dt>
              <dd className="text-base font-semibold">{formatRelativeDay(card.due, now)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t.strategies.transfer}</dt>
              <dd className="text-base font-semibold">
                {t.strategies.transferValue(card.transferSuccesses, card.transferAttempts)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted">{t.strategies.notStudied}</p>
        )}
        <Link
          to={`/allenati?concetto=${concept.id}`}
          className={`${buttonClass('primary', 'lg', true)} mt-4`}
          data-testid="practice-concept"
        >
          <Icon name="train" />
          {t.strategies.practice}
        </Link>
      </Card>

      {exercise && (
        <section aria-labelledby="examples-title">
          <h2 id="examples-title" className="font-display text-lg font-semibold">
            {t.strategies.examples}
          </h2>
          {exercises.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.strategies.examples}>
              {exercises.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                  className={`min-h-11 rounded-xl border-2 px-3 text-sm font-semibold ${
                    i === selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                  }`}
                >
                  {e.title}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3">
            <ObservePhase
              key={exercise.id}
              exercise={exercise}
              concept={concept}
              orientation={resolveOrientation(profile.settings.boardOrientation, exercise.sideToMove)}
            />
            <p className="mt-3 rounded-xl border border-line bg-surface p-3">
              <strong>{t.task.explanation}. </strong>
              {exercise.explanation}
            </p>
            <SpeakButton className="mt-2" text={exercise.explanation} />
          </div>
        </section>
      )}
    </div>
  );
}
