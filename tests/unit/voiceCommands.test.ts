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
