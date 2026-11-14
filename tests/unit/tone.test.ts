import { describe, expect, it } from 'vitest';
import { NamePacer, phrases, TONE_PROMPTS, TONES } from '../../src/features/tutor/tone';
import { explanationKey } from '../../src/features/tutor/explanationCache';

describe('tono di parlata', () => {
  it('il tono normale dice le stesse frasi di prima', () => {
    const p = phrases('normal');
    expect(p.wellDone('2.Cf3', '', 0)).toBe('Bene, 2.Cf3.');
    expect(p.wellDone('2.Cf3', 'Marco', 0)).toBe('Bravo Marco! 2.Cf3.');
    expect(p.aligned('Marco')).toBe('Perfetto Marco, la scacchiera è allineata.');
    expect(p.finished('Vince il Bianco', '')).toBe('Partita finita: Vince il Bianco.');
  });

  it('ogni tono ha le sue frasi, con o senza nome, senza segnaposto rimasti', () => {
    for (const tone of TONES) {
      const p = phrases(tone);
      for (const name of ['Marco', '']) {
        const lines = [p.hello(name), p.nice(name), p.call(name, 1), p.wellDone('1.e4', name, 2), p.reminder(name), p.wrong('gioca e4', name), p.finished('Patta', name), p.whyTo(name), p.aligned(name)];
        for (const line of lines) {
          expect(line, `${tone}: ${line}`).not.toMatch(/\{[nmr]\}/);
          expect(line, `${tone}: ${line}`).not.toMatch(/^[ ,]/);
        }
        if (name) expect(lines.filter((l) => l.includes('Marco')).length, tone).toBeGreaterThanOrEqual(6);
      }
    }
    expect(phrases('formal').wellDone('1.e4', 'Marco', 0)).toBe('Ottima mossa, Marco. 1.e4.');
    expect(phrases('offensive').call('Marco', 0)).toContain('schiappa');
  });

  it('le istruzioni per Claude e la cache dipendono dal tono', () => {
    expect(TONE_PROMPTS.formal).toContain('Lei');
    expect(TONE_PROMPTS.offensive).toContain('mai insulti su aspetto');
    expect(explanationKey('opera', 3)).toBe(explanationKey('opera', 3, 'normal'));
    expect(explanationKey('opera', 3, 'arrogant')).not.toBe(explanationKey('opera', 3));
  });

  it('il nome si dice al momento giusto, non in ogni frase', () => {
    const pacer = new NamePacer();
    expect(pacer.use('', 'greet')).toBe('');
    // Saluto: sempre. Subito dopo, le frasi di routine non ripetono il nome.
    expect(pacer.use('Marco', 'greet')).toBe('Marco');
    const routine = Array.from({ length: 6 }, () => pacer.use('Marco', 'routine'));
    expect(routine.every((n) => n === '')).toBe(true);
    // Dopo un po' di frasi senza nome, torna.
    expect(pacer.use('Marco', 'routine')).toBe('Marco');
    // Un errore richiama per nome, ma non se il nome è appena stato detto.
    expect(pacer.use('Marco', 'attention')).toBe('');
    expect(pacer.use('Marco', 'routine')).toBe('');
    expect(pacer.use('Marco', 'attention')).toBe('Marco');
    // Su venti mosse (indicazione + lode) il nome compare poche volte.
    const fresh = new NamePacer();
    const said = Array.from({ length: 40 }, () => fresh.use('Marco', 'routine')).filter(Boolean).length;
    expect(said).toBeGreaterThanOrEqual(4);
    expect(said).toBeLessThanOrEqual(7);
    fresh.reset();
    expect(fresh.use('Marco', 'routine')).toBe('Marco');
  });

  it('senza nome i toni non normali mantengono il loro richiamo', () => {
    expect(phrases('normal').call('', 0)).toBe('');
    expect(phrases('offensive').call('', 0)).toContain('schiappa');
    expect(phrases('rude').call('', 0)).toBe('Muoviti: ');
  });
});
