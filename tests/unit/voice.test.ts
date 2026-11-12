import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getVoiceEnabled, setVoiceEnabled, speak, spokenChess } from '../../src/features/voice/speech';

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
});
