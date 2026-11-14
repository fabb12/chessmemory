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
