/**
 * Controlli locali sulla lettura della scacchiera fatta da Claude.
 *
 * Claude restituisce le 8 traverse come stringhe di 8 caratteri (un carattere
 * per casa, «.» = vuota): è più affidabile della FEN con le cifre, dove un
 * conteggio sbagliato delle case vuote sposta tutti i pezzi della traversa.
 * Qui le traverse diventano FEN e la posizione viene verificata: se qualcosa
 * è impossibile (due re bianchi, nove pedoni, un pedone in prima traversa…)
 * la lettura viene ripetuta indicando a Claude che cosa non torna.
 */

const RANK = /^[pnbrqkPNBRQK.]{8}$/;

/** Normalizza una traversa: accetta anche spazi, «-», «_», «0» e «1» come casa vuota. */
function normalizeRank(rank: string): string {
  return rank.replace(/\s+/g, '').replace(/[-_01]/g, '.');
}

/** Converte 8 traverse (dall'ottava alla prima, colonne a→h) nel campo FEN dei pezzi. */
export function ranksToPlacement(ranks: readonly string[]): string | null {
  if (ranks.length !== 8) return null;
  const rows: string[] = [];
  for (const raw of ranks) {
    const rank = normalizeRank(raw);
    if (!RANK.test(rank)) return null;
    rows.push(rank.replace(/\.+/g, (dots) => String(dots.length)));
  }
  return rows.join('/');
}

/** Espande il campo FEN dei pezzi in 8 traverse di 8 caratteri. */
export function placementToRanks(placement: string): string[] {
  return placement.split('/').map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))));
}

/**
 * Problemi che rendono impossibile la posizione letta, in inglese (vanno nel
 * prompt della seconda lettura). Lista vuota = posizione plausibile.
 */
export function placementProblems(placement: string): string[] {
  const ranks = placementToRanks(placement);
  const count = (piece: string) => ranks.join('').split(piece).length - 1;
  const problems: string[] = [];
  for (const [king, side] of [
    ['K', 'White'],
    ['k', 'Black'],
  ] as const) {
    const n = count(king);
    if (n !== 1) problems.push(`${side} has ${n} kings (must be exactly 1)`);
  }
  for (const [pawn, side] of [
    ['P', 'White'],
    ['p', 'Black'],
  ] as const) {
    const n = count(pawn);
    if (n > 8) problems.push(`${side} has ${n} pawns (max 8)`);
  }
  const whitePieces = ranks.join('').replace(/[^PNBRQK]/g, '').length;
  const blackPieces = ranks.join('').replace(/[^pnbrqk]/g, '').length;
  if (whitePieces > 16) problems.push(`White has ${whitePieces} pieces (max 16)`);
  if (blackPieces > 16) problems.push(`Black has ${blackPieces} pieces (max 16)`);
  if (/[pP]/.test(ranks[0] ?? '') || /[pP]/.test(ranks[7] ?? '')) problems.push('a pawn stands on rank 1 or rank 8 (impossible)');
  return problems;
}

/**
 * Orientamento della scacchiera nella foto: da quale lato dell'immagine stanno i
 * pezzi del Bianco (la sua prima traversa).
 *
 * Claude trascrive le 64 case ESATTAMENTE come le vede (riga in alto per prima,
 * da sinistra a destra) senza dover ruotare nulla a mente: la rotazione, dove
 * è facile sbagliare, la fa questo codice.
 */
export type BoardView = 'bottom' | 'top' | 'left' | 'right';
export const BOARD_VIEWS: readonly BoardView[] = ['bottom', 'top', 'left', 'right'];

export function isBoardView(value: unknown): value is BoardView {
  return value === 'bottom' || value === 'top' || value === 'left' || value === 'right';
}

/** Orientamento successivo (per il pulsante «ruota»). */
export function nextView(view: BoardView): BoardView {
  return BOARD_VIEWS[(BOARD_VIEWS.indexOf(view) + 1) % BOARD_VIEWS.length] ?? 'bottom';
}

/** Verifica e normalizza la griglia letta: 8 righe di 8 caratteri, oppure null. */
export function normalizeGrid(raw: readonly unknown[]): string[] | null {
  if (raw.length !== 8) return null;
  const rows: string[] = [];
  for (const row of raw) {
    if (typeof row !== 'string') return null;
    const rank = normalizeRank(row);
    if (!RANK.test(rank)) return null;
    rows.push(rank);
  }
  return rows;
}

/**
 * Dalla griglia vista nella foto (riga 0 = in alto, colonna 0 = a sinistra) alle
 * 8 traverse dal punto di vista del Bianco (dall'ottava alla prima, colonne a→h).
 *
 * Con il Bianco a sinistra la prima traversa è il bordo sinistro dell'immagine e
 * la colonna «a» è la riga in alto; con il Bianco a destra è il contrario.
 */
export function gridToRanks(grid: readonly string[], view: BoardView): string[] {
  const at = (r: number, f: number): string => {
    switch (view) {
      case 'bottom':
        return grid[r]?.[f] ?? '.';
      case 'top':
        return grid[7 - r]?.[7 - f] ?? '.';
      case 'left':
        return grid[f]?.[7 - r] ?? '.';
      case 'right':
        return grid[7 - f]?.[r] ?? '.';
    }
  };
  return Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, f) => at(r, f)).join(''));
}

/** Operazione inversa: come apparirebbe la posizione in una foto con quell'orientamento. */
export function ranksToGrid(ranks: readonly string[], view: BoardView): string[] {
  const at = (i: number, j: number): string => {
    switch (view) {
      case 'bottom':
        return ranks[i]?.[j] ?? '.';
      case 'top':
        return ranks[7 - i]?.[7 - j] ?? '.';
      case 'left':
        return ranks[7 - j]?.[i] ?? '.';
      case 'right':
        return ranks[j]?.[7 - i] ?? '.';
    }
  };
  return Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => at(i, j)).join(''));
}

export function gridToPlacement(grid: readonly string[], view: BoardView): string | null {
  return ranksToPlacement(gridToRanks(grid, view));
}

/** Quanti pezzi bianchi e neri ci sono nella griglia. */
export function countPieces(grid: readonly string[]): { white: number; black: number } {
  const all = grid.join('');
  return { white: all.replace(/[^PNBRQK]/g, '').length, black: all.replace(/[^pnbrqk]/g, '').length };
}

/** Case che cambiano tra due posizioni (per descrivere la differenza a Claude o all'utente). */
export function changedSquares(before: string, after: string): string[] {
  const a = placementToRanks(before);
  const b = placementToRanks(after);
  const out: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (a[r]?.[f] !== b[r]?.[f]) out.push(`${'abcdefgh'[f]}${8 - r}`);
    }
  }
  return out;
}
