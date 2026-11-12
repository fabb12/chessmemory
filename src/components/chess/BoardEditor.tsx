import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Chessboard, defaultPieces, type ChessboardOptions } from 'react-chessboard';
import { t } from '../../i18n';
import {
  CASTLING_RIGHTS,
  PIECE_CODES,
  emptyPosition,
  possibleCastling,
  startPosition,
  type EditorPosition,
  type PieceCode,
} from '../../features/mistakes/position';
import type { Side } from '../../types';
import { Icon } from '../ui/Icon';

type Tool = PieceCode | 'erase' | 'move';

const FILES = 'abcdefgh';
const LIGHT = '#e3f0fc';
const DARK = '#5b9bd8';

function pieceLabel(code: PieceCode): string {
  const type = code[1]?.toLowerCase() as keyof typeof t.pieceLabels;
  return `${t.pieceLabels[type]} ${code[0] === 'w' ? 'bianco' : 'nero'}`;
}

function neighbour(square: string, key: string, orientation: 'white' | 'black'): string | null {
  const file = FILES.indexOf(square[0] ?? '');
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

interface BoardEditorProps {
  value: EditorPosition;
  onChange: (value: EditorPosition) => void;
  orientation: 'white' | 'black';
  onFlip: () => void;
}

/**
 * Editor libero della posizione: tavolozza dei pezzi, gomma, spostamento con
 * trascinamento, tratto e arrocchi. Usato per ricostruire la posizione dalla
 * foto della scacchiera o a mano.
 */
export function BoardEditor({ value, onChange, orientation, onFlip }: BoardEditorProps) {
  const rawId = useId();
  const boardId = useMemo(() => `ed${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId]);
  const [tool, setTool] = useState<Tool>('wP');
  const [focusSquare, setFocusSquare] = useState('e2');
  const containerRef = useRef<HTMLDivElement>(null);

  const setPlacement = (placement: EditorPosition['placement']) => {
    // Gli arrocchi impossibili con la nuova disposizione vengono tolti; quelli
    // che tornano possibili (re e torre sulle case iniziali) vengono proposti.
    const before = possibleCastling(value.placement);
    const after = possibleCastling(placement);
    const castling = after.filter((c) => value.castling.includes(c) || !before.includes(c));
    onChange({ ...value, placement, castling });
  };

  const applyTool = (square: string) => {
    if (tool === 'move') return;
    const placement = { ...value.placement };
    if (tool === 'erase' || placement[square] === tool) delete placement[square];
    else placement[square] = tool;
    setPlacement(placement);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, square: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      applyTool(square);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      const placement = { ...value.placement };
      delete placement[square];
      setPlacement(placement);
      return;
    }
    const next = neighbour(square, event.key, orientation);
    if (next) {
      event.preventDefault();
      setFocusSquare(next);
      containerRef.current?.querySelector<HTMLElement>(`[data-sq="${next}"]`)?.focus();
    }
  };

  const position = Object.fromEntries(
    Object.entries(value.placement)
      .filter((entry): entry is [string, PieceCode] => entry[1] !== undefined)
      .map(([sq, code]) => [sq, { pieceType: code }]),
  );

  const options: ChessboardOptions = {
    id: boardId,
    position,
    boardOrientation: orientation,
    allowDragging: tool === 'move',
    allowDrawingArrows: false,
    showAnimations: false,
    lightSquareStyle: { backgroundColor: LIGHT },
    darkSquareStyle: { backgroundColor: DARK },
    lightSquareNotationStyle: { color: '#2f5f94', fontWeight: 600 },
    darkSquareNotationStyle: { color: '#eaf4ff', fontWeight: 600 },
    boardStyle: { borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 28px rgb(0 0 0 / 0.25), 0 0 0 6px #2f6cae' },
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!targetSquare || sourceSquare === targetSquare) return false;
      const placement = { ...value.placement };
      const piece = placement[sourceSquare];
      if (!piece) return false;
      delete placement[sourceSquare];
      placement[targetSquare] = piece;
      setPlacement(placement);
      return true;
    },
    onSquareClick: ({ square }) => applyTool(square),
    squareRenderer: ({ piece, square, children }) => (
      <div
        className="cm-square"
        data-sq={square}
        role="button"
        tabIndex={square === focusSquare ? 0 : -1}
        aria-label={t.board.square(square, piece ? pieceLabel(piece.pieceType as PieceCode) : null)}
        onFocus={() => setFocusSquare(square)}
        onKeyDown={(e) => handleKeyDown(e, square)}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        {children}
      </div>
    ),
  };

  const allowed = possibleCastling(value.placement);
  const tools: { id: Tool; label: string }[] = [
    ...PIECE_CODES.map((code) => ({ id: code as Tool, label: pieceLabel(code) })),
    { id: 'erase', label: t.mistakes.editor.eraser },
    { id: 'move', label: t.mistakes.editor.move },
  ];

  return (
    <div className="space-y-3" data-testid="board-editor">
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-[min(100%,max(22rem,calc(100dvh-20rem)))] touch-manipulation select-none"
        role="group"
        aria-label={t.mistakes.editor.label}
      >
        <Chessboard options={options} />
      </div>

      <fieldset>
        <legend className="sr-only">{t.mistakes.editor.palette}</legend>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14" role="radiogroup" aria-label={t.mistakes.editor.palette}>
          {tools.map((item) => {
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={item.label}
                title={item.label}
                data-tool={item.id}
                onClick={() => setTool(item.id)}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-xl border-2 p-0.5 ${
                  active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                {item.id === 'erase' ? (
                  <Icon name="trash" size={20} />
                ) : item.id === 'move' ? (
                  <Icon name="arrowRight" size={20} />
                ) : (
                  <span className="block size-full" aria-hidden="true">
                    {defaultPieces[item.id]?.({ svgStyle: { width: '100%', height: '100%' } })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="text-sm text-muted">{t.mistakes.editor.help}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2" onClick={() => onChange({ ...startPosition(), turn: value.turn })}>
          {t.mistakes.editor.start}
        </button>
        <button type="button" className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2" onClick={() => onChange(emptyPosition(value.turn))}>
          {t.mistakes.editor.clear}
        </button>
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2" onClick={onFlip}>
          <Icon name="undo" size={16} />
          {t.mistakes.editor.flip}
        </button>
      </div>

      <fieldset>
        <legend className="mb-1.5 font-semibold">{t.mistakes.editor.toMove}</legend>
        <div className="flex gap-2">
          {(['w', 'b'] as Side[]).map((side) => (
            <label
              key={side}
              className={`flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium ${
                value.turn === side ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name={`${boardId}-turn`}
                checked={value.turn === side}
                onChange={() => onChange({ ...value, turn: side })}
                className="size-4 accent-(--accent)"
                data-testid={`turn-${side}`}
              />
              {t.sides[side]}
            </label>
          ))}
        </div>
      </fieldset>

      {allowed.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t.mistakes.editor.castling}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CASTLING_RIGHTS.filter((c) => allowed.includes(c)).map((c) => (
              <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.castling.includes(c)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      castling: e.target.checked ? [...value.castling, c] : value.castling.filter((x) => x !== c),
                    })
                  }
                  className="size-5 accent-(--accent)"
                />
                {t.mistakes.editor.castlingNames[c]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
