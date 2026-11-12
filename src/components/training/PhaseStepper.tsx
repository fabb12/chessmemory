import { t } from '../../i18n';
import { Icon, type IconName } from '../ui/Icon';

export type Phase = 'observe' | 'recall' | 'explain' | 'recognize';

const ICONS: Record<Phase, IconName> = {
  observe: 'eye',
  recall: 'brain',
  explain: 'chat',
  recognize: 'search',
};

interface PhaseStepperProps {
  phases: readonly Phase[];
  current: Phase;
}

/** Indicatore delle fasi MemoryMirror: icona, nome e stato sono sempre testuali. */
export function PhaseStepper({ phases, current }: PhaseStepperProps) {
  const currentIndex = phases.indexOf(current);
  return (
    <ol
      className="flex items-stretch gap-1.5"
      aria-label={t.phases.stepOf(currentIndex + 1, phases.length, t.phases[current])}
    >
      {phases.map((phase, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li
            key={phase}
            data-phase={phase}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            className={[
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 transition-all text-center text-[0.7rem] font-semibold leading-tight sm:flex-row sm:justify-center sm:gap-1.5 sm:text-xs',
              state === 'current'
                ? 'cm-btn-primary border-accent bg-accent text-on-accent'
                : state === 'done'
                  ? 'border-accent/40 bg-accent-soft text-fg'
                  : 'border-line bg-surface text-muted',
            ].join(' ')}
          >
            <Icon name={state === 'done' ? 'check' : ICONS[phase]} size={16} />
            <span className="truncate">{t.phases[phase]}</span>
            {state !== 'todo' && (
              <span className="sr-only">{state === 'done' ? t.phases.done : t.phases.current}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
