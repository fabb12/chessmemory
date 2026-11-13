import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Chessboard, type ChessboardOptions } from 'react-chessboard';
import type { PieceSymbol } from 'chess.js';
import { t } from '../../i18n';
import type { Side, Uci } from '../../types';
import { kingSquareInCheck, legalTargets, pieceAt, sideToMove } from '../../utils/chess';
import { BoardCoordinates } from './BoardCoordinates';
import { PromotionDialog } from './PromotionDialog';

export interface BoardArrow {
  from: string;
  to: string;
  /** teach = mossa migliore, second/third = alternative, good/bad = giudizio sulla mossa dell'utente. */
  tone?: 'teach' | 'bad' | 'good' | 'second' | 'third';
}

export interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  /** Se true l'utente può muovere i pezzi del colore al tratto. */
  interactive?: boolean;
  /** Chiamata solo con mosse legali (verificate da chess.js). */
  onMove?: (uci: Uci) => void;
  arrows?: BoardArrow[];
  lastMove?: { from: string; to: string } | null;
  /** Casa del pezzo suggerito da un indizio. */
  hintSquare?: string | null;
  /** Evidenzia come errata l'ultima mossa. */
  lastMoveTone?: 'neutral' | 'good' | 'bad';
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const ARROW_COLORS = {
  teach: '#2557e9',
  second: 'rgba(37, 87, 233, 0.62)',
  third: 'rgba(37, 87, 233, 0.38)',
  good: '#2f8f4e',
  bad: '#b3402f',
} as const;
const LIGHT = '#e9edf5';
const DARK = '#7389ad';

const TONE_BG = {
  neutral: 'rgba(246, 214, 92, 0.55)',
  good: 'rgba(96, 186, 120, 0.6)',
  bad: 'rgba(214, 96, 77, 0.6)',
} as const;

function neighbour(square: string, key: string, orientation: 'white' | 'black'): string | null {
  const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rank = Number(square[1]);
  const dir = orientation === 'white' ? 1 : -1;
  const delta: Record<string, [number, number]> = {
    ArrowUp: [0, dir],
    ArrowDown: [0, -dir],
    ArrowLeft: [-dir, 0],
    ArrowRight: [dir, 0],
  };
  const d = delta[key];
  if (!d) return null;
  const f = file + d[0];
  const r = rank + d[1];
  if (f < 0 || f > 7 || r < 1 || r > 8) return null;
  return `${FILES[f]}${r}`;
}

function describePiece(pieceType: string | undefined): string | null {
  if (!pieceType || pieceType.length < 2) return null;
  const side: Side = pieceType[0] === 'w' ? 'w' : 'b';
  const type = pieceType[1]?.toLowerCase() as PieceSymbol | undefined;
  if (!type || !(type in t.pieces)) return null;
  return t.board.pieceOf(t.pieces[type], side);
}

/**
 * Scacchiera interattiva. La legalità delle mosse è sempre delegata a chess.js:
 * il componente gestisce soltanto selezione, trascinamento, evidenziazioni,
 * promozione e navigazione da tastiera.
 */
