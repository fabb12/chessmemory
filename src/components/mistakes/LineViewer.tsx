import { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import type { Uci } from '../../types';
import { applyUci, parseUci, type AppliedMove } from '../../utils/chess';
import { sanToLocal } from '../../utils/notation';
import { ChessBoard, type BoardArrow } from '../chess/ChessBoard';
import { Icon } from '../ui/Icon';

/** Applica una variante e restituisce le mosse (solo il prefisso legale). */
export function playLine(fen: string, line: readonly Uci[]): AppliedMove[] {
  const out: AppliedMove[] = [];
  let current = fen;
  for (const uci of line) {
    const move = applyUci(current, uci);
    if (!move) break;
    out.push(move);
    current = move.fen;
  }
  return out;
}

interface LineViewerProps {
  fen: string;
  line: readonly Uci[];
  orientation: 'white' | 'black';
  /** Mossa sbagliata, mostrata in rosso sulla posizione iniziale. */
  playedMove?: Uci | null;
  /** Freccia blu sulla mossa giusta nella posizione iniziale. */
  showBestArrow?: boolean;
  testId?: string;
}

/**
 * Scacchiera con la continuazione giusta da scorrere mossa per mossa.
 * Sulla posizione di partenza mostra la mossa giocata (rosso) e quella
 * corretta (blu).
 */
export function LineViewer({ fen, line, orientation, playedMove, showBestArrow = true, testId = 'line-viewer' }: LineViewerProps) {
  const moves = useMemo(() => playLine(fen, line), [fen, line]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [fen, line]);

  const current = index === 0 ? null : moves[index - 1];
  const boardFen = current?.fen ?? fen;
  const arrows: BoardArrow[] = [];
  if (index === 0) {
    if (playedMove) {
      const p = parseUci(playedMove);
      arrows.push({ from: p.from, to: p.to, tone: 'bad' });
    }
    const best = moves[0];
    if (best && showBestArrow) arrows.push({ from: best.from, to: best.to, tone: 'teach' });
  }

  return (
    <div className="space-y-3" data-testid={testId} data-index={index}>
      <ChessBoard
        fen={boardFen}
        orientation={orientation}
        arrows={arrows}
        lastMove={current ? { from: current.from, to: current.to } : null}
        lastMoveTone={current ? 'good' : 'neutral'}
      />
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
          onClick={() => setIndex(0)}
          disabled={index === 0}
        >
          {t.mistakes.stepStart}
        </button>
        <button
          type="button"
          aria-label={t.mistakes.stepBack}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface hover:bg-surface-2 disabled:opacity-40"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <Icon name="arrowLeft" />
        </button>
        <button
          type="button"
          aria-label={t.mistakes.stepForward}
          data-testid="line-forward"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface hover:bg-surface-2 disabled:opacity-40"
          onClick={() => setIndex((i) => Math.min(moves.length, i + 1))}
          disabled={index >= moves.length}
        >
          <Icon name="arrowRight" />
        </button>
      </div>
      {moves.length > 0 && (
        <ol className="flex flex-wrap gap-1 text-sm" aria-label={t.mistakes.lineLabel}>
          {moves.map((move, i) => {
            const label =
              move.color === 'w'
                ? `${moveNumberBefore(move)}.${sanToLocal(move.san)}`
                : `${i === 0 ? `${moveNumberBefore(move)}…` : ''}${sanToLocal(move.san)}`;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setIndex(i + 1)}
                  aria-current={index === i + 1 ? 'step' : undefined}
                  className={`min-h-9 rounded-lg px-2 font-medium tabular-nums ${
                    index === i + 1 ? 'bg-accent text-on-accent' : 'bg-surface-2 hover:bg-accent-soft'
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Numero della mossa giocata (dalla FEN risultante). */
function moveNumberBefore(move: AppliedMove): number {
  const fullmove = Number(move.fen.split(' ')[5] ?? '1');
  // Dopo una mossa del Nero il contatore è già passato alla mossa successiva.
  return move.color === 'b' ? fullmove - 1 : fullmove;
}
