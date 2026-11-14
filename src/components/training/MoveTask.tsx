import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { t } from '../../i18n';
import type { Exercise, MoveTaskResult, Uci } from '../../types';
import { applyUci, fenAtStep, parseUci, pieceAt, solutionLine, type AppliedMove } from '../../utils/chess';
import { formatLine, sanToLocal } from '../../utils/notation';
import { evaluateMove, isAccepted } from '../../features/learning/evaluateMove';
import {
  canRequestHint,
  hintedSquare,
  initialMoveTaskState,
  isFinished,
  moveTaskReducer,
  toResult,
  visibleHints,
  type MoveTaskAction,
  type MoveTaskState,
} from '../../features/learning/moveTask';
import { ChessBoard, type BoardArrow } from '../chess/ChessBoard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { SpeakButton } from '../ui/SpeakButton';

interface MoveTaskProps {
  exercise: Exercise;
  title: string;
  prompt: string;
  orientation: 'white' | 'black';
  /** Mostra la spiegazione anche dopo una risposta corretta. */
  explainOnSuccess?: boolean;
  onComplete: (result: MoveTaskResult) => void;
  testId?: string;
}

const REPLY_DELAY_MS = 650;

/**
 * Compito «trova la mossa» usato dalle fasi RICORDA e RICONOSCI e dalla
 * valutazione iniziale. La mossa è convalidata da chess.js e confrontata con
 * la soluzione e le alternative del dataset.
 */
