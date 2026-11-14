import { useRef, type PointerEvent } from 'react';
import type { BoardView } from '../../features/assistant/boardReading';
import { cellToSquare, homography, type Corners, type Point } from '../../features/vision/geometry';
import { t } from '../../i18n';

export interface OverlayArrow {
  from: string;
  to: string;
  tone: 'hint' | 'bad' | 'good';
}

interface BoardOverlayProps {
  corners: Corners;
  /** Orientamento noto: serve a indicare dove sta la casa a1 (e dove disegnare pezzi e frecce). */
  view: BoardView | null;
  onChange: (corners: Corners) => void;
  /** Fine del trascinamento di un angolo (es. per salvare la calibrazione). */
  onChangeEnd?: (corners: Corners) => void;
  /** Disposizione attesa (prima parte della FEN): i pezzi vengono disegnati sulla base di ogni casa. */
  pieces?: string | null;
  arrows?: readonly OverlayArrow[];
  /** Case da evidenziare (es. quelle cambiate). */
  highlight?: readonly string[];
}

const CORNER_LABELS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
const ARROW_COLORS: Record<OverlayArrow['tone'], string> = {
  hint: 'rgba(250, 204, 21, 0.95)',
  bad: 'rgba(239, 68, 68, 0.95)',
  good: 'rgba(80, 220, 140, 0.95)',
};
const FILES = 'abcdefgh';

function pieceSquares(placement: string): { square: string; piece: string }[] {
  const out: { square: string; piece: string }[] = [];
  placement.split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else out.push({ square: `${FILES[f++]}${8 - r}`, piece: ch });
    }
  });
  return out;
}

/**
 * Griglia AR disegnata sul video nella posizione in cui il programma crede
 * che stia la scacchiera (omografia dai 4 angoli). Gli angoli si trascinano
 * per correggerla. Facoltativamente mostra i pezzi attesi secondo la FEN
 * (così si vede subito se griglia e orientamento combaciano con la scacchiera
 * reale) e le frecce dei suggerimenti.
 */
export function BoardOverlay({ corners, view, onChange, onChangeEnd, pieces, arrows, highlight }: BoardOverlayProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const latest = useRef(corners);
  latest.current = corners;
  const map = homography(corners);
  const pct = (p: Point) => ({ x: p.x * 100, y: p.y * 100 });

  const lines: { a: Point; b: Point }[] = [];
  for (let k = 0; k <= 8; k++) {
    lines.push({ a: pct(map(k / 8, 0)), b: pct(map(k / 8, 1)) });
    lines.push({ a: pct(map(0, k / 8)), b: pct(map(1, k / 8)) });
  }
  // Dalla casa alla cella dell'immagine (inverso di cellToSquare).
  const cellOf = new Map<string, { i: number; j: number }>();
  if (view) for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) cellOf.set(cellToSquare(i, j, view), { i, j });
  /** Punto della casa nel fotogramma: `dv` sposta verso il lato vicino (base del pezzo). */
  const at = (square: string, dv = 0.5): Point | null => {
    const cell = cellOf.get(square);
    return cell ? pct(map((cell.j + 0.5) / 8, (cell.i + dv) / 8)) : null;
  };
  const squarePolygon = (square: string): string | null => {
    const cell = cellOf.get(square);
    if (!cell) return null;
    const { i, j } = cell;
    return [map(j / 8, i / 8), map((j + 1) / 8, i / 8), map((j + 1) / 8, (i + 1) / 8), map(j / 8, (i + 1) / 8)]
      .map((p) => `${p.x * 100},${p.y * 100}`)
      .join(' ');
  };
  const a1 = at('a1');

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const index = dragging.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (index === null || !box || box.width === 0) return;
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    const next = corners.map((p, k) => (k === index ? { x, y } : p)) as Corners;
    onChange(next);
  };
  const end = () => {
    if (dragging.current !== null) onChangeEnd?.(latest.current);
    dragging.current = null;
  };

  return (
    <div ref={boxRef} className="absolute inset-0" data-testid="board-overlay">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {highlight?.map((square) => {
          const points = squarePolygon(square);
          return points ? <polygon key={`h-${square}`} points={points} fill="rgba(250, 204, 21, 0.35)" /> : null;
        })}
        {lines.map((l, k) => (
          <line
            key={k}
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            stroke={k < 2 || k >= 16 ? 'rgba(80, 220, 140, 0.95)' : 'rgba(80, 220, 140, 0.55)'}
            strokeWidth={k < 2 || k >= 16 ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {pieces &&
          view &&
          pieceSquares(pieces).map(({ square, piece }) => {
            const p = at(square, 0.55);
            if (!p) return null;
            const white = piece === piece.toUpperCase();
            return (
              <g key={`p-${square}`} data-testid="overlay-piece">
                <ellipse
                  cx={p.x}
                  cy={p.y}
                  rx={1.6}
                  ry={1.6}
                  fill={white ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.7)'}
                  stroke={white ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        {view &&
          arrows?.map((arrow) => {
            const a = at(arrow.from);
            const b = at(arrow.to);
            if (!a || !b) return null;
            const color = ARROW_COLORS[arrow.tone];
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            const head = 2.4;
            const left = { x: b.x - head * Math.cos(angle - 0.5), y: b.y - head * Math.sin(angle - 0.5) };
            const right = { x: b.x - head * Math.cos(angle + 0.5), y: b.y - head * Math.sin(angle + 0.5) };
            return (
              <g key={`a-${arrow.from}${arrow.to}`} data-testid="overlay-arrow" data-move={`${arrow.from}${arrow.to}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <polygon points={`${b.x},${b.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={color} />
              </g>
            );
          })}
      </svg>
      {a1 && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-1 text-[10px] font-bold text-white"
          style={{ left: `${a1.x}%`, top: `${a1.y}%` }}
        >
          a1
        </span>
      )}
      {corners.map((p, k) => (
        <button
          key={CORNER_LABELS[k]}
          type="button"
          aria-label={t.analyze.live.corner[CORNER_LABELS[k] ?? 'topLeft']}
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-emerald-500/80 shadow"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={(e) => {
            dragging.current = k;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      ))}
    </div>
  );
}
