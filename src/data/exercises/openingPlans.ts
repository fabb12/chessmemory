import type { Exercise } from '../../types';

/**
 * Aperture e sviluppo, seconda parte: sicurezza del re, sviluppo con tempo,
 * fianchetto, rotture centrali, inchiodature e forchette di pedone.
 * Le mosse migliori sono state controllate con Stockfish.
 */
export const OPENING_PLAN_EXERCISES: readonly Exercise[] = [
  // ───── Il matto dell'imbecille ─────
  {
    id: 'fools-mate-a',
    title: 'Due pedoni di troppo',
    category: 'openings',
    difficulty: 1,
    conceptId: 'fools-mate',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    sideToMove: 'b',
    solution: [{ move: 'd8h4' }],
    goal: 'Dopo 1.f3 e5 2.g4 la diagonale h4–e1 è completamente aperta: la donna nera arriva al re bianco in una sola mossa.',
    watchOut: 'Il re bianco non ha case di fuga: f2 è vuota ma è controllata dalla donna in h4, le altre sono occupate dai suoi pezzi.',
    explanation:
      '1…Dh4#: è il matto più rapido possibile (matto dell’imbecille). Il Bianco ha spinto i due pedoni che proteggevano la diagonale del re: nessun pezzo può interporsi in g3 o f2 e il re non ha case libere.',
    hints: [
      'Guarda la diagonale che va dalla tua donna verso il re bianco.',
      'I pedoni bianchi «f» e «g» non coprono più il re: c’è una casa da cui la donna dà scacco senza poter essere catturata.',
    ],
    question: {
      prompt: 'Qual è stato l’errore del Bianco?',
      options: [
        { id: 'a', text: 'Ha spinto i pedoni «f» e «g», aprendo la diagonale verso il proprio re.' },
        { id: 'b', text: 'Non ha fatto uscire subito la donna.' },
        { id: 'c', text: 'Non ha arroccato lungo alla seconda mossa.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'fools-mate-b',
    expect: 'checkmate',
  },
  {
    id: 'fools-mate-b',
    title: 'Il Nero indebolisce il suo re',
    category: 'openings',
    difficulty: 1,
    conceptId: 'fools-mate',
    fen: 'rnbqkbnr/ppppp2p/5p2/6p1/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
    sideToMove: 'w',
    solution: [{ move: 'd1h5' }],
    goal: 'Il Nero ha giocato …f6 e …g5: la diagonale e8–h5 è aperta e nessun pezzo nero può chiuderla.',
    watchOut: 'Il pedone g6 manca: è proprio quello che avrebbe potuto interporsi davanti al re.',
    explanation:
      '2.Dh5#: la donna dà scacco lungo la diagonale h5–e8. Il re nero è chiuso dai suoi stessi pezzi (d8, f8, d7, e7) e la casa f7 è controllata dalla donna. Lo stesso matto dell’imbecille, a colori invertiti.',
    hints: [
      'Il re nero ha spinto i pedoni che lo proteggevano sulla diagonale.',
      'Trova la casa da cui la donna attacca il re lungo la diagonale e8–h5.',
    ],
    question: {
      prompt: 'Quali pedoni conviene non spingere presto in apertura?',
      options: [
        { id: 'a', text: 'I pedoni centrali «d» ed «e».' },
        { id: 'b', text: 'I pedoni «f» e «g», che proteggono la diagonale del re.' },
        { id: 'c', text: 'I pedoni «a» e «h», perché servono per l’arrocco.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'fools-mate-a',
    expect: 'checkmate',
  },

  // ───── Sviluppo con guadagno di tempo ─────
  {
    id: 'develop-with-tempo-a',
    title: 'La donna nera in d5',
    category: 'openings',
    difficulty: 2,
    conceptId: 'develop-with-tempo',
    fen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
    sideToMove: 'w',
    solution: [{ move: 'b1c3' }],
    goal: 'Dopo 1.e4 d5 2.exd5 Dxd5 la donna nera è al centro: il cavallo in c3 si sviluppa e la attacca.',
    watchOut: 'Non serve inseguire la donna con pedoni: indeboliscono la posizione. Basta un pezzo che si sviluppa.',
    explanation:
      '3.Cc3: un pezzo nuovo entra in gioco e la donna deve spostarsi di nuovo (in a5, d6 o d8). Il Nero perde un tempo, il Bianco guadagna una mossa di sviluppo. È la linea principale della Scandinava.',
    hints: [
      'La donna nera è al centro e può essere attaccata.',
      'Un cavallo che ancora non ha mosso può svilupparsi su una casa che attacca d5.',
    ],
    question: {
      prompt: 'Perché 3.Cc3 è una buona mossa di sviluppo?',
      options: [
        { id: 'a', text: 'Perché minaccia di dare matto in f7.' },
        { id: 'b', text: 'Perché sviluppa un pezzo e obbliga la donna a spostarsi, facendo perdere tempo al Nero.' },
        { id: 'c', text: 'Perché libera la casa per arroccare lungo.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'develop-with-tempo-b',
  },
  {
    id: 'develop-with-tempo-b',
    title: 'La donna bianca in d4',
    category: 'openings',
    difficulty: 2,
    conceptId: 'develop-with-tempo',
    fen: 'rnbqkbnr/pp1ppppp/8/8/3QP3/8/PPP2PPP/RNB1KBNR b KQkq - 0 3',
    sideToMove: 'b',
    solution: [{ move: 'b8c6' }],
    goal: 'Dopo 1.e4 c5 2.d4 cxd4 3.Dxd4 la donna bianca è uscita presto: il cavallo in c6 la attacca sviluppandosi.',
    watchOut: 'Anche 3…Cf6 sviluppa, ma non attacca la donna: con …Cc6 il Nero guadagna una mossa.',
    explanation:
      '3…Cc6: il cavallo va verso il centro e la donna bianca deve spostarsi ancora. È il motivo per cui in apertura conviene non portare fuori la donna troppo presto.',
    hints: [
      'La donna bianca è in mezzo alla scacchiera: quali tuoi pezzi possono attaccarla?',
      'Un cavallo ancora a casa può svilupparsi verso il centro e colpire d4.',
    ],
    question: {
      prompt: 'Perché in apertura conviene non portare fuori la donna troppo presto?',
      options: [
        { id: 'a', text: 'Perché i pezzi avversari si sviluppano attaccandola e guadagnano tempo.' },
        { id: 'b', text: 'Perché la donna non può tornare indietro.' },
        { id: 'c', text: 'Perché il regolamento lo vieta nelle prime tre mosse.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'develop-with-tempo-a',
  },

  // ───── Fianchetto ─────
  {
    id: 'fianchetto-a',
    title: 'Il fianchetto del Bianco',
    category: 'openings',
    difficulty: 2,
    conceptId: 'fianchetto',
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq - 1 3',
    sideToMove: 'w',
    solution: [{ move: 'f1g2' }],
    goal: 'Il pedone g3 ha preparato la casa g2: da lì l’alfiere guarda tutta la grande diagonale h1–a8, fino a d5 e b7.',
    watchOut: 'Senza l’alfiere in g2 la spinta g3 lascerebbe deboli le case f3 e h3 davanti al futuro arrocco.',
    explanation:
      '3.Ag2: l’alfiere esce sulla diagonale più lunga della scacchiera, preme sul centro e sul lato di donna, e libera la strada all’arrocco corto. Il re arroccato in g1 resterà protetto dall’alfiere.',
    hints: [
      'Il pedone «g» ha già fatto spazio a un pezzo.',
      'Quale alfiere può usare la casa lasciata libera da g2?',
    ],
    question: {
      prompt: 'Che cosa fa un alfiere in fianchetto?',
      options: [
        { id: 'a', text: 'Resta chiuso dietro i pedoni finché non si apre la colonna.' },
        { id: 'b', text: 'Controlla la grande diagonale e protegge il re arroccato.' },
        { id: 'c', text: 'Serve soprattutto a catturare i pedoni sul bordo.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'fianchetto-b',
  },
  {
    id: 'fianchetto-b',
    title: 'La diagonale lunga del Nero',
    category: 'openings',
    difficulty: 2,
    conceptId: 'fianchetto',
    fen: 'rnbqkbnr/pppppp1p/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2',
    sideToMove: 'b',
    solution: [{ move: 'f8g7' }],
    goal: 'Dopo 1.e4 g6 2.d4 l’alfiere in g7 punta il centro bianco (d4) da lontano lungo la diagonale a1–h8.',
    watchOut: 'Il Bianco ha due pedoni centrali: il Nero non li occupa subito, ma li mette sotto pressione con i pezzi.',
    explanation:
      '2…Ag7: tipica mossa della Difesa Moderna. L’alfiere colpisce d4 e, dopo l’arrocco corto, sarà il principale difensore del re nero.',
    hints: [
      'La spinta …g6 ha creato una casa nuova per un pezzo.',
      'Cerca la diagonale più lunga che passa per il centro bianco.',
    ],
    question: {
      prompt: 'Su quale diagonale agisce l’alfiere in g7?',
      options: [
        { id: 'a', text: 'Sulla diagonale h8–a1, che passa per d4 ed e5.' },
        { id: 'b', text: 'Sulla diagonale g7–c3, solo fino al centro.' },
        { id: 'c', text: 'Sulla diagonale f8–a3.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'fianchetto-a',
  },

  // ───── Rotture centrali ─────
  {
    id: 'central-break-a',
    title: 'La catena di pedoni della Francese',
    category: 'openings',
    difficulty: 3,
    conceptId: 'central-break',
    fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
    sideToMove: 'b',
    solution: [{ move: 'c7c5' }],
    goal: 'La catena bianca d4–e5 si attacca alla base: il pedone c5 colpisce d4, che sostiene e5.',
    watchOut: 'Attaccare e5 (la punta) è più difficile: il pedone è difeso da d4. Si colpisce sempre il pedone che regge la catena.',
    explanation:
      '3…c5: è la mossa tipica della Difesa Francese, variante d’avanzata. Se il Bianco cambia in c5 o lascia cadere d4, il pedone e5 resta senza sostegno; intanto il Nero apre la colonna «c» per i suoi pezzi.',
    hints: [
      'I pedoni bianchi d4 ed e5 formano una catena: qual è il pedone che sostiene l’altro?',
      'Un pedone laterale può avanzare di due case e attaccare la base della catena.',
    ],
    question: {
      prompt: 'Dove si attacca di solito una catena di pedoni?',
      options: [
        { id: 'a', text: 'Alla punta, il pedone più avanzato.' },
        { id: 'b', text: 'Alla base, il pedone che sostiene gli altri.' },
        { id: 'c', text: 'Non si attacca: si aggira con i pezzi.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'central-break-b',
  },
  {
    id: 'central-break-b',
    title: 'Il gambetto di donna',
    category: 'openings',
    difficulty: 3,
    conceptId: 'central-break',
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 3',
    sideToMove: 'w',
    solution: [{ move: 'c2c4' }],
    goal: 'Il pedone c4 attacca d5, il pedone che dà al Nero la sua parte di centro.',
    watchOut: 'Se il Nero prende in c4 cede il centro: il Bianco potrà giocare e4 e riprendere il pedone più tardi.',
    explanation:
      '3.c4: il Gambetto di Donna. Il Bianco offre un pedone laterale per allontanare d5 dal centro; se il Nero lo difende, il Bianco aumenta la pressione con Cc3. È una delle aperture più giocate nella storia.',
    hints: [
      'Il pedone nero in d5 è il cuore del centro avversario.',
      'Un pedone laterale può avanzare di due case e attaccare d5.',
    ],
    question: {
      prompt: 'Qual è l’idea della spinta c4 in questa posizione?',
      options: [
        { id: 'a', text: 'Preparare l’arrocco lungo.' },
        { id: 'b', text: 'Liberare la casa c2 per la donna.' },
        { id: 'c', text: 'Attaccare il pedone d5 con un pedone laterale per conquistare il centro.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'central-break-a',
  },

  // ───── Inchiodare il cavallo ─────
  {
    id: 'pin-knight-a',
    title: 'Ag5 nel Gambetto di Donna',
    category: 'openings',
    difficulty: 3,
    conceptId: 'pin-knight',
    fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4',
    sideToMove: 'w',
    solution: [{ move: 'c1g5' }],
    goal: 'In g5 l’alfiere inchioda il cavallo f6 alla donna d8: il cavallo difende meno bene d5.',
    watchOut: 'L’alfiere di donna esce prima di chiudere la diagonale con e3: dopo e3 resterebbe dentro la catena di pedoni.',
    explanation:
      '4.Ag5: sviluppo con pressione. Se il cavallo f6 si muovesse, il Bianco catturerebbe la donna; così d5 è difeso un po’ meno e il Bianco può aumentare la pressione sul centro.',
    hints: [
      'Il cavallo nero f6 sta sulla stessa diagonale della donna d8.',
      'Sviluppa l’alfiere che ancora non ha una diagonale aperta.',
    ],
    question: {
      prompt: 'Perché conviene sviluppare l’alfiere in g5 prima di giocare e3?',
      options: [
        { id: 'a', text: 'Perché dopo e3 l’alfiere di donna resterebbe chiuso dietro i pedoni.' },
        { id: 'b', text: 'Perché in g5 l’alfiere difende il re.' },
        { id: 'c', text: 'Perché l’alfiere in g5 minaccia di dare matto.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'pin-knight-b',
  },
  {
    id: 'pin-knight-b',
    title: 'La Difesa Nimzo-Indiana',
    category: 'openings',
    difficulty: 3,
    conceptId: 'pin-knight',
    fen: 'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 2 3',
    sideToMove: 'b',
    solution: [{ move: 'f8b4' }],
    goal: 'In b4 l’alfiere inchioda il cavallo c3 al re: il cavallo non può più sostenere la spinta e4.',
    watchOut: 'Il Bianco vorrebbe giocare e4 e occupare tutto il centro: il cavallo inchiodato non può aiutarlo.',
    explanation:
      '3…Ab4: è la Difesa Nimzo-Indiana. Il Nero sviluppa, prepara l’arrocco e impedisce e4. Spesso è pronto a cambiare l’alfiere con il cavallo, lasciando al Bianco pedoni doppiati in «c».',
    hints: [
      'Il cavallo bianco c3 controlla e4: puoi renderlo meno efficace?',
      'Un alfiere che ancora non ha mosso può mettersi sulla diagonale tra cavallo e re.',
    ],
    question: {
      prompt: 'Che cosa ottiene il Nero con 3…Ab4?',
      options: [
        { id: 'a', text: 'Guadagna subito un pedone.' },
        { id: 'b', text: 'Sviluppa un pezzo e inchioda il cavallo che controlla e4.' },
        { id: 'c', text: 'Prepara l’arrocco lungo.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'pin-knight-a',
  },

  // ───── Trucco della forchetta ─────
  {
    id: 'fork-trick-a',
    title: 'Il trucco della forchetta per il Nero',
    category: 'openings',
    difficulty: 4,
    conceptId: 'fork-trick',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1N3/5N2/PPPP1PPP/R1BQK2R b KQkq - 0 5',
    sideToMove: 'b',
    solution: [{ move: 'd7d5' }],
    goal: 'Il Nero ha appena dato il cavallo in e4: ora il pedone d5 attacca insieme l’alfiere c4 e il cavallo e4.',
    watchOut: 'Senza …d5 il Nero avrebbe semplicemente perso un pezzo per un pedone.',
    explanation:
      '5…d5: forchetta di pedone. Il Bianco può salvare solo uno dei due pezzi, e il Nero riprende il materiale con un ottimo centro. È il «trucco della forchetta» (1.e4 e5 2.Cf3 Cc6 3.Ac4 Cf6 4.Cc3 Cxe4 5.Cxe4 d5).',
    hints: [
      'Due pezzi bianchi stanno su case vicine, in c4 ed e4.',
      'Un pedone che avanza attacca le due case in diagonale davanti a sé.',
    ],
    question: {
      prompt: 'Perché il sacrificio del cavallo in e4 era corretto?',
      options: [
        { id: 'a', text: 'Perché il cavallo bianco in e4 non poteva muoversi.' },
        { id: 'b', text: 'Perché il Nero dà matto subito dopo.' },
        { id: 'c', text: 'Perché la forchetta …d5 recupera il pezzo e lascia al Nero un buon centro.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'fork-trick-b',
  },
  {
    id: 'fork-trick-b',
    title: 'Il trucco della forchetta per il Bianco',
    category: 'openings',
    difficulty: 4,
    conceptId: 'fork-trick',
    fen: 'r1bqk1nr/pppp1ppp/8/2b1n3/4P3/2N5/PPPP1PPP/R1BQKB1R w KQkq - 0 5',
    sideToMove: 'w',
    solution: [{ move: 'd2d4' }],
    goal: 'Il Bianco ha dato il cavallo per il pedone e5: ora d4 attacca insieme l’alfiere c5 e il cavallo e5.',
    watchOut: 'Il pedone in d4 è difeso dalla donna d1: se il Nero salva l’alfiere, il Bianco cattura il cavallo, e viceversa.',
    explanation:
      '5.d4: forchetta di pedone sull’alfiere e sul cavallo (1.e4 e5 2.Cf3 Cc6 3.Cc3 Ac5 4.Cxe5 Cxe5 5.d4). Il Bianco riprende il pezzo e ottiene un centro forte con e4 e d4.',
    hints: [
      'Alfiere e cavallo neri stanno sulle case c5 ed e5.',
      'Quale pedone, avanzando di due case, li attacca entrambi?',
    ],
    question: {
      prompt: 'Che cos’è una forchetta di pedone?',
      options: [
        { id: 'a', text: 'Un pedone che attacca contemporaneamente due pezzi avversari.' },
        { id: 'b', text: 'Un pedone che promuove dando scacco.' },
        { id: 'c', text: 'Due pedoni affiancati sulla stessa traversa.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'fork-trick-a',
  },
];