export function ChessBoard({
  fen,
  orientation,
  interactive = false,
  onMove,
  arrows,
  lastMove,
  hintSquare,
  lastMoveTone = 'neutral',
}: ChessBoardProps) {
  const rawId = useId();
  const boardId = useMemo(() => `cm${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusSquare, setFocusSquare] = useState<string>(orientation === 'white' ? 'e2' : 'e7');
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  // Cambiata la posizione, la selezione precedente non è più valida.
  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [fen, interactive]);

  const turn = useMemo(() => sideToMove(fen), [fen]);
  const targets = useMemo(() => (selected ? legalTargets(fen, selected) : []), [fen, selected]);
  const checkSquare = useMemo(() => kingSquareInCheck(fen), [fen]);

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      const target = legalTargets(fen, from).find((x) => x.to === to);
      if (!target) return false;
      if (target.isPromotion) {
        setPendingPromotion({ from, to });
        return false;
      }
      setSelected(null);
      onMove?.(`${from}${to}`);
      return true;
    },
    [fen, onMove],
  );

  const handleSquare = useCallback(
    (square: string) => {
      if (!interactive) return;
      if (selected && selected !== square && targets.some((x) => x.to === square)) {
        tryMove(selected, square);
        return;
      }
      const piece = pieceAt(fen, square);
      if (piece && piece.color === turn && selected !== square) setSelected(square);
      else setSelected(null);
    },
    [fen, interactive, selected, targets, tryMove, turn],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, square: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSquare(square);
        return;
      }
      if (event.key === 'Escape') {
        setSelected(null);
        return;
      }
      const next = neighbour(square, event.key, orientation);
      if (next) {
        event.preventDefault();
        setFocusSquare(next);
        containerRef.current?.querySelector<HTMLElement>(`[data-sq="${next}"]`)?.focus();
      }
    },
    [handleSquare, orientation],
  );

  const styleFor = useCallback(
    (square: string): CSSProperties => {
      const style: CSSProperties = { width: '100%', height: '100%', position: 'relative' };
      const layers: string[] = [];
      if (lastMove && (square === lastMove.from || square === lastMove.to)) {
        style.backgroundColor = TONE_BG[lastMoveTone];
      }
      if (square === checkSquare) {
        layers.push('radial-gradient(circle, rgba(220,50,40,0.85) 0%, rgba(220,50,40,0.35) 55%, transparent 72%)');
      }
      const target = targets.find((x) => x.to === square);
      if (target) {
        layers.push(
          target.isCapture
            ? 'radial-gradient(circle, transparent 0 62%, rgba(10,40,90,0.5) 63% 78%, transparent 79%)'
            : 'radial-gradient(circle, rgba(10,40,90,0.45) 0 19%, transparent 20%)',
        );
      }
      if (layers.length > 0) style.backgroundImage = layers.join(', ');
      if (square === selected) style.boxShadow = 'inset 0 0 0 4px rgba(37,87,233,0.95)';
      else if (square === hintSquare) style.boxShadow = 'inset 0 0 0 4px #e0a100, inset 0 0 0 7px rgba(255,255,255,0.7)';
      return style;
    },
    [checkSquare, hintSquare, lastMove, lastMoveTone, selected, targets],
  );

  const options: ChessboardOptions = {
    id: boardId,
    position: fen,
    boardOrientation: orientation,
    allowDragging: interactive,
    allowDrawingArrows: false,
    showAnimations: true,
    animationDurationInMs: 260,
    lightSquareStyle: { backgroundColor: LIGHT },
    darkSquareStyle: { backgroundColor: DARK },
    showNotation: false,
    boardStyle: {
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 0 0 6px #0f1d42, 0 0 0 7px rgba(227,181,83,0.55), 0 24px 48px -12px rgb(6 11 22 / 0.55)',
    },
    arrows: (arrows ?? []).map((a) => ({
      startSquare: a.from,
      endSquare: a.to,
      color: ARROW_COLORS[a.tone ?? 'teach'],
    })),
    canDragPiece: ({ piece }) => interactive && piece.pieceType[0] === turn,
    onPieceDrag: ({ square }) => {
      if (square) setSelected(square);
    },
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!interactive || !targetSquare || sourceSquare === targetSquare) return false;
      return tryMove(sourceSquare, targetSquare);
    },
    onSquareClick: ({ square }) => handleSquare(square),
    squareRenderer: ({ piece, square, children }) => {
      const pieceLabel = describePiece(piece?.pieceType);
      const extra = [
        square === selected ? t.board.selected : null,
        targets.some((x) => x.to === square) ? t.board.legalTarget : null,
      ].filter(Boolean);
      return (
        <div
          className="cm-square"
          data-sq={square}
          role={interactive ? 'button' : 'img'}
          tabIndex={interactive && square === focusSquare ? 0 : -1}
          aria-label={[t.board.square(square, pieceLabel), ...extra].join(', ')}
          aria-pressed={interactive ? square === selected : undefined}
          onFocus={() => setFocusSquare(square)}
          onKeyDown={(e) => handleKeyDown(e, square)}
          style={styleFor(square)}
        >
          {children}
        </div>
      );
    },
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-[min(100%,max(24rem,calc(100dvh-17rem)))] touch-manipulation select-none"
      data-testid="chessboard"
      data-fen={fen}
      data-interactive={interactive ? 'true' : 'false'}
      role="group"
      aria-label={t.board.label(t.sideToMove[turn])}
    >
      <BoardCoordinates orientation={orientation}>
        <Chessboard options={options} />
      </BoardCoordinates>
      {pendingPromotion && (
        <PromotionDialog
          side={turn}
          onCancel={() => setPendingPromotion(null)}
          onSelect={(piece) => {
            const { from, to } = pendingPromotion;
            setPendingPromotion(null);
            setSelected(null);
            onMove?.(`${from}${to}${piece}`);
          }}
        />
      )}
    </div>
  );
}
