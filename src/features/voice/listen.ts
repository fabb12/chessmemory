/**
 * Ascolto con il microfono (Web Speech API, riconoscimento in italiano).
 *
 * Il riconoscimento resta attivo finché non si chiama `stop()`: il browser lo
 * chiude da solo dopo qualche secondo di silenzio, e qui viene riavviato.
 * Mentre l'app parla (sintesi vocale) ciò che si sente viene ignorato,
 * altrimenti il tutor ascolterebbe sé stesso.
 */

export type VoiceCommand =
  | { kind: 'next' }
  | { kind: 'why' }
  | { kind: 'repeat' }
  | { kind: 'back' }
  | { kind: 'stop' }
  /** «Pronto»: i pezzi sulla scacchiera vera sono stati sistemati. */
  | { kind: 'ready' }
  /** Vai a una mossa: numero della mossa (1 = prima) e colore, oppure inizio/fine della partita. */
  | { kind: 'goto'; move: number; color: 'w' | 'b' }
  | { kind: 'goto'; where: 'start' | 'end' }
  | { kind: 'question'; text: string };

const ORDINALS = [
  'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima',
  'undicesima', 'dodicesima', 'tredicesima', 'quattordicesima', 'quindicesima', 'sedicesima',
  'diciassettesima', 'diciottesima', 'diciannovesima', 'ventesima',
];
const NUMBERS = [
  'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci',
  'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti',
];

/** «quinta», «5», «cinque», «trentesima» (oltre la ventesima solo in cifre) → 5. */
function numberWord(word: string): number | null {
  if (/^\d{1,3}$/.test(word)) return Number(word);
  const ord = ORDINALS.indexOf(word);
  if (ord >= 0) return ord + 1;
  const num = NUMBERS.indexOf(word);
  if (num >= 0) return num + 1;
  if (word === 'un' || word === 'una') return 1;
  return null;
}

/** «vai alla quinta mossa», «torna alla mossa 12 del nero», «mossa dieci», «vai all'inizio», «vai alla fine». */
function parseGoto(text: string): VoiceCommand | null {
  if (/^(vai |torna |ricomincia |riparti )?(all |dall )?(inizio|da capo|dall inizio)$|^ricomincia$|^riparti$/.test(text)) return { kind: 'goto', where: 'start' };
  if (/^(vai |salta )?(alla |all )?(fine|ultima mossa)( della partita)?$/.test(text)) return { kind: 'goto', where: 'end' };
  const m = /^(?:(?:vai|torna|andiamo|salta|portami|passa)\s+)?(?:a\s+|alla\s+|al\s+)?(?:(\S+)\s+mossa|mossa\s+(?:numero\s+)?(\S+))(?:\s+del\s+(bianco|nero))?$/.exec(text);
  if (!m) return null;
  const n = numberWord(m[1] ?? m[2] ?? '');
  if (!n || n < 1) return null;
  return { kind: 'goto', move: n, color: m[3] === 'nero' ? 'b' : 'w' };
}

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
  const goto = parseGoto(text);
  if (goto) return goto;
  if ((/\b(prossima|successiva|seguente)\b/.test(text) && !/^perche\b/.test(text) && words <= 5) || /^(vai )?avanti\b/.test(text)) return { kind: 'next' };
  if (/^(e )?(perche|come mai)( (questa|questa mossa|la mossa))?$/.test(text)) return { kind: 'why' };
  if (/^(ripeti|ripetere|puoi ripetere|cosa hai detto)\b/.test(text) && words <= 4) return { kind: 'repeat' };
  if (/^(indietro|torna indietro|mossa precedente)$/.test(text)) return { kind: 'back' };
  if (/^(pronto|pronta|fatto|ho fatto|sistemato|sistemata|ho sistemato|pezzi sistemati)$/.test(text)) return { kind: 'ready' };
  if (/^(basta|stop|zitto|zitta|silenzio|fermati|ferma|aspetta|un attimo)\b/.test(text) && words <= 3) return { kind: 'stop' };
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
  /** Errore definitivo (permesso negato prima ancora di cominciare). */
  onError?: (error: string) => void;
}

/** Ogni quanto si controlla che l'ascolto sia ancora attivo (il browser a volte lo chiude senza dirlo). */
const WATCHDOG_MS = 4000;
const RESTART_DELAY_MS = 250;

