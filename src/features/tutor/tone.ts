import { useSyncExternalStore } from 'react';

/**
 * Tono di parlata del tutor: cambia le frasi dette dall'app (lodi, richiami,
 * saluti…) e le istruzioni date a Claude per spiegazioni e risposte.
 * Le spiegazioni restano sempre corrette: cambia solo il modo di dirle.
 */

export type Tone = 'master' | 'formal' | 'friendly' | 'playful' | 'normal' | 'youthful' | 'rude' | 'unpleasant' | 'arrogant' | 'offensive';

export const TONES: readonly Tone[] = ['master', 'formal', 'friendly', 'playful', 'normal', 'youthful', 'rude', 'unpleasant', 'arrogant', 'offensive'];

export const TONE_LABELS: Record<Tone, string> = {
  master: 'Maestro istruttivo',
  formal: 'Formale',
  friendly: 'Amichevole',
  playful: 'Simpatico e scherzoso',
  normal: 'Normale',
  youthful: 'Giovanile',
  rude: 'Sgarbato',
  unpleasant: 'Antipatico',
  arrogant: 'Arrogante',
  offensive: 'Offensivo',
};

/** Frasi con `{n}` al posto del nome; `{m}` = mossa, `{r}` = risultato. */
interface ToneLines {
  hello: string;
  nice: string;
  call: string[];
  praise: string[];
  reminder: string;
  wrong: string;
  finished: string;
  whyTo: string;
  aligned: string;
  /** Saluto quando l'allievo chiude la lezione (il microfono si spegne). */
  bye: string;
}

