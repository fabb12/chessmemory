import type { Tone } from '../tutor/tone';

/**
 * Le battute di Benbot nei diversi toni scelti nelle Impostazioni. Il tono
 * «normale» usa le frasi del dizionario; gli altri sostituiscono solo le frasi
 * qui elencate (le altre restano quelle normali). Le frasi dicono sempre la
 * stessa cosa: cambia solo il modo.
 */
export interface RobotToneLines {
  greeting?: (white: boolean) => string;
  /** Prima della partita, se Benbot non sa ancora come ti chiami. */
  askName?: string;
  /** Saluto quando sa il tuo nome (appena detto o ricordato). */
  greetName?: (name: string, white: boolean, met: boolean) => string;
  grade?: Partial<Record<'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder', string[]>>;
  lostPiece?: (piece: string) => string[];
  lostQueen?: string[];
  inCheck?: string[];
  iCapture?: string[];
  hint?: (move: string) => string;
  undo?: string[];
  thinking?: string[];
  yourTurn?: string[];
  outcome?: Partial<Record<'win' | 'loss' | 'draw' | 'resigned', string>>;
}

const who = (white: boolean) => (white ? 'Tu hai il Bianco e muovi per primo.' : 'Tu hai il Nero, quindi comincio io.');

export const ROBOT_TONES: Partial<Record<Tone, RobotToneLines>> = {
  master: {
    greeting: (w) => `Buongiorno, sono Benbot. ${who(w)} Giochiamo con calma e chiediamoci sempre il perché di ogni mossa.`,
    grade: {
      best: ['Esatto: è la mossa migliore. Ricorda questa idea.', 'Molto bene, è proprio la mossa del maestro.'],
      good: ['Bene, è una mossa sensata.', 'Giusto, segui i principi.'],
      inaccuracy: ['Non è un errore, ma c’era un’idea migliore: osserviamola.', 'Discreta, ma si poteva fare di più.'],
      mistake: ['Fermiamoci un attimo: questa mossa è un errore.', 'Qui hai sbagliato: guarda bene le minacce.'],
      blunder: ['Attenzione, questo è un errore grave. Ragioniamo su cosa è successo.', 'Errore grave: prima di muovere, controlla sempre catture e minacce.'],
    },
    lostPiece: (p) => [`Hai catturato ${p}: osserva come cambia l’equilibrio del materiale.`, `Bene, ${p} è tuo. Ora consolida la posizione.`],
    lostQueen: ['Hai vinto la donna: un vantaggio decisivo, ora semplifica.', 'La mia donna! Ora gioca con precisione per far valere il vantaggio.'],
    hint: (m) => `Un consiglio da maestro: guarda la freccia e valuta ${m}.`,
    undo: ['Torniamo indietro: ripensa alla posizione e cerca la mossa migliore.', 'Riproviamo: questa volta guarda prima le minacce.'],
    thinking: ['Lasciami riflettere sulla posizione…', 'Valuto le alternative…'],
    yourTurn: ['Tocca a te: che cosa minaccio?', 'A te: guarda prima scacchi, catture e minacce.'],
    outcome: {
      win: 'Scacco matto: hai vinto. Ripensa ai momenti chiave della partita: è così che si migliora.',
      loss: 'Scacco matto: questa volta ho vinto io. Ripassiamo gli errori e riproviamo.',
      draw: 'Patta. Una partita equilibrata: ottimo esercizio.',
      resigned: 'Ti arrendi. Va bene: ogni partita persa è una lezione.',
    },
  },
  formal: {
    greeting: (w) => `Buongiorno, sono Benbot. ${w ? 'Lei ha il Bianco e muove per primo.' : 'Lei ha il Nero, quindi comincio io.'} Le auguro una buona partita.`,
    askName: 'Buongiorno, sono Benbot. Come si chiama?',
    greetName: (name, w, met) =>
      `${met ? `Piacere, ${name}.` : `Buongiorno ${name}, lieto di rivederLa.`} ${w ? 'Lei ha il Bianco e muove per primo.' : 'Lei ha il Nero, quindi comincio io.'} Le auguro una buona partita.`,
    grade: {
      best: ['Eccellente, la mossa migliore.', 'Complimenti, mossa perfetta.'],
      good: ['Buona mossa.', 'Corretto.'],
      inaccuracy: ['Una piccola imprecisione: c’era di meglio.', 'Accettabile, ma migliorabile.'],
      mistake: ['Mi permetta: questa mossa è un errore.', 'Purtroppo è un errore.'],
      blunder: ['Temo si tratti di un errore grave.', 'Un errore serio, mi dispiace.'],
    },
    lostPiece: (p) => [`Ha catturato ${p}. Ben fatto.`, `Complimenti, ${p} è Suo.`],
    lostQueen: ['Ha catturato la mia donna. Notevole.', 'La mia donna… Complimenti.'],
    inCheck: ['Scacco. Devo proteggere il mio re.', 'Mi trovo sotto scacco.'],
    hint: (m) => `Un suggerimento: osservi la freccia e consideri ${m}.`,
    undo: ['Certamente, torniamo indietro. Riprovi pure.', 'Nessun problema: ripetiamo la mossa.'],
    yourTurn: ['Tocca a Lei.', 'Attendo la Sua mossa.'],
    outcome: {
      win: 'Scacco matto. Ha vinto Lei: complimenti per la bella partita.',
      loss: 'Scacco matto. Questa volta ho vinto io. Desidera la rivincita?',
      draw: 'Patta. Una partita equilibrata.',
      resigned: 'Ha abbandonato. Quando desidera, possiamo riprovare.',
    },
  },
  friendly: {
    greeting: (w) => `Ciao amico! Sono Benbot, che bello giocare con te! ${who(w)} Divertiamoci!`,
    grade: {
      best: ['Che mossa fantastica!', 'Bravissimo, proprio la migliore!'],
      good: ['Bella mossa, continua così!', 'Ottimo, mi piace!'],
      inaccuracy: ['Quasi! C’era una mossa un po’ migliore.', 'Non male, ma puoi fare ancora meglio!'],
      mistake: ['Ops, questa è un errore… ma succede a tutti!', 'Ahi, qui hai sbagliato. Niente paura!'],
      blunder: ['Oh no, errore grave… ma non mollare!', 'Ahi ahi, questa costa cara. Ce la fai a recuperare!'],
    },
    hint: (m) => `Ti do una mano: guarda la freccia e prova ${m}!`,
    undo: ['Certo, torniamo indietro! Riprova con calma.', 'Nessun problema, rifacciamola insieme!'],
    yourTurn: ['Tocca a te, amico!', 'Vai, sono curioso della tua mossa!'],
    outcome: {
      win: 'Scacco matto! Hai vinto tu, che bravo! Bellissima partita.',
      loss: 'Scacco matto! Ho vinto io, ma hai giocato bene. Rivincita?',
      draw: 'Patta! Che bella lotta, siamo pari.',
      resigned: 'Ti arrendi? Nessun problema, riproviamo quando vuoi!',
    },
  },
  playful: {
    greeting: (w) => `Bip bop! Sono Benbot, il robot più simpatico della scacchiera! ${who(w)} Che vinca il più furbo… cioè io!`,
    grade: {
      best: ['Accidenti, mi si sono fusi i circuiti: mossa perfetta!', 'Bip! Questa la metto nel mio album dei ricordi!'],
      good: ['Bella mossa! I miei bulloni applaudono.', 'Mi piace, hai stile!'],
      inaccuracy: ['Mmm, mossa creativa… ma c’era di meglio!', 'Non male, ma il mio processore suggerisce altro.'],
      mistake: ['Ops! Questa mossa ha preso la strada sbagliata.', 'Ahi, i miei sensori segnalano un errore!'],
      blunder: ['Allarme rosso! Errore grave in corso!', 'Ahi ahi ahi, mi è caduta una vite dallo spavento!'],
    },
    lostPiece: (p) => [`Ehi! ${p} era il mio preferito!`, `Ladro di pezzi! Mi hai preso ${p}!`],
    lostQueen: ['Nooo, la mia regina! Chiamo l’avvocato!', 'La donna! Vado a piangere in un angolo di bit.'],
    iCapture: ['Gnam! Questo me lo mangio io.', 'Grazie del regalo, lo metto in collezione!'],
    hint: (m) => `Psst… non dirlo a nessuno: guarda la freccia e prova ${m}.`,
    undo: ['Riavvolgo il nastro! Riprova.', 'Ctrl+Z attivato: rifacciamo!'],
    thinking: ['Bip bip… sto scaldando i circuiti…', 'Fammi consultare il mio criceto interno…'],
    outcome: {
      win: 'Scacco matto! Hai vinto tu: mi inchino… e mi si blocca la schiena!',
      loss: 'Scacco matto! Ho vinto io: balletto della vittoria! Rivincita?',
      draw: 'Patta! Pace e bulloni per tutti.',
      resigned: 'Bandiera bianca? Va bene, ma la rivincita è d’obbligo!',
    },
  },
  youthful: {
    greeting: (w) => `Ehi, sono Benbot! ${who(w)} Si gioca, let’s go!`,
    grade: {
      best: ['Bomba! Mossa top!', 'Spacchi, è proprio la migliore!'],
      good: ['Bella lì!', 'Ci sta, bella mossa!'],
      inaccuracy: ['Mah, ci sta, ma c’era di meglio.', 'Non è il massimo, bro.'],
      mistake: ['Nah, questa è un errore.', 'Oof, qui hai sbagliato.'],
      blunder: ['Oddio, errore pesante!', 'Raga, questa costa cara!'],
    },
    hint: (m) => `Dritta: guarda la freccia, prova ${m}.`,
    undo: ['Ok, rewind! Riprova.', 'Tranqui, rifacciamola.'],
    yourTurn: ['Tocca a te!', 'Vai, fai la tua mossa!'],
    outcome: {
      win: 'Scacco matto! GG, hai vinto tu!',
      loss: 'Scacco matto! GG, stavolta ho vinto io. Rivincita?',
      draw: 'Patta! GG, siamo pari.',
      resigned: 'Rage quit? Ci sta, riproviamo dopo!',
    },
  },
  rude: {
    greeting: (w) => `Sono Benbot. ${who(w)} Muoviamoci, non ho tutto il giorno.`,
    grade: {
      best: ['Giusta. Era ora.', 'Ok, la migliore. Avanti.'],
      good: ['Va bene. Avanti.', 'Ok. Non perdiamo tempo.'],
      inaccuracy: ['C’era di meglio. Pensaci di più.', 'Mossa mediocre.'],
      mistake: ['Sbagliato.', 'No. Errore.'],
      blunder: ['Errore grave. Stai attento!', 'Ma cosa fai? Errore grave.'],
    },
    hint: (m) => `Guarda la freccia: ${m}. Te lo dico una volta sola.`,
    undo: ['Va bene, indietro. Ma sbrigati.', 'Rifai. E stavolta pensa.'],
    yourTurn: ['Muovi.', 'Tocca a te, sbrigati.'],
    outcome: {
      win: 'Scacco matto. Hai vinto. Contento?',
      loss: 'Scacco matto. Ho vinto io, come previsto.',
      draw: 'Patta. Finita.',
      resigned: 'Ti arrendi. Prevedibile.',
    },
  },
  unpleasant: {
    greeting: (w) => `Ah, sei tu. Sono Benbot. ${who(w)} Vediamo quanto duri.`,
    grade: {
      best: ['Mh, la migliore. Fortuna, scommetto.', 'Giusta. Non abituarti.'],
      good: ['Passabile.', 'Ok, non hai sbagliato. Stranamente.'],
      inaccuracy: ['Lo sapevo che c’era di meglio.', 'Tipico: mossa così così.'],
      mistake: ['Ecco, lo sapevo: errore.', 'Sbagliato, come previsto.'],
      blunder: ['Errore grave. Che sorpresa… non.', 'Complimenti, hai regalato la partita.'],
    },
    hint: (m) => `Visto che da solo non ci arrivi: guarda la freccia, ${m}.`,
    undo: ['Di nuovo indietro? Va bene…', 'Rifai pure. Tanto è uguale.'],
    yourTurn: ['Sto ancora aspettando.', 'Tocca a te. Con calma, eh.'],
    outcome: {
      win: 'Scacco matto. Hai vinto tu. Incredibile, davvero.',
      loss: 'Scacco matto. Ho vinto io. Non mi sorprende.',
      draw: 'Patta. Meglio di quanto pensassi.',
      resigned: 'Ti arrendi già? Me lo aspettavo.',
    },
  },
  arrogant: {
    greeting: (w) => `Sono Benbot, il robot più forte che incontrerai. ${who(w)} Prova a resistere.`,
    grade: {
      best: ['La migliore. Io l’avevo vista prima di te, ovviamente.', 'Giusta: stai imparando da me.'],
      good: ['Discreta. Io avrei fatto meglio.', 'Non male, per un umano.'],
      inaccuracy: ['C’era di meglio. Io l’avrei trovata.', 'Mossa da principiante.'],
      mistake: ['Errore. Io non sbaglio mai.', 'Sbagliato. Guarda me e impara.'],
      blunder: ['Errore grave. Contro di me non si può.', 'Grazie del regalo, me lo merito.'],
    },
    lostPiece: (p) => [`Mi hai preso ${p}? Te l’ho lasciato io.`, `${p}? Un sacrificio calcolato, ovviamente.`],
    lostQueen: ['La donna? Non mi serviva, vincerò lo stesso.', 'Ti ho regalato la donna per pietà.'],
    iCapture: ['Mio, come tutto il resto.', 'Preso. Troppo facile.'],
    hint: (m) => `Il maestro ti concede un aiuto: ${m}. Guarda la freccia.`,
    undo: ['Torna pure indietro: non cambierà nulla.', 'Riprova. Tanto vinco io.'],
    outcome: {
      win: 'Scacco matto… hai vinto. Oggi i miei circuiti erano stanchi.',
      loss: 'Scacco matto. Ho vinto io, naturalmente.',
      draw: 'Patta. Ti ho lasciato pareggiare.',
      resigned: 'Ti arrendi davanti al migliore. Saggia scelta.',
    },
  },
  offensive: {
    greeting: (w) => `Eccolo, la schiappa di turno! Sono Benbot. ${who(w)} Vediamo quanto sei scarso.`,
    grade: {
      best: ['Miracolo! La schiappa ha trovato la migliore!', 'Incredibile, testone, ne hai azzeccata una!'],
      good: ['Ok, brocco, non male.', 'Anche una capra ogni tanto ci prende.'],
      inaccuracy: ['Mossa da zuccone, c’era di meglio.', 'Mah, testa di legno, si poteva fare meglio.'],
      mistake: ['Errore, schiappa!', 'Ma che combini, zuccone?'],
      blunder: ['Errore gravissimo, brocco!', 'Mani di burro! Hai buttato via tutto.'],
    },
    hint: (m) => `Senti, lumaca, guarda la freccia: ${m}.`,
    undo: ['Torna indietro, schiappa, e pensa!', 'Rifai, testone.'],
    yourTurn: ['Muoviti, lumaca!', 'Tocca a te, zuccone.'],
    outcome: {
      win: 'Scacco matto! Hai vinto tu, brocco: fortuna sfacciata!',
      loss: 'Scacco matto! Ho vinto io, schiappa. Rivincita?',
      draw: 'Patta! Non sei così scarso, testone.',
      resigned: 'Ti arrendi, coniglio? Lo sapevo!',
    },
  },
};
