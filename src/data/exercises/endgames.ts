import type { Exercise } from '../../types';

/**
 * Finali: matti elementari, stallo, regola del quadrato, opposizione,
 * finali di torre e lo studio di Réti. Le mosse sono state controllate con
 * Stockfish: in ogni posizione la soluzione è l'unica che vince (o che
 * salva la patta), salvo le alternative indicate.
 */
export const ENDGAME_EXERCISES: readonly Exercise[] = [
  // ───── Matto con donna e re ─────
  {
    id: 'queen-mate-a',
    title: 'La donna appoggiata dal re',
    category: 'endgames',
    difficulty: 1,
    conceptId: 'queen-mate',
    fen: '6k1/Q7/5K2/8/8/8/8/8 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'a7g7' }],
    goal: 'In g7 la donna dà scacco accanto al re nero ed è difesa dal re bianco in f6: non può essere catturata.',
    watchOut: 'Uno scacco in a8 non basta: il re nero scappa in h7. La donna deve stare a contatto con il re, protetta.',
    explanation:
      '1.Dg7#: la donna controlla tutte le case intorno al re nero (f8, h8, f7, h7) e il re non può catturarla perché è difesa dal re bianco.',
    hints: [
      'Il tuo re in f6 controlla e7, f7 e g7.',
      'Porta la donna a contatto con il re nero su una casa difesa dal tuo re.',
    ],
    question: {
      prompt: 'Perché il re nero non può catturare la donna in g7?',
      options: [
        { id: 'a', text: 'Perché la donna è difesa dal re bianco in f6.' },
        { id: 'b', text: 'Perché il re non può mai catturare la donna.' },
        { id: 'c', text: 'Perché è il turno del Bianco.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'queen-mate-b',
    expect: 'checkmate',
  },
  {
    id: 'queen-mate-b',
    title: 'Il re bianco nell’angolo',
    category: 'endgames',
    difficulty: 1,
    conceptId: 'queen-mate',
    fen: '8/8/8/8/8/2k5/7q/1K6 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'h2b2' }],
    goal: 'In b2 la donna nera dà scacco a contatto con il re bianco ed è difesa dal re nero in c3.',
    watchOut: 'Uno scacco in h1 lascerebbe al re bianco la casa a2: cerca lo scacco che toglie tutte le fughe.',
    explanation:
      '1…Db2#: la donna controlla a1, a2, c1 e c2; il re bianco non può catturarla perché il re nero in c3 la protegge.',
    hints: [
      'Il re bianco è sul bordo, vicino all’angolo.',
      'Cerca una casa accanto al re bianco che sia difesa dal tuo re.',
    ],
    question: {
      prompt: 'Qual è la regola per dare matto con donna e re?',
      options: [
        { id: 'a', text: 'Dare scacco da lontano il più spesso possibile.' },
        { id: 'b', text: 'Spingere il re avversario sul bordo e dare scacco con la donna difesa dal proprio re.' },
        { id: 'c', text: 'Tenere il proprio re lontano dalla donna.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'queen-mate-a',
    expect: 'checkmate',
  },

  // ───── Matto con torre e re ─────
  {
    id: 'rook-mate-a',
    title: 'Re contro re, torre sul bordo',
    category: 'endgames',
    difficulty: 1,
    conceptId: 'rook-mate',
    fen: '3k4/8/3K4/8/8/8/8/7R w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'h1h8' }],
    goal: 'I re sono uno di fronte all’altro: il re bianco toglie c7, d7 ed e7, la torre dà scacco su tutta l’ottava traversa.',
    watchOut: 'Se il re bianco non fosse esattamente di fronte, il re nero avrebbe una casa di fuga in settima.',
    explanation:
      '1.Th8#: la torre controlla l’ottava traversa e il re bianco in d6 copre le case della settima. Il re nero non ha più mosse.',
    hints: [
      'Il re nero è sul bordo e il tuo re gli sta proprio davanti.',
      'La torre deve dare scacco lungo la traversa del re nero.',
    ],
    question: {
      prompt: 'Che compito ha il re bianco nel matto di torre?',
      options: [
        { id: 'a', text: 'Difende la torre dalle catture.' },
        { id: 'b', text: 'Toglie al re avversario le case della traversa davanti al bordo.' },
        { id: 'c', text: 'Nessuno: la torre dà matto da sola.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'rook-mate-b',
    expect: 'checkmate',
  },
  {
    id: 'rook-mate-b',
    title: 'Il Nero dà matto sulla prima traversa',
    category: 'endgames',
    difficulty: 1,
    conceptId: 'rook-mate',
    fen: 'r7/8/8/8/8/4k3/8/4K3 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'a8a1' }],
    goal: 'Il re nero in e3 è in opposizione al re bianco in e1 e gli toglie d2, e2 e f2: la torre chiude la prima traversa.',
    watchOut: 'La torre deve dare scacco da lontano: se si avvicinasse al re bianco potrebbe essere catturata.',
    explanation:
      '1…Ta1#: la torre dà scacco lungo la prima traversa, il re nero copre tutte le case della seconda. È la stessa figura del matto di torre, vista dal Nero.',
    hints: [
      'I due re si guardano sulla colonna «e» con una casa in mezzo.',
      'Porta la torre sulla traversa del re bianco.',
    ],
    question: {
      prompt: 'Dove deve trovarsi il re avversario per il matto con torre e re?',
      options: [
        { id: 'a', text: 'Al centro della scacchiera.' },
        { id: 'b', text: 'Su una casa nera.' },
        { id: 'c', text: 'Sul bordo, con il re attaccante davanti a lui.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'rook-mate-a',
    expect: 'checkmate',
  },

  // ───── Matto a scala con due torri ─────
  {
    id: 'two-rooks-mate-a',
    title: 'La scala delle torri',
    category: 'endgames',
    difficulty: 2,
    conceptId: 'two-rooks-mate',
    fen: '4k3/R7/8/8/8/8/8/1R4K1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'b1b8' }],
    goal: 'La torre in a7 chiude tutta la settima traversa: l’altra torre dà scacco sull’ottava.',
    watchOut: 'Il re nero è lontano da entrambe le torri: nessuna delle due può essere catturata.',
    explanation:
      '1.Tb8#: la torre a7 toglie al re nero la settima traversa e la torre b8 lo attacca sull’ottava. Le due torri si danno il cambio salendo come i pioli di una scala.',
    hints: [
      'Una torre sta già tagliando la settima traversa.',
      'L’altra torre deve dare scacco sulla traversa del re nero.',
    ],
    question: {
      prompt: 'Come funziona il matto a scala?',
      options: [
        { id: 'a', text: 'Le torri si mettono una accanto all’altra davanti al re.' },
        { id: 'b', text: 'Una torre taglia una traversa, l’altra dà scacco su quella successiva, e così via fino al bordo.' },
        { id: 'c', text: 'Le torri danno scacco solo sulle colonne.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'two-rooks-mate-b',
    expect: 'checkmate',
  },
  {
    id: 'two-rooks-mate-b',
    title: 'La scala verso la prima traversa',
    category: 'endgames',
    difficulty: 2,
    conceptId: 'two-rooks-mate',
    fen: '1r4k1/8/8/8/8/8/r7/4K3 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'b8b1' }],
    goal: 'La torre in a2 chiude la seconda traversa al re bianco: l’altra torre dà scacco sulla prima.',
    watchOut: 'Uno scacco con la torre a2 in a1 lascerebbe libera la seconda traversa: il re scapperebbe.',
    explanation:
      '1…Tb1#: la torre a2 taglia la seconda traversa, la torre b1 dà scacco sulla prima. Il re bianco non ha più case.',
    hints: [
      'Il re bianco è già sul bordo e una torre gli chiude la traversa davanti.',
      'Muovi l’altra torre per dare scacco sulla prima traversa.',
    ],
    question: {
      prompt: 'Serve il proprio re per dare matto con due torri?',
      options: [
        { id: 'a', text: 'Sì, deve sempre stare in opposizione.' },
        { id: 'b', text: 'Sì, deve difendere una delle due torri.' },
        { id: 'c', text: 'No, le due torri bastano se il re avversario è sul bordo.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'two-rooks-mate-a',
    expect: 'checkmate',
  },

  // ───── Attenzione allo stallo ─────
  {
    id: 'stalemate-trap-a',
    title: 'Matto, non stallo',
    category: 'endgames',
    difficulty: 2,
    conceptId: 'stalemate-trap',
    fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'g1g7' }],
    goal: 'La donna in g7 dà scacco ed è difesa dal re in f6: è matto.',
    watchOut: 'Attenzione a 1.Dg6?: il re nero non sarebbe sotto scacco ma non avrebbe mosse. È stallo e la partita finisce patta!',
    explanation:
      '1.Dg7#. Con 1.Dg6 il Bianco toglierebbe al re nero tutte le case senza dare scacco: stallo, patta. Prima di muovere, controlla sempre che il re avversario abbia una casa libera oppure che sia matto.',
    hints: [
      'Una mossa naturale qui darebbe stallo: il re nero resterebbe senza mosse ma senza scacco.',
      'La donna deve dare scacco su una casa difesa dal tuo re.',
    ],
    question: {
      prompt: 'Quando una partita finisce in stallo?',
      options: [
        { id: 'a', text: 'Quando un giocatore ha solo il re.' },
        { id: 'b', text: 'Quando chi deve muovere non ha mosse legali e il suo re non è sotto scacco.' },
        { id: 'c', text: 'Quando si ripete tre volte lo scacco.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'stalemate-trap-b',
    expect: 'checkmate',
  },
  {
    id: 'stalemate-trap-b',
    title: 'Il Nero non deve regalare la patta',
    category: 'endgames',
    difficulty: 2,
    conceptId: 'stalemate-trap',
    fen: '6q1/8/8/8/8/5k2/8/7K b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'g8g2' }],
    goal: 'La donna in g2 dà scacco al re bianco ed è difesa dal re nero in f3: matto.',
    watchOut: '1…Dg3? toglierebbe al re bianco le case g1, g2 e h2 senza scacco: sarebbe stallo.',
    explanation:
      '1…Dg2#. La mossa «stringente» 1…Dg3 sembra forte ma lascia il Bianco senza mosse legali e senza scacco: stallo. Con tanto materiale di vantaggio lo stallo è l’unico modo di non vincere.',
    hints: [
      'Controlla quali mosse lascerebbero il re bianco senza case ma non sotto scacco.',
      'La donna può dare scacco a contatto, difesa dal tuo re.',
    ],
    question: {
      prompt: 'Che cosa conviene controllare prima di ogni mossa quando si è in forte vantaggio?',
      options: [
        { id: 'a', text: 'Che il re avversario abbia ancora una mossa, oppure che la mossa sia matto.' },
        { id: 'b', text: 'Di avere sempre la donna al centro.' },
        { id: 'c', text: 'Di dare scacco a ogni mossa.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'stalemate-trap-a',
    expect: 'checkmate',
  },

  // ───── La regola del quadrato ─────
  {
    id: 'square-rule-a',
    title: 'Entrare nel quadrato',
    category: 'endgames',
    difficulty: 2,
    conceptId: 'square-rule',
    fen: '7k/8/5K2/p7/8/8/8/8 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'f6e5' }],
    goal: 'Il quadrato del pedone a5 va da a5 ad a1 ed e1 fino a e5: il re bianco in e5 vi entra e raggiunge il pedone in tempo.',
    watchOut: 'Ogni altra mossa resta fuori dal quadrato: il pedone arriverebbe in a1 prima del re.',
    explanation:
      '1.Re5! a4 2.Rd4 a3 3.Rc3 a2 4.Rb2 e il pedone cade: patta. Con 1.Re7 o 1.Rf5 il re resterebbe fuori dal quadrato e il pedone promuoverebbe.',
    hints: [
      'Disegna un quadrato con un lato che va dal pedone a5 alla casa di promozione a1.',
      'Il tuo re deve entrare in quel quadrato con questa mossa.',
    ],
    question: {
      prompt: 'Che cosa dice la regola del quadrato?',
      options: [
        { id: 'a', text: 'Se il re entra nel quadrato del pedone, lo raggiunge prima che promuova.' },
        { id: 'b', text: 'Il re deve sempre restare al centro della scacchiera.' },
        { id: 'c', text: 'Un pedone sul bordo non può mai essere fermato.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'square-rule-b',
  },
  {
    id: 'square-rule-b',
    title: 'Il Nero insegue il pedone h',
    category: 'endgames',
    difficulty: 2,
    conceptId: 'square-rule',
    fen: '8/8/8/8/7P/2k5/8/K7 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'c3d4' }],
    goal: 'Il quadrato del pedone h4 va da h4 a h8, d8 e d4: con Rd4 il re nero ci entra.',
    watchOut: 'Il re bianco è troppo lontano per aiutare: basta raggiungere il pedone in tempo.',
    explanation:
      '1…Rd4! 2.h5 Re5 3.h6 Rf6 4.h7 Rg7 e il pedone cade. 1…Rc4 o 1…Rd3 restano fuori dal quadrato: il pedone promuoverebbe.',
    hints: [
      'Conta le mosse che servono al pedone per promuovere e disegna il quadrato.',
      'Una sola casa vicina al tuo re è dentro il quadrato.',
    ],
    question: {
      prompt: 'Come si disegna il quadrato di un pedone?',
      options: [
        { id: 'a', text: 'Dal pedone fino al re avversario.' },
        { id: 'b', text: 'Con un lato che va dal pedone alla sua casa di promozione.' },
        { id: 'c', text: 'Con le quattro case centrali.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'square-rule-a',
  },

  // ───── Opposizione ─────
  {
    id: 'opposition-a',
    title: 'Prendere l’opposizione davanti al pedone',
    category: 'endgames',
    difficulty: 3,
    conceptId: 'opposition',
    fen: '8/8/4k3/8/3K4/4P3/8/8 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'd4e4' }],
    goal: 'In e4 il re bianco sta di fronte al re nero (e6) con una casa in mezzo: ora tocca al Nero cedere il passo.',
    watchOut: 'Con la spinta e4 o con altre mosse di re, il Bianco perde l’opposizione e la partita è patta.',
    explanation:
      '1.Re4! Rf6 2.Rd5 Re7 3.Re5: il re bianco avanza davanti al pedone e conquista le case chiave. Il pedone resta indietro come riserva di tempo. Con 1.e4? Rd6 il Nero prende l’opposizione e pareggia.',
    hints: [
      'Nei finali di pedoni il re deve andare davanti al pedone.',
      'Metti il tuo re sulla stessa colonna del re nero con una sola casa in mezzo.',
    ],
    question: {
      prompt: 'Che cosa significa «avere l’opposizione»?',
      options: [
        { id: 'a', text: 'Avere più pedoni dell’avversario.' },
        { id: 'b', text: 'Avere il re più vicino al centro.' },
        { id: 'c', text: 'I re sono di fronte con una casa in mezzo ed è l’altro a dover muovere.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'opposition-b',
  },
  {
    id: 'opposition-b',
    title: 'Il Nero difende con l’opposizione',
    category: 'endgames',
    difficulty: 3,
    conceptId: 'opposition',
    fen: '8/8/8/4k3/8/4PK2/8/8 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'e5f5' }],
    goal: 'In f5 il re nero sta di fronte al re bianco (f3): il Bianco non riesce ad avanzare.',
    watchOut: 'Ogni altra mossa permette al re bianco di avanzare (Rf4 o Re4) e il pedone vince.',
    explanation:
      '1…Rf5! Il Nero prende l’opposizione: se 2.Re2 Re4 o 2.Rg3 Re4, il re nero resta davanti al pedone. Con 1…Rd5? 2.Rf4 il re bianco passa e vince.',
    hints: [
      'Il re bianco vuole avanzare davanti al suo pedone.',
      'Mettiti esattamente di fronte al re bianco, con una casa in mezzo.',
    ],
    question: {
      prompt: 'Perché l’opposizione aiuta chi difende?',
      options: [
        { id: 'a', text: 'Perché costringe il re attaccante a cedere il passo, senza poter avanzare.' },
        { id: 'b', text: 'Perché permette di catturare subito il pedone.' },
        { id: 'c', text: 'Perché obbliga l’avversario a promuovere a cavallo.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'opposition-a',
  },

  // ───── Pedone di torre ─────
  {
    id: 'rook-pawn-corner-a',
    title: 'Verso h8',
    category: 'endgames',
    difficulty: 3,
    conceptId: 'rook-pawn-corner',
    fen: '8/4k3/8/5K1P/8/8/8/8 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'e7f7', alternatives: ['e7f8', 'e7e8'] }],
    goal: 'Il re nero corre verso l’angolo h8, davanti al pedone di torre: da lì non può essere scacciato.',
    watchOut: 'Se il re nero si allontana dall’angolo (ad esempio in d6), il pedone promuove.',
    explanation:
      '1…Rf7 (oppure 1…Rf8 o 1…Re8): il re raggiunge g8 e h8. Con il pedone «h» il re bianco non può cacciarlo dall’angolo senza dare stallo: patta.',
    hints: [
      'Contro il pedone di torre basta arrivare nell’angolo di promozione.',
      'Avvicina il re alla casa h8.',
    ],
    question: {
      prompt: 'Perché re e pedone di torre contro re è spesso patta?',
      options: [
        { id: 'a', text: 'Perché il pedone di torre non può promuovere a donna.' },
        { id: 'b', text: 'Perché il re difensore nell’angolo non può essere scacciato senza dare stallo.' },
        { id: 'c', text: 'Perché il re attaccante non può avvicinarsi al bordo.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'rook-pawn-corner-b',
  },
  {
    id: 'rook-pawn-corner-b',
    title: 'Verso a1',
    category: 'endgames',
    difficulty: 3,
    conceptId: 'rook-pawn-corner',
    fen: '8/8/8/8/p1k5/8/3K4/8 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'd2c1', alternatives: ['d2c2', 'd2d1'] }],
    goal: 'Il re bianco si dirige verso a1, la casa di promozione del pedone «a» nero.',
    watchOut: 'Allontanarsi verso il centro (Re2, Re3) lascerebbe correre il pedone fino alla promozione.',
    explanation:
      '1.Rc1 (oppure 1.Rc2 o 1.Rd1): il re arriva in b1 e a1. Davanti al pedone di torre la difesa è semplice: si resta nell’angolo e il Nero non può vincere.',
    hints: [
      'Guarda su quale colonna si trova il pedone nero.',
      'Il tuo re deve raggiungere l’angolo di promozione.',
    ],
    question: {
      prompt: 'Dove deve andare il re che difende contro un pedone di torre?',
      options: [
        { id: 'a', text: 'Al centro della scacchiera.' },
        { id: 'b', text: 'Dietro al pedone.' },
        { id: 'c', text: 'Nell’angolo, davanti alla casa di promozione.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'rook-pawn-corner-a',
  },

  // ───── Torre dietro al pedone passato ─────
  {
    id: 'rook-behind-passed-a',
    title: 'La torre spinge il pedone «a»',
    category: 'endgames',
    difficulty: 3,
    conceptId: 'rook-behind-passed',
    fen: '2r5/5pkp/6p1/P7/8/6P1/5PKP/3R4 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'd1a1' }],
    goal: 'In a1 la torre sta dietro al pedone passato: lo sostiene in ogni casa fino alla promozione.',
    watchOut: 'Se il Bianco perde tempo, la torre nera può portarsi lei dietro al pedone, sulla colonna «a» sotto di esso, e attaccarlo da dietro.',
    explanation:
      '1.Ta1: la torre bianca protegge il pedone da dietro. Ogni passo del pedone allunga il raggio d’azione della torre e costringe la torre nera a una difesa passiva davanti al pedone.',
    hints: [
      'Il pedone a5 è passato: dove sta meglio la torre per sostenerlo?',
      'Davanti al pedone la torre lo blocca; dietro lo spinge.',
    ],
    question: {
      prompt: 'Perché la torre va dietro al pedone passato?',
      options: [
        { id: 'a', text: 'Perché più il pedone avanza, più case controlla la torre sulla colonna.' },
        { id: 'b', text: 'Perché davanti al pedone la torre potrebbe essere catturata dal pedone.' },
        { id: 'c', text: 'Perché così la torre difende anche il re.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'rook-behind-passed-b',
  },
  {
    id: 'rook-behind-passed-b',
    title: 'Il Nero sostiene il pedone «a»',
    category: 'endgames',
    difficulty: 3,
    conceptId: 'rook-behind-passed',
    fen: '3r4/5pkp/6p1/8/p7/6P1/5PKP/2R5 b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'd8a8' }],
    goal: 'Per il pedone nero che scende verso a1, «dietro» significa sopra: la torre in a8 lo spinge da dietro.',
    watchOut: 'La torre bianca proverà a bloccare il pedone davanti, in a1 o a2: sarà lei a dover restare passiva.',
    explanation:
      '1…Ta8: la torre nera sostiene il pedone lungo tutta la colonna. Dopo …a3 e …a2 la torre bianca sarà legata alla difesa della casa a1, mentre il re nero potrà avvicinarsi.',
    hints: [
      'Il pedone nero a4 avanza verso la prima traversa.',
      'Metti la torre sulla stessa colonna del pedone, dalla parte opposta rispetto alla casa di promozione.',
    ],
    question: {
      prompt: 'Che cosa succede alla torre che deve bloccare un pedone passato da davanti?',
      options: [
        { id: 'a', text: 'Diventa più attiva a ogni passo del pedone.' },
        { id: 'b', text: 'Resta passiva, legata alla difesa della casa di promozione.' },
        { id: 'c', text: 'Può catturare il pedone senza rischi.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'rook-behind-passed-a',
  },

  // ───── Tagliare fuori il re ─────
  {
    id: 'cut-off-king-a',
    title: 'Il muro sulla colonna «f»',
    category: 'endgames',
    difficulty: 4,
    conceptId: 'cut-off-king',
    fen: '7r/8/6k1/8/3P4/3K4/8/R7 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'a1f1' }],
    goal: 'In f1 la torre impedisce al re nero di passare sulla colonna «f»: resta a due colonne di distanza dal pedone d4.',
    watchOut: 'Con 1.Te1 il re nero, a una sola colonna dal pedone, arriverebbe in tempo a difendersi: patta.',
    explanation:
      '1.Tf1! taglia fuori il re nero di due colonne (e ed f). Il re bianco e il pedone avanzano insieme e il Nero non riesce più a fermarli. Secondo Stockfish solo questa mossa conserva la vittoria.',
    hints: [
      'Il re nero vuole avvicinarsi al pedone d4.',
      'Usa la torre come un muro su una colonna tra il re nero e il pedone, il più lontano possibile dal pedone.',
    ],
    question: {
      prompt: 'Perché conviene tagliare il re avversario lontano dal pedone?',
      options: [
        { id: 'a', text: 'Perché la torre sul bordo è più sicura.' },
        { id: 'b', text: 'Perché così il re non può mai dare scacco.' },
        { id: 'c', text: 'Perché il re difensore non riesce a raggiungere il pedone in tempo.' },
      ],
      correctOptionId: 'c',
    },
    transferExerciseId: 'cut-off-king-b',
  },
  {
    id: 'cut-off-king-b',
    title: 'Il Nero taglia la colonna «f»',
    category: 'endgames',
    difficulty: 4,
    conceptId: 'cut-off-king',
    fen: 'r7/8/3k4/3p4/8/6K1/8/7R b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'a8f8' }],
    goal: 'In f8 la torre nera tiene il re bianco sulle colonne «g» e «h», lontano dal pedone d5.',
    watchOut: 'Se il re bianco raggiungesse la colonna «e», si piazzerebbe davanti al pedone e pareggerebbe.',
    explanation:
      '1…Tf8! Il re bianco è tagliato fuori di due colonne: re e pedone neri avanzano senza disturbo. Le altre mosse, secondo Stockfish, permettono al Bianco di salvarsi.',
    hints: [
      'Il re bianco in g3 cerca di avvicinarsi al pedone.',
      'Una torre su una colonna è un muro che il re non può attraversare.',
    ],
    question: {
      prompt: 'Che cosa fa la torre quando «taglia fuori» il re?',
      options: [
        { id: 'a', text: 'Controlla una colonna (o traversa) che il re avversario non può attraversare.' },
        { id: 'b', text: 'Dà scacco al re a ogni mossa.' },
        { id: 'c', text: 'Difende il pedone da dietro.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'cut-off-king-a',
  },

  // ───── Manovra di Réti ─────
  {
    id: 'reti-maneuver-a',
    title: 'Lo studio di Réti',
    category: 'endgames',
    difficulty: 5,
    conceptId: 'reti-maneuver',
    fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1',
    sideToMove: 'w',
    solution: [{ move: 'h8g7' }],
    goal: 'In diagonale il re insegue il pedone h5 e, nello stesso tempo, si avvicina al proprio pedone c6.',
    watchOut: 'Il re sembra lontanissimo dal pedone h5: in linea retta non arriverebbe mai in tempo.',
    explanation:
      '1.Rg7! h4 2.Rf6 Rb6 (se 2…h3 3.Re7 h2 4.c7 e promuovono entrambi) 3.Re5! Rxc6 (oppure 3…h3 4.Rd6 h2 5.c7 h1=D 6.c8=D) 4.Rf4 e il pedone h cade: patta. Il re ha inseguito due obiettivi con una sola strada.',
    hints: [
      'Una mossa di re in diagonale vale quanto una in linea retta.',
      'Cerca una strada che avvicini il re sia al pedone h5 sia al tuo pedone c6.',
    ],
    question: {
      prompt: 'Qual è il segreto della manovra di Réti?',
      options: [
        { id: 'a', text: 'Il re in diagonale si avvicina contemporaneamente a due obiettivi.' },
        { id: 'b', text: 'Il pedone c6 promuove sempre per primo.' },
        { id: 'c', text: 'Il re bianco deve restare nell’angolo.' },
      ],
      correctOptionId: 'a',
    },
    transferExerciseId: 'reti-maneuver-b',
  },
  {
    id: 'reti-maneuver-b',
    title: 'Réti a colori invertiti',
    category: 'endgames',
    difficulty: 5,
    conceptId: 'reti-maneuver',
    fen: '8/8/8/8/7P/K1p5/8/7k b - - 0 1',
    sideToMove: 'b',
    solution: [{ move: 'h1g2' }],
    goal: 'Il re nero sale in diagonale: insegue il pedone h4 e si avvicina al proprio pedone c3.',
    watchOut: 'Inseguire il pedone h in linea retta (…Rh2) non basta: il re arriverebbe tardi e lontano dal pedone c.',
    explanation:
      '1…Rg2! 2.h5 Rf3: ora il re minaccia sia di raggiungere il pedone h (…Rg4) sia di accompagnare il pedone c3 verso la promozione (…Re2). Il Bianco non può impedire entrambe le idee: patta. È lo studio di Réti visto dal Nero.',
    hints: [
      'Il re nero sembra troppo lontano da tutto.',
      'Muovi il re in diagonale verso il centro: due obiettivi con una sola strada.',
    ],
    question: {
      prompt: 'Perché la diagonale è così utile al re nei finali?',
      options: [
        { id: 'a', text: 'Perché il re in diagonale non può essere attaccato.' },
        { id: 'b', text: 'Perché in diagonale il re percorre la stessa distanza ma può avvicinarsi a due zone insieme.' },
        { id: 'c', text: 'Perché in diagonale il re può muovere di due case.' },
      ],
      correctOptionId: 'b',
    },
    transferExerciseId: 'reti-maneuver-a',
  },
];
