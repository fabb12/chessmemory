import { useEffect, useMemo, useState } from 'react';
import { ANALYSIS_DEPTH, getEngine, type Analysis, type AnalysisDepth } from '../../features/engine/engine';
import { classifyMove, formatScore, negateScore, scoreToCp, type Score, type Severity } from '../../features/engine/uci';
import { t } from '../../i18n';
import type { MistakeEngineInfo } from '../../db/schema';
import type { Uci } from '../../types';
import { applyUci, sideToMove } from '../../utils/chess';
import { formatLine, sanToLocal } from '../../utils/notation';
import { ChessBoard } from '../chess/ChessBoard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { playLine } from './LineViewer';

export interface BestMoveChoice {
  bestMove: Uci;
  line: Uci[];
  alternatives: Uci[];
  severity: Severity | null;
  engine: MistakeEngineInfo | null;
}

interface BestMoveStepProps {
  fen: string;
  playedMove: Uci | null;
  orientation: 'white' | 'black';
  analysisDepth: AnalysisDepth;
  /** Suggerimento già calcolato (ricerca degli errori nella partita). */
  initial: BestMoveChoice | null;
  onConfirm: (choice: BestMoveChoice) => void;
}

/** Margine entro cui un'altra mossa è considerata buona quanto la migliore. */
const ALTERNATIVE_MARGIN_CP = 30;

type EngineState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; analysis: Analysis; playedScore: Score | null };

