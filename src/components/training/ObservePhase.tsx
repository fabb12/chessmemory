import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import type { Concept, Exercise } from '../../types';
import { solutionLine, type AppliedMove } from '../../utils/chess';
import { describeMove, formatLine } from '../../utils/notation';
import { ChessBoard, type BoardArrow } from '../chess/ChessBoard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface ObservePhaseProps {
  exercise: Exercise;
  concept: Concept;
  orientation: 'white' | 'black';
  /** Assente nella libreria, dove la fase serve solo da ripasso della spiegazione. */
  onNext?: () => void;
}

const STEP_MS = 1100;

/** Fase A — OSSERVA: la mossa viene mostrata con freccia, animazione e spiegazione. */
export function ObservePhase({ exercise, concept, orientation, onNext }: ObservePhaseProps) {
  const frames = useMemo(() => solutionLine(exercise), [exercise]);
  const moves = useMemo(
    () => frames.map((f) => f.move).filter((m): m is AppliedMove => m !== undefined),
    [frames],
  );
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const play = useCallback(() => {
    clearTimers();
    setPlaying(true);
    setFrameIndex(0);
    for (let i = 1; i < frames.length; i++) {
      timers.current.push(window.setTimeout(() => setFrameIndex(i), STEP_MS * i));
    }
    timers.current.push(
      window.setTimeout(() => {
        setFrameIndex(0);
        setPlaying(false);
      }, STEP_MS * frames.length + 700),
    );
  }, [frames.length]);

  useEffect(() => {
    const id = window.setTimeout(play, 700);
    return () => {
      window.clearTimeout(id);
      clearTimers();
    };
  }, [play]);

  const frame = frames[frameIndex] ?? frames[0];
  const upcoming = frames[frameIndex + 1];
  const arrows: BoardArrow[] = upcoming?.move
    ? [{ from: upcoming.move.from, to: upcoming.move.to, tone: upcoming.byPlayer ? 'teach' : 'bad' }]
    : [];
  const first = moves[0];

  const facts = [
    { label: t.observe.piece, text: first ? describeMove(first) : '' },
    { label: t.observe.goal, text: exercise.goal },
    { label: t.observe.principle, text: concept.principle },
    { label: t.observe.watchOut, text: exercise.watchOut },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] md:items-start lg:gap-8" data-testid="observe-phase" data-exercise-id={exercise.id}>
      <div>
        <ChessBoard
          fen={frame?.fen ?? exercise.fen}
          orientation={orientation}
          arrows={arrows}
          lastMove={frame?.move ? { from: frame.move.from, to: frame.move.to } : null}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm text-muted">{t.sideToMove[exercise.sideToMove]}</p>
          <Button variant="ghost" onClick={play} disabled={playing} icon={<Icon name="play" size={16} />}>
            {playing ? t.observe.playing : t.observe.replay}
          </Button>
        </div>
      </div>

      <div className="animate-rise">
        <p className="text-sm text-muted">{t.observe.intro}</p>
        <dl className="mt-3 space-y-3">
          {facts.map((fact) => (
            <div key={fact.label} className="cm-card rounded-2xl border border-l-4 border-line border-l-accent bg-surface p-3.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-accent-strong">{fact.label}</dt>
              <dd className="mt-0.5">{fact.text}</dd>
            </div>
          ))}
          {moves.length > 1 && (
            <div className="cm-card rounded-2xl border border-l-4 border-line border-l-gold bg-surface p-3.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-accent-strong">{t.observe.line}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{formatLine(moves)}</dd>
            </div>
          )}
        </dl>
        {onNext && (
          <Button size="lg" block className="mt-4" onClick={onNext} icon={<Icon name="arrowRight" />}>
            {t.observe.next}
          </Button>
        )}
      </div>
    </div>
  );
}
