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
/** Testo che l'app sta pronunciando (per riconoscere, nel microfono, l'eco della sua voce). */
let currentText = '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function italianVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.replace('_', '-') === 'it-IT' && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('it'))
  );
}

/**
 * Voce da usare: quella italiana; se il dispositivo non ne ha, quella predefinita.
 * Chiedere «it-IT» senza una voce italiana installata, su alcuni telefoni, non produce alcun suono.
 */
function chooseVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return italianVoice() ?? voices.find((v) => v.default) ?? voices[0];
}

/** Ultimo errore segnalato dalla sintesi vocale (per la diagnosi nelle impostazioni). */
let lastError: string | null = null;

/**
 * Frasi in coda tenute in memoria finché non finiscono: in Chrome, se il garbage
 * collector le elimina, la lettura si interrompe e la fine non viene mai segnalata.
 */
const alive = new Set<SpeechSynthesisUtterance>();

/** Cresce a ogni interruzione: le frasi di una lettura interrotta non avvisano più `onEnd`. */
let speechGeneration = 0;

/** Ultima frase in coda: solo la sua fine chiude il «sta parlando». */
let lastUtterance: SpeechSynthesisUtterance | null = null;

export interface SpeakOptions {
  /** Moltiplica la velocità scelta dall'utente (es. 0,9 = un po' più lenta e scandita). */
  rate?: number;
  /** Tono della voce (0–2, 1 = normale). */
  pitch?: number;
  /** false = non avvisa `onSpoken` (chi parla registra lui il testo completo). */
  log?: boolean;
  /** Chiamata quando questa frase finisce di essere letta (non se viene interrotta). */
  onEnd?: () => void;
}

let defaultOptions: SpeakOptions = {};

/** Velocità e tono predefiniti per chi non li passa (es. la voce del «Maestro»). */
export function setSpeakDefaults(options: SpeakOptions): void {
  defaultOptions = options;
}

/**
 * Spezza un testo lungo in frasi da leggere una dopo l'altra. Alcuni browser
 * (Chrome con le voci di Google, per esempio) smettono di parlare dopo circa
 * 15 secondi di una sola lettura: a frasi la voce arriva fino in fondo.
 */
export function speechChunks(text: string, min = 40): string[] {
  const parts = text.split(/(?<=[.!?…;:])\s+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.length < min) out[out.length - 1] = `${prev} ${part}`;
    else out.push(part);
  }
  return out;
}

/** true se il browser ha rifiutato di parlare senza un tocco dell'utente (iPhone, Safari, Chrome). */
let blocked = false;

function setBlocked(value: boolean): void {
  if (blocked === value) return;
  blocked = value;
  notify();
}

function utter(text: string, id: string, options: SpeakOptions, last: boolean): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(spokenChess(text));
  const voice = chooseVoice();
  utterance.lang = voice && !voice.lang.toLowerCase().startsWith('it') ? voice.lang : 'it-IT';
  if (voice) utterance.voice = voice;
  alive.add(utterance);
  const opts = { ...defaultOptions, ...options };
  utterance.rate = Math.max(0.5, Math.min(2, getVoiceRate() * (opts.rate ?? 1)));
  utterance.pitch = opts.pitch ?? 1;
  utterance.volume = getVoiceVolume();
  // Solo l'ultima frase in coda chiude il «sta parlando»: quella interrotta da cancel()
  // segnala la sua fine più tardi e non deve far credere che la nuova sia finita.
  const done = () => {
    alive.delete(utterance);
    if (lastUtterance !== utterance) return;
    lastUtterance = null;
    currentText = '';
    if (speakingId === id) {
      speakingId = null;
      notify();
    }
  };
  const generation = speechGeneration;
  utterance.onstart = () => {
    lastError = null;
    setBlocked(false);
  };
  utterance.onend = () => {
    // Una frase interrotta (nuova lettura o «Ferma») non conta come finita.
    if (last && generation === speechGeneration) options.onEnd?.();
    done();
  };
  utterance.onerror = (event?: { error?: string }) => {
    if (event?.error && event.error !== 'interrupted' && event.error !== 'canceled') {
      lastError = event.error;
      notify();
    }
    if (event?.error === 'not-allowed') setBlocked(true);
    // Senza il resto della lettura, chi aspetta la fine (es. l'animazione) non resta bloccato.
    if (last && generation === speechGeneration && event?.error !== 'interrupted' && event?.error !== 'canceled') options.onEnd?.();
    done();
  };
  return utterance;
}

/** Accoda il testo frase per frase; `onEnd` arriva alla fine dell'ultima. */
function enqueue(text: string, id: string, options: SpeakOptions): void {
  const synth = window.speechSynthesis;
  const chunks = speechChunks(text);
  chunks.forEach((chunk, i) => {
    const utterance = utter(chunk, id, options, i === chunks.length - 1);
    lastUtterance = utterance;
    currentText = `${currentText} ${utterance.text}`.trim();
    synth.speak(utterance);
  });
  // Chrome a volte resta «in pausa» dopo un cancel(): la lettura non partirebbe mai.
  synth.resume?.();
  if (options.log !== false) spokenListeners.forEach((l) => l(text, id));
}

