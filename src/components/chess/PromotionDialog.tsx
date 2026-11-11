import { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import type { Side } from '../../types';

type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const GLYPHS: Record<Side, Record<PromotionPiece, string>> = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
};

interface PromotionDialogProps {
  side: Side;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/** Scelta del pezzo di promozione, sovrapposta alla scacchiera. */
export function PromotionDialog({ side, onSelect, onCancel }: PromotionDialogProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={t.board.promotionTitle}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="w-full max-w-xs rounded-2xl bg-surface p-4 text-center shadow-xl">
        <p className="mb-3 font-semibold">{t.board.promotionTitle}</p>
        <div className="grid grid-cols-4 gap-2">
          {(['q', 'r', 'b', 'n'] as const).map((piece, i) => (
            <button
              key={piece}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              data-promotion={piece}
              onClick={() => onSelect(piece)}
              className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 hover:border-accent"
            >
              <span aria-hidden="true" className="text-3xl leading-none">
                {GLYPHS[side][piece]}
              </span>
              <span className="mt-1 text-xs">{t.pieceLabels[piece]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="mt-3 min-h-11 px-3 text-sm underline" onClick={onCancel}>
          {t.app.cancel}
        </button>
      </div>
    </div>
  );
}