const LINES: Record<Tone, ToneLines> = {
  master: {
    hello: 'Buongiorno {n}, oggi studiamo insieme una partita da maestri.',
    nice: 'Piacere, {n}. Mettiti comodo: guarderemo ogni mossa chiedendoci il perché.',
    call: ['{n}, osserva bene: ', 'Ora, {n}, ', 'Seguimi, {n}: ', 'Guarda la scacchiera, {n}: '],
    praise: ['Esatto, {n}.', 'Bene, {n}, ricorda questa idea.', 'Giusto, {n}.', 'Molto bene, {n}.'],
    reminder: '{n}, prenditi il tempo: guarda le minacce, poi muovi.',
    wrong: '{n}, fermiamoci un attimo: non è questa la mossa. Rimetti il pezzo e gioca: ',
    finished: 'La partita è finita, {n}: {r}. Ripensiamo a che cosa abbiamo imparato.',
    whyTo: 'Ragioniamo insieme, {n}:',
    aligned: 'Bene {n}, la scacchiera è pronta: riprendiamo la lezione.',
    bye: 'Va bene, {n}, per oggi chiudiamo la lezione. Spengo il microfono: quando vorrai riprendere, ti aspetto.',
  },
  normal: {
    hello: 'Ciao {n}!',
    nice: 'Piacere, {n}! Iniziamo.',
    call: ['{n}, ', 'Ora tocca a te, {n}. ', 'Attento {n}: ', 'Vai {n}! '],
    praise: ['Bravo {n}!', 'Ottimo {n}!', 'Esatto {n}!', 'Molto bene {n}!'],
    reminder: '{n}, tocca ancora a te.',
    wrong: '{n}, non è questa la mossa. Rimetti il pezzo e gioca: ',
    finished: 'Complimenti {n}, partita finita: {r}.',
    whyTo: 'Ecco perché, {n}:',
    aligned: 'Perfetto {n}, la scacchiera è allineata.',
    bye: 'Va bene {n}, ci fermiamo qui. Spengo il microfono.',
  },
  formal: {
    hello: 'Buongiorno {n}.',
    nice: 'Piacere di conoscerLa, {n}. Possiamo cominciare.',
    call: ['{n}, ', 'Prego {n}, ', '{n}, proceda: ', 'Tocca a Lei, {n}. '],
    praise: ['Ottima mossa, {n}.', 'Molto bene, {n}.', 'Corretto, {n}.', 'Eccellente, {n}.'],
    reminder: '{n}, attendo la Sua mossa.',
    wrong: '{n}, non è la mossa corretta. Rimetta il pezzo e giochi: ',
    finished: 'Complimenti {n}, la partita è conclusa: {r}.',
    whyTo: 'Le spiego il motivo, {n}:',
    aligned: 'Perfetto {n}, la scacchiera è allineata.',
    bye: 'Come desidera, {n}. Ci fermiamo qui e spengo il microfono.',
  },
  friendly: {
    hello: 'Ciao {n}! Che bello vederti.',
    nice: 'Piacere {n}! Divertiamoci insieme.',
    call: ['Dai {n}, ', 'Ok {n}, ', 'Forza {n}! ', 'Tocca a te, {n}! '],
    praise: ['Grande {n}!', 'Bravissimo {n}!', 'Che bella mossa, {n}!', 'Così si fa, {n}!'],
    reminder: '{n}, con calma: tocca ancora a te.',
    wrong: 'Quasi {n}! Rimetti il pezzo e prova: ',
    finished: 'Che bella partita, {n}! Finita: {r}.',
    whyTo: 'Ti spiego, {n}:',
    aligned: 'Perfetto {n}, ci siamo!',
    bye: 'Va bene {n}, ci fermiamo qui! Spengo il microfono, a presto.',
  },
  playful: {
    hello: 'Ciao {n}! Pronto a far ballare i pezzi?',
    nice: 'Piacere {n}! Io porto le battute, tu le mosse. Si parte!',
    call: ['{n}, ', 'Occhio {n}: ', 'Tocca a te, campione {n}! ', 'Su {n}, niente pisolini: '],
    praise: ['Bravo {n}, applausi dalla tribuna!', 'Che colpo, {n}! Morphy approverebbe.', 'Giusta, {n}! Anche i pedoni applaudono.', 'Ottimo {n}, stai diventando pericoloso!'],
    reminder: '{n}, i pezzi non si muovono da soli… purtroppo! Tocca a te.',
    wrong: 'Ops {n}, mossa fantasiosa ma non è quella! Rimetti il pezzo e gioca: ',
    finished: 'Finita, {n}: {r}. Inchino e applausi!',
    whyTo: 'Ecco il trucco, {n}:',
    aligned: 'Perfetto {n}, tutto in ordine!',
    bye: 'Ok {n}, i pezzi vanno a dormire! Spengo il microfono.',
  },
  youthful: {
    hello: 'Ehi {n}!',
    nice: 'Bella {n}! Partiamo.',
    call: ['{n}, ', 'Vai {n}, ', 'Ok {n}, tocca a te: ', 'Dai {n}! '],
    praise: ['Top {n}!', 'Grande {n}, spacchi!', 'Bomba {n}!', 'Ottima, {n}, sei un mostro!'],
    reminder: '{n}, ci sei? Tocca a te!',
    wrong: 'Nah {n}, non è questa. Rimetti il pezzo e fai: ',
    finished: 'GG {n}! Partita finita: {r}.',
    whyTo: 'Ti spiego al volo, {n}:',
    aligned: 'Ok {n}, tutto a posto, si riparte!',
    bye: 'Ok {n}, chiudiamo qui! Microfono spento, ciao!',
  },
  rude: {
    hello: '{n}. Cominciamo, non ho tutto il giorno.',
    nice: '{n}, eh? Va bene, cominciamo.',
    call: ['{n}, muoviti: ', 'Su {n}, ', '{n}, sbrigati: ', 'Forza {n}, non dormire: '],
    praise: ['Era ora, {n}.', 'Ok, {n}. Avanti.', 'Giusta. Finalmente, {n}.', 'Va bene, {n}. Non perdiamo tempo.'],
    reminder: '{n}, ti sei addormentato? Muovi!',
    wrong: 'No, {n}! Rimetti a posto e fai quello che ti dico: ',
    finished: 'Finita, {n}: {r}. Era ora.',
    whyTo: 'Te lo dico una volta sola, {n}:',
    aligned: 'Bene {n}, finalmente la scacchiera è a posto.',
    bye: 'Come vuoi, {n}. Spengo il microfono.',
  },
  unpleasant: {
    hello: 'Ah, {n}. Va bene, iniziamo.',
    nice: '{n}. Ok. Se proprio dobbiamo, iniziamo.',
    call: ['{n}, vediamo se ce la fai: ', '{n}, prova a non sbagliare: ', 'Allora {n}: ', '{n}, sforzati: '],
    praise: ['Mh, giusta {n}. Fortuna?', 'Ok {n}, anche un orologio rotto ogni tanto ci prende.', 'Corretta, {n}. Non abituarti.', 'Toh, {n}, ne hai presa una.'],
    reminder: '{n}, sto ancora aspettando. Come al solito.',
    wrong: 'Lo sapevo, {n}. Rimetti il pezzo e gioca: ',
    finished: 'Finita, {n}: {r}. Sei arrivato in fondo, incredibile.',
    whyTo: 'Te lo spiego piano piano, {n}:',
    aligned: '{n}, ce l’hai fatta a sistemare i pezzi. Bravo, eh.',
    bye: 'Già stanco, {n}? Va bene, spengo il microfono.',
  },
  arrogant: {
    hello: '{n}, oggi impari dal migliore.',
    nice: '{n}. Sei fortunato ad avere me come maestro. Iniziamo.',
    call: ['{n}, segui il genio: ', '{n}, fai come farei io: ', 'Ascolta il maestro, {n}: ', '{n}, guarda e impara: '],
    praise: ['Ovvio, {n}: te l’ho detto io.', 'Giusta, {n}. Con un maestro come me è facile.', 'Bene {n}, stai imparando dal migliore.', 'Certo che è giusta, {n}: l’ho scelta io.'],
    reminder: '{n}, il maestro aspetta. Muovi.',
    wrong: 'No {n}, io non l’avrei mai giocata. Rimetti il pezzo e gioca: ',
    finished: 'Finita, {n}: {r}. Grazie a me, ovviamente.',
    whyTo: 'Ascolta bene, {n}, perché lo dico io:',
    aligned: 'Perfetto {n}, ora possiamo continuare con la mia lezione.',
    bye: 'Peccato, {n}: perdi la lezione del migliore. Spengo il microfono.',
  },
  offensive: {
    hello: 'Eccolo qua, {n} la schiappa!',
    nice: 'Piacere {n}, vediamo quanto sei scarso. Cominciamo.',
    call: ['Allora {n}, schiappa, ', '{n}, zuccone, ', 'Sveglia {n}, brocco: ', 'Muoviti {n}, lumaca: '],
    praise: ['Incredibile {n}, ne hai azzeccata una, testone!', 'Giusta, {n}. Anche una capra ogni tanto ci prende.', 'Bravo {n}, pezzo di legno!', 'Miracolo, {n}! Il brocco ha trovato la mossa.'],
    reminder: '{n}, ti sei pietrificato come un pedone? Muovi, lumaca!',
    wrong: 'Ma che combini {n}, testa di legno? Rimetti il pezzo e gioca: ',
    finished: 'Finita, {n}: {r}. Sei sopravvissuto, scarpone!',
    whyTo: 'Senti qua, {n}, zuccone:',
    aligned: 'Era ora, {n}, mani di burro: scacchiera a posto.',
    bye: 'Ti arrendi già, {n}, schiappa? Va bene, spengo il microfono.',
  },
};

