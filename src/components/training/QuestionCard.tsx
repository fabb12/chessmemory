import { useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import type { Exercise, QuestionResult } from '../../types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface QuestionCardProps {
  exercise: Exercise;
  onComplete: (result: QuestionResult) => void;
  /** Disattivabile nei test per avere un ordine prevedibile. */
  shuffle?: boolean;
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Fase C — SPIEGA: domanda a risposta multipla sul principio, con testi curati nel dataset. */
export function QuestionCard({ exercise, onComplete, shuffle = true }: QuestionCardProps) {
  const { question } = exercise;
  const options = useMemo(
    () => (shuffle ? shuffled(question.options) : [...question.options]),
    [question.options, shuffle],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(performance.now());
  const responseMs = useRef(0);

  const isCorrect = submitted && selected === question.correctOptionId;
  const correctText = question.options.find((o) => o.id === question.correctOptionId)?.text ?? '';

  const submit = () => {
    if (!selected) return;
    responseMs.current = Math.round(performance.now() - startedAt.current);
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-xl animate-rise" data-testid="question-card" data-exercise-id={exercise.id}>
      <fieldset disabled={submitted}>
        <legend className="font-display text-xl font-semibold">{question.prompt}</legend>
        <p className="mt-1 text-sm text-muted">{t.question.choose}</p>
        <div className="mt-3 space-y-2">
          {options.map((option) => {
            const checked = selected === option.id;
            const showCorrect = submitted && option.id === question.correctOptionId;
            const showWrong = submitted && checked && !showCorrect;
            return (
              <label
                key={option.id}
                data-option-id={option.id}
                className={[
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors',
                  showCorrect
                    ? 'border-ok bg-ok-soft'
                    : showWrong
                      ? 'border-bad bg-bad-soft'
                      : checked
                        ? 'border-accent bg-accent-soft'
                        : 'border-line bg-surface hover:border-accent/60',
                  submitted ? 'cursor-default' : '',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={`question-${exercise.id}`}
                  value={option.id}
                  checked={checked}
                  onChange={() => setSelected(option.id)}
                  className="size-5 shrink-0 accent-(--accent)"
                />
                <span className="flex-1">{option.text}</span>
                {showCorrect && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-ok">
                    <Icon name="check" size={18} />
                    <span className="sr-only sm:not-sr-only">{t.question.optionState.correct}</span>
                  </span>
                )}
                {showWrong && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-bad">
                    <Icon name="cross" size={18} />
                    <span className="sr-only sm:not-sr-only">{t.question.optionState.wrong}</span>
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite">
        {submitted && (
          <div
            className={`mt-4 animate-pop rounded-xl border-2 p-4 ${isCorrect ? 'border-ok bg-ok-soft' : 'border-bad bg-bad-soft'}`}
            data-testid="question-feedback"
            data-correct={isCorrect ? 'true' : 'false'}
          >
            <p className={`flex items-center gap-2 font-bold ${isCorrect ? 'text-ok' : 'text-bad'}`}>
              <Icon name={isCorrect ? 'check' : 'cross'} />
              {isCorrect ? t.question.correct : t.question.wrong}
            </p>
            {!isCorrect && (
              <p className="mt-1">
                {t.question.rightAnswerWas} <strong>{correctText}</strong>
              </p>
            )}
            <p className="mt-2">{exercise.explanation}</p>
          </div>
        )}
      </div>

      {submitted ? (
        <Button
          size="lg"
          block
          className="mt-4"
          icon={<Icon name="arrowRight" />}
          onClick={() =>
            onComplete({
              exerciseId: exercise.id,
              correct: isCorrect,
              selectedOptionId: selected ?? '',
              responseMs: responseMs.current,
            })
          }
        >
          {t.app.continue}
        </Button>
      ) : (
        <Button size="lg" block className="mt-4" disabled={!selected} onClick={submit}>
          {t.question.submit}
        </Button>
      )}
    </div>
  );
}
