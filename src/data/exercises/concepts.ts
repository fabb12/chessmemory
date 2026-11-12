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

  {
    id: 'fools-mate',
    title: "Il matto dell'imbecille: non scoprire il re",
    category: 'openings',
    difficulty: 1,
    summary: 'Spingere i pedoni «f» e «g» in apertura apre la diagonale verso il re: la donna avversaria dà matto subito.',
    principle:
      'Sicurezza del re: i pedoni davanti al re lo proteggono. Spingere presto il pedone «f» (e peggio ancora anche il «g») apre la diagonale e8–h5 o e1–h4.',
    taskPrompt: "Approfitta del re scoperto: dai scacco matto.",
  },
  {
    id: 'develop-with-tempo',
    title: 'Sviluppare guadagnando tempo sulla donna',
    category: 'openings',
    difficulty: 2,
    summary: 'Se la donna avversaria esce presto al centro, sviluppa un pezzo che la attacchi: lei deve spostarsi, tu sei avanti nello sviluppo.',
    principle:
      'Sviluppo con tempo: una mossa che sviluppa un pezzo e insieme attacca qualcosa vale doppio, perché costringe l’avversario a perdere una mossa.',
    taskPrompt: 'Sviluppa un pezzo attaccando la donna avversaria.',
  },
  {
    id: 'fianchetto',
    title: "L'alfiere in fianchetto",
    category: 'openings',
    difficulty: 2,
    summary: 'Dopo la spinta del pedone «g» l’alfiere va in g2 (o g7): da lì controlla la grande diagonale e protegge il re arroccato.',
    principle:
      'Fianchetto: un alfiere sulla grande diagonale (a1–h8 o h1–a8) agisce sul centro da lontano ed è un ottimo difensore del re arroccato.',
    taskPrompt: "Completa il fianchetto: porta l'alfiere sulla grande diagonale.",
  },
  {
    id: 'central-break',
    title: 'Attaccare il centro avversario con un pedone',
    category: 'openings',
    difficulty: 3,
    summary: 'Un centro di pedoni avversario si attacca alla base con una spinta laterale, come …c5 contro d4 o c4 contro d5.',
    principle:
      'Rottura centrale: se l’avversario costruisce un centro di pedoni, lo si colpisce alla base con un pedone laterale (c o f) per indebolirlo e aprire linee.',
    taskPrompt: 'Attacca il centro avversario con un pedone laterale.',
  },
  {
    id: 'pin-knight',
    title: 'Inchiodare il cavallo che difende il centro',
    category: 'openings',
    difficulty: 3,
    summary: 'Un alfiere in g5 o b4 inchioda il cavallo davanti a donna o re: il cavallo non difende più bene il centro.',
    principle:
      'Sviluppo con pressione: un alfiere che inchioda un cavallo sviluppa un pezzo e ostacola il controllo del centro da parte dell’avversario.',
    taskPrompt: "Sviluppa l'alfiere inchiodando un cavallo.",
  },
  {
    id: 'fork-trick',
    title: 'Il trucco della forchetta di pedone',
    category: 'openings',
    difficulty: 4,
    summary: 'Si dà un pezzo per un pedone centrale e lo si riprende subito con una forchetta di pedone su due pezzi.',
    principle:
      'Calcolo in apertura: un pedone che avanza attaccando due pezzi insieme fa una forchetta; uno dei due va perso, e il centro passa a chi l’ha giocata.',
    taskPrompt: 'Riprendi il materiale con una forchetta di pedone.',
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

  // ───────────── Finali ─────────────
  {
    id: 'queen-mate',
    title: 'Matto con donna e re',
    category: 'endgames',
    difficulty: 1,
    summary: 'Con la donna difesa dal proprio re si dà matto al re avversario spinto sul bordo.',
    principle:
      'Collaborazione re–donna: la donna da sola non basta, ma se si appoggia accanto al re avversario ed è difesa dal proprio re, il matto è sicuro.',
    taskPrompt: 'Dai scacco matto con la donna.',
  },
  {
    id: 'rook-mate',
    title: 'Matto con torre e re',
    category: 'endgames',
    difficulty: 1,
    summary: 'Re contro re in opposizione: la torre dà scacco sulla traversa del bordo e il re avversario non ha case.',
    principle:
      'Il re attaccante sta di fronte al re avversario (opposizione) e gli toglie le tre case davanti; la torre dà scacco lungo il bordo.',
    taskPrompt: 'Dai scacco matto con la torre.',
  },
  {
    id: 'two-rooks-mate',
    title: 'Matto a scala con due torri',
    category: 'endgames',
    difficulty: 2,
    summary: 'Le due torri si danno il cambio: una taglia una traversa, l’altra dà scacco su quella successiva.',
    principle:
      'Matto a scala: una torre chiude la fuga del re su una traversa, l’altra dà scacco su quella del bordo. Il proprio re non serve.',
    taskPrompt: 'Dai scacco matto con le due torri.',
  },
  {
    id: 'stalemate-trap',
    title: 'Attenzione allo stallo',
    category: 'endgames',
    difficulty: 2,
    summary: 'Se il re avversario non ha mosse ma non è sotto scacco, la partita è patta. Prima di muovere controlla che abbia ancora una casa o che sia matto.',
    principle:
      'Stallo: se chi deve muovere non ha mosse legali e il re non è sotto scacco, la partita finisce patta. Con tanto vantaggio, l’errore più comune è togliere tutte le case senza dare scacco.',
    taskPrompt: 'Vinci subito, senza dare stallo.',
  },
  {
    id: 'square-rule',
    title: 'La regola del quadrato',
    category: 'endgames',
    difficulty: 2,
    summary: 'Il re ferma un pedone passato solo se riesce a entrare nel «quadrato» che va dal pedone alla casa di promozione.',
    principle:
      'Regola del quadrato: si disegna il quadrato che ha come lato la distanza tra pedone e casa di promozione. Se il re vi entra con la sua mossa, raggiunge il pedone in tempo.',
    taskPrompt: 'Ferma il pedone passato avversario con il re.',
  },
  {
    id: 'opposition',
    title: "L'opposizione dei re",
    category: 'endgames',
    difficulty: 3,
    summary: 'Re di fronte con una casa in mezzo: chi deve muovere deve cedere il passo. Nei finali di pedoni spesso decide tutto.',
    principle:
      'Opposizione: quando i due re stanno sulla stessa colonna (o traversa) con una sola casa in mezzo, chi ha appena mosso «ha l’opposizione» e costringe l’altro re a spostarsi.',
    taskPrompt: "Prendi l'opposizione con il re.",
  },
  {
    id: 'rook-pawn-corner',
    title: "Pedone di torre: il re va nell'angolo",
    category: 'endgames',
    difficulty: 3,
    summary: 'Contro il solo pedone di torre (colonna «a» o «h») il re che raggiunge l’angolo di promozione non può più essere scacciato: è patta.',
    principle:
      'Pedone di torre: il re difensore che arriva davanti al pedone, nell’angolo, non può essere spinto via perché il re attaccante finirebbe per dargli stallo.',
    taskPrompt: "Corri con il re verso l'angolo di promozione.",
  },
  {
    id: 'rook-behind-passed',
    title: 'La torre dietro al pedone passato',
    category: 'endgames',
    difficulty: 3,
    summary: 'Nei finali di torre la torre si mette dietro al pedone passato: più il pedone avanza, più la torre diventa forte.',
    principle:
      'Regola di Tarrasch: la torre va dietro al pedone passato, il proprio o quello avversario. Davanti al pedone diventa passiva, dietro lo spinge a ogni passo.',
    taskPrompt: 'Metti la torre nel posto giusto rispetto al pedone passato.',
  },
  {
    id: 'cut-off-king',
    title: 'Tagliare fuori il re con la torre',
    category: 'endgames',
    difficulty: 4,
    summary: 'In un finale di torre e pedone, la torre su una colonna tiene il re avversario lontano dal pedone.',
    principle:
      'Taglio del re: una torre su una colonna (o traversa) è un muro che il re non può attraversare. Più colonne separano il re difensore dal pedone, più facile è vincere.',
    taskPrompt: 'Usa la torre per tenere lontano il re avversario.',
  },
  {
    id: 'reti-maneuver',
    title: 'La manovra di Réti: due obiettivi con una mossa',
    category: 'endgames',
    difficulty: 5,
    summary: 'Il re si muove in diagonale per inseguire il pedone avversario e, insieme, avvicinarsi al proprio: la diagonale è lunga quanto la colonna.',
    principle:
      'Geometria del re: in diagonale il re percorre la stessa distanza che in linea retta, ma può avvicinarsi a due obiettivi insieme. È lo studio di Richard Réti (1921).',
    taskPrompt: 'Trova la mossa di re che salva la partita.',
  },
];