/**
 * Ascolto continuo che non si spegne da solo: si riavvia dopo ogni silenzio, dopo
 * gli errori temporanei (rete, nessun audio) e quando la pagina torna visibile.
 * Si ferma solo con `stop()` o se il permesso del microfono è negato dall'inizio.
 */
export class VoiceListener {
  private recognition: RecognitionLike | null = null;
  private active = false;
  private running = false;
  private everStarted = false;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: ListenerOptions) {}

  start(): boolean {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    this.active = true;
    const rec = new Ctor();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = false;
    (rec as unknown as { onstart: (() => void) | null }).onstart = () => {
      this.running = true;
      this.everStarted = true;
    };
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (!result.isFinal) continue;
        const text = result[0]?.transcript ?? '';
        if (text.trim()) this.options.onHeard(text);
      }
    };
    rec.onerror = (event) => {
      // Permesso negato subito: inutile insistere. Dopo (schermo spento, pagina in
      // secondo piano) è temporaneo: il controllo periodico riavvia l'ascolto.
      if ((event.error === 'not-allowed' || event.error === 'service-not-allowed') && !this.everStarted) {
        this.stop();
        this.options.onError?.(event.error);
      }
    };
    rec.onend = () => {
      this.running = false;
      this.scheduleRestart();
    };
    this.recognition = rec;
    this.watchdog = setInterval(() => {
      if (this.active && !this.running) this.restart();
    }, WATCHDOG_MS);
    document.addEventListener('visibilitychange', this.onVisible);
    return this.restart();
  }

  stop(): void {
    this.active = false;
    this.running = false;
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.watchdog = null;
    this.restartTimer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    this.recognition?.abort();
    this.recognition = null;
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible' && this.active && !this.running) this.restart();
  };

  private scheduleRestart(): void {
    if (!this.active || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.active && !this.running) this.restart();
    }, RESTART_DELAY_MS);
  }

  private restart(): boolean {
    if (!this.recognition) return false;
    try {
      this.recognition.start();
      this.running = true;
      return true;
    } catch {
      // già in ascolto, oppure il browser non è pronto: ci riprova il controllo periodico
      return false;
    }
  }
}

/**
 * Schermo sempre acceso (Screen Wake Lock) finché serve: niente salvaschermo né blocco,
 * che fermerebbero microfono e fotocamera. Il browser lo rilascia quando la pagina
 * va in secondo piano: si richiede di nuovo appena torna visibile.
 */
export class ScreenAwake {
  private sentinel: { release(): Promise<void> } | null = null;
  private wanted = false;

  static supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisible);
    await this.request();
  }

  release(): void {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible' && this.wanted) void this.request();
  };

  private async request(): Promise<void> {
    if (!ScreenAwake.supported() || document.visibilityState !== 'visible') return;
    try {
      const lock = await (navigator as unknown as { wakeLock: { request(type: 'screen'): Promise<{ release(): Promise<void>; addEventListener(e: string, l: () => void): void }> } }).wakeLock.request('screen');
      this.sentinel = lock;
      lock.addEventListener('release', () => {
        if (this.sentinel === lock) this.sentinel = null;
      });
    } catch {
      // negato (batteria scarica, iframe): si riprova alla prossima visibilità
    }
  }
}

/** La frase sentita è l'eco di ciò che l'app sta dicendo (il microfono sente l'altoparlante)? */
export function isEcho(heard: string, speaking: string): boolean {
  const h = normalize(heard);
  const s = normalize(speaking);
  return h.length > 0 && s.length > 0 && s.includes(h);
}

/** Il nome detto a voce: «mi chiamo Marco», «sono Anna Maria», «Luca». null se non sembra un nome. */
export function parseName(heard: string): string | null {
  const text = heard
    .trim()
    .replace(/[.!?,;:]+$/g, '')
    .replace(/^(ciao[,!]?\s+)?(io\s+)?(mi\s+chiamo|sono|il\s+mio\s+nome\s+(e|è))\s+/i, '')
    .trim();
  const words = text.split(/\s+/).filter(Boolean);
  // Una domanda o un comando non sono un nome.
  if (parseCommand(text)?.kind && parseCommand(text)?.kind !== 'question') return null;
  if (/^(chi|cosa|che|come|perch[eé]|quando|dove|qual[ei]?|quanti?|quante|non|si|sì|no|ok|va bene)$/i.test(words[0] ?? '')) return null;
  if (words.length === 0 || words.length > 3 || !words.every((w) => /^[\p{L}'’-]+$/u.test(w))) return null;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