export function MoveTask({
  exercise,
  title,
  prompt,
  orientation,
  explainOnSuccess = false,
  onComplete,
  testId = 'move-task',
}: MoveTaskProps) {
  const [state, dispatch] = useReducer(
    (s: MoveTaskState, a: MoveTaskAction) => moveTaskReducer(s, a, exercise),
    undefined,
    initialMoveTaskState,
  );
  /** Posizione mostrata subito dopo una mossa accettata, prima della risposta avversaria. */
  const [transit, setTransit] = useState<AppliedMove | null>(null);
  const [lastAccepted, setLastAccepted] = useState<AppliedMove | null>(null);
  const [reply, setReply] = useState<AppliedMove | null>(null);
  const startedAt = useRef(performance.now());
  const finishedMs = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const baseFen = useMemo(() => fenAtStep(exercise, state.stepIndex), [exercise, state.stepIndex]);
  const finished = isFinished(state);
  if (finished && finishedMs.current === null) {
    finishedMs.current = Math.round(performance.now() - startedAt.current);
  }

  const handleMove = (uci: Uci) => {
    if (state.status !== 'awaiting' || transit) return;
    const verdict = evaluateMove(exercise, state.stepIndex, uci);
    if (verdict === 'illegal') return;
    const applied = applyUci(baseFen, uci);
    if (!applied) return;
    if (isAccepted(verdict)) {
      const step = exercise.solution[state.stepIndex];
      const isLast = state.stepIndex === exercise.solution.length - 1;
      setLastAccepted(applied);
      if (!isLast && step?.reply) {
        const replied = applyUci(applied.fen, step.reply);
        setTransit(applied);
        timer.current = window.setTimeout(() => {
          setTransit(null);
          setReply(replied);
        }, REPLY_DELAY_MS);
      } else {
        setReply(null);
      }
    }
    dispatch({ type: 'move', uci, verdict });
  };

  // ── Posizione e decorazioni da mostrare ──
  const wrongApplied = state.status === 'wrong' && state.wrongMove ? applyUci(baseFen, state.wrongMove) : null;
  const solutionStep = exercise.solution[state.stepIndex];
  let fen = baseFen;
  let lastMove: { from: string; to: string } | null = reply ? { from: reply.from, to: reply.to } : null;
  let tone: 'neutral' | 'good' | 'bad' = 'neutral';
  let arrows: BoardArrow[] = [];

  if (transit) {
    fen = transit.fen;
    lastMove = { from: transit.from, to: transit.to };
    tone = 'good';
  } else if (wrongApplied) {
    fen = wrongApplied.fen;
    lastMove = { from: wrongApplied.from, to: wrongApplied.to };
    tone = 'bad';
  } else if (state.status === 'solved' && lastAccepted) {
    fen = lastAccepted.fen;
    lastMove = { from: lastAccepted.from, to: lastAccepted.to };
    tone = 'good';
  } else if (state.status === 'failed' && solutionStep) {
    const m = parseUci(solutionStep.move);
    arrows = [{ from: m.from, to: m.to, tone: 'teach' }];
  }

  const hints = visibleHints(state, exercise);
  const hintSquare = state.status === 'awaiting' ? hintedSquare(state, exercise) : null;
  const hintPiece = hintSquare ? pieceAt(baseFen, hintSquare) : null;

  const remainingLine = useMemo(() => {
    if (state.status !== 'failed') return '';
    const moves = solutionLine(exercise)
      .map((f) => f.move)
      .filter((m): m is AppliedMove => m !== undefined);
    // Le mosse già giocate precedono il passo corrente: due semimosse per passo completato.
    const skip = exercise.solution.slice(0, state.stepIndex).reduce((n, s) => n + (s.reply ? 2 : 1), 0);
    return formatLine(moves.slice(skip));
  }, [exercise, state.status, state.stepIndex]);

  const bestSan = solutionStep ? applyUci(baseFen, solutionStep.move)?.san : undefined;
  const multiStep = exercise.solution.length > 1;

  const renderHints = () =>
    hints.length > 0 && (
      <ul className="mt-3 space-y-2" data-testid="hints">
        {hints.map((hint, i) => (
          <li key={i} className="flex gap-2 rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">
            <Icon name="bulb" size={18} className="mt-0.5 shrink-0 text-warn" />
            <span>
              <strong className="text-warn">{t.task.hintLabel(i + 1)}. </strong>
              {hint.kind === 'strategy'
                ? hint.text
                : hintPiece && hintSquare
                  ? t.task.pieceHint(t.pieces[hintPiece.type], hintSquare)
                  : solutionStep
                    ? t.task.pieceHint(
                        t.pieces[pieceAt(baseFen, parseUci(solutionStep.move).from)?.type ?? 'p'],
                        parseUci(solutionStep.move).from,
                      )
                    : ''}
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div
      className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] md:items-start lg:gap-8"
      data-testid={testId}
      data-exercise-id={exercise.id}
      data-step={state.stepIndex}
      data-status={transit ? 'transit' : state.status}
    >
      <div>
        <ChessBoard
          fen={fen}
          orientation={orientation}
          interactive={state.status === 'awaiting' && !transit}
          onMove={handleMove}
          arrows={arrows}
          lastMove={lastMove}
          lastMoveTone={tone}
          hintSquare={hintSquare}
        />
        <div className="mt-2 flex items-center justify-between gap-2 text-sm text-muted">
          <span>{t.sideToMove[exercise.sideToMove]}</span>
          {multiStep && !finished && (
            <span className="tabular-nums">{t.task.stepProgress(state.stepIndex + 1, exercise.solution.length)}</span>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="mt-1">{prompt}</p>

        <div aria-live="polite" className="mt-3">
          {state.status === 'awaiting' && (
            <div>
              {reply && lastAccepted && (
                <p className="mb-2 flex items-start gap-2 rounded-xl border border-ok/40 bg-ok-soft p-3 text-sm">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-ok" />
                  <span>
                    {t.task.goodStep} {t.task.opponentReplies(sanToLocal(reply.san))}
                  </span>
                </p>
              )}
              {renderHints()}
              <Button
                variant="secondary"
                className="mt-3"
                icon={<Icon name="bulb" size={18} />}
                disabled={!canRequestHint(state, exercise)}
                onClick={() => dispatch({ type: 'hint' })}
              >
                {canRequestHint(state, exercise) ? t.task.hintButton : t.task.noMoreHints}
              </Button>
            </div>
          )}

          {state.status === 'wrong' && wrongApplied && (
            <div className="animate-pop rounded-xl border-2 border-bad bg-bad-soft p-4" data-testid="wrong-feedback">
              <p className="flex items-center gap-2 font-bold text-bad">
                <Icon name="cross" />
                {t.task.wrongTitle}
              </p>
              <p className="mt-1 text-sm">{t.task.wrongText(sanToLocal(wrongApplied.san))}</p>
              {renderHints()}
              <Button className="mt-3" block icon={<Icon name="undo" size={18} />} onClick={() => dispatch({ type: 'undo' })}>
                {t.task.undo}
              </Button>
            </div>
          )}

          {state.status === 'solved' && (
            <div className="animate-pop rounded-xl border-2 border-ok bg-ok-soft p-4" data-testid="solved-feedback">
              <p className="flex items-center gap-2 font-bold text-ok">
                <Icon name="check" />
                {state.usedAlternative ? t.task.alternativeTitle : t.task.correctTitle}
                {lastAccepted?.isCheckmate ? ` ${t.task.checkmate}.` : ''}
              </p>
              {state.usedAlternative && bestSan && (
                <p className="mt-1 text-sm">{t.task.alternativeText(sanToLocal(bestSan))}</p>
              )}
              {explainOnSuccess && <p className="mt-2">{exercise.explanation}</p>}
              {explainOnSuccess && <SpeakButton className="mt-2" text={exercise.explanation} auto />}
            </div>
          )}

          {state.status === 'failed' && (
            <div className="animate-pop rounded-xl border-2 border-warn bg-warn-soft p-4" data-testid="failed-feedback">
              <p className="flex items-center gap-2 font-bold text-warn">
                <Icon name="bulb" />
                {t.task.failedTitle}
              </p>
              <p className="mt-1 font-semibold">{t.task.failedText(remainingLine)}</p>
              <p className="mt-2">{exercise.explanation}</p>
              <SpeakButton className="mt-2" text={`${t.task.failedText(remainingLine)} ${exercise.explanation}`} auto />
            </div>
          )}
        </div>

        {finished && (
          <Button
            size="lg"
            block
            className="mt-4"
            icon={<Icon name="arrowRight" />}
            onClick={() => onComplete(toResult(state, exercise.id, finishedMs.current ?? 0))}
          >
            {t.app.continue}
          </Button>
        )}
      </div>
    </div>
  );
}
