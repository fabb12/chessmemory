import { useSyncExternalStore } from 'react';

/**
 * Lettura ad alta voce con la sintesi vocale del browser (Web Speech API).
 * Nessun servizio esterno: la voce italiana è quella del sistema operativo.
 */

const PIECES: Record<string, string> = { R: 're', D: 'donna', T: 'torre', A: 'alfiere', C: 'cavallo' };

// Mossa in notazione italiana, con numero facoltativo: «12.Cxe5+», «3…Ab4», «exd5», «e8=D#».
const SAN_RE =
  /(?<![\p{L}\d])(?:(\d+)(\.|…|\.\.\.)\s?)?(?:(O-O-O|O-O)|([RDTAC])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([DTAC]))?)([+#])?[!?]{0,2}(?![\p{L}\d])/gu;

/**
 * Rende pronunciabile un testo con mosse in notazione: «1.Cf3» → «mossa 1, cavallo f3».
 * Le case isolate («e4») restano come sono: la voce le legge già bene.
 */
export function spokenChess(text: string): string {
  return text
    .replace(SAN_RE, (match, num, sep, castle, piece, file, rank, capture, square, promo, check) => {
      const isMove = Boolean(num || castle || piece || capture || promo || check);
      if (!isMove) return match;
      const parts: string[] = [];
      if (num) parts.push(sep === '.' ? `mossa ${num},` : `mossa ${num} del Nero,`);
      if (castle) parts.push(castle === 'O-O-O' ? 'arrocco lungo' : 'arrocco corto');
      else {
        parts.push([piece ? PIECES[piece] : '', file ?? '', rank ?? ''].filter(Boolean).join(' '));
        if (capture) parts.push('prende');
        parts.push(square);
        if (promo) parts.push(`e promuove a ${PIECES[promo]}`);
      }
      if (check === '+') parts.push(', scacco');
      if (check === '#') parts.push(', scacco matto');
      return parts.filter(Boolean).join(' ').replace(/ ,/g, ',');
    })
    .replace(/…/g, ' ')
    .replace(/[«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

let speakingId: string | null = null;
/** Frase in corso (per riconoscere, nel microfono, l'eco della voce dell'app). */
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentText = '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function italianVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'it-IT' && v.localService) ?? voices.find((v) => v.lang.toLowerCase().startsWith('it'));
}

/** Legge il testo; `id` identifica chi parla (per mostrare «Ferma» sul pulsante giusto). */
export function speak(text: string, id = 'default'): void {
  if (!speechSupported() || !getVoiceEnabled() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenChess(text));
  utterance.lang = 'it-IT';
  const voice = italianVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = getVoiceRate();
  // Solo la frase in corso chiude il «sta parlando»: quella interrotta da cancel()
  // segnala la sua fine più tardi e non deve far credere che la nuova sia finita.
  const done = () => {
    if (currentUtterance !== utterance) return;
    currentUtterance = null;
    currentText = '';
    if (speakingId === id) {
      speakingId = null;
      notify();
    }
  };
  utterance.onend = done;
  utterance.onerror = done;
  currentUtterance = utterance;
  currentText = utterance.text;
  speakingId = id;
  notify();
  synth.speak(utterance);
}

/** Il testo che l'app sta pronunciando adesso ('' se tace). */
export function currentSpeechText(): string {
  return currentText;
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  currentUtterance = null;
  currentText = '';
  window.speechSynthesis.cancel();
  speakingId = null;
  notify();
}

export function currentSpeakingId(): string | null {
  return speakingId;
}

/** Chi sta parlando adesso (id passato a `speak`), oppure null. */
export function useSpeakingId(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => speakingId,
    () => null,
  );
}

// ───── Preferenze (solo su questo dispositivo: la voce dipende dal dispositivo) ─────

const ENABLED_KEY = 'cm.voice.enabled';
const AUTO_KEY = 'cm.voice.auto';
const RATE_KEY = 'cm.voice.rate';
const prefListeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // archivio non disponibile (navigazione privata): resta il valore predefinito
  }
  prefListeners.forEach((l) => l());
}

/** Interruttore generale della voce: attivo per impostazione predefinita. Da spento nulla viene letto. */
export function getVoiceEnabled(): boolean {
  return read(ENABLED_KEY) !== 'off';
}

export function setVoiceEnabled(on: boolean): void {
  write(ENABLED_KEY, on ? 'on' : 'off');
  if (!on) stopSpeaking();
}

/** Lettura automatica delle spiegazioni: attiva per impostazione predefinita. */
export function getVoiceAuto(): boolean {
  return read(AUTO_KEY) !== 'off';
}

export function setVoiceAuto(on: boolean): void {
  write(AUTO_KEY, on ? 'on' : 'off');
  if (!on) stopSpeaking();
}

export function getVoiceRate(): number {
  const n = Number(read(RATE_KEY));
  return n >= 0.6 && n <= 1.4 ? n : 1;
}

export function setVoiceRate(rate: number): void {
  write(RATE_KEY, String(rate));
}

function subscribePrefs(l: () => void) {
  prefListeners.add(l);
  return () => prefListeners.delete(l);
}

export function useVoiceEnabled(): boolean {
  return useSyncExternalStore(subscribePrefs, getVoiceEnabled, () => true);
}

export function useVoiceAuto(): boolean {
  return useSyncExternalStore(subscribePrefs, getVoiceAuto, () => true);
}

export function useVoiceRate(): number {
  return useSyncExternalStore(subscribePrefs, getVoiceRate, () => 1);
}
