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
  it('«stop», «aspetta», «zitto» interrompono la voce', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    for (const text of ['Stop!', 'aspetta', 'zitto']) expect(parseCommand(text), text).toEqual({ kind: 'stop' });
  });

  it('«basta», «non voglio giocare» e simili chiudono la lezione e spengono il microfono', async () => {
    const { parseCommand, commandAtEnd } = await import('../../src/features/voice/listen');
    for (const text of [
      'basta',
      'Basta!',
      'basta così',
      'ok basta',
      'basta basta',
      'basta per oggi',
      'non voglio giocare',
      'non voglio più giocare',
      'Non ho voglia di giocare',
      'non mi va di continuare',
      'non voglio più',
      'smettiamo',
      'ho finito',
      'finiamo qui',
      'spegni il microfono',
      'fine lezione',
      'lasciamo perdere',
      'arrivederci',
    ]) {
      expect(parseCommand(text), text).toEqual({ kind: 'quit' });
    }
    // Detto sopra la voce del tutor funziona lo stesso.
    expect(commandAtEnd('il cavallo va in f3 basta')?.command).toEqual({ kind: 'quit' });
    // «Basta» seguito da una richiesta resta un'interruzione con quella richiesta.
    expect(parseCommand('basta, prossima mossa')).toEqual({ kind: 'next' });
    expect(parseCommand('perché non voglio giocare la torre?')?.kind).toBe('question');
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

describe('interrompere il tutor', () => {
  it('capisce tanti modi di dire «smetti di parlare»', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    for (const text of [
      'stop stop',
      'aspetta un attimo',
      'aspetta aspetta',
      'un momento per favore',
      'fermati un attimo',
      'fermo',
      'silenzio',
      'smettila',
      'smetti di parlare',
      'interrompi',
      'pausa',
      'scusa',
      'scusami',
      'ehi tutor stai zitto',
      'fammi parlare',
      'posso parlare?',
      'ho una domanda',
      'shh',
    ]) {
      expect(parseCommand(text), text).toEqual({ kind: 'stop' });
    }
  });

  it('dopo l’interruzione conta la richiesta che segue', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    expect(parseCommand('aspetta, vai alla quinta mossa')).toEqual({ kind: 'goto', move: 5, color: 'w' });
    expect(parseCommand('scusa, perché?')).toEqual({ kind: 'why' });
    expect(parseCommand('basta, prossima mossa')).toEqual({ kind: 'next' });
    expect(parseCommand('scusa, che apertura è questa?')).toEqual({ kind: 'question', text: 'scusa, che apertura è questa?' });
    expect(parseCommand('stop eh')).toEqual({ kind: 'stop' });
    // Parole che solo somigliano a un'interruzione non lo sono.
    expect(parseCommand('perché il pedone si ferma in e5')?.kind).toBe('question');
    expect(parseCommand('altro')).toBeNull();
  });

  it('«continua» riprende la lezione', async () => {
    const { parseCommand } = await import('../../src/features/voice/listen');
    for (const text of ['continua', 'ok continua', 'riprendi', 'vai pure', 'prosegui per favore']) expect(parseCommand(text), text).toEqual({ kind: 'resume' });
  });

  it('trova l’interruzione all’inizio di una frase detta sopra la voce del tutor', async () => {
    const { interruptAtStart, commandAtEnd } = await import('../../src/features/voice/listen');
    expect(interruptAtStart('scusa che apertura è questa')).toEqual({
      command: { kind: 'question', text: 'scusa che apertura è questa' },
      phrase: 'scusa',
    });
    expect(interruptAtStart('aspetta un attimo')?.phrase).toBe('aspetta un attimo');
    expect(interruptAtStart('il cavallo va in f3')).toBeNull();
    expect(commandAtEnd('il cavallo sviluppa verso il centro aspetta un attimo')?.command).toEqual({ kind: 'stop' });
    expect(commandAtEnd('il cavallo sviluppa verso il centro scusa')?.command).toEqual({ kind: 'stop' });
  });
});
