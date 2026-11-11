import type { Exercise } from '../../types';

export const CALCULATION_EXERCISES: readonly Exercise[] = [
  {
    id: 'count-exchange-a',
    title: 'Due attaccanti, un difensore',
    category: 'calculation',
    difficulty: 3,
    conceptId: 'count-exchange',
    fen: 'r4rk1/ppp2ppp/5n2/3p4/8/2N5/PPP2PPP/3R1RK1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'c3d5', reply: 'f6d5' }, { move: 'd1d5' }],
    goal: 'Il pedone d5 è attaccato da cavallo e torre e difeso solo dal cavallo f6: la serie di catture guadagna un pedone.',
    watchOut:
      'L’ordine conta: iniziando con la torre (Txd5, Cxd5, Cxd5) il Bianco darebbe una torre per cavallo e pedone.',
    explanation:
      '1.Cxd5 Cxd5 2.Txd5: due attaccanti contro un difensore. Catturando prima con il pezzo di minor valore il Bianco resta con un pedone in più.',
    hints: [
      'Conta i pezzi che attaccano d5 e quelli che la difendono.',
      'Inizia la serie di catture con il pezzo che vale meno.',
    ],
    question: {
      prompt: 'Perché si cattura prima con il cavallo e non con la torre?',
      options: [
        { id: 'a', text: 'Perché il cavallo dà scacco.' },
        { id: 'b', text: 'Perché, se viene ripreso, si perde il pezzo di minor valore e la torre conclude lo scambio.' },
        { id: 'c', text: 'Perché la torre non può catturare i pedoni.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'count-exchange-b',
    expect: 'capture',
  },
  {
    id: 'count-exchange-b',
    title: 'Il pedone e4 è poco difeso',
    category: 'calculation',
    difficulty: 3,
    conceptId: 'count-exchange',
    fen: '4r1k1/ppp2pp1/5n1p/8/4P3/2N5/PPP2PPP/3R2K1 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'f6e4', reply: 'c3e4' }, { move: 'e8e4' }],
    goal: 'Il pedone e4 è attaccato da cavallo e torre e difeso soltanto dal cavallo c3.',
    watchOut: 'Prima di catturare controlla il tuo re: grazie al pedone in h6 non c’è pericolo di matto del corridoio.',
    explanation:
      '1…Cxe4 2.Cxe4 Txe4: due attaccanti contro un difensore, il Nero guadagna un pedone.',
    hints: [
      'C’è un pedone bianco attaccato due volte: quante volte è difeso?',
      'Cattura per primo con il pezzo di minor valore.',
    ],
    question: {
      prompt: 'Quando una cattura su una casa difesa guadagna materiale?',
      options: [
        { id: 'a', text: 'Quando gli attaccanti sono più numerosi dei difensori.' },
        { id: 'b', text: 'Quando si cattura con il pezzo di maggior valore.' },
        { id: 'c', text: 'Sempre, se si cattura per primi.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'count-exchange-a',
    expect: 'capture',
  },
  {
    id: 'mate-in-two-a',
    title: 'Sacrificio di donna sul corridoio',
    category: 'calculation',
    difficulty: 4,
    conceptId: 'mate-in-two',
    fen: 'r5k1/5ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'd2d8', reply: 'a8d8' }, { move: 'd1d8' }],
    goal: 'La donna dà scacco in d8: la torre nera è costretta a catturarla e abbandona la difesa dell’ottava traversa.',
    watchOut: 'Il re nero non ha case di fuga: l’unico difensore dell’ultima traversa è la torre a8.',
    explanation:
      '1.Dd8+! Txd8 2.Txd8#: il sacrificio elimina l’unico difensore. La risposta del Nero è obbligata, quindi la variante si calcola fino in fondo.',
    hints: [
      'Il re nero è chiuso dai suoi pedoni: chi difende l’ottava traversa?',
      'Uno scacco con sacrificio costringe quel difensore a spostarsi.',
    ],
    question: {
      prompt: 'Perché il sacrificio di donna funziona?',
      options: [
        { id: 'a', text: 'Perché il Nero può rifiutarlo ma perde la torre.' },
        { id: 'b', text: 'Perché la donna vale meno della torre.' },
        { id: 'c', text: 'Perché la risposta è forzata e la torre che riprende dà matto.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'mate-in-two-b',
    expect: 'checkmate',
  },
  {
    id: 'mate-in-two-b',
    title: 'Matto affogato',
    category: 'calculation',
    difficulty: 4,
    conceptId: 'mate-in-two',
    fen: '5r1k/6pp/7N/8/8/1Q6/6PP/6K1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'b3g8', reply: 'f8g8' }, { move: 'h6f7' }],
    goal: 'La donna si sacrifica in g8 con scacco: il re non può prenderla (il cavallo h6 la protegge), deve farlo la torre.',
    watchOut: 'Dopo …Txg8 il re nero è circondato dai propri pezzi: basta uno scacco di cavallo.',
    explanation:
      '1.Dg8+! Txg8 2.Cf7#: il «matto affogato». Il sacrificio costringe la torre a occupare l’ultima casa libera accanto al re.',
    hints: [
      'Calcola prima gli scacchi, anche quelli che sembrano regalare la donna.',
      'Se il re nero non avesse più case, a quale pezzo basterebbe uno scacco?',
    ],
    question: {
      prompt: 'Qual è lo scopo del sacrificio in g8?',
      options: [
        { id: 'a', text: 'Guadagnare la torre f8.' },
        { id: 'b', text: 'Costringere la torre a togliere al re l’ultima casa di fuga.' },
        { id: 'c', text: 'Portare la donna vicino al re bianco.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'mate-in-two-a',
    expect: 'checkmate',
  },
  {
    id: 'pawn-breakthrough-a',
    title: 'Tre contro tre',
    category: 'calculation',
    difficulty: 5,
    conceptId: 'pawn-breakthrough',
    fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
    sideToMove: 'w',
    solution: [
      { move: 'b5b6', reply: 'c7b6' },
      { move: 'a5a6', reply: 'b7a6' },
      { move: 'c5c6' },
    ],
    goal: 'Il pedone centrale avanza e si offre: comunque il Nero catturi, un secondo sacrificio libera un pedone bianco.',
    watchOut:
      'Se il Nero cattura con il pedone «a» (1…axb6) il secondo sacrificio va fatto dall’altra parte: 2.c6!',
    explanation:
      '1.b6! cxb6 2.a6! bxa6 3.c6: il pedone «c» non può più essere fermato e i re sono troppo lontani. I pedoni neri vengono deviati uno dopo l’altro.',
    hints: [
      'Nessun pedone può passare da solo: bisogna deviare i pedoni neri con dei sacrifici.',
      'Comincia dal pedone di mezzo.',
    ],
    question: {
      prompt: 'Dopo 1.b6 cxb6, perché il Bianco gioca 2.a6?',
      options: [
        { id: 'a', text: 'Per deviare il pedone b7 e liberare la strada al pedone «c».' },
        { id: 'b', text: 'Per riprendere il pedone perso.' },
        { id: 'c', text: 'Per dare scacco al re nero.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'pawn-breakthrough-b',
  },
  {
    id: 'pawn-breakthrough-b',
    title: 'Sfondamento sull’ala di re',
    category: 'calculation',
    difficulty: 5,
    conceptId: 'pawn-breakthrough',
    fen: '7k/8/8/8/5ppp/8/5PPP/K7 b - - 0 1',
    sideToMove: 'b',
    solution: [
      { move: 'g4g3', reply: 'h2g3' },
      { move: 'f4f3', reply: 'g2f3' },
      { move: 'h4h3' },
    ],
    goal: 'Il pedone centrale nero avanza in g3 e costringe uno dei pedoni bianchi a lasciare la propria colonna.',
    watchOut: 'Se il Bianco cattura con l’altro pedone (2.fxg3) il secondo sacrificio cambia lato: 2…h3!',
    explanation:
      '1…g3! 2.hxg3 f3! 3.gxf3 h3: il pedone «h» corre a promozione e il re bianco in a1 è troppo lontano.',
    hints: [
      'È la stessa struttura di tre pedoni contro tre, vista dal lato del Nero.',
      'Il primo sacrificio spetta al pedone di mezzo.',
    ],
    question: {
      prompt: 'Qual è la condizione indispensabile perché lo sfondamento vinca?',
      options: [
        { id: 'a', text: 'Avere un pedone in più.' },
        { id: 'b', text: 'Che i propri pedoni siano sulla seconda traversa.' },
        { id: 'c', text: 'Che il re avversario sia troppo lontano per fermare il pedone passato.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'pawn-breakthrough-a',
  },
  {
    id: 'legal-mate-a',
    title: 'Il matto di Legal',
    category: 'calculation',
    difficulty: 5,
    conceptId: 'legal-mate',
    fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
    sideToMove: 'w',
    solution: [
      { move: 'f3e5', reply: 'g4d1' },
      { move: 'c4f7', reply: 'e8e7' },
      { move: 'c3d5' },
    ],
    goal: 'Il cavallo cattura in e5 lasciando la donna in presa: se l’alfiere la cattura, alfiere e cavalli danno matto.',
    watchOut:
      'Il sacrificio va calcolato in ogni variante: se il Nero riprende 5…dxe5, il Bianco gioca 6.Dxg4 e resta con un pedone in più.',
    explanation:
      '5.Cxe5! Axd1? 6.Axf7+ Re7 7.Cd5#. Il cavallo f3 sembrava inchiodato, ma l’inchiodatura sulla donna non è assoluta.',
    hints: [
      'Il tuo cavallo sembra inchiodato sulla donna, ma può muoversi lo stesso: che cosa minaccerebbe?',
      'Alfiere e cavalli puntano le case attorno al re nero: f7 è la più debole.',
    ],
    question: {
      prompt: 'Perché il cavallo f3 può muoversi pur essendo «inchiodato»?',
      options: [
        { id: 'a', text: 'Perché l’alfiere g4 non è difeso da nessuno.' },
        { id: 'b', text: 'Perché l’inchiodatura è sulla donna, non sul re: muoversi è legale e le minacce create valgono di più.' },
        { id: 'c', text: 'Perché la donna bianca è protetta due volte.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'legal-mate-b',
    expect: 'checkmate',
  },
  {
    id: 'legal-mate-b',
    title: 'Legal con l’alfiere in h5',
    category: 'calculation',
    difficulty: 5,
    conceptId: 'legal-mate',
    fen: 'r2qkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6',
    sideToMove: 'w',
    solution: [
      { move: 'f3e5', reply: 'h5d1' },
      { move: 'c4f7', reply: 'e8e7' },
      { move: 'c3d5' },
    ],
    goal: 'Stessa combinazione: il cavallo cattura in e5 e, se il Nero prende la donna, segue il matto con i tre pezzi leggeri.',
    watchOut:
      'Qui il Nero può riprendere 6…Cxe5: dopo 7.Dxh5 Cxc4 8.Db5+ il Bianco recupera il pezzo e resta con un pedone in più.',
    explanation:
      '6.Cxe5! Axd1? 7.Axf7+ Re7 8.Cd5#. L’alfiere in h5 non è difeso: per questo il sacrificio funziona anche se il Nero non prende la donna.',
    hints: [
      'Riconosci lo schema: alfiere in c4, cavalli in c3 e f3, alfiere nero che «inchioda» il cavallo.',
      'Il primo colpo è una cattura al centro con il cavallo.',
    ],
    question: {
      prompt: 'Che cosa deve verificare il Bianco prima di sacrificare?',
      options: [
        { id: 'a', text: 'Di ottenere un vantaggio anche se il Nero non cattura la donna.' },
        { id: 'b', text: 'Che il Nero abbia già arroccato.' },
        { id: 'c', text: 'Che la propria donna sia difesa dal re.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'legal-mate-a',
    expect: 'checkmate',
  },
];
