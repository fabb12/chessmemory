/**
 * Introduzione colloquiale di ogni lezione: il tutor la dice a voce all'inizio
 * della fase OSSERVA, prima di mostrare la mossa. Spiega in parole semplici
 * perché l'idea funziona e come si mette in pratica, dando del tu all'allievo.
 */
export const CONCEPT_INTROS: Readonly<Record<string, string>> = {
  // ───────────── Aperture ─────────────
  'center-pawn':
    'Partiamo dalla prima mossa. Il centro è la parte più importante della scacchiera: da lì i pezzi arrivano ovunque in fretta. Se metti subito un pedone al centro, ti prendi spazio e apri la strada alla donna e agli alfieri. Ecco perché le mosse più giocate sono e4 e d4.',
  'develop-knights':
    'Parliamo dei cavalli. Il cavallo si muove a salti corti, quindi è forte solo quando sta vicino al centro: sul bordo controlla poche case, e c’è un detto che dice «cavallo sul bordo, cavallo sordo». Per questo, appena puoi, lo porti in f3 o in c3, verso il centro.',
  'develop-bishop':
    'Adesso tocca all’alfiere. L’alfiere ama le diagonali lunghe e libere: da lì tiene d’occhio tante case, anche lontane. Farlo uscire presto ha un altro vantaggio: libera lo spazio tra re e torre, così puoi arroccare.',
  'castle-early':
    'Ora parliamo della sicurezza del re. Al centro il re è esposto: appena si aprono le colonne arrivano gli scacchi. Con l’arrocco lo metti in un angolo, protetto dai pedoni, e in più la torre si avvicina al centro. Due vantaggi con una sola mossa: per questo conviene arroccare presto.',
  'defend-f7':
    'Attenzione a una trappola classica. La casa f7, all’inizio, è difesa soltanto dal re: è il punto debole del Nero. Se la donna e l’alfiere avversari la puntano insieme, c’è la minaccia di matto. Il trucco è semplice: prima di muovere guarda sempre che cosa vuole fare l’avversario, e para la minaccia.',
  'prepare-center':
    'Vediamo come si costruisce un centro forte. Se spingi subito d4, l’avversario può semplicemente catturare e il centro sparisce. Con c3, invece, prepari il terreno: quando arriva d4, se il Nero cattura, riprendi con il pedone e resti con due pedoni al centro.',
  'fools-mate':
    'Questa lezione ti insegna che cosa non fare. Se in apertura spingi i pedoni f e g, apri una diagonale che porta dritta al tuo re. La donna avversaria ci si infila e dà matto in poche mosse: è il matto più rapido che esista. Perciò, all’inizio, lascia stare i pedoni davanti al re.',
  'develop-with-tempo':
    'Qui sfruttiamo un errore dell’avversario. Quando la donna esce troppo presto, diventa un bersaglio: è il pezzo più prezioso e deve scappare se la attacchi. Allora sviluppi un tuo pezzo minacciandola. Lei perde una mossa a spostarsi, tu invece hai messo in gioco un pezzo in più.',
  'fianchetto':
    'Conosciamo il fianchetto. Sposti di un passo il pedone g e metti l’alfiere in g2, o in g7 se giochi col Nero. Da lì l’alfiere guarda tutta la grande diagonale fino all’angolo opposto, e intanto fa da scudo al re arroccato. È un modo tranquillo ma solido di sviluppare.',
  'central-break':
    'Se l’avversario ha costruito un bel centro di pedoni, non stare a guardare. Un centro si attacca alla base, con un pedone che arriva di lato, come c5 contro d4. Così lo costringi a scegliere: cambiare e cedere il centro, oppure lasciarlo sotto pressione.',
  'pin-knight':
    'Vediamo come mettere in difficoltà un difensore. Quando un cavallo sta davanti alla donna o al re, puoi attaccarlo con un alfiere. Il cavallo resta inchiodato: se si sposta, perde un pezzo più importante. E un pezzo inchiodato difende male il centro.',
  'fork-trick':
    'Ecco un trucco furbo. A volte puoi «regalare» un pezzo per prendere un pedone centrale. Sembra un errore, ma subito dopo un tuo pedone avanza e attacca due pezzi insieme: è una forchetta. Uno dei due cade, e così ti riprendi il pezzo con un pedone in più.',

  // ───────────── Tattica ─────────────
  'mate-f7':
    'Questo è il matto del barbiere. Ricordi la casa f7, difesa solo dal re? Se la donna ci arriva protetta dall’alfiere, il re non può catturarla e non ha case dove scappare. È uno dei primi matti che si imparano, e conoscerlo serve anche a non subirlo.',
  'back-rank-mate':
    'Parliamo del matto del corridoio. I pedoni davanti al re lo proteggono, ma a volte lo chiudono come in una gabbia. Se una torre o la donna arrivano sull’ultima traversa, il re non ha dove andare. La difesa? Aprirgli una finestra spingendo un pedone, come h3 o h6.',
  'knight-fork':
    'La forchetta di cavallo è un’arma bellissima. Il cavallo salta e da una sola casa può attaccare due pezzi insieme, magari il re e la donna. L’avversario può salvarne uno solo. Il trucco è cercare la casa da cui il cavallo tocca due bersagli.',
  'pin':
    'Vediamo l’inchiodatura. Quando un pezzo sta tra un tuo pezzo che attacca e il suo re, non si può muovere: se lo facesse, lascerebbe il re sotto scacco. È come un chiodo che lo blocca sul posto. Un pezzo inchiodato è un bersaglio facile: puoi attaccarlo ancora.',
  'skewer':
    'L’infilata è un’inchiodatura al contrario. Dai scacco al re, e dietro di lui, sulla stessa linea, c’è un altro pezzo. Il re deve spostarsi per forza, e il pezzo che stava dietro resta scoperto: lo catturi.',
  'double-attack':
    'Il doppio attacco di donna funziona così. La donna si muove in tutte le direzioni, quindi con una mossa può dare scacco e attaccare anche un pezzo lasciato senza difesa. L’avversario deve prima pensare al re, e il pezzo indifeso cade. Per questo è importante notare i pezzi non protetti.',
  'discovered-attack':
    'L’attacco di scoperta è come aprire una tenda. Un tuo pezzo sta davanti a un altro che punta lontano: quando si sposta, libera la linea a quello di dietro. Così con una sola mossa crei due minacce. Se una delle due è uno scacco, l’altra quasi sempre va a segno.',
  'smothered-mate':
    'Il matto dell’affogato è uno dei più spettacolari. Il re è chiuso nell’angolo dai suoi stessi pezzi, che gli tolgono ogni via di fuga. Basta uno scacco di cavallo, che salta gli ostacoli e non si può bloccare. Se manca ancora una casa, si sacrifica la donna per attirarci un pezzo nemico.',

  // ───────────── Strategia ─────────────
  'passed-pawn':
    'Parliamo del pedone passato. È un pedone che non ha pedoni avversari davanti né sulle colonne vicine: niente può fermarlo, se non i pezzi. Ogni passo lo avvicina a diventare donna, e l’avversario deve usare pezzi preziosi per bloccarlo. Per questo il pedone passato va spinto.',
  'rook-open-file':
    'Le torri sono pezzi forti, ma hanno bisogno di strade libere. Una colonna senza pedoni è un’autostrada: la torre la percorre tutta e arriva nel campo avversario. Quindi, quando si apre una colonna, porta lì una torre prima che lo faccia l’avversario.',
  'rook-seventh':
    'La settima traversa è il paradiso della torre. Lì attacca i pedoni avversari che non si sono ancora mossi, e intanto tiene il re chiuso sull’ultima traversa. Una torre in settima vale spesso quanto un pedone in più.',
  'outpost':
    'Vediamo l’avamposto. È una casa nel campo avversario dove nessun pedone nemico può più arrivare a cacciarti. Se ci metti un cavallo, protetto da un tuo pedone, resta lì per sempre e controlla tutto attorno. Togliertelo costerebbe all’avversario un pezzo.',

  // ───────────── Calcolo ─────────────
  'count-exchange':
    'Prima di catturare, fermati e conta. Quanti tuoi pezzi attaccano quella casa, e quanti la difendono? Se gli attaccanti sono di più, alla fine dello scambio la casa resta tua. Conta anche il valore: conviene catturare prima con i pezzi che valgono meno.',
  'mate-in-two':
    'Vediamo un matto in due con sacrificio. A volte regali un pezzo con scacco: l’avversario è obbligato a prenderlo, non ha scelta. Ma catturando mette il suo pezzo proprio dove ti serve, e la mossa dopo è matto. Il segreto è che ogni sua risposta sia forzata.',
  'pawn-breakthrough':
    'Lo sfondamento di pedoni sembra magia. Tre pedoni contro tre, e nessuno passa. Però se sacrifichi due pedoni nel modo giusto, sposti quelli avversari e uno dei tuoi resta libero di correre fino in fondo. Funziona se il re avversario è troppo lontano per fermarlo.',
  'legal-mate':
    'Il matto di Legal è un classico. Il cavallo sembra inchiodato davanti alla donna, ma l’inchiodatura è sulla donna, non sul re: quindi il cavallo può muoversi lo stesso. Se l’avversario si prende la donna, i tuoi pezzi minori danno matto. La lezione è calcolare ogni risposta, anche quelle che sembrano vincere.',
  'anastasia-mate':
    'Il matto di Anastasia unisce cavallo e torre. Il cavallo si piazza in e7 e toglie al re le case davanti a lui; poi la torre arriva sulla colonna h e dà matto. Se la colonna è chiusa, la apri sacrificando la donna. Funziona solo se ogni mossa è uno scacco.',
  'boden-mate':
    'Il matto di Boden usa due alfieri che si incrociano. Le loro diagonali formano una specie di croce davanti al re e coprono tutte le case di fuga. Spesso c’è un pedone che ripara il re: lo togli di mezzo con un sacrificio, e la diagonale si apre.',
  'greek-gift':
    'Questo è il famoso sacrificio greco. L’alfiere si dà in h7 con scacco e strappa al re il pedone che lo proteggeva. Poi il cavallo salta in g5 con scacco e la donna arriva sulla colonna h: il re resta solo. Prima di sacrificare, però, controlla che cavallo e donna possano davvero arrivare in tempo.',

  // ───────────── Finali ─────────────
  'queen-mate':
    'Impariamo a dare matto con donna e re. La donna da sola non basta: le serve l’aiuto del re. Prima spingi il re avversario sul bordo, togliendogli case con la donna; poi avvicini il tuo re e dai scacco con la donna protetta. Così il re avversario non può né catturarla né scappare.',
  'rook-mate':
    'Ora il matto con torre e re. La torre taglia al re avversario una traversa alla volta e lo spinge verso il bordo. Quando i due re si guardano in faccia, con una casa in mezzo, la torre dà scacco sull’ultima traversa ed è matto. Serve un po’ di pazienza, ma il metodo funziona sempre.',
  'two-rooks-mate':
    'Il matto a scala con due torri è il più facile. Le torri si danno il cambio, come i gradini di una scala: una blocca una traversa, l’altra dà scacco su quella successiva. Il re avversario arretra di un passo ogni volta, fino al bordo. Qui il tuo re non serve nemmeno.',
  'stalemate-trap':
    'Attenzione allo stallo, che è una trappola per chi sta vincendo. Se il re avversario non è sotto scacco ma non ha nessuna mossa legale, la partita finisce patta. Quindi, quando hai tanto vantaggio, prima di muovere chiediti: al re avversario resta almeno una casa? Se no, deve essere matto.',
  'square-rule':
    'La regola del quadrato ti fa risparmiare un sacco di calcoli. Immagina un quadrato che va dal pedone fino alla casa dove promuove. Se il re che difende riesce a entrare in quel quadrato, prende il pedone; se resta fuori, il pedone diventa donna. Basta guardare, senza contare mossa per mossa.',
  'opposition':
    'Parliamo dell’opposizione. Quando i due re sono uno di fronte all’altro, con una sola casa in mezzo, nessuno dei due può avanzare. Chi deve muovere è costretto a farsi da parte. Nei finali di pedoni spesso vince chi riesce a prendersi l’opposizione.',
  'rook-pawn-corner':
    'Ecco un salvataggio da ricordare. Se all’avversario resta solo un pedone sulla colonna a o h, al difensore basta portare il re nell’angolo dove il pedone vuole promuovere. Da lì non lo può scacciare nessuno, e la partita finisce patta.',
  'rook-behind-passed':
    'Nei finali di torre c’è una regola d’oro: la torre va dietro al pedone passato. Da dietro lo spinge, e più il pedone avanza, più la torre controlla case. Se invece sta davanti, più il pedone avanza, meno spazio le resta.',
  'cut-off-king':
    'Vediamo come tagliare fuori il re. La torre si mette su una colonna e fa da muro: il re avversario non può attraversarla. Così resta lontano dal tuo pedone, e il tuo re ha tutto il tempo di accompagnarlo alla promozione.',
  'reti-maneuver':
    'La manovra di Réti sembra un trucco di magia. Il re si muove in diagonale, e sulla scacchiera la diagonale è lunga quanto la colonna. Così, con le stesse mosse, il re insegue il pedone avversario e insieme si avvicina al proprio. Insegue due lepri e alla fine almeno una la prende.',
  'lucena':
    'La posizione di Lucena è la chiave per vincere i finali di torre. Il tuo pedone è quasi arrivato, ma il re è chiuso davanti a lui e la torre avversaria dà scacchi di lato. Il trucco è costruire un ponte: porti la torre sulla quarta traversa, poi il re esce e la torre ferma gli scacchi.',
  'philidor-defense':
    'La difesa di Philidor è il modo per pareggiare con la torre. Metti la torre sulla terza traversa: il re avversario non può avanzare. Quando il pedone avanza su quella traversa, la torre va in fondo e dà scacco da dietro, perché il re avversario non ha più dove nascondersi.',
};
