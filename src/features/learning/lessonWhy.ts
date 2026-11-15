import { t } from '../../i18n';
import type { Concept, Exercise } from '../../types';
import { solutionLine } from '../../utils/chess';
import { describeMove } from '../../utils/notation';

/**
 * Il «perché» di un esercizio, spiegato dal tutor senza servizi esterni:
 * la variante mossa per mossa (chi muove, che cosa fa, che cosa provoca),
 * la spiegazione dell'esercizio e il principio da ricordare.
 */
export interface LessonWhy {
  /** Una riga per mossa: «Il Bianco muove … Scacco: il Nero è obbligato a rispondere.» */
  steps: string[];
  explanation: string;
  principle: string;
}

export function lessonWhy(exercise: Exercise, concept: Concept): LessonWhy {
  const frames = solutionLine(exercise).slice(1);
  const steps = frames.map((frame) => {
    const move = frame.move!;
    const what = describeMove(move);
    const effect = move.isCheckmate
      ? t.why.effects.mate
      : move.isCheck
        ? frame.byPlayer
          ? t.why.effects.check
          : ''
        : move.isCapture
          ? t.why.effects.capture
          : '';
    const forced = !frame.byPlayer ? t.why.reply : '';
    return `${forced}${what}${effect ? ` ${effect}` : ''}`;
  });
  return { steps, explanation: exercise.explanation, principle: concept.principle };
}

/** Tutto il perché in un unico testo, da leggere a voce. */
export function lessonWhyText(why: LessonWhy): string {
  return [t.why.intro, ...why.steps, why.explanation, `${t.why.principleLabel}: ${why.principle}`].join(' ');
}
