import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { gridToRanks, placementToRanks, ranksToGrid, type BoardView } from '../../src/features/assistant/boardReading';
import { inferTurn, resolveReading } from '../../src/features/assistant/boardResolve';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START = START_FEN.split(' ')[0]!;

/** Foto simulata della posizione con il Bianco dal lato indicato. */
const photo = (placement: string, view: BoardView) => ranksToGrid(placementToRanks(placement), view);
/** Sostituisce il carattere di una casa (es. 'e2') nella disposizione dei pezzi. */
function withSquare(placement: string, square: string, piece: string): string {
  const ranks = placementToRanks(placement).map((r) => r.split(''));
  ranks[8 - Number(square[1])]![' abcdefgh'.indexOf(square[0]!) - 1] = piece;
  return ranksToPlacementLocal(ranks.map((r) => r.join('')));
}
const ranksToPlacementLocal = (ranks: string[]) => ranks.map((row) => row.replace(/\.+/g, (d) => String(d.length))).join('/');

describe('lettura della scacchiera: correzione con le mosse legali', () => {
  it('riconosce la posizione iniziale in ogni orientamento', () => {
    for (const view of ['bottom', 'top', 'left', 'right'] as const) {
      const result = resolveReading({ grid: photo(START, view), claimedView: view });
      expect(result.placement).toBe(START);
      expect(result.view).toBe(view);
      expect(result.turn).toBe('w');
      expect(result.corrected).toEqual([]);
    }
  });

  it('corregge l\'orientamento dichiarato male quando la foto coincide con la posizione iniziale', () => {
    // Claude dice «Bianco in basso» ma la foto è scattata dal lato del Nero.
    const result = resolveReading({ grid: photo(START, 'top'), claimedView: 'bottom' });
    expect(result.view).toBe('top');
    expect(result.placement).toBe(START);
  });

  it('non cambia l\'orientamento imposto dall\'utente', () => {
    const result = resolveReading({ grid: photo(START, 'top'), claimedView: 'bottom', forcedView: 'bottom' });
    expect(result.view).toBe('bottom');
  });

  it('sistema un pezzo letto male nella posizione iniziale', () => {
    // L'alfiere nero in c8 letto come pedone e il cavallo bianco in g1 come alfiere.
    let wrong = withSquare(START, 'c8', 'p');
    wrong = withSquare(wrong, 'g1', 'B');
    const result = resolveReading({ grid: photo(wrong, 'bottom'), claimedView: 'bottom' });
    expect(result.placement).toBe(START);
    expect(result.corrected.sort()).toEqual(['c8', 'g1']);
  });

  it('riconosce una mossa dalla posizione iniziale e ne deduce il tratto', () => {
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
    const result = resolveReading({ grid: photo(after, 'bottom'), claimedView: 'bottom' });
    expect(result.placement).toBe(after);
    expect(result.turn).toBe('b');
    expect(result.moves).toEqual(['e4']);
  });

  it('con la posizione precedente trasforma una lettura impossibile nella mossa legale più vicina', () => {
    const chess = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) chess.move(san);
    const reference = { fen: chess.fen(), locked: false };
    chess.move('Bb5');
    const truth = chess.fen().split(' ')[0]!;
    // Il nuovo alfiere letto come pedone e il cavallo in c6 letto come alfiere.
    const wrong = withSquare(withSquare(truth, 'b5', 'P'), 'c6', 'b');
    const result = resolveReading({ grid: photo(wrong, 'bottom'), claimedView: 'bottom', reference });
    expect(result.placement).toBe(truth);
    expect(result.moves).toEqual(['Bb5']);
    expect(result.turn).toBe('b');
    expect(result.corrected.sort()).toEqual(['b5', 'c6']);
  });

  it('se il tratto della posizione precedente era un\'ipotesi sbagliata, la mossa si trova lo stesso', () => {
    const chess = new Chess();
    chess.move('e4');
    // Chi ha letto la posizione ha supposto che toccasse al Bianco (invece muove il Nero).
    const reference = { fen: chess.fen().replace(' b ', ' w '), locked: false };
    chess.move('e5');
    const truth = chess.fen().split(' ')[0]!;
    const result = resolveReading({ grid: photo(truth, 'bottom'), claimedView: 'bottom', reference });
    expect(result.placement).toBe(truth);
    expect(result.turn).toBe('w');
  });

  it('accetta una posizione lontana da quella precedente senza forzarla', () => {
    const other = '8/5k2/8/3p4/3P4/8/5K2/8';
    const result = resolveReading({ grid: photo(other, 'bottom'), claimedView: 'bottom', reference: { fen: START_FEN, locked: false } });
    expect(result.placement).toBe(other);
    expect(result.corrected).toEqual([]);
    expect(result.turn).toBeNull();
  });

  it('una posizione corretta a mano non viene sostituita da una lettura sbagliata', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const misread = withSquare(START, 'c8', 'n');
    const locked = resolveReading({ grid: photo(misread, 'bottom'), claimedView: 'bottom', reference: { fen, locked: true }, lastRawPlacement: misread });
    expect(locked.placement).toBe(START);
    // Se la posizione non era stata toccata dall'utente, due letture uguali di seguito prevalgono.
    const stable = resolveReading({ grid: photo(misread, 'bottom'), claimedView: 'bottom', reference: { fen, locked: false }, lastRawPlacement: misread });
    expect(stable.placement).toBe(misread);
    const first = resolveReading({ grid: photo(misread, 'bottom'), claimedView: 'bottom', reference: { fen, locked: false }, lastRawPlacement: null });
    expect(first.placement).toBe(START);
  });

  it('il risultato è sempre una disposizione valida da 8 traverse', () => {
    const result = resolveReading({ grid: photo(START, 'left'), claimedView: 'left' });
    expect(gridToRanks(photo(START, 'left'), 'left')).toEqual(placementToRanks(START));
    expect(result.placement.split('/')).toHaveLength(8);
  });
});

describe('tratto dedotto dalla posizione', () => {
  it('muove chi ha il re sotto scacco', () => {
    // Re nero in e8 attaccato dalla torre in e1: deve muovere il Nero, anche se si era ipotizzato il Bianco.
    expect(inferTurn('4k3/8/8/8/8/8/8/K3R3', 'w')).toBe('b');
    expect(inferTurn('4k3/8/8/8/8/8/8/K3R3', 'b')).toBe('b');
    expect(inferTurn(START, 'b')).toBe('b');
  });
});