/** Istruzioni per Claude: come parlare all'allievo. */
export const TONE_PROMPTS: Record<Tone, string> = {
  master:
    'Parla come un maestro di scacchi esperto e paziente che fa lezione: tono calmo, autorevole e didattico; dai del tu. Collega la mossa a un principio generale (sviluppo, centro, sicurezza del re, pezzi attivi, struttura pedonale) e indica all’allievo che cosa osservare sulla scacchiera.',
  normal: '',
  formal: 'Dai del Lei all’allievo, con un tono formale e cortese.',
  friendly: 'Tono caldo, amichevole e incoraggiante; dai del tu.',
  playful: 'Tono simpatico e scherzoso: al massimo una battuta leggera o un paragone buffo, sempre gentile; dai del tu. La battuta non allunga la spiegazione, che resta corretta e chiara.',
  youthful: 'Tono giovanile e informale, con qualche espressione da ragazzi, senza esagerare.',
  rude: 'Tono sgarbato e brusco, sbrigativo; la spiegazione però resta corretta e chiara.',
  unpleasant: 'Tono antipatico e saccente, con qualche frecciatina all’allievo; la spiegazione resta corretta e utile.',
  arrogant: 'Tono arrogante: ti vanti di essere il migliore maestro; la spiegazione resta corretta e utile.',
  offensive:
    'Tono da maestro burbero che prende in giro l’allievo con insulti scherzosi e coloriti (schiappa, testone, brocco…), riferiti solo al suo modo di giocare: mai parolacce pesanti, mai insulti su aspetto, origine, genere, religione o altre caratteristiche personali. La spiegazione resta corretta e utile.',
};

// ───── Maestro istruttivo ─────

/** Voce del Maestro: un po' più lenta e grave, per scandire la lezione. */
export const MASTER_VOICE = { rate: 0.92, pitch: 0.9 } as const;

/**
 * Domande guida che il Maestro fa prima di una mossa da indovinare: il metodo
 * di pensiero da allenare (minacce, scacchi, catture, pezzi inattivi…).
 */
