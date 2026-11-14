import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../src/features/voice/listen';

describe('comandi a voce del tutor', () => {
  it('riconosce «prossima mossa» e le sue varianti', () => {
    for (const text of ['prossima mossa', 'Prossima mossa!', 'la mossa successiva', 'avanti', 'vai avanti', 'dimmi la prossima mossa']) {
      expect(parseCommand(text), text).toEqual({ kind: 'next' });
    }
  });

  it('«perché» da solo chiede il perché della mossa; una domanda più lunga va a Claude', () => {
    expect(parseCommand('Perché?')).toEqual({ kind: 'why' });
    expect(parseCommand('e perché questa mossa')).toEqual({ kind: 'why' });
    expect(parseCommand('come mai')).toEqual({ kind: 'why' });
    expect(parseCommand('perché il cavallo non va in d4?')).toEqual({ kind: 'question', text: 'perché il cavallo non va in d4?' });
    expect(parseCommand('perché il pedone va avanti')).toEqual({ kind: 'question', text: 'perché il pedone va avanti' });
  });

  it('ripeti, indietro, domande e rumore', () => {
    expect(parseCommand('ripeti')).toEqual({ kind: 'repeat' });
    expect(parseCommand('torna indietro')).toEqual({ kind: 'back' });
    expect(parseCommand('chi ha vinto questa partita')).toEqual({ kind: 'question', text: 'chi ha vinto questa partita' });
    expect(parseCommand('eh')).toBeNull();
    expect(parseCommand('  ')).toBeNull();
  });
});

describe('interruzione, eco e nome', () => {
  it('«basta», «stop», «aspetta» interrompono la voce', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    for (const text of ['basta', 'Stop!', 'aspetta', 'zitto']) expect(parseCommand(text), text).toEqual({ kind: 'stop' });
  });

  it('riconosce l’eco della voce dell’app', async () => {
    const { isEcho } = await import('../../src/features/voice/listen');
    expect(isEcho('la prossima mossa', 'Tra poco la prossima mossa del Nero.')).toBe(true);
    expect(isEcho('prossima mossa', 'Il Bianco muove il cavallo da g1 a f3.')).toBe(false);
  });

  it('capisce il nome detto a voce', async () => {
    const { parseName } = await import('../../src/features/voice/listen');
    expect(parseName('mi chiamo marco')).toBe('Marco');
    expect(parseName('Sono Anna Maria.')).toBe('Anna Maria');
    expect(parseName('luca')).toBe('Luca');
    expect(parseName('chi ha vinto')).toBeNull();
    expect(parseName('prossima mossa')).toBeNull();
    expect(parseName('perché il cavallo va in f3')).toBeNull();
  });
});

describe('vai a una mossa', () => {
  it('capisce numeri, ordinali, colore, inizio e fine', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    expect(parseCommand('vai alla quinta mossa')).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(parseCommand('Torna alla mossa 12 del Nero')).toEqual({ kind: 'goto', move: 12, color: 'b' });
    expect(parseCommand('mossa dieci')).toEqual({ kind: 'goto', move: 10, color: 'w' });
    expect(parseCommand('vai alla mossa numero 3')).toEqual({ kind: 'goto', move: 3, color: 'w' });
    expect(parseCommand('prima mossa')).toEqual({ kind: 'goto', move: 1, color: 'w' });
    expect(parseCommand("vai all'inizio")).toEqual({ kind: 'goto', where: 'start' });
    expect(parseCommand('ricomincia')).toEqual({ kind: 'goto', where: 'start' });
    expect(parseCommand('vai alla fine')).toEqual({ kind: 'goto', where: 'end' });
    // Non sono «vai a»:
    expect(parseCommand('prossima mossa')).toEqual({ kind: 'next' });
    expect(parseCommand('perché la quinta mossa è forte')?.kind).toBe('question');
  });
});

describe('dialogo dinamico', () => {
  it('capisce le varianti naturali dei comandi', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    expect(parseCommand('vai alla 5ª mossa')).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(parseCommand('vai alla 5° mossa')).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(parseCommand('vai alla 5 mossa')).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(parseCommand('vai alla 5')).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(parseCommand('ok vai alla prossima')).toEqual({ kind: 'next' });
    expect(parseCommand('dai, prossima mossa per favore')).toEqual({ kind: 'next' });
    expect(parseCommand('zitta per favore')).toEqual({ kind: 'stop' });
    expect(parseCommand('stai zitta')).toEqual({ kind: 'stop' });
  });

  it('trova il comando alla fine di ciò che sente mentre il tutor parla', async () => {
    const { commandAtEnd, isEcho } = await import('../../src/features/voice/listen');
    expect(commandAtEnd('il cavallo sviluppa verso il centro zitta')?.command).toEqual({ kind: 'stop' });
    expect(commandAtEnd('la lezione è chi controlla il centro vai alla prossima')?.command).toEqual({ kind: 'next' });
    expect(commandAtEnd('arrocca presto vai alla quinta mossa')?.command).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(commandAtEnd('il cavallo sviluppa verso il centro')).toBeNull();
    // L'eco della voce del tutor non conta.
    const spoken = 'Siamo alla mossa 5 del Bianco. Il Bianco cattura in f3.';
    const echo = commandAtEnd('siamo alla mossa 5 del bianco')!;
    expect(isEcho(echo.phrase, spoken)).toBe(true);
  });
});

describe('eco con l’audio alto', () => {
  it('riconosce l’eco anche trascritta male, ma non i comandi veri', async () => {
    const { isEcho, commandAtEnd } = await import('../../src/features/voice/listen');
    const spoken = 'Bene, 1.e4. Perché: occupa il centro. Tra poco la mossa successiva.';
    expect(isEcho('la mossa successiva', spoken)).toBe(true);
    expect(isEcho('mossa successiva', spoken)).toBe(true);
    expect(isEcho('zitta', spoken)).toBe(false);
    expect(isEcho('vai alla quinta mossa', spoken)).toBe(false);
    // «perché» detto dal tutor non è mai un'interruzione.
    expect(commandAtEnd('occupa il centro perché')).toBeNull();
    expect(commandAtEnd('pronto')).toBeNull();
  });
});

describe('salta', () => {
  it('«salta», «salta la mossa», «passa» vanno alla mossa successiva', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    for (const text of ['salta', 'Salta la mossa', 'salta questa mossa', 'passa']) expect(parseCommand(text), text).toEqual({ kind: 'next' });
  });
});
