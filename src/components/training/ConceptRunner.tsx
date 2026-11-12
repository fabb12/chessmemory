import { useMemo, useState } from 'react';
import { getConcept, getExercise } from '../../data/exercises';
import { t } from '../../i18n';
import type {
  BoardOrientationPreference,
  ConceptResult,
  MoveTaskResult,
  QuestionResult,
  SessionItem,
} from '../../types';
import { resolveOrientation } from '../../utils/orientation';
import { MoveTask } from './MoveTask';
import { ObservePhase } from './ObservePhase';
import { PhaseStepper, type Phase } from './PhaseStepper';
import { QuestionCard } from './QuestionCard';

interface ConceptRunnerProps {
  item: SessionItem;
  orientationPref: BoardOrientationPreference;
  onComplete: (result: ConceptResult) => void;
}

/**
 * MemoryMirror: guida un concetto attraverso le fasi
 * OSSERVA (solo per i concetti nuovi) → RICORDA → SPIEGA → RICONOSCI.
 */
export function ConceptRunner({ item, orientationPref, onComplete }: ConceptRunnerProps) {
  const concept = getConcept(item.conceptId);
  const exercise = getExercise(item.exerciseId);
  const transferExercise = item.transferExerciseId ? getExercise(item.transferExerciseId) : null;

  const phases = useMemo<Phase[]>(() => {
    const list: Phase[] = item.kind === 'new' ? ['observe', 'recall', 'explain'] : ['recall', 'explain'];
    if (transferExercise) list.push('recognize');
    return list;
  }, [item.kind, transferExercise]);

  const [phase, setPhase] = useState<Phase>(phases[0] ?? 'recall');
  const [recall, setRecall] = useState<MoveTaskResult | null>(null);
  const [explain, setExplain] = useState<QuestionResult | null>(null);

  const finish = (r: MoveTaskResult, e: QuestionResult, transfer?: MoveTaskResult) =>
    onComplete({ conceptId: item.conceptId, kind: item.kind, recall: r, explain: e, ...(transfer ? { transfer } : {}) });

  return (
    <section aria-labelledby="concept-title" data-testid="concept-runner" data-concept-id={concept.id} data-phase={phase}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 id="concept-title" className="font-display text-xl font-semibold sm:text-2xl">
          {concept.title}
        </h1>
        <p className="text-sm text-muted">
          {t.train.kind[item.kind]} · {t.categories[concept.category]} · {t.level.difficulty(concept.difficulty)}
        </p>
      </div>
      <PhaseStepper phases={phases} current={phase} />

      <div className="mt-4">
        {phase === 'observe' && (
          <ObservePhase
            exercise={exercise}
            concept={concept}
            orientation={resolveOrientation(orientationPref, exercise.sideToMove)}
            onNext={() => setPhase('recall')}
          />
        )}
        {phase === 'recall' && (
          <MoveTask
            key={`recall-${exercise.id}`}
            testId="recall-task"
            exercise={exercise}
            title={t.task.recallTitle}
            prompt={concept.taskPrompt}
            orientation={resolveOrientation(orientationPref, exercise.sideToMove)}
            onComplete={(result) => {
              setRecall(result);
              setPhase('explain');
            }}
          />
        )}
        {phase === 'explain' && recall && (
          <QuestionCard
            exercise={exercise}
            orientation={resolveOrientation(orientationPref, exercise.sideToMove)}
            onComplete={(result) => {
              setExplain(result);
              if (transferExercise) setPhase('recognize');
              else finish(recall, result);
            }}
          />
        )}
        {phase === 'recognize' && recall && explain && transferExercise && (
          <MoveTask
            key={`transfer-${transferExercise.id}`}
            testId="transfer-task"
            exercise={transferExercise}
            title={t.task.recognizeTitle}
            prompt={t.task.recognizePrompt}
            orientation={resolveOrientation(orientationPref, transferExercise.sideToMove)}
            explainOnSuccess
            onComplete={(result) => finish(recall, explain, result)}
          />
        )}
      </div>
    </section>
  );
}
