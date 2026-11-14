import { useSyncExternalStore } from 'react';

/**
 * Tono di parlata del tutor: cambia le frasi dette dall'app (lodi, richiami,
 * saluti…) e le istruzioni date a Claude per spiegazioni e risposte.
 * Le spiegazioni restano sempre corrette: cambia solo il modo di dirle.
 */

export type Tone = 'formal' | 'friendly' | 'normal' | 'youthful' | 'rude' | 'unpleasant' | 'arrogant' | 'offensive';

export const TONES: readonly Tone[] = ['formal', 'friendly', 'normal', 'youthful', 'rude', 'unpleasant', 'arrogant', 'offensive'];

export const TONE_LABELS: Record<Tone, string> = {
  formal: 'Formale',
  friendly: 'Amichevole',
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
}

const LINES: Record<Tone, ToneLines> = {
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
  },
};

/** Istruzioni per Claude: come parlare all'allievo. */
export const TONE_PROMPTS: Record<Tone, string> = {
  normal: '',
  formal: 'Dai del Lei all’allievo, con un tono formale e cortese.',
  friendly: 'Tono caldo, amichevole e incoraggiante; dai del tu.',
  youthful: 'Tono giovanile e informale, con qualche espressione da ragazzi, senza esagerare.',
  rude: 'Tono sgarbato e brusco, sbrigativo; la spiegazione però resta corretta e chiara.',
  unpleasant: 'Tono antipatico e saccente, con qualche frecciatina all’allievo; la spiegazione resta corretta e utile.',
  arrogant: 'Tono arrogante: ti vanti di essere il migliore maestro; la spiegazione resta corretta e utile.',
  offensive:
    'Tono da maestro burbero che prende in giro l’allievo con insulti scherzosi e coloriti (schiappa, testone, brocco…), riferiti solo al suo modo di giocare: mai parolacce pesanti, mai insulti su aspetto, origine, genere, religione o altre caratteristiche personali. La spiegazione resta corretta e utile.',
};

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
}

export function phrases(tone: Tone): TonePhrases {
  const l = LINES[tone];
  return {
    hello: (n) => fill(l.hello, n),
    nice: (n) => fill(l.nice, n),
    call: (n, turn) => (n ? fill(l.call[turn % l.call.length]!, n) : ''),
    wellDone: (m, n, turn) => (tone === 'normal' && !n ? `Bene, ${m}.` : `${fill(l.praise[turn % l.praise.length]!, n)} ${m}.`),
    reminder: (n) => fill(l.reminder, n),
    wrong: (instruction, n) => `${fill(l.wrong, n)}${instruction}`,
    finished: (r, n) => (tone === 'normal' && !n ? `Partita finita: ${r}.` : fill(l.finished, n, { r })),
    whyTo: (n) => fill(l.whyTo, n),
    aligned: (n) => fill(l.aligned, n),
  };
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