export const THINKING_PROMPTS: readonly string[] = [
  'Prima di muovere chiediti: che cosa minaccia l’avversario?',
  'Guarda prima scacchi, catture e minacce.',
  'Quale pezzo sta lavorando poco? Forse è il momento di migliorarlo.',
  'Dove si trova il re avversario, e quanti difensori ha?',
  'Pensa al centro: chi lo controlla?',
  'C’è un pezzo indifeso, tuo o dell’avversario?',
  'Quale piano avrebbe un maestro in questa posizione?',
  'Se toccasse all’avversario, che cosa farebbe?',
];

/** Frasi brevi per rispondere subito mentre Claude prepara la risposta (non finiscono nello storico). */
export const ACKS: readonly string[] = ['Vediamo.', 'Bella domanda.', 'Ci penso un attimo.', 'Ottima domanda, vediamo.'];

/** Sostituisce il nome; senza nome toglie il segnaposto e la punteggiatura che lo accompagnava. */
function fill(template: string, name: string, extra: Record<string, string> = {}): string {
  let text = template;
  for (const [k, v] of Object.entries(extra)) text = text.replaceAll(`{${k}}`, v);
  if (name) return text.replaceAll('{n}', name);
  text = text.replace(/^\{n\}[,.]?\s*/, '').replace(/[ ,]*\{n\}/g, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface TonePhrases {
  hello(name: string): string;
  nice(name: string): string;
  /** Richiamo prima di un'indicazione (si alterna con `turn`). */
  call(name: string, turn: number): string;
  /** Mossa eseguita su indicazione. */
  wellDone(move: string, name: string, turn: number): string;
  reminder(name: string): string;
  wrong(instruction: string, name: string): string;
  finished(result: string, name: string): string;
  whyTo(name: string): string;
  aligned(name: string): string;
  bye(name: string): string;
}

export function phrases(tone: Tone): TonePhrases {
  const l = LINES[tone];
  return {
    hello: (n) => fill(l.hello, n),
    nice: (n) => fill(l.nice, n),
    call: (n, turn) => (n || tone !== 'normal' ? fill(l.call[turn % l.call.length]!, n) : ''),
    wellDone: (m, n, turn) => (tone === 'normal' && !n ? `Bene, ${m}.` : `${fill(l.praise[turn % l.praise.length]!, n)} ${m}.`),
    reminder: (n) => fill(l.reminder, n),
    wrong: (instruction, n) => `${fill(l.wrong, n)}${instruction}`,
    finished: (r, n) => (tone === 'normal' && !n ? `Partita finita: ${r}.` : fill(l.finished, n, { r })),
    whyTo: (n) => fill(l.whyTo, n),
    aligned: (n) => fill(l.aligned, n),
    bye: (n) => fill(l.bye, n),
  };
}

// ───── Quando dire il nome ─────

/**
 * Momento in cui il tutor potrebbe chiamare l'allievo per nome:
 * - `greet`: saluto o presentazione → sempre;
 * - `attention`: errore, richiamo, mossa indovinata al primo colpo, fine partita →
 *   quasi sempre, ma non se il nome è appena stato detto;
 * - `routine`: indicazioni e lodi di ogni mossa → solo ogni tanto.
 */
export type NameMoment = 'greet' | 'attention' | 'routine';

/** Frasi da lasciar passare (senza nome) prima di poter ridire il nome. */
const NAME_GAP: Record<NameMoment, number> = { greet: 0, attention: 2, routine: 6 };

/**
 * Dosa il nome dell'allievo: un insegnante vero lo dice per salutare, per richiamare
 * l'attenzione o sottolineare un momento, non in ogni frase. Ogni chiamata a `use`
 * è una frase detta; restituisce il nome da usare in quella frase oppure ''.
 */
export class NamePacer {
  private since = Number.POSITIVE_INFINITY;

  use(name: string, moment: NameMoment): string {
    if (!name) return '';
    this.since++;
    if (this.since <= NAME_GAP[moment]) return '';
    this.since = 0;
    return name;
  }

  /** Nuovo inizio (nuovo nome, nuovo tono): il prossimo momento utile usa il nome. */
  reset(): void {
    this.since = Number.POSITIVE_INFINITY;
  }
}

// ───── Preferenza (sul dispositivo) ─────

const TONE_KEY = 'cm.tutor.tone';
const listeners = new Set<() => void>();

export function getTone(): Tone {
  try {
    const raw = localStorage.getItem(TONE_KEY);
    return TONES.includes(raw as Tone) ? (raw as Tone) : 'normal';
  } catch {
    return 'normal';
  }
}

export function setTone(tone: Tone): void {
  try {
    localStorage.setItem(TONE_KEY, tone);
  } catch {
    // preferenza non salvata
  }
  listeners.forEach((l) => l());
}

export function useTone(): Tone {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTone,
    () => 'normal',
  );
}
