import { useState } from 'react';
import { LogoMark } from '../components/layout/Logo';
import { MoveTask } from '../components/training/MoveTask';
import { Button } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import {
  DEFAULT_PLACEMENT_CONFIG,
  nextPlacementLevel,
  placementResult,
} from '../features/adaptation/difficulty';
import { taskQuality } from '../features/learning/moveTask';
import { pickPlacementExercise } from '../features/onboarding/placement';
import { t } from '../i18n';
import { completePlacement, type PlacementOutcome } from '../services/progress';
import type { DeclaredLevel, Difficulty, Exercise } from '../types';
import { resolveOrientation } from '../utils/orientation';

type Step = 'welcome' | 'level' | 'intro' | 'placement' | 'result';
type Answer = PlacementOutcome['answers'][number];

const LEVELS: DeclaredLevel[] = ['beginner', 'intermediate', 'unsure'];
const TOTAL = DEFAULT_PLACEMENT_CONFIG.exerciseCount;

/** Primo avvio: livello dichiarato e valutazione iniziale di cinque posizioni. */
export function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [declared, setDeclared] = useState<DeclaredLevel | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [used, setUsed] = useState<Exercise[]>([]);
  const [level, setLevel] = useState<Difficulty>(1);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finalLevel, setFinalLevel] = useState<Difficulty>(1);
  const [saving, setSaving] = useState(false);

  const beginPlacement = () => {
    if (!declared) return;
    const start = DEFAULT_PLACEMENT_CONFIG.startLevel[declared];
    setLevel(start);
    setExercise(pickPlacementExercise(start, []));
    setStep('placement');
  };

  const handleAnswer = (answer: Answer, current: Exercise) => {
    const all = [...answers, answer];
    const usedNow = [...used, current];
    setAnswers(all);
    setUsed(usedNow);
    const next = nextPlacementLevel(level, answer.quality);
    const nextExercise = all.length < TOTAL ? pickPlacementExercise(next, usedNow) : null;
    if (nextExercise && declared) {
      setLevel(next);
      setExercise(nextExercise);
    } else if (declared) {
      setFinalLevel(placementResult(declared, all));
      setExercise(null);
      setStep('result');
    }
  };

  const finish = async () => {
    if (!declared || saving) return;
    setSaving(true);
    await completePlacement({ declaredLevel: declared, level: finalLevel, answers });
  };

  if (step === 'welcome') {
    return (
      <div className="mx-auto max-w-lg pt-4 text-center" data-testid="onboarding-welcome">
        <span className="inline-block animate-pop">
          <LogoMark size={72} />
        </span>
        <PageTitle className="mt-4">{t.onboarding.welcomeTitle}</PageTitle>
        <p className="mt-2 text-muted">{t.onboarding.welcomeText}</p>
        <ul className="mt-5 grid gap-2 text-left sm:grid-cols-3">
          {t.onboarding.pillars.map((p, i) => (
            <li key={p.title} className="rounded-xl border border-line bg-surface p-3">
              <Icon name={(['brain', 'chat', 'search'] as const)[i] ?? 'brain'} className="text-accent" />
              <p className="mt-1 font-semibold">{p.title}</p>
              <p className="text-sm text-muted">{p.text}</p>
            </li>
          ))}
        </ul>
        <Button size="lg" block className="mt-6" onClick={() => setStep('level')} data-testid="onboarding-start">
          {t.onboarding.start}
        </Button>
        <p className="mt-4 text-sm text-muted">{t.onboarding.localData}</p>
      </div>
    );
  }

  if (step === 'level') {
    return (
      <div className="mx-auto max-w-lg" data-testid="onboarding-level">
        <PageTitle>{t.onboarding.levelTitle}</PageTitle>
        <p className="mt-1 text-muted">{t.onboarding.levelText}</p>
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{t.onboarding.levelTitle}</legend>
          {LEVELS.map((value) => (
            <label
              key={value}
              data-level={value}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                declared === value ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/60'
              }`}
            >
              <input
                type="radio"
                name="declared-level"
                value={value}
                checked={declared === value}
                onChange={() => setDeclared(value)}
                className="size-5 shrink-0 accent-(--accent)"
              />
              <span>
                <span className="block font-semibold">{t.declared[value]}</span>
                <span className="text-sm text-muted">{t.declaredHelp[value]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button size="lg" block className="mt-5" disabled={!declared} onClick={() => setStep('intro')} data-testid="level-continue">
          {t.app.continue}
        </Button>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="mx-auto max-w-lg" data-testid="onboarding-intro">
        <PageTitle>{t.onboarding.placementTitle}</PageTitle>
        <p className="mt-2">{t.onboarding.placementIntro(TOTAL)}</p>
        <p className="mt-2 text-sm text-muted">{t.board.keyboardHelp}</p>
        <Button size="lg" block className="mt-5" onClick={beginPlacement} data-testid="placement-start">
          {t.onboarding.placementStart}
        </Button>
      </div>
    );
  }

  if (step === 'placement' && exercise) {
    return (
      <div data-testid="onboarding-placement">
        <p className="mb-3 text-sm font-semibold text-muted" data-testid="placement-progress">
          {t.onboarding.placementProgress(answers.length + 1, TOTAL)} · {t.level.difficulty(exercise.difficulty)}
        </p>
        <MoveTask
          key={exercise.id}
          testId="placement-task"
          exercise={exercise}
          title={t.onboarding.placementTitle}
          prompt={t.onboarding.placementPrompt}
          orientation={resolveOrientation('auto', exercise.sideToMove)}
          explainOnSuccess
          onComplete={(result) =>
            handleAnswer(
              { level: exercise.difficulty, quality: taskQuality(result), result, conceptId: exercise.conceptId },
              exercise,
            )
          }
        />
      </div>
    );
  }

  const solved = answers.filter((a) => a.result.correct).length;
  return (
    <div className="mx-auto max-w-lg text-center" data-testid="onboarding-result">
      <PageTitle>{t.onboarding.resultTitle}</PageTitle>
      <Card className="mt-4">
        <p className="font-display text-4xl font-semibold" data-testid="placement-level">
          {t.level.label(finalLevel)}
        </p>
        <p className="mt-1 text-lg">{t.level.names[finalLevel]}</p>
        <p className="mt-3 text-muted">{t.onboarding.resultText(solved, answers.length)}</p>
      </Card>
      <p className="mt-3 text-sm text-muted">{t.onboarding.resultNote}</p>
      <p className="text-sm text-muted">{t.level.notElo}</p>
      <Button size="lg" block className="mt-5" disabled={saving} onClick={() => void finish()} data-testid="onboarding-finish">
        {t.onboarding.finish}
      </Button>
    </div>
  );
}
