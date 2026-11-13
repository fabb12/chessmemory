import { useRef, type PointerEvent } from 'react';
import type { BoardView } from '../../features/assistant/boardReading';
import { cellToSquare, homography, type Corners, type Point } from '../../features/vision/geometry';
import { t } from '../../i18n';

interface BoardOverlayProps {
  corners: Corners;
  /** Orientamento noto: serve a indicare dove sta la casa a1. */
  view: BoardView | null;
  onChange: (corners: Corners) => void;
}

const CORNER_LABELS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;

/**
 * Griglia 8×8 disegnata sul video nella posizione in cui il programma crede
 * che stia la scacchiera. Gli angoli si trascinano per correggerla: da questa
 * griglia dipendono il ritaglio inviato a Claude e il riconoscimento delle
 * mosse senza Claude.
 */
export function BoardOverlay({ corners, view, onChange }: BoardOverlayProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const map = homography(corners);
  const pct = (p: Point) => ({ x: p.x * 100, y: p.y * 100 });

  const lines: { a: Point; b: Point }[] = [];
  for (let k = 0; k <= 8; k++) {
    lines.push({ a: pct(map(k / 8, 0)), b: pct(map(k / 8, 1)) });
    lines.push({ a: pct(map(0, k / 8)), b: pct(map(1, k / 8)) });
  }
  let a1: Point | null = null;
  if (view) {
    for (let i = 0; i < 8 && !a1; i++) {
      for (let j = 0; j < 8; j++) {
        if (cellToSquare(i, j, view) === 'a1') {
          a1 = pct(map((j + 0.5) / 8, (i + 0.5) / 8));
          break;
        }
      }
    }
  }

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const index = dragging.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (index === null || !box || box.width === 0) return;
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    const next = corners.map((p, k) => (k === index ? { x, y } : p)) as Corners;
    onChange(next);
  };

  return (
    <div ref={boxRef} className="absolute inset-0" data-testid="board-overlay">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
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
          aria-label={t.analyze.live.corner[CORNER_LABELS[k] ?? "topLeft"]}
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-emerald-500/80 shadow"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={(e) => {
            dragging.current = k;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={move}
          onPointerUp={() => (dragging.current = null)}
          onPointerCancel={() => (dragging.current = null)}
        />
      ))}
    </div>
  );
}
