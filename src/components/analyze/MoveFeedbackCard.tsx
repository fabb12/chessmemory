import { t } from '../../i18n';
import type { MoveFeedback } from '../../features/analysis/moveCoach';
import { sanToLocal } from '../../utils/notation';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface MoveFeedbackCardProps {
  feedback: MoveFeedback;
  /** Mossa migliore in notazione locale (es. «Cf3»). */
  bestSan: string;
  onRetry: () => void;
}

const TONE: Record<string, string> = {
  best: 'border-l-ok',
  good: 'border-l-ok',
  inaccuracy: 'border-l-warn',
  mistake: 'border-l-bad',
  blunder: 'border-l-bad',
};

/** Giudizio di Stockfish sulla mossa provata dall'utente. */
export function MoveFeedbackCard({ feedback, bestSan, onRetry }: MoveFeedbackCardProps) {
  const san = sanToLocal(feedback.san);
  return (
    <div
      className={`rounded-xl border border-l-4 border-line bg-surface p-3.5 ${TONE[feedback.grade] ?? ''}`}
      data-testid="move-feedback"
      data-grade={feedback.grade}
      aria-live="polite"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {t.analyze.coach.yourMove}: {san}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold">{t.analyze.coach.grades[feedback.grade]}</p>
      <p className="mt-1">{t.analyze.coach.text(feedback.grade, san, bestSan, feedback.rank, feedback.lossCp)}</p>
      <p className="mt-1 text-sm text-muted">
        {t.analyze.coach.afterEval}: <strong className="tabular-nums">{feedback.evaluation}</strong>
      </p>
      <Button variant="secondary" size="sm" className="mt-2" icon={<Icon name="undo" size={16} />} onClick={onRetry}>
        {t.analyze.coach.retry}
      </Button>
    </div>
  );
}
