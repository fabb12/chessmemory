import type { Exercise } from '../../types';

export const OPENING_EXERCISES: readonly Exercise[] = [
  {
    id: 'center-pawn-a',
    title: 'La prima mossa del Bianco',
    category: 'openings',
    difficulty: 1,
    conceptId: 'center-pawn',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'e2e4', alternatives: ['d2d4'] }],
    goal: "Il pedone in e4 occupa una casa centrale, controlla d5 e f5 e apre le diagonali dell'alfiere e della donna.",
    watchOut:
      'Le mosse di pedone laterali, come a3 o h3, non aiutano lo sviluppo: in apertura ogni tempo è prezioso.',
    explanation:
      "1.e4 occupa il centro e libera alfiere di re e donna. Anche 1.d4 applica lo stesso principio ed è altrettanto valida.",
    hints: [
      'Le case centrali sono e4, d4, e5 e d5: chi le controlla ha più spazio per i propri pezzi.',
      'Cerca un pedone che possa avanzare di due case fino al centro.',
    ],
    question: {
      prompt: 'Perché conviene iniziare la partita con un pedone centrale?',
      options: [
        { id: 'a', text: 'Occupa il centro e apre la strada ad alfiere e donna.' },
        { id: 'b', text: 'Perché il pedone di re è il meno importante e si può perdere.' },
        { id: 'c', text: "Perché permette di arroccare già alla mossa successiva." },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'center-pawn-b',
  },
  {
    id: 'center-pawn-b',
    title: 'La risposta del Nero a 1.e4',
    category: 'openings',
    difficulty: 1,
    conceptId: 'center-pawn',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'e7e5', alternatives: ['d7d5', 'c7c5'] }],
    goal: 'Il pedone in e5 prende la sua parte di centro, controlla d4 e f4 e libera alfiere e donna.',
    watchOut:
      'Se il Nero trascura il centro, il Bianco può giocare d4 e ottenere due pedoni centrali affiancati.',
    explanation:
      "1…e5 contende il centro alla pari. Sono valide anche 1…d5, che attacca subito e4, e 1…c5, che controlla la casa d4 da lato.",
    hints: [
      'Anche il Nero ha diritto alla sua parte di centro: non lasciarlo tutto al Bianco.',
      'Un pedone davanti al re o alla donna può avanzare di due case.',
    ],
    question: {
      prompt: 'Che cosa ottiene il Nero rispondendo 1…e5?',
      options: [
        { id: 'a', text: 'Minaccia subito di catturare il pedone e4.' },
        { id: 'b', text: 'Occupa il centro, controlla d4 e apre le linee ai propri pezzi.' },
        { id: 'c', text: 'Impedisce al Bianco di sviluppare i cavalli.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'center-pawn-a',
  },
  {
    id: 'develop-knights-a',
    title: 'Il cavallo di re in f3',
    category: 'openings',
    difficulty: 1,
    conceptId: 'develop-knights',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    sideToMove: 'w',
    solution: [{ move: 'g1f3', alternatives: ['b1c3'] }],
    goal: 'Il cavallo in f3 controlla le case centrali d4 ed e5 e attacca il pedone nero in e5.',
    watchOut:
      "Sul bordo (ad esempio in h3) il cavallo controllerebbe la metà delle case: «cavallo al margine, cavallo in disgrazia».",
    explanation:
      "2.Cf3 sviluppa un pezzo, attacca e5 e prepara l'arrocco. Anche 2.Cc3 sviluppa un cavallo verso il centro ed è una mossa corretta.",
    hints: [
      'Sviluppa un pezzo nuovo creando, se puoi, anche una minaccia.',
      'Un cavallo che va verso il centro controlla fino a otto case.',
    ],
    question: {
      prompt: 'Perché sviluppiamo il cavallo in f3?',
      options: [
        { id: 'a', text: 'Per portare subito il cavallo in g5 e attaccare da solo.' },
        { id: 'b', text: 'Per difendere il pedone e4.' },
        { id: 'c', text: 'Controlla il centro, attacca e5 e prepara l’arrocco.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'develop-knights-b',
  },
  {
    id: 'develop-knights-b',
    title: 'Difendere e5 sviluppando',
    category: 'openings',
    difficulty: 1,
    conceptId: 'develop-knights',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    sideToMove: 'b',
    solution: [{ move: 'b8c6', alternatives: ['g8f6'] }],
    goal: 'Il cavallo in c6 difende il pedone e5 attaccato e controlla la casa centrale d4.',
    watchOut:
      'Il cavallo bianco in f3 attacca e5: la minaccia va parata, meglio se con una mossa di sviluppo.',
    explanation:
      '2…Cc6 difende e5 sviluppando un pezzo. Anche 2…Cf6 è corretta: sviluppa un cavallo e contrattacca il pedone e4.',
    hints: [
      'Il pedone e5 è attaccato: puoi difenderlo e sviluppare un pezzo con la stessa mossa.',
      'Un cavallo può arrivare a difendere e5 in una sola mossa.',
    ],
    question: {
      prompt: 'Qual è il vantaggio di difendere e5 con 2…Cc6?',
      options: [
        { id: 'a', text: 'Si difende il pedone mettendo in gioco un pezzo nuovo.' },
        { id: 'b', text: 'Il cavallo in c6 non potrà mai essere attaccato.' },
        { id: 'c', text: 'Costringe il Bianco a cambiare le donne.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'develop-knights-a',
  },
  {
    id: 'develop-bishop-a',
    title: "L'alfiere italiano",
    category: 'openings',
    difficulty: 2,
    conceptId: 'develop-bishop',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    sideToMove: 'w',
    solution: [{ move: 'f1c4', alternatives: ['f1b5'] }],
    goal: "L'alfiere in c4 occupa la diagonale a2–g8, punta la casa f7 e libera la strada all'arrocco corto.",
    watchOut:
      "In e2 o d3 l'alfiere sarebbe passivo: in d3 bloccherebbe anche il pedone d2 e quindi l'altro alfiere.",
    explanation:
      "3.Ac4 (Partita Italiana) mette l'alfiere sulla diagonale più attiva. Anche 3.Ab5 (Partita Spagnola) è ottima: preme sul cavallo che difende e5.",
    hints: [
      "Dopo i cavalli tocca agli alfieri: scegli una diagonale lunga e libera.",
      "La casa f7 è difesa solo dal re nero: c'è una diagonale che la punta.",
    ],
    question: {
      prompt: "Perché l'alfiere sta bene in c4?",
      options: [
        { id: 'a', text: 'Perché da lì difende il pedone e4.' },
        { id: 'b', text: 'Occupa una diagonale aperta verso f7 e prepara l’arrocco.' },
        { id: 'c', text: 'Perché in c4 non può essere attaccato dai pedoni neri.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'develop-bishop-b',
  },
  {
    id: 'develop-bishop-b',
    title: "L'alfiere del Nero in c5",
    category: 'openings',
    difficulty: 2,
    conceptId: 'develop-bishop',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    sideToMove: 'b',
    solution: [{ move: 'f8c5', alternatives: ['f8e7'] }],
    goal: "L'alfiere in c5 occupa la diagonale a7–g1, controlla d4 e punta il pedone f2.",
    watchOut:
      "Anche il Bianco punta f7 con l'alfiere in c4: sviluppare in fretta serve anche a poter arroccare.",
    explanation:
      "3…Ac5 sviluppa l'alfiere sulla diagonale più attiva e prepara l'arrocco. La più prudente 3…Ae7 è ugualmente corretta.",
    hints: [
      "Il Bianco ha appena sviluppato il suo alfiere: puoi fare lo stesso con il tuo.",
      "Cerca la diagonale che controlla d4 e guarda verso f2.",
    ],
    question: {
      prompt: 'Che cosa hanno in comune Ac4 del Bianco e …Ac5 del Nero?',
      options: [
        { id: 'a', text: 'Entrambe attaccano direttamente la donna avversaria.' },
        { id: 'b', text: 'Entrambe servono a difendere il pedone centrale.' },
        { id: 'c', text: 'Entrambe mettono l’alfiere su una diagonale aperta verso il punto debole f7/f2.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'develop-bishop-a',
  },
  {
    id: 'castle-early-a',
    title: 'Arrocco corto del Bianco',
    category: 'openings',
    difficulty: 2,
    conceptId: 'castle-early',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
    sideToMove: 'w',
    solution: [{ move: 'e1g1' }],
    goal: "Con l'arrocco il re va in g1, dietro tre pedoni, e la torre arriva in f1, più vicina al centro.",
    watchOut:
      'Un re rimasto in e1 è esposto appena si aprono le colonne centrali. Si arrocca muovendo il re di due case.',
    explanation:
      "5.O-O: cavallo e alfiere sono già sviluppati, quindi è il momento di mettere il re al sicuro e attivare la torre.",
    hints: [
      'Tra re e torre non ci sono più pezzi: c’è una mossa speciale che sistema entrambi.',
      'Muovi il re di due case verso la torre.',
    ],
    question: {
      prompt: "Qual è lo scopo principale dell'arrocco?",
      options: [
        { id: 'a', text: 'Mettere il re al sicuro e portare la torre in gioco.' },
        { id: 'b', text: 'Attaccare subito il re avversario.' },
        { id: 'c', text: 'Guadagnare un tempo sul cavallo avversario.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'castle-early-b',
    expect: 'castle',
  },
  {
    id: 'castle-early-b',
    title: 'Arrocco del Nero nella Spagnola',
    category: 'openings',
    difficulty: 2,
    conceptId: 'castle-early',
    fen: 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 7',
    sideToMove: 'b',
    solution: [{ move: 'e8g8' }],
    goal: 'Il re nero va in g8 al riparo e la torre entra in gioco in f8.',
    watchOut:
      "La torre bianca è già in e1: se la colonna «e» si apre, un re nero rimasto al centro sarebbe in pericolo.",
    explanation:
      "7…O-O completa lo sviluppo dell'ala di re. Il Bianco ha già arroccato e messo la torre in e1: il Nero non deve restare indietro.",
    hints: [
      'Il Bianco ha già messo al sicuro il re. E il tuo?',
      'Cavallo e alfiere di re sono sviluppati: re e torre possono scambiarsi di posto.',
    ],
    question: {
      prompt: 'Perché il Nero non dovrebbe rimandare ancora l’arrocco?',
      options: [
        { id: 'a', text: 'Perché dopo dieci mosse l’arrocco non è più permesso.' },
        { id: 'b', text: 'Perché la torre bianca in e1 è già puntata verso il re al centro.' },
        { id: 'c', text: 'Perché arroccando cattura un pedone.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'castle-early-a',
    expect: 'castle',
  },
  {
    id: 'defend-f7-a',
    title: 'Fermare il matto del barbiere',
    category: 'openings',
    difficulty: 2,
    conceptId: 'defend-f7',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    solution: [{ move: 'g7g6', alternatives: ['d8e7', 'd8f6'] }],
    goal: 'Il pedone in g6 chiude la linea della donna verso f7 e la attacca, guadagnando un tempo.',
    watchOut: 'Donna in h5 e alfiere in c4 attaccano insieme f7: il Bianco minaccia Dxf7 scacco matto.',
    explanation:
      '3…g6 para il matto attaccando la donna. Funzionano anche 3…De7 e 3…Df6, che aggiungono un difensore a f7.',
    hints: [
      'Guarda dove puntano insieme la donna e l’alfiere del Bianco.',
      'Puoi chiudere la linea della donna con un pedone, attaccandola.',
    ],
    question: {
      prompt: 'Che cosa minacciava il Bianco?',
      options: [
        { id: 'a', text: 'Di catturare il pedone e5 con scacco.' },
        { id: 'b', text: 'Di catturare il cavallo c6.' },
        { id: 'c', text: 'Dxf7 scacco matto: la donna sarebbe protetta dall’alfiere.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'defend-f7-b',
  },
  {
    id: 'defend-f7-b',
    title: 'La stessa minaccia da f3',
    category: 'openings',
    difficulty: 2,
    conceptId: 'defend-f7',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    sideToMove: 'b',
    solution: [{ move: 'g8f6', alternatives: ['d8f6', 'd8e7'] }],
    goal: 'Il cavallo in f6 chiude la colonna «f» alla donna bianca e intanto si sviluppa.',
    watchOut: 'La donna in f3 e l’alfiere in c4 puntano ancora f7: senza difesa, Dxf7 è matto.',
    explanation:
      '3…Cf6 è la parata migliore perché sviluppa un pezzo. Anche 3…Df6 e 3…De7 difendono f7.',
    hints: [
      'La donna bianca ha cambiato casa, ma il bersaglio è lo stesso.',
      'Un pezzo non ancora sviluppato può mettersi tra la donna e f7.',
    ],
    question: {
      prompt: 'Perché 3…Cf6 è la parata migliore?',
      options: [
        { id: 'a', text: 'Para la minaccia e sviluppa un pezzo nello stesso tempo.' },
        { id: 'b', text: 'Perché attacca la donna bianca.' },
        { id: 'c', text: 'Perché prepara la cattura dell’alfiere c4.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'defend-f7-a',
  },
  {
    id: 'prepare-center-a',
    title: 'Italiana: c3 e poi d4',
    category: 'openings',
    difficulty: 4,
    conceptId: 'prepare-center',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    sideToMove: 'w',
    solution: [{ move: 'c2c3', reply: 'g8f6' }, { move: 'd2d4' }],
    goal: 'Il pedone c3 sostiene la spinta d4: dopo …exd4 il Bianco riprende con cxd4 e mantiene due pedoni al centro.',
    watchOut:
      'La casa d4 è controllata da pedone e5, cavallo c6 e alfiere c5: una spinta d4 immediata costerebbe un pedone.',
    explanation:
      '4.c3 Cf6 5.d4: il Bianco conquista il centro guadagnando un tempo sull’alfiere c5. Senza c3 la spinta d4 perderebbe semplicemente un pedone.',
    hints: [
      'La spinta d4 è il tuo obiettivo, ma la casa d4 è attaccata tre volte: va preparata.',
      'Un pedone vicino può sostenere la casa d4.',
    ],
    question: {
      prompt: 'A che cosa serve la mossa 4.c3?',
      options: [
        { id: 'a', text: 'A sviluppare la donna in b3.' },
        { id: 'b', text: 'A sostenere d4 per poter riprendere di pedone e tenere il centro.' },
        { id: 'c', text: 'A impedire l’arrocco del Nero.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'prepare-center-b',
  },
  {
    id: 'prepare-center-b',
    title: 'Spagnola: prima c3',
    category: 'openings',
    difficulty: 4,
    conceptId: 'prepare-center',
    fen: 'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq - 0 8',
    sideToMove: 'w',
    solution: [{ move: 'c2c3' }],
    goal: 'Il pedone c3 prepara d4 e apre all’alfiere b3 la casa di ritirata c2.',
    watchOut:
      'La spinta immediata 8.d4 cade in una trappola nota: dopo i cambi in d4 il Nero gioca …c5 e …c4 e intrappola l’alfiere b3.',
    explanation:
      '8.c3 è la mossa principale della Spagnola chiusa: sostiene d4 e dà all’alfiere la casa c2. L’immediata 8.d4 permetterebbe la «trappola dell’arca di Noè».',
    hints: [
      'Vuoi giocare d4, ma prima serve una mossa di preparazione.',
      'Lo stesso pedone che sostiene d4 libera anche una casa per l’alfiere b3.',
    ],
    question: {
      prompt: 'Perché nella Spagnola si gioca c3 prima di d4?',
      options: [
        { id: 'a', text: 'Per poter sviluppare il cavallo b1 in c3.' },
        { id: 'b', text: 'Per attaccare il pedone b5.' },
        { id: 'c', text: 'Per sostenere d4 e dare all’alfiere una ritirata in c2.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'prepare-center-a',
  },
];
