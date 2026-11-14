/**
 * Ascolto con il microfono (Web Speech API, riconoscimento in italiano).
 *
 * Il riconoscimento resta attivo finché non si chiama `stop()`: il browser lo
 * chiude da solo dopo qualche secondo di silenzio, e qui viene riavviato.
 * Mentre l'app parla (sintesi vocale) ciò che si sente viene ignorato,
 * altrimenti il tutor ascolterebbe sé stesso.
 */

export type VoiceCommand = { kind: 'next' } | { kind: 'why' } | { kind: 'repeat' } | { kind: 'back' } | { kind: 'question'; text: string };

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Interpreta una frase ascoltata. null = rumore o frase troppo corta per essere una domanda. */
export function parseCommand(heard: string): VoiceCommand | null {
  const text = normalize(heard);
  if (!text) return null;
  const words = text.split(' ').length;
  if ((/\b(prossima|successiva|seguente)\b/.test(text) && !/^perche\b/.test(text) && words <= 5) || /^(vai )?avanti\b/.test(text)) return { kind: 'next' };
  if (/^(e )?(perche|come mai)( (questa|questa mossa|la mossa))?$/.test(text)) return { kind: 'why' };
  if (/^(ripeti|ripetere|puoi ripetere|cosa hai detto)\b/.test(text) && words <= 4) return { kind: 'repeat' };
  if (/^(indietro|torna indietro|mossa precedente)$/.test(text)) return { kind: 'back' };
  // Una domanda vera: almeno due parole (una parola isolata è quasi sempre rumore).
  if (words >= 2) return { kind: 'question', text: heard.trim() };
  return null;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function listeningSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenerOptions {
  onHeard: (text: string) => void;
  /** true mentre l'app sta parlando: quello che si sente viene scartato. */
  muted: () => boolean;
  onError?: (error: string) => void;
}

export class VoiceListener {
  private recognition: RecognitionLike | null = null;
  private active = false;

  constructor(private readonly options: ListenerOptions) {}

  start(): boolean {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    this.active = true;
    const rec = new Ctor();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (!result.isFinal) continue;
        const text = result[0]?.transcript ?? '';
        if (text.trim() && !this.options.muted()) this.options.onHeard(text);
      }
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.active = false;
        this.options.onError?.(event.error);
      }
    };
    rec.onend = () => {
      // Il browser chiude l'ascolto dopo un silenzio: si riparte finché è attivo.
      if (this.active) {
        try {
          rec.start();
        } catch {
          // già avviato
        }
      }
    };
    this.recognition = rec;
    try {
      rec.start();
    } catch {
      return false;
    }
    return true;
  }

  stop(): void {
    this.active = false;
    this.recognition?.abort();
    this.recognition = null;
  }
}
