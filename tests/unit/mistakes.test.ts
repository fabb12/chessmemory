import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChessMemoryDB } from '../../src/db/database';
import { PROFILE_ID } from '../../src/db/schema';
import type { Analyser } from '../../src/features/engine/engine';
import { evaluateMove } from '../../src/features/learning/evaluateMove';
import { isDue } from '../../src/features/memory/scheduler';
import {
  PgnError,
  detectPlayerColor,
  parsePgn,
  scanGameForMistakes,
  splitPgnGames,
} from '../../src/features/mistakes/game';
import {
  emptyPosition,
  fenToPosition,
  positionToFen,
  possibleCastling,
  startPosition,
  validatePosition,
} from '../../src/features/mistakes/position';
import { exportBackup, importBackup, parseBackupText, resetProgress, validateBackup } from '../../src/services/backup';
import {
  MistakeValidationError,
  createMistake,
  deleteMistake,
  dueMistakes,
  legalPrefix,
  mistakeToExercise,
  normalizeDraft,
  rateMistakeReview,
  recordMistakeReview,
  updateMistakeNotes,
  type MistakeDraft,
} from '../../src/services/mistakes';
import { ensureProfile } from '../../src/services/progress';
import { DAY, T0 } from './helpers';

/** Il Bianco ha giocato 1.Tb1?? invece del matto 1.Ta8#. */
const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

function draft(overrides: Partial<MistakeDraft> = {}): MistakeDraft {
  return {
    title: '  Matto sulla traversa  ',
    fen: BACK_RANK,
    playedMove: 'a1b1',
    bestMove: 'a1a8',
    alternatives: [],
    line: ['a1a8'],
    whatWentWrong: 'Non ho controllato gli scacchi.',
    howToContinue: 'Ta8 è matto: il re non ha case di fuga.',
    conceptId: null,
    source: 'manual',
    gameInfo: null,
    moveNumber: 24,
    severity: 'blunder',
    engine: { depth: 12, bestCp: 99_900, playedCp: 650 },
    ...overrides,
  };
}