export function BestMoveStep({ fen, playedMove, orientation, analysisDepth, initial, onConfirm }: BestMoveStepProps) {
  const [engine, setEngine] = useState<EngineState>({ status: 'loading' });
  const [manual, setManual] = useState(false);
  const [ownLine, setOwnLine] = useState<Uci[]>([]);
  const whiteToMove = sideToMove(fen) === 'w';

  useEffect(() => {
    let cancelled = false;
    setEngine({ status: 'loading' });
    (async () => {
      try {
        const depth = ANALYSIS_DEPTH[analysisDepth];
        const analysis = await getEngine().analyse(fen, { depth, multiPv: 3 });
        let playedScore: Score | null = null;
        const played = playedMove ? applyUci(fen, playedMove) : null;
        if (played) {
          const after = await getEngine().analyse(played.fen, { depth: depth - 2 });
          playedScore = negateScore(after.score);
        }
        if (!cancelled) setEngine({ status: 'ready', analysis, playedScore });
      } catch {
        if (!cancelled) {
          setEngine({ status: 'error' });
          setManual(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fen, playedMove, analysisDepth]);

  const engineChoice = useMemo<BestMoveChoice | null>(() => {
    if (engine.status !== 'ready') return initial;
    const { analysis, playedScore } = engine;
    const top = analysis.lines[0];
    if (!top || !analysis.bestMove) return initial;
    // Se la mossa migliore coincide con quella giocata (succede con le
    // imprecisioni minime), si propone la seconda scelta del motore.
    let main = top;
    if (analysis.bestMove === playedMove) {
      const second = analysis.lines[1];
      if (!second) return null;
      main = second;
    }
    const bestCp = scoreToCp(main.score);
    const alternatives = analysis.lines
      .filter((l) => l !== main && l.pv[0] && l.pv[0] !== playedMove)
      .filter((l) => scoreToCp(l.score) >= bestCp - ALTERNATIVE_MARGIN_CP && Math.sign(scoreToCp(l.score)) === Math.sign(bestCp))
      .map((l) => l.pv[0] as Uci);
    const playedCp = playedScore ? scoreToCp(playedScore) : null;
    return {
      bestMove: main.pv[0] as Uci,
      line: main.pv.slice(0, 12),
      alternatives,
      severity: playedCp === null ? null : classifyMove(bestCp, playedCp),
      engine: { depth: analysis.depth, bestCp, playedCp },
    };
  }, [engine, initial, playedMove]);

  const ownMoves = useMemo(() => playLine(fen, ownLine), [fen, ownLine]);
  const ownFen = ownMoves.at(-1)?.fen ?? fen;
  const ownSameAsPlayed = ownLine[0] !== undefined && ownLine[0] === playedMove;

  if (manual) {
    return (
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)] md:items-start" data-testid="best-step" data-mode="manual">
        <ChessBoard
          fen={ownFen}
          orientation={orientation}
          interactive
          onMove={(uci) => setOwnLine((l) => [...l, uci])}
          lastMove={ownMoves.at(-1) ? { from: ownMoves.at(-1)!.from, to: ownMoves.at(-1)!.to } : null}
          lastMoveTone="good"
        />
        <div className="space-y-3">
          {engine.status === 'error' && (
            <p className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">{t.mistakes.engineError}</p>
          )}
          <p>{t.mistakes.ownLinePrompt}</p>
          <p className="font-semibold" data-testid="own-line">
            {ownMoves.length > 0 ? formatLine(ownMoves) : t.mistakes.lineEmpty}
          </p>
          {ownSameAsPlayed && <p className="rounded-xl border border-bad/40 bg-bad-soft p-3 text-sm">{t.mistakes.sameAsPlayed}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Icon name="undo" size={16} />} onClick={() => setOwnLine((l) => l.slice(0, -1))} disabled={ownLine.length === 0}>
              {t.mistakes.ownLineUndo}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOwnLine([])} disabled={ownLine.length === 0}>
              {t.mistakes.ownLineReset}
            </Button>
            {engine.status !== 'error' && (
              <Button variant="ghost" size="sm" onClick={() => setManual(false)}>
                {t.mistakes.back}
              </Button>
            )}
          </div>
          <Button
            block
            size="lg"
            icon={<Icon name="arrowRight" />}
            disabled={ownLine.length === 0 || ownSameAsPlayed}
            onClick={() =>
              onConfirm({
                bestMove: ownLine[0] as Uci,
                line: ownLine,
                alternatives: [],
                severity: engineChoice?.severity ?? null,
                engine: null,
              })
            }
            data-testid="confirm-own-line"
          >
            {t.mistakes.next}
          </Button>
        </div>
      </div>
    );
  }

  const choice = engineChoice;
  const choiceMoves = choice ? playLine(fen, choice.line) : [];
  const playedApplied = playedMove ? applyUci(fen, playedMove) : null;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)] md:items-start" data-testid="best-step" data-mode="engine" data-status={engine.status}>
      <ChessBoard
        fen={fen}
        orientation={orientation}
        arrows={[
          ...(playedApplied ? [{ from: playedApplied.from, to: playedApplied.to, tone: 'bad' as const }] : []),
          ...(choiceMoves[0] ? [{ from: choiceMoves[0].from, to: choiceMoves[0].to, tone: 'teach' as const }] : []),
        ]}
      />
      <div className="space-y-3" aria-live="polite">
        {engine.status === 'loading' && !choice && (
          <p className="flex items-center gap-2 text-muted">
            <Icon name="clock" size={18} />
            {t.mistakes.engineLoading}
          </p>
        )}
        {choice && choiceMoves[0] && (
          <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4" data-testid="engine-suggestion" data-best={choice.bestMove}>
            <p className="text-sm text-muted">{t.mistakes.engineBest}</p>
            <p className="font-display text-2xl font-semibold">{sanToLocal(choiceMoves[0].san)}</p>
            <p className="mt-1 text-sm">
              <span className="font-semibold">{t.mistakes.lineLabel}: </span>
              {formatLine(choiceMoves)}
            </p>
            {choice.engine && (
              <p className="mt-1 text-sm text-muted">
                {t.mistakes.engineEval(
                  formatScore(cpToScore(choice.engine.bestCp), whiteToMove),
                  choice.engine.playedCp === null ? null : formatScore(cpToScore(choice.engine.playedCp), whiteToMove),
                )}{' '}
                ({t.mistakes.engineDepth(choice.engine.depth)})
              </p>
            )}
            {choice.severity && (
              <p className="mt-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${choice.severity === 'blunder' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
                  {t.mistakes.severity[choice.severity]}
                </span>
              </p>
            )}
            {choice.alternatives.length > 0 && (
              <p className="mt-2 text-sm">
                {t.mistakes.engineAlternatives}{' '}
                {choice.alternatives.map((a) => sanToLocal(applyUci(fen, a)?.san ?? a)).join(', ')}
              </p>
            )}
          </div>
        )}
        {engine.status === 'loading' && choice && <p className="text-sm text-muted">{t.mistakes.engineLoading}</p>}
        <Button block size="lg" icon={<Icon name="check" />} disabled={!choice} onClick={() => choice && onConfirm(choice)} data-testid="use-engine">
          {t.mistakes.useEngine}
        </Button>
        <Button block variant="secondary" icon={<Icon name="edit" />} onClick={() => setManual(true)} data-testid="own-line-mode">
          {t.mistakes.ownLine}
        </Button>
      </div>
    </div>
  );
}

/** I punteggi salvati sono in centipedoni: si ricostruisce il matto per la visualizzazione. */
function cpToScore(cp: number): Score {
  if (Math.abs(cp) >= 90_000) {
    const moves = Math.round((100_000 - Math.abs(cp)) / 100);
    return { kind: 'mate', value: cp > 0 ? moves : -moves };
  }
  return { kind: 'cp', value: cp };
}
