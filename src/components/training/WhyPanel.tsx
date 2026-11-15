import { useMemo, useState } from 'react';
import { explainLesson, useApiKey } from '../../features/assistant/claude';
import { lessonWhy, lessonWhyText } from '../../features/learning/lessonWhy';
import { TONE_PROMPTS, useTone } from '../../features/tutor/tone';
import { speak } from '../../features/voice/speech';
import { t } from '../../i18n';
import type { Concept, Exercise } from '../../types';
import { solutionLine, type AppliedMove } from '../../utils/chess';
import { formatLine } from '../../utils/notation';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { SpeakButton } from '../ui/SpeakButton';

interface WhyPanelProps {
  exercise: Exercise;
  concept: Concept;
  /** Testo che precede la spiegazione a voce (es. «La soluzione era …»). */
  lead?: string;
}

/**
 * «Il tutor ti spiega perché»: la variante mossa per mossa, la spiegazione e il
 * principio, letti a voce; con la chiave API anche una spiegazione più approfondita.
 */
export function WhyPanel({ exercise, concept, lead = '' }: WhyPanelProps) {
  const why = useMemo(() => lessonWhy(exercise, concept), [exercise, concept]);
  const apiKey = useApiKey();
  const tone = useTone();
  const [deeper, setDeeper] = useState<{ status: 'busy' } | { status: 'done'; text: string } | { status: 'error' } | null>(null);

  const askDeeper = async () => {
    setDeeper({ status: 'busy' });
    try {
      const moves = solutionLine(exercise)
        .map((f) => f.move)
        .filter((m): m is AppliedMove => m !== undefined);
      const text = await explainLesson({
        concept: concept.title,
        principle: concept.principle,
        fen: exercise.fen,
        line: formatLine(moves),
        explanation: exercise.explanation,
        tone: TONE_PROMPTS[tone],
      });
      setDeeper({ status: 'done', text });
      speak(text, 'why-deeper');
    } catch {
      setDeeper({ status: 'error' });
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-3 text-fg" data-testid="why-panel">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <Icon name="chat" size={18} />
          {t.why.title}
        </p>
        <SpeakButton text={`${lead} ${lessonWhyText(why)}`.trim()} auto />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">{t.why.stepsLabel}</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm" data-testid="why-steps">
          {why.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
      <p data-testid="why-explanation">{why.explanation}</p>
      <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
        <span className="font-semibold">{t.why.principleLabel}: </span>
        {why.principle}
      </p>
      {apiKey ? (
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="sparkle" size={16} />}
            onClick={() => void askDeeper()}
            disabled={deeper?.status === 'busy'}
            data-testid="why-deeper"
          >
            {deeper?.status === 'busy' ? t.why.deeperBusy : t.why.deeper}
          </Button>
          {deeper?.status === 'done' && (
            <p className="text-sm" data-testid="why-deeper-text">
              {deeper.text}
            </p>
          )}
          {deeper?.status === 'error' && <p className="text-sm font-semibold text-bad">{t.why.deeperError}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted">{t.why.deeperNoKey}</p>
      )}
    </div>
  );
}