const PHOTO = { dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', width: 640, height: 480 };

let name = '';
let database: ChessMemoryDB;
let counter = 0;
beforeEach(async () => {
  name = `mistakes-db-${++counter}`;
  database = new ChessMemoryDB(name);
  await database.open();
});
afterEach(async () => {
  database.close();
  await ChessMemoryDB.delete(name);
});

describe('partite in PGN', () => {
  const PGN = `[Event "Torneo sociale"]
[White "Rossi"]
[Black "Bianchi"]
[Date "2026.11.10"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

  it('legge intestazioni, mosse e posizioni', () => {
    const game = parsePgn(PGN);
    expect(game.label).toBe('Rossi – Bianchi, 2026-11-10');
    expect(game.moves).toHaveLength(7);
    expect(game.moves[5]).toMatchObject({ ply: 5, moveNumber: 3, color: 'b', san: 'Nf6', uci: 'g8f6' });
    expect(game.moves[6]!.fenBefore).toBe(game.moves[5]!.fenAfter);
  });

  it('riconosce il colore del giocatore dal nome', () => {
    const { headers } = parsePgn(PGN);
    expect(detectPlayerColor(headers, 'bianchi')).toBe('b');
    expect(detectPlayerColor(headers, ' Rossi ')).toBe('w');
    expect(detectPlayerColor(headers, 'Verdi')).toBeNull();
    expect(detectPlayerColor(headers, '')).toBeNull();
  });

  it('separa i file con più partite e rifiuta testi non validi', () => {
    expect(splitPgnGames(`${PGN}\n\n${PGN}`)).toHaveLength(2);
    expect(() => parsePgn('')).toThrow(PgnError);
    expect(() => parsePgn('1. e4 e5 2. Ke3 Ke6 3. Qxh8')).toThrow(PgnError);
    expect(() => parsePgn('[Event "?"]\n\n*')).toThrow(/non contiene mosse/);
  });
});

describe('ricerca degli errori', () => {
  it('confronta la mossa migliore con quella giocata e analizza ogni posizione una sola volta', async () => {
    const game = parsePgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0');
    const calls: string[] = [];
    // Motore finto: valutazioni costruite a mano per ogni posizione.
    const analyser: Analyser = {
      async analyse(fen) {
        calls.push(fen);
        const ply = game.moves.findIndex((m) => m.fenBefore === fen);
        const afterNf6 = game.moves[5]!.fenAfter;
        if (fen === afterNf6) {
          return { fen, depth: 10, lines: [], bestMove: 'h5f7', score: { kind: 'mate', value: 1 } };
        }
        if (ply === 5) {
          return {
            fen,
            depth: 10,
            lines: [{ multipv: 1, depth: 10, score: { kind: 'cp', value: -60 }, pv: ['g7g6', 'h5f3'] }],
            bestMove: 'g7g6',
            score: { kind: 'cp', value: -60 },
          };
        }
        return { fen, depth: 10, lines: [], bestMove: 'a7a6', score: { kind: 'cp', value: 0 } };
      },
    };
    const progress: number[] = [];
    const found = await scanGameForMistakes(game.moves, 'b', analyser, {
      depth: 10,
      onProgress: (p) => progress.push(p.done),
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'blunder', bestMove: 'g7g6', line: ['g7g6', 'h5f3'] });
    expect(found[0]!.move.san).toBe('Nf6');
    expect(found[0]!.playedScore).toEqual({ kind: 'mate', value: -1 });
    expect(new Set(calls).size).toBe(calls.length);
    expect(progress.at(-1)).toBe(calls.length);
  });

  it('si interrompe se richiesto', async () => {
    const game = parsePgn('1. e4 e5 2. Nf3 Nc6');
    const controller = new AbortController();
    controller.abort();
    const analyser: Analyser = { analyse: async (fen) => ({ fen, depth: 1, lines: [], bestMove: null, score: { kind: 'cp', value: 0 } }) };
    await expect(scanGameForMistakes(game.moves, 'w', analyser, { depth: 5, signal: controller.signal })).rejects.toThrow(
      /interrotta/,
    );
  });
});

describe('editor della posizione', () => {
  it('converte avanti e indietro tra posizione e FEN', () => {
    const start = startPosition();
    expect(positionToFen(start)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const back = fenToPosition(BACK_RANK)!;
    expect(back.placement).toMatchObject({ g8: 'bK', a1: 'wR', g1: 'wK', f2: 'wP' });
    expect(positionToFen(back)).toBe(BACK_RANK);
    expect(fenToPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')?.turn).toBe('w');
    expect(fenToPosition('8/8/9/8/8/8/8/8 w - - 0 1')).toBeNull();
    expect(fenToPosition('ciao')).toBeNull();
  });

  it('propone solo gli arrocchi compatibili con la posizione dei pezzi', () => {
    const pos = startPosition();
    expect(possibleCastling(pos.placement)).toEqual(['K', 'Q', 'k', 'q']);
    const moved = { ...pos, placement: { ...pos.placement, h1: undefined } };
    expect(possibleCastling(moved.placement)).toEqual(['Q', 'k', 'q']);
    expect(positionToFen(moved).split(' ')[2]).toBe('Qkq');
  });

  it('segnala le posizioni impossibili', () => {
    expect(validatePosition(emptyPosition())).toBe('kings');
    expect(validatePosition(fenToPosition(BACK_RANK)!)).toBeNull();
    expect(validatePosition(fenToPosition('4k3/8/8/8/8/8/8/P3K3 w - - 0 1')!)).toBe('pawns');
    // Il re nero è sotto scacco ma muove il Bianco.
    expect(validatePosition(fenToPosition('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')!)).toBe('check');
    // Stallo: nessuna mossa legale.
    expect(validatePosition(fenToPosition('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')!)).toBe('noMoves');
  });
});

describe('salvataggio degli errori', () => {
  it('normalizza la bozza e rifiuta mosse illegali o incoerenti', () => {
    const clean = normalizeDraft(draft({ line: ['a1a8', 'h2h4'], alternatives: ['a1a8', 'a1b1', 'g2g3', 'a1h8'] }));
    expect(clean.title).toBe('Matto sulla traversa');
    // Dopo il matto non ci sono altre mosse legali.
    expect(clean.line).toEqual(['a1a8']);
    expect(clean.alternatives).toEqual(['g2g3']);
    expect(normalizeDraft(draft({ line: ['h2h3'] })).line).toEqual(['a1a8']);
    expect(() => normalizeDraft(draft({ bestMove: 'a1a9' }))).toThrow(MistakeValidationError);
    expect(() => normalizeDraft(draft({ playedMove: 'a1a8' }))).toThrow(/coincide/);
    expect(() => normalizeDraft(draft({ fen: 'non una fen' }))).toThrow(/posizione/);
    expect(legalPrefix('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'e7e5', 'e1e3'])).toEqual([
      'e2e4',
      'e7e5',
    ]);
  });

  it('salva errore e foto, aggiorna le note ed elimina tutto insieme', async () => {
    const record = await createMistake(draft(), PHOTO, database, T0);
    expect(record.card).toMatchObject({ conceptId: record.id, state: 'new', reps: 0 });
    expect(isDue(record.card, T0)).toBe(true);
    expect(await database.photos.get(record.photoId!)).toMatchObject({ width: 640, dataUrl: PHOTO.dataUrl });

    await updateMistakeNotes(record.id, { whatWentWrong: 'Nuova nota', conceptId: 'back-rank-mate' }, database, T0 + 1000);
    const updated = await database.mistakes.get(record.id);
    expect(updated).toMatchObject({ whatWentWrong: 'Nuova nota', updatedAt: T0 + 1000, bestMove: 'a1a8', conceptId: 'back-rank-mate' });
    await updateMistakeNotes(record.id, { conceptId: 'inesistente' }, database, T0 + 2000);
    expect((await database.mistakes.get(record.id))!.conceptId).toBeNull();

    await deleteMistake(record.id, database);
    expect(await database.mistakes.count()).toBe(0);
    expect(await database.photos.count()).toBe(0);
  });

  it('programma i ripassi con FSRS e conta come giorno di allenamento', async () => {
    await ensureProfile(database, T0);
    const record = await createMistake(draft(), null, database, T0);
    expect(rateMistakeReview({ correct: false, mistakes: 3, hintsUsed: 2 }, 0)).toBe(1);
    expect(rateMistakeReview({ correct: true, mistakes: 1, hintsUsed: 0 }, 0)).toBe(2);
    expect(rateMistakeReview({ correct: true, mistakes: 0, hintsUsed: 0 }, 0)).toBe(3);
    expect(rateMistakeReview({ correct: true, mistakes: 0, hintsUsed: 0 }, 2)).toBe(4);

    const clean = { exerciseId: record.id, correct: true, attempts: 1, mistakes: 0, hintsUsed: 0, responseMs: 3000 };
    const after = await recordMistakeReview(record.id, clean, database, T0);
    expect(after).toMatchObject({ reviewCount: 1, lastResult: 'clean' });
    expect(after!.card.due).toBeGreaterThan(T0 + DAY / 2);
    expect(dueMistakes([after!], T0)).toHaveLength(0);
    const profile = await database.profile.get(PROFILE_ID);
    expect(profile!.streak.current).toBe(1);

    const failed = await recordMistakeReview(record.id, { ...clean, correct: false, mistakes: 3, hintsUsed: 2 }, database, after!.card.due);
    expect(failed).toMatchObject({ reviewCount: 2, lastResult: 'failed' });
    expect(failed!.card.lapses).toBe(1);
  });

  it('diventa un esercizio: la nota è il primo indizio e le alternative sono accettate', async () => {
    const record = await createMistake(draft({ alternatives: ['g2g3'] }), null, database, T0);
    const exercise = mistakeToExercise(record, 'indizio generico');
    expect(exercise).toMatchObject({ id: record.id, sideToMove: 'w', hints: ['Non ho controllato gli scacchi.'] });
    expect(evaluateMove(exercise, 0, 'a1a8')).toBe('best');
    expect(evaluateMove(exercise, 0, 'g2g3')).toBe('alternative');
    expect(evaluateMove(exercise, 0, 'a1b1')).toBe('wrong');
    expect(mistakeToExercise({ ...record, whatWentWrong: '' }, 'indizio generico').hints).toEqual(['indizio generico']);
  });
});

describe('backup con gli errori', () => {
  it('esporta e reimporta errori e foto', async () => {
    await ensureProfile(database, T0);
    const record = await createMistake(draft(), PHOTO, database, T0);
    const backup = await exportBackup(database, T0 + DAY);
    const data = parseBackupText(JSON.stringify(backup));
    expect(data.mistakes).toHaveLength(1);
    expect(data.photos).toHaveLength(1);

    await deleteMistake(record.id, database);
    await importBackup(data, database);
    expect(await database.mistakes.get(record.id)).toMatchObject({ title: 'Matto sulla traversa', photoId: record.photoId });
    expect(await database.photos.count()).toBe(1);
  });

  it('senza foto (cloud) mantiene quelle locali ancora collegate', async () => {
    await ensureProfile(database, T0);
    const kept = await createMistake(draft(), PHOTO, database, T0);
    const backup = await exportBackup(database, T0, { includePhotos: false });
    expect(backup.data.photos).toBeNull();
    // Un errore creato dopo il salvataggio sparisce con il ripristino, insieme alla sua foto.
    await createMistake(draft({ title: 'Più recente' }), PHOTO, database, T0 + 1);
    await importBackup(validateBackup(JSON.parse(JSON.stringify(backup))), database);
    expect(await database.mistakes.count()).toBe(1);
    expect((await database.photos.toArray()).map((p) => p.id)).toEqual([kept.photoId]);
  });

  it('legge i backup della versione 1 (senza errori né nuove preferenze)', async () => {
    await ensureProfile(database, T0);
    const backup = (await exportBackup(database, T0)) as unknown as {
      version: number;
      data: { mistakes?: unknown; photos?: unknown; profile: { settings: Record<string, unknown> } };
    };
    backup.version = 1;
    delete backup.data.mistakes;
    delete backup.data.photos;
    delete backup.data.profile.settings.analysisDepth;
    delete backup.data.profile.settings.playerName;
    const data = validateBackup(backup);
    expect(data.mistakes).toEqual([]);
    expect(data.photos).toBeNull();
    expect(data.profile.settings).toMatchObject({ analysisDepth: 'quick', playerName: '' });
  });

  it('rifiuta errori e foto non validi', async () => {
    await ensureProfile(database, T0);
    await createMistake(draft(), PHOTO, database, T0);
    const base = JSON.stringify(await exportBackup(database, T0));
    const broken = (mutate: (b: { data: { mistakes: Record<string, unknown>[]; photos: Record<string, unknown>[] } }) => void) => {
      const b = JSON.parse(base);
      mutate(b);
      return () => validateBackup(b);
    };
    expect(broken((b) => (b.data.mistakes[0]!.fen = 'xx'))).toThrow(/posizione non valida/);
    expect(broken((b) => (b.data.mistakes[0]!.bestMove = 'z9z9'))).toThrow(/mossa non valida/);
    expect(broken((b) => (b.data.mistakes[0]!.whatWentWrong = 'x'.repeat(3000)))).toThrow(/testo/);
    expect(broken((b) => (b.data.photos[0]!.dataUrl = 'javascript:alert(1)'))).toThrow(/immagine/);
    expect(broken((b) => b.data.mistakes.push(b.data.mistakes[0]!))).toThrow(/duplicati/);
  });

  it('il ripristino dei progressi non cancella gli errori salvati', async () => {
    await ensureProfile(database, T0);
    await createMistake(draft(), PHOTO, database, T0);
    await resetProgress(database);
    expect(await database.mistakes.count()).toBe(1);
    expect(await database.photos.count()).toBe(1);
  });
});
