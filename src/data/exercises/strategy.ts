import type { Exercise } from '../../types';

export const STRATEGY_EXERCISES: readonly Exercise[] = [
  {
    id: 'passed-pawn-a',
    title: 'Corsa verso la promozione',
    category: 'strategy',
    difficulty: 2,
    conceptId: 'passed-pawn',
    fen: '8/5kpp/8/P7/8/8/6PP/6K1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'a5a6' }],
    goal: 'Il pedone «a» non ha pedoni neri davanti né sulle colonne vicine: avanzando si avvicina alla promozione.',
    watchOut: 'Il re nero in f7 è troppo lontano: non riesce a raggiungere la colonna «a» in tempo.',
    explanation:
      '1.a6: il pedone promuove in tre mosse (a6, a7, a8) e il re nero, partendo da f7, non riesce ad avvicinarsi abbastanza. Ogni tempo perso lo aiuterebbe.',
    hints: [
      'Uno dei tuoi pedoni non ha alcun pedone avversario che possa fermarlo.',
      'Confronta le mosse che servono al pedone per promuovere con quelle che servono al re nero per raggiungerlo.',
    ],
    question: {
      prompt: 'Che cos’è un pedone passato?',
      options: [
        { id: 'a', text: 'Un pedone che ha già superato la metà della scacchiera.' },
        { id: 'b', text: 'Un pedone che nessun pedone avversario può più bloccare o catturare.' },
        { id: 'c', text: 'Un pedone difeso da un altro pedone.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'passed-pawn-b',
  },
  {
    id: 'passed-pawn-b',
    title: 'Il pedone passato del Nero',
    category: 'strategy',
    difficulty: 2,
    conceptId: 'passed-pawn',
    fen: '6k1/6pp/8/8/8/p7/5KPP/8 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'a3a2' }],
    goal: 'Il pedone nero in a3 è a due passi dalla promozione e nessun pedone bianco può fermarlo.',
    watchOut: 'Il re bianco in f2 prova ad avvicinarsi: ogni mossa di attesa gli regalerebbe un tempo.',
    explanation:
      '1…a2 e alla mossa successiva …a1=D: il re bianco arriva soltanto in e2. Il pedone passato va spinto subito.',
    hints: [
      'Guarda il lato di donna: lì hai un pedone che nessuno può fermare.',
      'Il re bianco è lontano dalla colonna «a»: quante mosse gli servirebbero per arrivarci?',
    ],
    question: {
      prompt: 'Perché non conviene perdere tempo con altre mosse?',
      options: [
        { id: 'a', text: 'Perché il re avversario si avvicinerebbe al pedone.' },
        { id: 'b', text: 'Perché il pedone può muovere solo per un numero limitato di turni.' },
        { id: 'c', text: 'Perché il Bianco potrebbe arroccare.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'passed-pawn-a',
  },
  {
    id: 'rook-open-file-a',
    title: 'La colonna «d» è aperta',
    category: 'strategy',
    difficulty: 2,
    conceptId: 'rook-open-file',
    fen: 'r4rk1/ppp2ppp/2n2n2/4p3/4P3/2N2N2/PPP2PPP/R4RK1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'a1d1', alternatives: ['f1d1'] }],
    goal: 'La torre in d1 occupa l’unica colonna senza pedoni e da lì può entrare nel campo nero.',
    watchOut: 'Anche il Nero vorrebbe la colonna «d»: chi la occupa per primo costringe l’altro a contenderla.',
    explanation:
      '1.Tad1 (o 1.Tfd1): sulla colonna aperta la torre controlla d7 e d8 e minaccia di penetrare. Dietro i propri pedoni non farebbe nulla.',
    hints: [
      'Le torri lavorano bene solo sulle colonne libere dai pedoni.',
      'Cerca la colonna su cui non c’è nessun pedone, né bianco né nero.',
    ],
    question: {
      prompt: 'Perché la torre va sulla colonna «d»?',
      options: [
        { id: 'a', text: 'Per difendere il pedone e4.' },
        { id: 'b', text: 'Per preparare l’arrocco lungo.' },
        { id: 'c', text: 'Perché è senza pedoni e la torre può agire fino in fondo alla scacchiera.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'rook-open-file-b',
  },
  {
    id: 'rook-open-file-b',
    title: 'La colonna «c» per il Nero',
    category: 'strategy',
    difficulty: 2,
    conceptId: 'rook-open-file',
    fen: 'r4rk1/pp3ppp/4pn2/3p4/3P4/4PN2/PP3PPP/R4RK1 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'f8c8', alternatives: ['a8c8'] }],
    goal: 'La torre in c8 prende il controllo della colonna «c», l’unica senza pedoni.',
    watchOut: 'Il centro è bloccato dai pedoni d4 e d5: il gioco si decide sulla colonna aperta.',
    explanation:
      '1…Tfc8 (o 1…Tac8): la torre controlla la colonna e punta la casa d’ingresso c2.',
    hints: [
      'Dove sono stati cambiati i pedoni? Lì c’è una strada per le torri.',
      'Una delle tue torri può occupare subito la colonna senza pedoni.',
    ],
    question: {
      prompt: 'Come si riconosce una colonna aperta?',
      options: [
        { id: 'a', text: 'Non contiene pedoni di nessuno dei due colori.' },
        { id: 'b', text: 'Contiene almeno un pedone avversario da attaccare.' },
        { id: 'c', text: 'È sempre una delle due colonne centrali.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'rook-open-file-a',
  },
  {
    id: 'rook-seventh-a',
    title: 'La torre entra in settima',
    category: 'strategy',
    difficulty: 3,
    conceptId: 'rook-seventh',
    fen: 'r5k1/pp3pp1/7p/8/8/8/PP3PPP/3R2K1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'd1d7' }],
    goal: 'In d7 la torre attacca il pedone b7 e tiene sotto pressione f7, lungo tutta la settima traversa.',
    watchOut: 'Uno scacco in d8 non porta a nulla: il re nero ha la casa di fuga h7.',
    explanation:
      '1.Td7: la torre attacca i pedoni sulla loro traversa di partenza, dove non possono difendersi a vicenda. La torre nera è costretta a una difesa passiva, ad esempio in b8.',
    hints: [
      'I pedoni neri sono quasi tutti sulla stessa traversa.',
      'La torre può arrivare in una casa da cui li attacca di fianco.',
    ],
    question: {
      prompt: 'Perché la settima traversa è così forte per una torre?',
      options: [
        { id: 'a', text: 'Perché da lì la torre può promuovere.' },
        { id: 'b', text: 'Perché attacca di fianco i pedoni non ancora mossi e limita il re.' },
        { id: 'c', text: 'Perché lì non può essere attaccata.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'rook-seventh-b',
  },
  {
    id: 'rook-seventh-b',
    title: 'La «settima» del Nero',
    category: 'strategy',
    difficulty: 3,
    conceptId: 'rook-seventh',
    fen: '3r2k1/pp3ppp/8/8/8/7P/PP3PP1/5RK1 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'd8d2' }],
    goal: 'In d2 la torre nera attacca il pedone b2 e preme su f2, lungo la seconda traversa.',
    watchOut: 'La torre bianca difende la prima traversa: lo scacco in d1 porterebbe solo al cambio delle torri.',
    explanation:
      '1…Td2: per il Nero la «settima» è la seconda traversa. La torre attacca b2 e costringe il Bianco alla difesa passiva.',
    hints: [
      'Per il Nero la traversa dei pedoni avversari è la seconda.',
      'La torre ha una colonna libera per scendere fino ai pedoni bianchi.',
    ],
    question: {
      prompt: 'Qual è, per il Nero, la traversa equivalente alla settima?',
      options: [
        { id: 'a', text: 'L’ottava traversa.' },
        { id: 'b', text: 'La prima traversa.' },
        { id: 'c', text: 'La seconda traversa, dove partono i pedoni bianchi.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'rook-seventh-a',
  },
  {
    id: 'outpost-a',
    title: 'Il cavallo in d5',
    category: 'strategy',
    difficulty: 4,
    conceptId: 'outpost',
    fen: 'r2q1rk1/pp2bppp/3p4/4p3/4P3/2N5/PPP2PPP/R2Q1RK1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'c3d5' }],
    goal: 'In d5 il cavallo è sostenuto dal pedone e4 e nessun pedone nero può più attaccarlo.',
    watchOut:
      'Il Nero non ha più i pedoni «c» ed «e» per controllare d5, e il suo alfiere e7 è chiuso dai propri pedoni.',
    explanation:
      '1.Cd5: il cavallo occupa un avamposto permanente, attacca l’alfiere e7 e domina la posizione. È il classico «cavallo buono contro alfiere cattivo».',
    hints: [
      'Cerca una casa avanzata che i pedoni neri non possono più controllare.',
      'Il pedone e4 sostiene una casa nel campo avversario.',
    ],
    question: {
      prompt: 'Che cosa rende d5 un avamposto?',
      options: [
        { id: 'a', text: 'È sostenuta da un pedone bianco e nessun pedone nero può attaccarla.' },
        { id: 'b', text: 'È una casa di colore chiaro.' },
        { id: 'c', text: 'È vicina al re bianco.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'outpost-b',
  },
  {
    id: 'outpost-b',
    title: 'Il cavallo nero in d4',
    category: 'strategy',
    difficulty: 4,
    conceptId: 'outpost',
    fen: 'r2q1rk1/ppp2ppp/2n5/4p3/4P3/3P4/PP2BPPP/R2Q1RK1 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'c6d4' }],
    goal: 'In d4 il cavallo nero è sostenuto dal pedone e5 e non può essere scacciato da alcun pedone bianco.',
    watchOut: 'Il Bianco non ha più il pedone «c» e il pedone «e» è già avanzato: la casa d4 è indifendibile dai pedoni.',
    explanation:
      '1…Cd4: stesso principio a colori invertiti. Il cavallo centralizzato attacca l’alfiere e2 e domina il centro.',
    hints: [
      'Quali case centrali il Bianco non può più controllare con i pedoni?',
      'Il tuo pedone e5 sostiene una casa nel campo bianco.',
    ],
    question: {
      prompt: 'Perché il Bianco non può scacciare il cavallo da d4?',
      options: [
        { id: 'a', text: 'Perché il cavallo è inchiodato.' },
        { id: 'b', text: 'Perché non ha più pedoni sulle colonne «c» ed «e» capaci di attaccare d4.' },
        { id: 'c', text: 'Perché il re bianco è sotto scacco.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'outpost-a',
  },
];
