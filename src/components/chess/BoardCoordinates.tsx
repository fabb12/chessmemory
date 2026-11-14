import type { ReactNode } from 'react';
import { squaresFlipped } from '../../utils/notation';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Cornice con le coordinate (righe a sinistra, colonne sotto) attorno a una
 * scacchiera. Usata da tutte le scacchiere dell'app, così le coordinate sono
 * sempre visibili e coerenti con l'orientamento.
 */
export function BoardCoordinates({ orientation, children }: { orientation: 'white' | 'black'; children: ReactNode }) {
  // Numerazione invertita (Nero sulle righe 1-2): le etichette sono quelle della scacchiera ruotata.
  const white = (orientation === 'white') !== squaresFlipped();
  const files = white ? FILES : [...FILES].reverse();
  const ranks = white ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2">
      <div
        className="flex flex-col justify-around text-base font-bold leading-none text-fg sm:text-lg"
        aria-hidden="true"
        data-testid="board-ranks"
      >
        {ranks.map((r) => (
          <span key={r} className="text-center">{r}</span>
        ))}
      </div>
      <div className="min-w-0">{children}</div>
      <span />
      <div
        className="flex justify-around text-base font-bold uppercase leading-none text-fg sm:text-lg"
        aria-hidden="true"
        data-testid="board-files"
      >
        {files.map((f) => (
          <span key={f} className="text-center">{f}</span>
        ))}
      </div>
    </div>
  );
}