/** Legge il testo; `id` identifica chi parla (per mostrare «Ferma» sul pulsante giusto). */
export function speak(text: string, id = 'default', options: SpeakOptions = {}): void {
  if (!speechSupported() || !getVoiceEnabled() || !text.trim()) return;
  const synth = window.speechSynthesis;
  const busy = synth.speaking || synth.pending;
  synth.cancel();
  speechGeneration++;
  const generation = speechGeneration;
  currentText = '';
  lastUtterance = null;
  speakingId = id;
  notify();
  if (!busy) {
    deferred = null;
    return enqueue(text, id, options);
  }
  // Chrome ignora in silenzio una lettura avviata subito dopo cancel(): si aspetta un istante.
  const waiting: Deferred[] = [{ text, options }];
  deferred = waiting;
  window.setTimeout(() => {
    if (deferred === waiting) deferred = null;
    if (generation !== speechGeneration || speakingId !== id) return;
    for (const item of waiting) enqueue(item.text, id, item.options);
  }, 80);
}

interface Deferred {
  text: string;
  options: SpeakOptions;
}
/** Letture in attesa dopo un cancel(): `speakNext` le accoda qui invece di ricominciare. */
let deferred: Deferred[] | null = null;

/**
 * Accoda una frase senza interrompere quella in corso (per leggere una risposta
 * mentre arriva, frase dopo frase). Se a parlare è un altro `id`, lo interrompe.
 */
export function speakNext(text: string, id = 'default', options: SpeakOptions = {}): void {
  if (!speechSupported() || !getVoiceEnabled() || !text.trim()) return;
  if (speakingId === id && deferred) {
    deferred.push({ text, options });
    return;
  }
  if (speakingId !== id || !lastUtterance) return speak(text, id, options);
  enqueue(text, id, options);
}

export interface SpeechStatus {
  /** Voci installate sul dispositivo (0 = la sintesi vocale non può parlare). */
  voices: number;
  /** Nome della voce italiana usata, o null se manca. */
  italian: string | null;
  /** Ultimo errore della sintesi vocale, o null. */
  error: string | null;
}

let statusCache: SpeechStatus = { voices: 0, italian: null, error: null };

function readStatus(): SpeechStatus {
  if (!speechSupported()) return statusCache;
  const voices = window.speechSynthesis.getVoices().length;
  const italian = italianVoice()?.name ?? null;
  if (voices !== statusCache.voices || italian !== statusCache.italian || lastError !== statusCache.error) {
    statusCache = { voices, italian, error: lastError };
  }
  return statusCache;
}

/** Stato della voce sul dispositivo, per capire perché non si sente nulla. */
export function useSpeechStatus(): SpeechStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      // Le voci arrivano in ritardo (Chrome le carica dopo l'apertura della pagina).
      const synth = speechSupported() ? window.speechSynthesis : null;
      synth?.addEventListener?.('voiceschanged', l);
      return () => {
        listeners.delete(l);
        synth?.removeEventListener?.('voiceschanged', l);
      };
    },
    readStatus,
    () => statusCache,
  );
}

/** Il browser ha bloccato la lettura automatica: serve un tocco (es. su «Ascolta»). */
export function useSpeechBlocked(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => blocked,
    () => false,
  );
}

/**
 * Al primo tocco o tasto sblocca la voce: iPhone e Safari permettono di parlare
 * da soli (letture automatiche) solo dopo una prima lettura avviata da un gesto.
 */
function installUnlock(): void {
  if (typeof window === 'undefined' || !speechSupported()) return;
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    const synth = window.speechSynthesis;
    synth.resume?.();
    if (!synth.speaking && !synth.pending) {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      synth.speak(silent);
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}
installUnlock();

/**
 * Divide in frasi un testo che arriva a pezzi: `push` riceve il testo arrivato
 * finora e restituisce le frasi complete non ancora consegnate; `flush` il resto.
 */
export class SentenceSplitter {
  private sent = 0;

  push(soFar: string): string[] {
    const out: string[] = [];
    const re = /[.!?…:;]+["»”)]?\s+/g;
    re.lastIndex = this.sent;
    let match: RegExpExecArray | null;
    while ((match = re.exec(soFar))) {
      const end = match.index + match[0].length;
      const sentence = soFar.slice(this.sent, end).trim();
      // Non spezza dopo un numero di mossa («12.») o frasi troppo corte.
      if (/\d\.\s*$/.test(soFar.slice(this.sent, match.index + 1)) || sentence.length < 12) continue;
      out.push(sentence);
      this.sent = end;
    }
    return out;
  }

  flush(full: string): string {
    const rest = full.slice(this.sent).trim();
    this.sent = full.length;
    return rest;
  }
}

const spokenListeners = new Set<(text: string, id: string) => void>();

/** Avvisa ogni volta che l'app pronuncia una frase (per lo storico della lezione). */
export function onSpoken(listener: (text: string, id: string) => void): () => void {
  spokenListeners.add(listener);
  return () => spokenListeners.delete(listener);
}

/** Il testo che l'app sta pronunciando adesso ('' se tace). */
export function currentSpeechText(): string {
  return currentText;
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  lastUtterance = null;
  currentText = '';
  deferred = null;
  speechGeneration++;
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
const VOLUME_KEY = 'cm.voice.volume';
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

/** Volume della voce (0,2–1). Più basso = il microfono sente meno l'eco dell'altoparlante. */
export function getVoiceVolume(): number {
  const n = Number(read(VOLUME_KEY));
  return read(VOLUME_KEY) !== null && n >= 0.2 && n <= 1 ? n : 1;
}

export function setVoiceVolume(volume: number): void {
  write(VOLUME_KEY, String(Math.max(0.2, Math.min(1, volume))));
}

export function useVoiceVolume(): number {
  return useSyncExternalStore(subscribePrefs, getVoiceVolume, () => 1);
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
