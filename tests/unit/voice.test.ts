import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getVoiceEnabled, setVoiceEnabled, speak, speakNext, speechChunks, spokenChess, stopSpeaking } from '../../src/features/voice/speech';

describe('lettura ad alta voce delle mosse', () => {
  it('legge pezzi, catture, scacchi e numeri di mossa', () => {
    expect(spokenChess('1.Cf3')).toBe('mossa 1, cavallo f3');
    expect(spokenChess('16.Db8+!! Cxb8 17.Td8#')).toBe(
      'mossa 16, donna b8, scacco cavallo prende b8 mossa 17, torre d8, scacco matto',
    );
    expect(spokenChess('3…Ab4')).toBe('mossa 3 del Nero, alfiere b4');
    expect(spokenChess('exd5 e poi e8=D')).toBe('e prende d5 e poi e8 e promuove a donna');
    expect(spokenChess('12.O-O-O')).toBe('mossa 12, arrocco lungo');
    expect(spokenChess('1.Tad1 (o 1.Tfd1)')).toBe('mossa 1, torre a d1 (o mossa 1, torre f d1)');
  });

  it('lascia invariato il testo normale e le case isolate', () => {
    expect(spokenChess('Il pedone in «e4» controlla d5.')).toBe('Il pedone in e4 controlla d5.');
    expect(spokenChess('Re e donna')).toBe('Re e donna');
  });
});

describe('letture lunghe divise in frasi', () => {
  it('spezza alle fine frase e unisce i pezzi troppo corti', () => {
    const text = 'Questo è il famoso sacrificio greco. L’alfiere si dà in h7 con scacco e strappa al re il pedone. Ok! Poi il cavallo salta in g5: il re resta solo.';
    const chunks = speechChunks(text);
    expect(chunks.join(' ')).toBe(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks.slice(0, -1)) expect(c.length).toBeGreaterThanOrEqual(40);
  });

  it('non spezza le mosse in notazione', () => {
    expect(speechChunks('1.Axh7+ Rxh7 2.Cg5+ e il Nero è in difficoltà.')).toEqual(['1.Axh7+ Rxh7 2.Cg5+ e il Nero è in difficoltà.']);
  });
});

describe('voce attivabile e disattivabile', () => {
  const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] };

  beforeEach(() => {
    localStorage.clear();
    synth.speak.mockClear();
    synth.cancel.mockClear();
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('è attiva per impostazione predefinita e legge il testo', () => {
    expect(getVoiceEnabled()).toBe(true);
    speak('Il cavallo va in f3.');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('da spenta non legge nulla e ferma la lettura in corso', () => {
    setVoiceEnabled(false);
    expect(getVoiceEnabled()).toBe(false);
    expect(synth.cancel).toHaveBeenCalled();
    speak('Il cavallo va in f3.');
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('si può riaccendere e la scelta resta salvata', () => {
    setVoiceEnabled(false);
    setVoiceEnabled(true);
    expect(getVoiceEnabled()).toBe(true);
    expect(localStorage.getItem('cm.voice.enabled')).toBe('on');
    speak('Ciao.');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('avvisa quando l’introduzione è stata letta tutta, non se viene interrotta', () => {
    const onEnd = vi.fn();
    type Utt = { onend?: () => void };
    speak('Questa è la prima frase, abbastanza lunga da stare da sola. E questa è la seconda frase.', 'lesson', { onEnd });
    expect(synth.speak).toHaveBeenCalledTimes(2);
    speakNext('Adesso guarda la scacchiera.', 'lesson');
    const [first, last] = synth.speak.mock.calls.map((c) => c[0] as Utt);
    first!.onend?.();
    expect(onEnd).not.toHaveBeenCalled();
    last!.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);

    const stopped = vi.fn();
    speak('Un’altra introduzione.', 'lesson', { onEnd: stopped });
    const second = synth.speak.mock.calls[synth.speak.mock.calls.length - 1]![0] as Utt;
    stopSpeaking();
    second.onend?.();
    expect(stopped).not.toHaveBeenCalled();
  });
});

describe('lettura a frasi di una risposta che arriva a pezzi', () => {
  it('consegna ogni frase completa una sola volta, senza spezzare i numeri di mossa', async () => {
    const { SentenceSplitter } = await import('../../src/features/voice/speech');
    const s = new SentenceSplitter();
    expect(s.push('Il cavallo va in')).toEqual([]);
    expect(s.push('Il cavallo va in f3 e controlla il centro. Dopo 12.')).toEqual(['Il cavallo va in f3 e controlla il centro.']);
    expect(s.push('Il cavallo va in f3 e controlla il centro. Dopo 12. Cxe5 il Nero perde un pedone! Poi')).toEqual(['Dopo 12. Cxe5 il Nero perde un pedone!']);
    expect(s.flush('Il cavallo va in f3 e controlla il centro. Dopo 12. Cxe5 il Nero perde un pedone! Poi arrocca.')).toBe('Poi arrocca.');
  });
});
