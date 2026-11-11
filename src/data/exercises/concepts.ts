import type { Concept } from '../../types';

/**
 * Concetti didattici. Ogni concetto è l'unità di ripasso (una scheda FSRS)
 * e possiede almeno due esercizi: uno per RICORDA/SPIEGA e uno, in una
 * posizione diversa, per RICONOSCI.
 */
export const CONCEPTS: readonly Concept[] = [
  // ───────────── Aperture ─────────────
  {
    id: 'center-pawn',
    title: 'Occupare il centro con un pedone',
    category: 'openings',
    difficulty: 1,
    summary: 'La prima mossa ideale porta un pedone al centro e apre la strada ai pezzi.',
    principle:
      'Controllo del centro: chi occupa le case e4, d4, e5, d5 dà più spazio e mobilità ai propri pezzi.',
    taskPrompt: 'Occupa il centro con un pedone.',
  },
  {
    id: 'develop-knights',
    title: 'Sviluppare i cavalli verso il centro',
    category: 'openings',
    difficulty: 1,
    summary: 'I cavalli si sviluppano presto, verso il centro, dove controllano più case.',
    principle:
      'Sviluppo rapido: in apertura ogni mossa dovrebbe mettere in gioco un pezzo nuovo, preferibilmente verso il centro.',
    taskPrompt: 'Sviluppa un cavallo verso il centro.',
  },
  {
    id: 'develop-bishop',
    title: "Sviluppare l'alfiere su una diagonale attiva",
    category: 'openings',
    difficulty: 2,
    summary: "L'alfiere esce su una diagonale aperta e libera la strada all'arrocco.",
    principle:
      "Pezzi attivi: un alfiere rende di più su una diagonale lunga e libera, puntata verso il centro o il re avversario.",
    taskPrompt: "Sviluppa l'alfiere di re su una diagonale attiva.",
  },
  {
    id: 'castle-early',
    title: 'Arroccare presto',
    category: 'openings',
    difficulty: 2,
    summary: "L'arrocco mette il re al sicuro e porta la torre verso il centro.",
    principle:
      'Sicurezza del re: prima di attaccare, porta il re lontano dal centro e collega le torri.',
    taskPrompt: 'Metti il re al sicuro.',
  },
  {
    id: 'defend-f7',
    title: 'Parare la minaccia su f7',
    category: 'openings',
    difficulty: 2,
    summary: 'Donna e alfiere puntano la casa f7: bisogna vedere la minaccia e pararla.',
    principle:
      "Prima di muovere chiediti: «Che cosa minaccia l'ultima mossa avversaria?». La casa f7 è difesa solo dal re.",
    taskPrompt: "L'avversario minaccia qualcosa: para la minaccia.",
  },
  {
    id: 'prepare-center',
    title: 'Preparare la spinta centrale d4 con c3',
    category: 'openings',
    difficulty: 4,
    summary: 'La mossa c3 sostiene la spinta d4 per costruire un forte centro di pedoni.',
    principle:
      "Piano di apertura: una spinta centrale funziona meglio se è sostenuta da un pedone, così in caso di cambio si riprende di pedone e si mantiene il centro.",
    taskPrompt: 'Costruisci un centro di pedoni solido.',
  },

  // ───────────── Tattica ─────────────
  {
    id: 'mate-f7',
    title: 'Matto del barbiere su f7',
    category: 'tactics',
    difficulty: 1,
    summary: "Donna sostenuta dall'alfiere: la cattura in f7 è scacco matto.",
    principle:
      'Un pezzo che dà scacco da vicino non può essere catturato dal re se è difeso da un altro pezzo.',
    taskPrompt: 'Trova lo scacco matto in una mossa.',
  },
  {
    id: 'back-rank-mate',
    title: 'Matto del corridoio',
    category: 'tactics',
    difficulty: 1,
    summary: "Il re chiuso dai propri pedoni non ha case di fuga sull'ultima traversa.",
    principle:
      "Un re senza «finestra» (case di fuga davanti a sé) è vulnerabile a uno scacco di torre o donna sull'ultima traversa.",
    taskPrompt: 'Trova lo scacco matto in una mossa.',
  },
  {
    id: 'knight-fork',
    title: 'Forchetta di cavallo',
    category: 'tactics',
    difficulty: 2,
    summary: 'Il cavallo attacca due pezzi insieme: uno dei due cadrà.',
    principle:
      "Doppio attacco: una sola mossa crea due minacce e l'avversario può pararne una sola. Con lo scacco, la risposta è obbligata.",
    taskPrompt: 'Trova la mossa che guadagna materiale.',
  },
  {
    id: 'pin',
    title: 'Inchiodatura',
    category: 'tactics',
    difficulty: 3,
    summary: 'Un pezzo che copre il proprio re non può muoversi: è inchiodato.',
    principle:
      "Inchiodatura assoluta: un pezzo allineato con il proprio re non può lasciare la linea. Attaccalo con un pezzo di valore minore.",
    taskPrompt: 'Trova la mossa che guadagna materiale.',
  },
  {
    id: 'skewer',
    title: 'Infilata',
    category: 'tactics',
    difficulty: 3,
    summary: 'Scacco al re: quando il re si sposta, cade il pezzo che gli stava dietro.',
    principle:
      "Infilata: due pezzi sulla stessa linea, il più prezioso davanti. Attaccando il primo, il secondo resta scoperto.",
    taskPrompt: 'Trova la mossa che guadagna materiale.',
  },
  {
    id: 'double-attack',
    title: 'Doppio attacco di donna',
    category: 'tactics',
    difficulty: 3,
    summary: 'Uno scacco di donna che attacca anche un pezzo indifeso.',
    principle:
      'I pezzi indifesi sono bersagli: cerca uno scacco che attacchi contemporaneamente un pezzo non protetto.',
    taskPrompt: 'Trova la mossa che guadagna materiale.',
  },
  {
    id: 'discovered-attack',
    title: 'Attacco di scoperta',
    category: 'tactics',
    difficulty: 4,
    summary: 'Un pezzo si sposta e libera la linea di un altro: due minacce in una mossa.',
    principle:
      "Attacco di scoperta: il pezzo che si muove crea una minaccia, quello dietro ne crea un'altra. Se una delle due è uno scacco, l'altra va quasi sempre a segno.",
    taskPrompt: 'Trova la mossa che guadagna materiale.',
  },

  // ───────────── Strategia ─────────────
  {
    id: 'passed-pawn',
    title: 'Il pedone passato va spinto',
    category: 'strategy',
    difficulty: 2,
    summary: 'Un pedone senza pedoni avversari davanti a sé è una futura donna.',
    principle:
      'Pedone passato: nessun pedone avversario può fermarlo. Se il re nemico è lontano, ogni passo avanti lo avvicina alla promozione.',
    taskPrompt: 'Sfrutta il tuo pedone passato.',
  },
  {
    id: 'rook-open-file',
    title: 'Torre sulla colonna aperta',
    category: 'strategy',
    difficulty: 2,
    summary: 'Le torri hanno bisogno di colonne senza pedoni per entrare in gioco.',
    principle:
      "Colonna aperta: una colonna senza pedoni è la strada che porta la torre nel campo avversario. Chi la occupa per primo la controlla.",
    taskPrompt: 'Attiva una torre.',
  },
  {
    id: 'rook-seventh',
    title: 'Torre in settima traversa',
    category: 'strategy',
    difficulty: 3,
    summary: 'Sulla penultima traversa la torre attacca i pedoni e limita il re.',
    principle:
      "Torre in settima: lì la torre attacca i pedoni ancora sulla casa di partenza e costringe i pezzi avversari alla difesa.",
    taskPrompt: 'Porta la torre nella posizione più attiva.',
  },
  {
    id: 'outpost',
    title: 'Avamposto per il cavallo',
    category: 'strategy',
    difficulty: 4,
    summary: 'Una casa avanzata che nessun pedone avversario può più attaccare.',
    principle:
      "Avamposto: una casa nel campo avversario, sostenuta da un tuo pedone, da cui nessun pedone nemico può scacciare il pezzo. È la casa ideale per un cavallo.",
    taskPrompt: 'Migliora la posizione del cavallo.',
  },

  // ───────────── Calcolo delle varianti ─────────────
  {
    id: 'count-exchange',
    title: 'Contare attaccanti e difensori',
    category: 'calculation',
    difficulty: 3,
    summary: 'Prima di catturare, conta chi attacca e chi difende la casa.',
    principle:
      "Calcolo degli scambi: se gli attaccanti sono più dei difensori la cattura guadagna materiale. Si inizia catturando con il pezzo di minor valore.",
    taskPrompt: 'Calcola la sequenza di catture che guadagna materiale.',
  },
  {
    id: 'mate-in-two',
    title: 'Matto in due con sacrificio',
    category: 'calculation',
    difficulty: 4,
    summary: 'Uno scacco con sacrificio costringe la risposta e prepara il matto.',
    principle:
      "Mosse forzanti: calcola prima gli scacchi, anche quelli che sacrificano materiale. Se la risposta è obbligata, la variante è facile da vedere fino in fondo.",
    taskPrompt: 'Trova lo scacco matto in due mosse.',
  },
  {
    id: 'pawn-breakthrough',
    title: 'Sfondamento di pedoni',
    category: 'calculation',
    difficulty: 5,
    summary: 'Tre pedoni contro tre: un doppio sacrificio crea un pedone passato.',
    principle:
      'Sfondamento: sacrificare pedoni per deviare quelli avversari e aprire la strada a un pedone passato. Bisogna calcolare ogni cattura.',
    taskPrompt: 'Calcola come creare un pedone passato inarrestabile.',
  },
  {
    id: 'legal-mate',
    title: 'Matto di Legal',
    category: 'calculation',
    difficulty: 5,
    summary: "Il cavallo «inchiodato» si muove lo stesso: se la donna viene presa, è matto.",
    principle:
      "Un'inchiodatura sulla donna non è assoluta: il pezzo può muoversi se le minacce che crea valgono più della donna. Va calcolata ogni risposta.",
    taskPrompt: 'Calcola la combinazione vincente.',
  },
];
