import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { CONCEPTS, EXERCISES, getConceptExercises } from '../../src/data/exercises';
import { CATEGORIES } from '../../src/types';
import { allLegalUci, applyUci, isUci, isValidFen, sideToMove, solutionLine } from '../../src/utils/chess';

describe('dataset didattico', () => {
  it('contiene almeno 24 esercizi distribuiti nelle categorie', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(24);
    for (const category of ['openings', 'tactics', 'strategy'] as const) {
      expect(EXERCISES.filter((e) => e.category === category).length).toBeGreaterThanOrEqual(6);
    }
    for (const category of CATEGORIES) {
      expect(CONCEPTS.some((c) => c.category === category)).toBe(true);
    }
  });

  it('copre tutti i livelli di difficoltà da 1 a 5', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(CONCEPTS.some((c) => c.difficulty === level)).toBe(true);
    }
  });

  it('ha identificativi unici', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(CONCEPTS.map((c) => c.id)).size).toBe(CONCEPTS.length);
  });

  it('ogni concetto ha almeno due esercizi coerenti (categoria e difficoltà)', () => {
    for (const concept of CONCEPTS) {
      const exercises = getConceptExercises(concept.id);
      expect(exercises.length, concept.id).toBeGreaterThanOrEqual(2);
      for (const e of exercises) {
        expect(e.category, e.id).toBe(concept.category);
        expect(e.difficulty, e.id).toBe(concept.difficulty);
      }
      expect(concept.principle.length).toBeGreaterThan(20);
      expect(concept.taskPrompt.length).toBeGreaterThan(5);
    }
  });

  it('non contiene posizioni duplicate', () => {
    expect(new Set(EXERCISES.map((e) => e.fen)).size).toBe(EXERCISES.length);
  });

  describe.each(EXERCISES.map((e) => [e.id, e] as const))('%s', (_id, exercise) => {
    it('ha un FEN valido con il colore al tratto dichiarato', () => {
      expect(isValidFen(exercise.fen)).toBe(true);
      expect(sideToMove(exercise.fen)).toBe(exercise.sideToMove);
      const chess = new Chess(exercise.fen);
      expect(chess.isGameOver()).toBe(false);
    });

    it('appartiene a un concetto esistente', () => {
      expect(CONCEPTS.some((c) => c.id === exercise.conceptId)).toBe(true);
    });

    it('ha una soluzione legale, comprese risposte e alternative', () => {
      expect(exercise.solution.length).toBeGreaterThan(0);
      let fen = exercise.fen;
      exercise.solution.forEach((step, index) => {
        expect(isUci(step.move)).toBe(true);
        const legal = allLegalUci(fen);
        expect(legal, `${step.move} in ${fen}`).toContain(step.move);
        expect(sideToMove(fen)).toBe(exercise.sideToMove);
        for (const alt of step.alternatives ?? []) {
          expect(legal, `alternativa ${alt}`).toContain(alt);
          expect(alt).not.toBe(step.move);
        }
        expect(new Set(step.alternatives ?? []).size).toBe((step.alternatives ?? []).length);
        // Le alternative sono ammesse solo sull'ultima mossa: prima cambierebbero la variante.
        if (step.alternatives?.length) expect(index).toBe(exercise.solution.length - 1);

        const played = applyUci(fen, step.move);
        expect(played).not.toBeNull();
        fen = played!.fen;
        if (step.reply) {
          expect(allLegalUci(fen), `risposta ${step.reply}`).toContain(step.reply);
          fen = applyUci(fen, step.reply)!.fen;
        } else {
          expect(index, 'solo l’ultima mossa può non avere risposta').toBe(exercise.solution.length - 1);
        }
      });
    });

    it('produce l’esito dichiarato', () => {
      const frames = solutionLine(exercise);
      const last = frames[frames.length - 1]!.move!;
      const anyAlt = exercise.solution[exercise.solution.length - 1]!.alternatives ?? [];
      switch (exercise.expect) {
        case 'checkmate':
          expect(last.isCheckmate).toBe(true);
          expect(anyAlt).toHaveLength(0);
          break;
        case 'check':
          expect(last.isCheck).toBe(true);
          break;
        case 'capture':
          expect(last.isCapture).toBe(true);
          break;
        case 'castle':
          expect(last.isCastle).toBe(true);
          break;
        default:
          // Senza esito dichiarato la mossa finale non deve essere un matto «nascosto».
          expect(last.isCheckmate).toBe(false);
      }
    });

    it('nelle combinazioni di matto ogni risposta avversaria è forzata', () => {
      if (exercise.expect !== 'checkmate' || exercise.conceptId !== 'mate-in-two') return;
      let fen = exercise.fen;
      for (const step of exercise.solution) {
        fen = applyUci(fen, step.move)!.fen;
        if (step.reply) {
          expect(allLegalUci(fen)).toEqual([step.reply]);
          fen = applyUci(fen, step.reply)!.fen;
        }
      }
    });

    it('ha testi, indizi e domanda completi', () => {
      expect(exercise.title.length).toBeGreaterThan(3);
      expect(exercise.goal.length).toBeGreaterThan(20);
      expect(exercise.watchOut.length).toBeGreaterThan(20);
      expect(exercise.explanation.length).toBeGreaterThan(20);
      expect(exercise.hints.length).toBeGreaterThanOrEqual(2);
      for (const hint of exercise.hints) expect(hint.length).toBeGreaterThan(10);

      const { question } = exercise;
      expect(question.prompt.length).toBeGreaterThan(10);
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      const ids = question.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(question.options.map((o) => o.text)).size).toBe(ids.length);
      expect(ids).toContain(question.correctOptionId);
    });

    it('ha un esercizio di trasferimento diverso ma con lo stesso principio', () => {
      expect(exercise.transferExerciseId).toBeDefined();
      const transfer = EXERCISES.find((e) => e.id === exercise.transferExerciseId);
      expect(transfer).toBeDefined();
      expect(transfer!.id).not.toBe(exercise.id);
      expect(transfer!.conceptId).toBe(exercise.conceptId);
      expect(transfer!.fen).not.toBe(exercise.fen);
    });
  });

  describe('verifiche tematiche sulle posizioni', () => {
    const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
    const attackers = (fen: string, square: string, by: 'w' | 'b') =>
      new Chess(fen).attackers(square as never, by);

    it('forchette: dopo la mossa il cavallo dà scacco e attacca un secondo pezzo', () => {
      for (const [id, target] of [['knight-fork-a', 'c6'], ['knight-fork-b', 'a8']] as const) {
        const e = byId(id);
        const first = applyUci(e.fen, e.solution[0]!.move)!;
        expect(first.piece).toBe('n');
        expect(first.isCheck).toBe(true);
        expect(attackers(first.fen, target, 'w')).toContain(first.to);
        // la casa di arrivo non è attaccata: il cavallo non può essere catturato
        expect(attackers(first.fen, first.to, 'b')).toHaveLength(0);
      }
    });

    it('infilate e doppi attacchi iniziano con uno scacco', () => {
      for (const id of ['skewer-a', 'skewer-b', 'double-attack-a', 'double-attack-b', 'discovered-attack-a', 'discovered-attack-b']) {
        const e = byId(id);
        expect(applyUci(e.fen, e.solution[0]!.move)!.isCheck, id).toBe(true);
      }
    });

    it('doppio attacco: il pezzo guadagnato è indifeso', () => {
      const a = byId('double-attack-a');
      expect(attackers(a.fen, 'e4', 'b')).toHaveLength(0);
      const b = byId('double-attack-b');
      expect(attackers(b.fen, 'g5', 'w')).toHaveLength(0);
    });

    it('inchiodatura: la donna inchiodata ha solo mosse lungo la linea', () => {
      const a = byId('pin-a');
      const afterA = applyUci(a.fen, 'f1b5')!.fen;
      const queenMovesA = allLegalUci(afterA).filter((m) => m.startsWith('c6'));
      expect(queenMovesA.sort()).toEqual(['c6b5', 'c6d7']);

      const b = byId('pin-b');
      for (const move of ['f1e1', 'a1e1']) {
        const after = applyUci(b.fen, move)!.fen;
        const queenMoves = allLegalUci(after).filter((m) => m.startsWith('e6'));
        expect(queenMoves.every((m) => m[2] === 'e')).toBe(true);
        expect(attackers(after, 'e1', 'w').length).toBeGreaterThan(0);
      }
    });

    it('contare gli attaccanti: due attaccanti contro un difensore', () => {
      const a = byId('count-exchange-a');
      expect(attackers(a.fen, 'd5', 'w')).toHaveLength(2);
      expect(attackers(a.fen, 'd5', 'b')).toHaveLength(1);
      const b = byId('count-exchange-b');
      expect(attackers(b.fen, 'e4', 'b')).toHaveLength(2);
      expect(attackers(b.fen, 'e4', 'w')).toHaveLength(1);
    });

    it('colonne aperte: nessun pedone sulla colonna occupata dalla torre', () => {
      for (const [id, file] of [['rook-open-file-a', 'd'], ['rook-open-file-b', 'c']] as const) {
        const chess = new Chess(byId(id).fen);
        const pawns = chess.board().flat().filter((p) => p && p.type === 'p' && p.square[0] === file);
        expect(pawns, id).toHaveLength(0);
      }
    });

    it('avamposti: nessun pedone avversario può attaccare la casa', () => {
      const a = applyUci(byId('outpost-a').fen, 'c3d5')!.fen;
      expect(attackers(a, 'd5', 'w')).toContain('e4');
      const blackPawnsNear = new Chess(a).board().flat().filter((p) => p && p.type === 'p' && p.color === 'b' && ['c', 'e'].includes(p.square[0]!) && Number(p.square[1]) > 5);
      expect(blackPawnsNear).toHaveLength(0);

      const b = applyUci(byId('outpost-b').fen, 'c6d4')!.fen;
      expect(attackers(b, 'd4', 'b')).toContain('e5');
      const whitePawnsNear = new Chess(b).board().flat().filter((p) => p && p.type === 'p' && p.color === 'w' && ['c', 'e'].includes(p.square[0]!) && Number(p.square[1]) < 4);
      expect(whitePawnsNear).toHaveLength(0);
    });

    it('difesa di f7: senza parata il matto è reale, con le mosse accettate non c’è', () => {
      const cases = [['defend-f7-a', 'h5f7'], ['defend-f7-b', 'f3f7']] as const;
      for (const [id, mate] of cases) {
        const e = byId(id);
        // una mossa indifferente (…a6) permette il matto
        const careless = applyUci(e.fen, 'a7a6')!.fen;
        expect(applyUci(careless, mate)!.isCheckmate, id).toBe(true);
        const step = e.solution[0]!;
        for (const move of [step.move, ...(step.alternatives ?? [])]) {
          const after = applyUci(e.fen, move)!.fen;
          const threat = applyUci(after, mate);
          expect(threat === null || !threat.isCheckmate, `${id} ${move}`).toBe(true);
        }
      }
    });

    it('pedoni passati: nessun pedone avversario sulla colonna o su quelle adiacenti', () => {
      for (const [id, color] of [['passed-pawn-a', 'b'], ['passed-pawn-b', 'w']] as const) {
        const chess = new Chess(byId(id).fen);
        const blockers = chess.board().flat().filter((p) => p && p.type === 'p' && p.color === color && ['a', 'b'].includes(p.square[0]!));
        expect(blockers, id).toHaveLength(0);
      }
    });
  });
});
