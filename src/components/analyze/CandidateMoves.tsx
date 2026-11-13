import { t } from '../../i18n';
import type { EngineLine } from '../../features/engine/uci';
import { formatScore } from '../../features/engine/uci';
import { formatLine, sanToLocal } from '../../utils/notation';
import type { AppliedMove } from '../../utils/chess';
import { ARROW_COLORS } from '../chess/ChessBoard';

/** Tono della freccia (e del numerino) di ciascuna delle tre mosse consigliate. */
export const CANDIDATE_TONES = ['teach', 'second', 'third'] as const;

export interface Candidate {
  line: EngineLine;
  /** Mosse della variante già applicate alla posizione (la prima è la mossa consigliata). */
  moves: AppliedMove[];
}

interface CandidateMovesProps {
  candidates: Candidate[];
  whiteToMove: boolean;
  /** Variante aperta sulla scacchiera, se c'è. */
  openIndex: number | null;
  onOpen: (index: number | null) => void;
}

/**
 * Le mosse migliori trovate da Stockfish, con il colore della freccia disegnata
 * sulla scacchiera, la valutazione e l'inizio della variante.
 */
export function CandidateMoves({ candidates, whiteToMove, openIndex, onOpen }: CandidateMovesProps) {
  return (
    <div data-testid="candidate-moves">
      <p className="text-sm font-semibold">{t.analyze.candidates.title}</p>
      <ol className="mt-1.5 space-y-1.5">
        {candidates.map((candidate, index) => {
          const first = candidate.moves[0];
          if (!first) return null;
          const tone = CANDIDATE_TONES[index] ?? 'third';
          const open = openIndex === index;
          return (
            <li key={candidate.line.multipv} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2" data-testid={`candidate-${index + 1}`}>
              <span
                aria-hidden
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: ARROW_COLORS[tone] }}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <strong className="font-display text-lg">{sanToLocal(first.san)}</strong>
                  <span className="text-sm tabular-nums text-muted">{formatScore(candidate.line.score, whiteToMove)}</span>
                  <span className="text-xs text-muted">{t.analyze.candidates.ranks[index]}</span>
                </p>
                {candidate.moves.length > 1 && (
                  <p className="truncate text-sm text-muted tabular-nums">
                    {t.analyze.candidates.continuation}: {formatLine(candidate.moves.slice(1, 6))}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-pressed={open}
                onClick={() => onOpen(open ? null : index)}
                className="min-h-10 shrink-0 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-accent-soft"
              >
                {open ? t.analyze.candidates.hideLine : t.analyze.candidates.showLine}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
