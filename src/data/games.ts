/**
 * Partite famose, complete e commentate (lingua: italiano).
 *
 * Le mosse sono in notazione SAN inglese (K, Q, R, B, N), come nei PGN:
 * l'interfaccia le mostra con le iniziali italiane. I commenti tra graffe
 * si riferiscono alla mossa che li precede. La legalità di ogni mossa e il
 * risultato finale sono verificati dai test (`tests/unit/games.test.ts`).
 */

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export type GameTheme = 'opening' | 'development' | 'attack' | 'sacrifice' | 'endgame' | 'strategy';

export interface FamousGame {
  id: string;
  title: string;
  white: string;
  black: string;
  event: string;
  year: number;
  result: GameResult;
  opening: string;
  themes: GameTheme[];
  /** Presentazione breve per l'elenco. */
  summary: string;
  /**
   * Commento iniziale, mostrato (e letto a voce) prima della prima mossa:
   * il contesto, il carattere della partita e che cosa se ne può imparare.
   */
  intro: string;
  /** Che cosa insegna la partita. */
  lessons: string[];
  /** Mosse in SAN con commenti tra graffe. */
  pgn: string;
}

export const FAMOUS_GAMES: readonly FamousGame[] = [
  {
    id: 'opera-game',
    title: "La partita dell'Opera",
    white: 'Paul Morphy',
    black: 'Duca di Brunswick e Conte Isouard',
    event: "Parigi, Teatro dell'Opera",
    year: 1858,
    result: '1-0',
    opening: 'Difesa Philidor',
    themes: ['opening', 'development', 'attack', 'sacrifice'],
    summary:
      'Giocata in un palco durante il «Barbiere di Siviglia»: Morphy mostra che cosa succede quando un giocatore sviluppa tutti i pezzi e l’altro no.',
    intro:
      "Siamo a Parigi nel 1858, in un palco del Teatro dell’Opera: Paul Morphy, il più forte giocatore del suo tempo, affronta in consultazione due nobili mentre in scena va il «Barbiere di Siviglia». È la partita perfetta per capire lo sviluppo. Il Nero perde tempo con l’alfiere e lascia metà dei pezzi a casa; Morphy invece porta in gioco un pezzo dopo l’altro, arrocca lungo e apre le linee con due sacrifici. Guardala chiedendoti a ogni mossa: quanti pezzi sta usando il Bianco, e quanti il Nero?",
    lessons: [
      'Lo sviluppo rapido vale più di un pedone o di un pezzo.',
      'Un vantaggio di sviluppo si sfrutta aprendo le linee verso il re avversario.',
      'Il matto finale arriva con gli ultimi pezzi messi in gioco.',
    ],
    pgn: `1.e4 e5 2.Nf3 d6 {La Difesa Philidor: solida ma un po' passiva.} 3.d4 Bg4?! {Inchioda il cavallo, ma il Nero sarà costretto a cedere la coppia degli alfieri.}
4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 {Il Bianco ha già due pezzi attivi e minaccia Dxf7 matto.} Nf6 7.Qb3 {Doppio attacco su f7 e b7.} Qe7
8.Nc3 {Morphy preferisce sviluppare invece di prendere il pedone b7.} c6 9.Bg5 {Inchioda il cavallo f6: tutti i pezzi bianchi stanno entrando in gioco.} b5?
10.Nxb5! {Il Bianco sacrifica un pezzo per aprire le linee verso il re nero, rimasto al centro.} cxb5 11.Bxb5+ Nbd7 12.O-O-O {La torre arriva subito sulla colonna d, dove il cavallo nero è inchiodato.} Rd8
13.Rxd7! Rxd7 14.Rd1 {Un'altra torre si aggiunge all'attacco: il Nero ha ancora metà dei pezzi a casa.} Qe6 15.Bxd7+ Nxd7
16.Qb8+!! {Sacrificio di donna: il cavallo è costretto a liberare la casa d8.} Nxb8 17.Rd8# {Matto con gli ultimi due pezzi sviluppati: alfiere e torre.}`,
  },
  {
    id: 'legal-mate-game',
    title: 'Il matto di Legal',
    white: 'Kermur de Legal',
    black: 'Saint Brie',
    event: 'Parigi, Café de la Régence',
    year: 1750,
    result: '1-0',
    opening: 'Difesa Philidor',
    themes: ['opening', 'sacrifice'],
    summary:
      'Una trappola d’apertura celebre: il Bianco lascia la donna in presa e dà matto con i pezzi minori.',
    intro:
      "Una partita di poche mosse giocata intorno al 1750 al Café de la Régence di Parigi, il ritrovo degli scacchisti dell’epoca. Più che una partita è una trappola diventata famosa: il Bianco lascia la donna in presa, il Nero la cattura e riceve matto dai pezzi minori. La caratteristica è l’inchiodatura «finta»: il cavallo sembra bloccato, ma dietro c’è la donna, non il re. Impara a chiederti sempre che cosa minaccia l’avversario prima di prendere un pezzo che sembra regalato.",
    lessons: [
      'Un’inchiodatura su un cavallo non è assoluta se dietro c’è la donna, non il re.',
      'Prima di catturare un pezzo grosso, controlla che cosa minaccia l’avversario.',
    ],
    pgn: `1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 {L'alfiere inchioda il cavallo alla donna.} 4.Nc3 g6? {Una mossa lenta: il Nero non vede la minaccia.}
5.Nxe5! {Il cavallo «inchiodato» si muove lo stesso, lasciando la donna in presa.} Bxd1?? {Il Nero accetta la donna ma va incontro al matto. Meglio era 5…dxe5, perdendo solo un pedone.}
6.Bxf7+ Ke7 7.Nd5# {Tre pezzi minori danno matto: il re nero è chiuso dai propri pezzi.}`,
  },
  {
    id: 'immortal-game',
    title: "L'Immortale",
    white: 'Adolf Anderssen',
    black: 'Lionel Kieseritzky',
    event: 'Londra, partita amichevole',
    year: 1851,
    result: '1-0',
    opening: 'Gambetto di re',
    themes: ['opening', 'attack', 'sacrifice'],
    summary:
      'Anderssen sacrifica un alfiere, entrambe le torri e la donna, e dà matto con i tre pezzi minori rimasti.',
    intro:
      "Londra, 1851: una partita amichevole giocata durante il primo grande torneo internazionale. È lo scacco romantico nella sua forma più pura: Gambetto di re, pezzi offerti uno dopo l’altro e un attacco che non dà respiro. Anderssen sacrifica un alfiere, le due torri e infine la donna, e dà matto con i tre pezzi minori rimasti. La lezione va oltre lo spettacolo: il materiale conta poco se i tuoi pezzi lavorano tutti insieme e quelli dell’avversario sono fuori gioco.",
    lessons: [
      'Nell’attacco conta quanti pezzi partecipano, non il materiale sulla scacchiera.',
      'Un re senza difensori può subire matto anche da pezzi minori.',
      'Il Nero ha preso molto materiale ma ha mosso solo la donna e pochi altri pezzi: lo sviluppo decide.',
    ],
    pgn: `1.e4 e5 2.f4 {Il Gambetto di re: il Bianco offre un pedone per aprire la colonna f.} exf4 3.Bc4 Qh4+ 4.Kf1 b5 {Il Gambetto Bryan: il Nero restituisce un pedone per guadagnare tempo.}
5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1! {Il Bianco offre l'alfiere: lo sviluppo e l'iniziativa contano di più.} cxb5
12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 {Il cavallo nero deve tornare a casa: il Nero ha un solo pezzo sviluppato, la donna.} 15.Bxf4 Qf6 16.Nc3 Bc5
17.Nd5 Qxb2 {La donna nera attacca la torre a1 e minaccia scacco.} 18.Bd6!! {Anderssen lascia andare entrambe le torri: conta solo il re nero.} Bxg1 19.e5! {Il pedone chiude la diagonale della donna nera, che non potrà più difendere il re.} Qxa1+ 20.Ke2
Na6 21.Nxg7+ Kd8 22.Qf6+!! {Anche la donna viene sacrificata.} Nxf6 23.Be7# {Matto con i pezzi minori: alfiere e due cavalli.}`,
  },
  {
    id: 'evergreen-game',
    title: 'La Sempreverde',
    white: 'Adolf Anderssen',
    black: 'Jean Dufresne',
    event: 'Berlino, partita amichevole',
    year: 1852,
    result: '1-0',
    opening: 'Gambetto Evans',
    themes: ['opening', 'development', 'attack', 'sacrifice'],
    summary:
      'Un gambetto per guadagnare tempo, il centro aperto e una combinazione finale che ancora oggi si studia in ogni scuola di scacchi.',
    intro:
      "Berlino, 1852: ancora Anderssen, questa volta contro Jean Dufresne, in una partita amichevole che Steinitz chiamò «la sempreverde dell’alloro di Anderssen». Il Bianco gioca il Gambetto Evans: un pedone in cambio di tempo per sviluppare e costruire il centro. La caratteristica è la combinazione finale, una serie di sacrifici con scacchi continui che non lascia mai al Nero il tempo di eseguire le sue minacce. Osserva come le colonne aperte davanti al re diventano strade per i pezzi bianchi.",
    lessons: [
      'Nel Gambetto Evans il Bianco dà un pedone per sviluppare con tempo e costruire il centro.',
      'Le colonne aperte davanti al re sono la strada per l’attacco.',
      'Una combinazione forzata con scacchi continui non lascia tempo all’avversario per le sue minacce.',
    ],
    pgn: `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 {Il Gambetto Evans: un pedone per guadagnare tempo con c3 e d4.} Bxb4 5.c3 Ba5 6.d4 {Il Bianco costruisce il centro con tempo.} exd4
7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 {La torre va sulla colonna aperta davanti al re nero.} Nge7 11.Ba3 {L'alfiere impedisce al Nero di arroccare.} b5 12.Qxb5 Rb8
13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 {Il Nero prepara …Dxf3, con minacce di matto in g2.} 17.Nf6+! {Il cavallo apre la colonna g, ma anche le linee verso il re nero.} gxf6
18.exf6 Rg8 19.Rad1!! {Una mossa tranquilla, mentre il Nero minaccia matto: tutti i pezzi bianchi sono pronti.} Qxf3 20.Rxe7+! Nxe7 21.Qxd7+!! {Il sacrificio di donna apre la strada agli alfieri.} Kxd7
22.Bf5+ {Scacco doppio: alfiere e torre.} Ke8 23.Bd7+ Kf8 24.Bxe7# {Matto con i due alfieri.}`,
  },
  {
    id: 'steinitz-bardeleben',
    title: 'Il re che non si arrende',
    white: 'Wilhelm Steinitz',
    black: 'Curt von Bardeleben',
    event: 'Hastings',
    year: 1895,
    result: '1-0',
    opening: 'Partita Italiana (Giuoco Piano)',
    themes: ['opening', 'development', 'attack', 'sacrifice'],
    summary:
      'Il re nero non riesce ad arroccare e Steinitz lo insegue con una torre che non può essere catturata. Von Bardeleben lasciò la sala invece di arrendersi.',
    intro:
      "Hastings, 1895. Wilhelm Steinitz, primo campione del mondo ufficiale, è noto per aver insegnato il gioco posizionale; qui mostra che sapeva anche attaccare con precisione. Il re nero resta al centro, il pedone d del Bianco apre la strada e una torre bianca in settima traversa dà scacco su scacco senza poter essere catturata. Von Bardeleben, invece di arrendersi, lasciò la sala. Impara quanto costa non arroccare e come una torre attiva, difesa indirettamente, vale più di molto materiale.",
    lessons: [
      'Se il re resta al centro, ogni colonna aperta diventa pericolosa.',
      'Un pedone centrale che avanza può aprire la strada all’attacco.',
      'Una torre in settima traversa, difesa indirettamente, può dare scacco senza fine.',
    ],
    pgn: `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 {Il Giuoco Piano, la più classica delle aperture italiane.} 4.c3 Nf6 5.d4 {Il Bianco costruisce il centro con c3 e d4.} exd4 6.cxd4 Bb4+
7.Nc3 d5 8.exd5 Nxd5 9.O-O Be6 10.Bg5 Be7 11.Bxd5 Bxd5 12.Nxd5 Qxd5 13.Bxe7 Nxe7 {Dopo i cambi il re nero è rimasto al centro e non può arroccare.}
14.Re1 {La torre occupa subito la colonna aperta del re.} f6 15.Qe2 Qd7 16.Rac1 c6 17.d5! {Il pedone si sacrifica per aprire le linee.} cxd5 18.Nd4 Kf7 19.Ne6 Rhc8
20.Qg4 g6 21.Ng5+ Ke8 22.Rxe7+!! {Il sacrificio celebre: la torre non può essere catturata, perché ogni presa porta al matto o alla perdita della donna.} Kf8 23.Rf7+! Kg8
24.Rg7+! Kh8 25.Rxh7+ {Qui il Nero se ne andò senza firmare il formulario. Steinitz mostrò poi il matto in dieci mosse.}`,
  },
  {
    id: 'reti-tartakower',
    title: 'Il sacrificio di donna di Réti',
    white: 'Richard Réti',
    black: 'Savielly Tartakower',
    event: 'Vienna',
    year: 1910,
    result: '1-0',
    opening: 'Difesa Caro-Kann',
    themes: ['opening', 'development', 'sacrifice'],
    summary:
      'Undici mosse: il Nero cattura un pedone di troppo con la donna, il Bianco arrocca lungo e dà matto con un doppio scacco.',
    intro:
      "Vienna, 1910: undici mosse appena, una delle miniature più famose di sempre. Richard Réti, che diventerà un maestro delle idee moderne, punisce Savielly Tartakower nella Difesa Caro-Kann. Il Nero mangia un pedone con la donna lasciando il re al centro; il Bianco arrocca lungo, sacrifica la donna e chiude con uno scacco doppio e il matto. È la partita ideale per memorizzare un motivo: arrocco lungo, torre sulla colonna d e scacco doppio quando il re non può fuggire.",
    lessons: [
      'In apertura non si mangiano pedoni lasciando il re al centro.',
      'L’arrocco lungo porta subito una torre sulla colonna del re avversario.',
      'Lo scacco doppio è la forma più forte di attacco di scoperta: il re deve muovere.',
    ],
    pgn: `1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nf6 5.Qd3 e5?! {Una spinta ambiziosa: apre il centro mentre il re nero è ancora a casa.} 6.dxe5 Qa5+ 7.Bd2 Qxe5
8.O-O-O! {Il Bianco lascia il cavallo e4 in presa: la torre è già sulla colonna d.} Nxe4? 9.Qd8+!! {Sacrificio di donna sul re al centro.} Kxd8
10.Bg5+ {Scacco doppio: alfiere g5 e torre d1.} Kc7 11.Bd8# {L'alfiere dà matto, protetto dalla torre.}`,
  },
  {
    id: 'game-of-the-century',
    title: 'La partita del secolo',
    white: 'Donald Byrne',
    black: 'Bobby Fischer',
    event: 'New York, Rosenwald Memorial',
    year: 1956,
    result: '0-1',
    opening: 'Difesa Grünfeld',
    themes: ['opening', 'development', 'sacrifice', 'endgame'],
    summary:
      'Fischer, tredicenne, sacrifica la donna per un attacco che gli frutta torre, due alfieri e un cavallo, poi chiude con un matto di soli pezzi minori e torre.',
    intro:
      "New York, 1956: Bobby Fischer ha tredici anni e gioca con il Nero contro Donald Byrne, uno dei migliori maestri americani. La partita fu subito chiamata «la partita del secolo». Il Bianco perde un po’ di tempo in apertura e tiene il re al centro; Fischer lo punisce con un sacrificio di donna stupefacente alla diciassettesima mossa. In cambio riceve torre, due alfieri e cavallo, e i suoi pezzi coordinati danno matto. Impara a valutare un sacrificio da quanto lavorano bene i pezzi che ricevi.",
    lessons: [
      'Il re che non arrocca è un bersaglio anche a metà partita.',
      'Un sacrificio di donna può essere un investimento se i pezzi che si ricevono lavorano insieme.',
      'Con vantaggio di materiale, i pezzi coordinati danno matto anche contro la donna.',
    ],
    pgn: `1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O {Il Nero completa il fianchetto e arrocca subito.} 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7
9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5? {Il Bianco ritarda ancora lo sviluppo dell'alfiere f1 e dell'arrocco.} Na4!! {Una mossa sorprendente: se 12.Nxa4 Nxe4 con attacco.} 12.Qa3 Nxc3 13.bxc3 Nxe4
14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 {Il re bianco non ha arroccato e ora viene inseguito.} Be6!! {Fischer lascia la donna: il «mulino» di scacchi gli darà molto più materiale.}
18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 {Per la donna il Nero ha ricevuto due alfieri, una torre e un pedone.}
24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h5 34.Ne5 Kg7
35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# {Matto con torre, cavallo e alfieri: la donna bianca guarda da lontano.}`,
  },
  {
    id: 'fischer-spassky-6',
    title: 'Fischer–Spassky, sesta partita',
    white: 'Bobby Fischer',
    black: 'Boris Spassky',
    event: 'Campionato del mondo, Reykjavík',
    year: 1972,
    result: '1-0',
    opening: 'Gambetto di donna rifiutato',
    themes: ['strategy', 'development', 'attack'],
    summary:
      'Fischer gioca per la prima volta in carriera 1.c4 e vince una partita «perfetta»: alla fine anche Spassky applaudì.',
    intro:
      "Reykjavík, 1972, sesta partita del match più famoso della storia, giocato in piena Guerra fredda. Fischer, che giocava quasi sempre 1.e4, sorprende tutti con 1.c4 e arriva a una variante del Gambetto di donna rifiutato. È una partita strategica, quasi «perfetta»: il Bianco blocca i pedoni sospesi neri, li trasforma in bersagli e poi attacca sul lato di re. Alla fine anche Spassky si unì all’applauso del pubblico. Impara come si gioca contro i pedoni sospesi e come si passa dal centro all’attacco.",
    lessons: [
      'I pedoni sospesi (c5 e d5) sono forti al centro ma diventano un bersaglio se vengono bloccati.',
      'Un pedone passato avanzato (e6) lega i pezzi dell’avversario.',
      'Si attacca dove si è più forti: Fischer spinge f4–f5 e raddoppia le torri sulla colonna f.',
    ],
    pgn: `1.c4 e6 2.Nf3 d5 3.d4 Nf6 4.Nc3 Be7 5.Bg5 O-O 6.e3 h6 7.Bh4 b6 {La variante Tartakower, solida e molto giocata.} 8.cxd5 Nxd5 9.Bxe7 Qxe7
10.Nxd5 exd5 11.Rc1 Be6 12.Qa4 c5 13.Qa3 Rc8 14.Bb5 {Provoca …a6, una piccola debolezza sul lato di donna; poi l'alfiere tornerà in e2.} a6 15.dxc5 bxc5 {Il Nero ha i pedoni sospesi c5 e d5.}
16.O-O Ra7 17.Be2 Nd7 18.Nd4! {Il cavallo occupa la casa davanti ai pedoni neri e prepara il cambio dell'alfiere e6.} Qf8 19.Nxe6 fxe6 20.e4! {Il Bianco colpisce subito il centro nero.} d4
21.f4 Qe7 22.e5 Rb8 23.Bc4 Kh8 24.Qh3 Nf8 25.b3 a5 26.f5! {L'attacco si sposta sul lato di re, dove il Bianco è più forte.} exf5 27.Rxf5 Nh7 28.Rcf1 Qd8 29.Qg3 Re7
30.h4 Rbb7 31.e6 {Il pedone passato e6 paralizza il Nero.} Rbc7 32.Qe5 Qe8 33.a4 Qd8 34.R1f2 Qe8 35.R2f3 Qd8 36.Bd3 Qe8 37.Qe4 {Minaccia Tf8+ e matto.} Nf6
38.Rxf6! gxf6 39.Rxf6 Kg8 40.Bc4 Kh8 41.Qf4 {Il matto è inevitabile e il Nero abbandona.}`,
  },
  {
    id: 'deep-blue-kasparov-6',
    title: 'Deep Blue–Kasparov, sesta partita',
    white: 'Deep Blue',
    black: 'Garry Kasparov',
    event: 'New York, rivincita uomo–macchina',
    year: 1997,
    result: '1-0',
    opening: 'Difesa Caro-Kann',
    themes: ['opening', 'sacrifice', 'attack'],
    summary:
      'La partita decisiva della sfida: Kasparov sbaglia l’ordine di mosse in apertura e il computer sacrifica un cavallo in e6. Il campione del mondo abbandona dopo 19 mosse.',
    intro:
      "New York, 1997: la sesta e ultima partita della rivincita tra il campione del mondo Garry Kasparov e il computer Deep Blue di IBM. Il match era in parità e questa partita lo decise: per la prima volta un computer batté un campione del mondo in un match. Kasparov sbaglia l’ordine delle mosse in una Caro-Kann che conosceva bene e Deep Blue sacrifica subito un cavallo in e6. Il re nero non riesce più ad arroccare. Impara che in apertura un solo tempo sbagliato può bastare a perdere.",
    lessons: [
      'In apertura anche l’ordine delle mosse conta: un tempo di ritardo può costare caro.',
      'Un sacrificio che lascia il re avversario al centro dà un attacco duraturo.',
      'Il re che non riesce ad arroccare blocca anche lo sviluppo degli altri pezzi.',
    ],
    pgn: `1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Ng5 {Un'idea moderna: il cavallo guarda subito f7 ed e6.} Ngf6 6.Bd3 e6 7.N1f3 h6? {Un errore noto di ordine di mosse: qui si gioca 7…Ad6.}
8.Nxe6! {Il sacrificio: per il cavallo il Bianco ottiene due pedoni e un attacco che non finisce.} Qe7 9.O-O fxe6 10.Bg6+ Kd8 {Il re nero deve restare al centro, chiudendo i propri pezzi.} 11.Bf4 b5
12.a4 Bb7 13.Re1 Nd5 14.Bg3 Kc8 15.axb5 cxb5 16.Qd3 Bc6 17.Bf5! exf5 18.Rxe7 Bxe7 19.c4 {Il Bianco recupera il materiale con interessi e il Nero abbandona.}`,
  },
  {
    id: 'kasparov-topalov',
    title: "L'Immortale di Kasparov",
    white: 'Garry Kasparov',
    black: 'Veselin Topalov',
    event: 'Wijk aan Zee',
    year: 1999,
    result: '1-0',
    opening: 'Difesa Pirc',
    themes: ['attack', 'sacrifice', 'endgame'],
    summary:
      'Il re nero viene trascinato dalla colonna b fino a d1, nel campo bianco, grazie a una serie di sacrifici calcolata con molte mosse di anticipo.',
    intro:
      "Wijk aan Zee, 1999: Garry Kasparov, campione del mondo, gioca quella che molti considerano la sua partita più bella. Contro la Difesa Pirc di Veselin Topalov il re nero si rifugia sul lato di donna, ma con la ventiquattresima mossa Kasparov sacrifica una torre e comincia una caccia al re che lo porta fino a d1, nel campo bianco. È una combinazione calcolata con molte mosse di anticipo. Seguila lentamente e chiediti a ogni mossa perché il re nero non ha alternative.",
    lessons: [
      'Un re che esce dal suo rifugio può essere inseguito per tutta la scacchiera.',
      'I sacrifici di torre su d4 ed e7 aprono le linee verso il re.',
      'Alla fine anche i pezzi più lontani (l’alfiere h3) partecipano all’attacco.',
    ],
    pgn: `1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.Nge2 Nbd7 8.Bh6 Bxh6 9.Qxh6 Bb7 10.a3 e5 11.O-O-O Qe7 12.Kb1 a6
13.Nc1 O-O-O {I due re sono arroccati lungo: la battaglia si gioca al centro e sul lato di donna.} 14.Nb3 exd4 15.Rxd4 c5 16.Rd1 Nb6 17.g3 Kb8 18.Na5 Ba8 19.Bh3 d5
20.Qf4+ Ka7 21.Rhe1 d4 22.Nd5 Nbxd5 23.exd5 Qd6 24.Rxd4!! {Inizia la combinazione: la torre si sacrifica per aprire le linee.} cxd4 25.Re7+! Kb6
26.Qxd4+ Kxa5 27.b4+ Ka4 {Il re nero è stato trascinato in mezzo ai pezzi bianchi.} 28.Qc3 Qxd5 29.Ra7! Bb7 30.Rxb7 Qc4 31.Qxf6 Kxa3 32.Qxa6+ Kxb4 33.c3+ Kxc3
34.Qa1+ Kd2 35.Qb2+ Kd1 {Il re nero è arrivato fino alla prima traversa bianca.} 36.Bf1! Rd2 37.Rd7! Rxd7 38.Bxc4 bxc4 39.Qxh8 Rd3 40.Qa8 c3 41.Qa4+ Ke1
42.f4 f5 43.Kc1 Rd2 44.Qa7 {Il Bianco ha la donna contro due pedoni passati: il Nero abbandona.}`,
  },
  {
    id: "carlsen-anand-2013-5",
    title: "Carlsen–Anand, quinta partita",
    white: "Magnus Carlsen",
    black: "Viswanathan Anand",
    event: "Campionato del mondo, Chennai",
    year: 2013,
    result: "1-0",
    opening: "Gambetto di donna rifiutato",
    themes: ["strategy", "endgame"],
    summary:
      "La prima vittoria di Carlsen nel match mondiale con Anand: senza donne, con piccoli vantaggi accumulati un po' alla volta e un finale di torri condotto fino in fondo.",
    intro:
      "Chennai, 2013, campionato del mondo: lo sfidante è Magnus Carlsen, 22 anni, contro il campione Viswanathan Anand, a casa sua. Dopo quattro patte questa è la prima vittoria del match, e mostra lo stile di Carlsen: nessun attacco travolgente, ma piccoli vantaggi accumulati con pazienza. Le donne si cambiano presto e la partita si decide in un lungo finale di torri. Impara a non accontentarti della patta quando la posizione è appena migliore: continua a fare domande all’avversario finché sbaglia.",
    lessons: [
      "Un lieve vantaggio, se si fa crescere con pazienza, può diventare un finale vinto.",
      "Dopo il cambio delle donne contano l'attività dei pezzi e la posizione del re.",
      "Nei finali di torre i pedoni passati, anche lontani, costringono l'avversario a restare passivo.",
    ],
    pgn: `1.c4 e6 2.d4 d5 3.Nc3 c6 4.e4 dxe4 5.Nxe4 {Il Bianco prende il pedone in e4: la posizione si apre subito.} Bb4+ 6.Nc3 c5 7.a3 Ba5 8.Nf3 Nf6
9.Be3 Nc6 10.Qd3 cxd4 11.Nxd4 Ng4 12.O-O-O {Arrocco lungo: la torre in d1 si schiera sulla colonna d.} Nxe3 13.fxe3 Bc7 14.Nxc6 bxc6 15.Qxd8+ {Cambio delle donne: si va verso un finale in cui il Bianco ha i pezzi più attivi.} Bxd8 16.Be2 Ke7
17.Bf3 Bd7 18.Ne4 Bb6 19.c5 f5 20.cxb6 fxe4 21.b7 {Il pedone arriva in b7: il Nero deve ricatturarlo con la torre.} Rab8 22.Bxe4 Rxb7 23.Rhf1 Rb5 24.Rf4 g5
25.Rf3 h5 26.Rdf1 Be8 27.Bc2 Rc5 28.Rf6 h4 29.e4 a5 30.Kd2 Rb5 31.b3 Bh5 32.Kc3 Rc5+
33.Kb2 Rd8 34.R1f2 Rd4 35.Rh6 Bd1 36.Bb1 Rb5 37.Kc3 c5 38.Rb2 e5 39.Rg6 a4 40.Rxg5 {La torre bianca prende il pedone g5: il Bianco guadagna materiale.} Rxb3+
41.Rxb3 Bxb3 42.Rxe5+ Kd6 43.Rh5 Rd1 44.e5+ Kd5 45.Bh7 Rc1+ 46.Kb2 Rg1 47.Bg8+ Kc6 48.Rh6+ Kd7
49.Bxb3 axb3 50.Kxb3 Rxg2 51.Rxh4 Ke6 52.a4 Kxe5 53.a5 Kd6 54.Rh7 Kd5 55.a6 c4+ 56.Kc3 Ra2
57.a7 {Il pedone in a7 imprigiona la torre nera, che non può più lasciare la colonna a.} Kc5 58.h4`,
  },
  {
    id: "anand-carlsen-2013-6",
    title: "Anand–Carlsen, sesta partita",
    white: "Viswanathan Anand",
    black: "Magnus Carlsen",
    event: "Campionato del mondo, Chennai",
    year: 2013,
    result: "0-1",
    opening: "Spagnola, variante Berlinese con 4.d3",
    themes: ["strategy", "endgame"],
    summary:
      "Una partita lunga e tesa: Carlsen difende con calma e, quando il Bianco allenta la presa, trasforma i suoi pedoni passati sul lato di re in una vittoria.",
    intro:
      "Chennai, 2013, sesta partita: il giorno dopo la sua prima vittoria Carlsen ha il Nero, e Anand sceglie la tranquilla Spagnola con 4.d3. Non succede nulla di clamoroso per molte mosse; Carlsen difende con calma, cambia i pezzi giusti e, quando il Bianco allenta la presa nel finale di torri, i suoi pedoni passati sul lato di re diventano inarrestabili. Con questa vittoria prende il largo nel match. Impara quanto valgono una torre attiva e due pedoni passati collegati.",
    lessons: [
      "Difendersi con calma permette di sfruttare le imprecisioni dell'avversario.",
      "Nel finale di torri l'attività della torre conta più di un pedone.",
      "Due pedoni passati collegati sono una forza decisiva.",
    ],
    pgn: `1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.d3 {Una continuazione tranquilla: il Bianco evita le varianti teoriche più affilate.} Bc5 5.c3 O-O 6.O-O Re8 7.Re1 a6 8.Ba4 b5
9.Bb3 d6 10.Bg5 Be6 11.Nbd2 h6 12.Bh4 Bxb3 {Il Nero cambia l'alfiere chiaro: la lotta continua con i pezzi minori.} 13.axb3 Nb8 14.h3 Nbd7 15.Nh2 Qe7 16.Ndf1 Bb6
17.Ne3 Qe6 18.b4 a5 19.bxa5 Bxa5 20.Nhg4 Bb6 21.Bxf6 {Il Bianco cambia l'alfiere con il cavallo in f6, riducendo le difese del re nero.} Nxf6 22.Nxf6+ Qxf6 23.Qg4 Bxe3 24.fxe3 Qe7
25.Rf1 c5 26.Kh2 c4 27.d4 Rxa1 28.Rxa1 Qb7 29.Rd1 Qc6 30.Qf5 exd4 31.Rxd4 Re5 32.Qf3 Qc7
33.Kh1 Qe7 34.Qg4 Kh7 35.Qf4 g6 36.Kh2 Kg7 37.Qf3 Re6 38.Qg3 Rxe4 39.Qxd6 Rxe3 40.Qxe7 {Le donne si cambiano: resta un finale di torri con pedoni su entrambe le ali.} Rxe7
41.Rd5 Rb7 42.Rd6 f6 43.h4 Kf7 44.h5 gxh5 45.Rd5 Kg6 46.Kg3 Rb6 47.Rc5 f5 48.Kh4 Re6
49.Rxb5 Re4+ 50.Kh3 Kg5 51.Rb8 h4 {Il Nero avanza i pedoni sul lato di re: il Bianco resta sulla difensiva.} 52.Rg8+ Kh5 53.Rf8 Rf4 54.Rc8 Rg4 55.Rf8 Rg3+ 56.Kh2 Kg5
57.Rg8+ Kf4 58.Rc8 Ke3 59.Rxc4 f4 60.Ra4 h3 61.gxh3 Rg6 62.c4 f3 {Il pedone f nero arriva in f3: la minaccia di promuovere è decisiva.} 63.Ra3+ Ke2 64.b4 f2
65.Ra2+ Kf3 66.Ra3+ Kf4 67.Ra8 Rg1 {Il pedone f2 sta per promuovere: Anand abbandona.}`,
  },
  {
    id: "carlsen-anand-2014-6",
    title: "Carlsen–Anand, sesta partita",
    white: "Magnus Carlsen",
    black: "Viswanathan Anand",
    event: "Campionato del mondo, Soči",
    year: 2014,
    result: "1-0",
    opening: "Siciliana, variante Kan",
    themes: ["strategy", "endgame", "attack"],
    summary:
      "Carlsen cambia subito le donne ma tiene viva la partita: con i pedoni h avanzati e una torre in g3 mette sotto pressione il re nero e vince un pedone decisivo.",
    intro:
      "Soči, 2014: rivincita del mondiale tra Carlsen e Anand. Carlsen cambia le donne alla nona mossa, eppure la partita resta piena di tensione: avanza il pedone h, porta una torre sulla terza traversa e mette pressione al re nero anche senza donne. Alla mossa 26 entrambi i giocatori sbagliano: Carlsen permette una combinazione e Anand non la vede, poi perde. Impara due cose: un finale senza donne può essere ricco di attacco, e prima di ogni mossa controlla sempre le minacce dell’avversario, anche quando stai meglio.",
    lessons: [
      "Il cambio delle donne non spegne la partita: l'attacco sul re può continuare anche senza.",
      "Pedoni su c4 ed e4 tolgono spazio e case al Nero (il «vincolo Maróczy»).",
      "Una torre che passa per la terza traversa può entrare nel gioco in modo inatteso.",
    ],
    pgn: `1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.c4 {Il Bianco costruisce il «vincolo Maróczy»: i pedoni c4 ed e4 controllano d5 e riducono lo spazio del Nero.} Nf6 6.Nc3 Bb4 7.Qd3 Nc6 8.Nxc6 dxc6
9.Qxd8+ {Cambio di donne subito: Carlsen cerca un finale con piccole ma durature pressioni.} Kxd8 10.e5 Nd7 11.Bf4 Bxc3+ 12.bxc3 Kc7 13.h4 {Il pedone h avanza per guadagnare spazio sul lato di re.} b6 14.h5 h6 15.O-O-O Bb7 16.Rd3 c5
17.Rg3 {La torre passa per la terza traversa e arriva sulla colonna g.} Rag8 18.Bd3 Nf8 19.Be3 g6 20.hxg6 {Il Bianco apre le colonne h e g per le sue torri.} Nxg6 21.Rh5 Bc6 22.Bc2 Kb7 23.Rg4 a5 24.Bd1 Rd8
25.Bc2 Rdg8 26.Kd2 a4 27.Ke2 a3 28.f3 Rd8 29.Ke1 Rd7 30.Bc1 Ra8 31.Ke2 Ba4 32.Be4+ Bc6
33.Bxg6 {Cambio che apre le linee e indebolisce il re nero.} fxg6 34.Rxg6 {La torre prende il pedone g6: il Bianco guadagna materiale.} Ba4 35.Rxe6 Rd1 36.Bxa3 Ra1 37.Ke3 Bc2 38.Re7+ {Con lo scacco la torre bianca vince materiale: il Nero abbandona.}`,
  },
  {
    id: "carlsen-nepomniachtchi-2021-6",
    title: "Carlsen–Nepomniachtchi, sesta partita",
    white: "Magnus Carlsen",
    black: "Ian Nepomniachtchi",
    event: "Campionato del mondo, Dubai",
    year: 2021,
    result: "1-0",
    opening: "Apertura Catalana",
    themes: ["strategy", "endgame"],
    summary:
      "136 mosse, la partita più lunga della storia dei campionati del mondo: Carlsen sacrifica la donna per due torri e poi spinge per ore finché il Nero cede.",
    intro:
      "Dubai, 2021: sesta partita del mondiale contro Ian Nepomniachtchi, dopo cinque patte. Diventa la partita più lunga della storia dei campionati del mondo: 136 mosse, quasi otto ore. Carlsen dà la donna per due torri, poi per decine di mosse manovra torri e cavallo cercando un varco, mentre il Nero difende con la donna. Da qui in avanti lo sfidante crollò e il match finì presto. Impara la pazienza nei finali lunghi e come due torri coordinate possono battere una donna.",
    lessons: [
      "Un sacrificio di qualità (donna per due torri) può dare un vantaggio posizionale più che materiale.",
      "Nei finali lunghi la pazienza e la precisione contano più della fretta di vincere.",
      "Un cavallo ben piazzato, sostenuto dai pedoni, può valere quanto una torre.",
    ],
    pgn: `1.d4 Nf6 2.Nf3 d5 3.g3 {Un sistema tranquillo: l'alfiere in g2 controlla la lunga diagonale.} e6 4.Bg2 Be7 5.O-O O-O 6.b3 c5 7.dxc5 Bxc5 8.c4 dxc4
9.Qc2 Qe7 10.Nbd2 Nc6 11.Nxc4 {Il Bianco recupera il pedone di c4.} b5 12.Nce5 Nb4 13.Qb2 Bb7 14.a3 Nc6 15.Nd3 Bb6 16.Bg5 Rfd8
17.Bxf6 {Il Bianco rovina la struttura dei pedoni neri, che ora ha un pedone doppio.} gxf6 18.Rac1 Nd4 19.Nxd4 Bxd4 20.Qa2 Bxg2 21.Kxg2 Qb7+ 22.Kg1 Qe4 23.Qc2 a5 24.Rfd1 Kg7
25.Rd2 Rac8 26.Qxc8 {Carlsen dà la donna per due torri: il materiale è equilibrato ma la posizione resta molto aperta.} Rxc8 27.Rxc8 Qd5 28.b4 a4 29.e3 Be5 30.h4 {Il pedone h avanza per creare un'altra debolezza sul lato di re nero.} h5 31.Kh2 Bb2 32.Rc5 Qd6
33.Rd1 Bxa3 34.Rxb5 Qd7 35.Rc5 e5 36.Rc2 Qd5 37.Rdd2 Qb3 38.Ra2 e4 39.Nc5 Qxb4 40.Nxe4 Qb3
41.Rac2 Bf8 42.Nc5 Qb5 43.Nd3 a3 44.Nf4 Qa5 45.Ra2 Bb4 46.Rd3 Kh6 47.Rd1 Qa4 48.Rda1 Bd6
49.Kg1 Qb3 50.Ne2 Qd3 51.Nd4 Kh7 52.Kh2 Qe4 53.Rxa3 Qxh4+ 54.Kg1 Qe4 55.Ra4 Be5 56.Ne2 Qc2
57.R1a2 Qb3 58.Kg2 Qd5+ 59.f3 Qd1 60.f4 Bc7 61.Kf2 Bb6 62.Ra1 Qb3 63.Re4 Kg7 64.Re8 f5
65.Raa8 Qb4 66.Rac8 Ba5 67.Rc1 Bb6 68.Re5 Qb3 69.Re8 Qd5 70.Rcc8 Qh1 71.Rc1 Qd5 72.Rb1 Ba7
73.Re7 Bc5 74.Re5 Qd3 75.Rb7 Qc2 76.Rb5 Ba7 77.Ra5 Bb6 78.Rab5 Ba7 79.Rxf5 {Dopo una lunghissima manovra il Bianco prende il pedone f5.} Qd3 80.Rxf7+ Kxf7
81.Rb7+ {Con lo scacco la torre bianca prende il controllo della settima traversa e vince l'alfiere.} Kg6 82.Rxa7 Qd5 83.Ra6+ Kh7 84.Ra1 Kg6 85.Nd4 Qb7 86.Ra2 Qh1 87.Ra6+ Kf7 88.Nf3 Qb1
89.Rd6 Kg7 90.Rd5 Qa2+ 91.Rd2 Qb1 92.Re2 Qb6 93.Rc2 Qb1 94.Nd4 Qh1 95.Rc7+ Kf6 96.Rc6+ Kf7
97.Nf3 Qb1 98.Ng5+ Kg7 99.Ne6+ Kf7 100.Nd4 Qh1 101.Rc7+ Kf6 102.Nf3 Qb1 103.Rd7 Qb2+ 104.Rd2 Qb1
105.Ng1 Qb4 106.Rd1 Qb3 107.Rd6+ Kg7 108.Rd4 Qb2+ 109.Ne2 Qb1 110.e4 Qh1 111.Rd7+ Kg8 112.Rd4 Qh2+
113.Ke3 h4 114.gxh4 Qh3+ 115.Kd2 Qxh4 116.Rd3 Kf8 117.Rf3 Qd8+ 118.Ke3 Qa5 119.Kf2 Qa7+ 120.Re3 Qd7
121.Ng3 Qd2+ 122.Kf3 Qd1+ 123.Re2 Qb3+ 124.Kg2 Qb7 125.Rd2 Qb3 126.Rd5 Ke7 127.Re5+ Kf7 128.Rf5+ Ke8
129.e5 Qa2+ 130.Kh3 Qe6 131.Kh4 Qh6+ 132.Nh5 Qh7 133.e6 Qg6 134.Rf7 Kd8 135.f5 Qg1 136.Ng7 {Dopo quasi otto ore il Nero abbandona: è la partita più lunga di un campionato del mondo.}`,
  },
  {
    id: "carlsen-topalov-2009",
    title: "Carlsen–Topalov, Nanchino",
    white: "Magnus Carlsen",
    black: "Veselin Topalov",
    event: "Pearl Spring, Nanchino",
    year: 2009,
    result: "1-0",
    opening: "Difesa Est-Indiana",
    themes: ["attack", "strategy"],
    summary:
      "A 18 anni Carlsen batte l'ex campione del mondo Topalov con un attacco sul lato di re condotto con i pedoni: arrocchi opposti e linee aperte contro il re avversario.",
    intro:
      "Nanchino, 2009, torneo Pearl Spring: Carlsen ha 18 anni e qui ottiene una delle prestazioni migliori della sua carriera giovanile. Contro l’ex campione del mondo Veselin Topalov, nella Difesa Est-Indiana, sceglie un piano diretto: arrocco lungo, pedoni g e h lanciati contro il re nero. Con gli arrocchi opposti vince chi apre prima le linee. Impara come si attacca con i pedoni quando i re sono su lati diversi e perché il tempismo conta più del materiale.",
    lessons: [
      "Con gli arrocchi opposti si attacca spingendo i pedoni verso il re avversario.",
      "Aprire le colonne davanti al re nemico dà alle torri vie d'accesso decisive.",
      "Il tempismo è tutto: chi attacca per primo con più pezzi ha spesso l'iniziativa.",
    ],
    pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.h3 {Una mossa solida: il Bianco prepara g4 e un'espansione sul lato di re.} Na6 7.Be3 e5 8.d5 c6
9.g4 {I pedoni bianchi avanzano contro il re nero: Carlsen attacca con decisione.} Nc5 10.Nd2 a5 11.a3 Nfd7 12.Rg1 a4 13.Qc2 Nb6 14.O-O-O {Arrocco lungo: i due re sono su ali opposte e la partita sarà una corsa all'attacco.} Bd7 15.Kb1 cxd5 16.cxd5 Rc8
17.Bb5 Bxb5 18.Nxb5 Qd7 19.Nc3 Bf6 20.g5 {Il pedone g5 colpisce l'alfiere in f6 e tiene chiusa la posizione.} Bd8 21.h4 Na8 22.Bxc5 Rxc5 23.Qxa4 Qc8 24.Rc1 Nb6
25.Qd1 Qh3 26.Qf3 Qd7 27.Qd3 Kg7 28.Rc2 f6 29.gxf6+ {Si apre la colonna g: il re nero è esposto.} Rxf6 30.h5 Rxf2 31.hxg6 h6 32.Nd1 Rxc2
33.Nxf2 Rc8 34.Ng4 Bg5 35.Nf3 Nc4 36.Nxg5 hxg5 37.Ne3 Nxe3 38.Qxe3 Qa4 39.Qxg5 Qxe4+ 40.Ka1 Re8
41.Rc1 {Il Nero abbandona: il Bianco ha troppe minacce contro il suo re.}`,
  },
  {
    id: "carlsen-karjakin-2016-10",
    title: "Carlsen–Karjakin, decima partita",
    white: "Magnus Carlsen",
    black: "Sergey Karjakin",
    event: "Campionato del mondo, New York",
    year: 2016,
    result: "1-0",
    opening: "Spagnola, variante Berlinese con 4.d3",
    themes: ["strategy", "endgame"],
    summary:
      "Dopo la sconfitta nell'ottava partita, Carlsen riporta il match in parità con una vittoria da maestro: pressione continua in un finale con poco materiale.",
    intro:
      "New York, 2016: Sergey Karjakin ha appena vinto l’ottava partita e il campione Carlsen è in svantaggio. Nella decima risponde con una vittoria da maestro, partendo da una tranquilla Spagnola Berlinese con 4.d3. Il finale sembra pari, ma Carlsen sposta il gioco da un’ala all’altra, apre il lato di donna con b4–b5 al momento giusto e alla fine il suo re entra nella posizione nera. Impara come si vince una posizione «normale» mettendo problemi all’avversario mossa dopo mossa.",
    lessons: [
      "Un finale quasi pari può essere vinto se si mettono continuamente problemi all'avversario.",
      "Spostare il gioco da un lato all'altro della scacchiera sovraccarica le difese dell'avversario.",
      "Una rottura di pedoni al momento giusto (b4–b5) apre il gioco a favore di chi ha i pezzi più attivi.",
    ],
    pgn: `1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.d3 {Una variante tranquilla della Spagnola: Carlsen preferisce una lotta lunga.} Bc5 5.c3 O-O 6.Bg5 {Il Bianco inchioda il cavallo in f6 sulla donna.} h6 7.Bh4 Be7 8.O-O d6
9.Nbd2 Nh5 {Il cavallo nero va in h5 per cambiare l'alfiere g5.} 10.Bxe7 Qxe7 11.Nc4 Nf4 12.Ne3 Qf6 13.g3 Nh3+ 14.Kh1 Ne7 15.Bc4 c6 16.Bb3 Ng6
17.Qe2 a5 18.a4 Be6 19.Bxe6 fxe6 20.Nd2 d5 21.Qh5 Ng5 22.h4 Nf3 23.Nxf3 Qxf3+ 24.Qxf3 {Cambio delle donne: il finale è equilibrato ma più comodo per il Bianco.} Rxf3
25.Kg2 Rf7 26.Rfe1 h5 27.Nf1 Kf8 28.Nd2 Ke7 29.Re2 Kd6 30.Nf3 Raf8 31.Ng5 Re7 32.Rae1 Rfe8
33.Nf3 Nh8 34.d4 {Il Bianco apre il centro con d4 per sfruttare l'attività dei suoi pezzi.} exd4 35.Nxd4 g6 36.Re3 Nf7 37.e5+ {Il pedone in e5 guadagna spazio e limita il cavallo nero.} Kd7 38.Rf3 Nh6 39.Rf6 Rg7 40.b4 axb4
41.cxb4 Ng8 42.Rf3 Nh6 43.a5 Nf5 44.Nb3 Kc7 45.Nc5 Kb8 46.Rb1 Ka7 47.Rd3 Rc7 48.Ra3 Nd4
49.Rd1 Nf5 50.Kh3 Nh6 51.f3 Rf7 52.Rd4 Nf5 53.Rd2 Rh7 54.Rb3 Ree7 55.Rdd3 Rh8 56.Rb1 Rhh7
57.b5 {Rottura di pedoni sul lato di donna: si aprono le linee per le torri.} cxb5 58.Rxb5 d4 59.Rb6 Rc7 60.Nxe6 {Il cavallo prende il pedone e6: comincia la fase decisiva.} Rc3 61.Nf4 Rhc7 62.Nd5 Rxd3 63.Nxc7 Kb8 64.Nb5 Kc8
65.Rxg6 {La torre bianca prende il pedone g6.} Rxf3 66.Kg2 Rb3 67.Nd6+ Nxd6 68.Rxd6 Re3 69.e6 Kc7 70.Rxd4 Rxe6 71.Rd5 Rh6 72.Kf3 Kb8
73.Kf4 Ka7 74.Kg5 Rh8 75.Kf6 {Il Nero abbandona: il re bianco entra nella posizione nera.}`,
  },
  {
    id: "carlsen-nakamura-2013",
    title: "Carlsen–Nakamura, Wijk aan Zee",
    white: "Magnus Carlsen",
    black: "Hikaru Nakamura",
    event: "Tata Steel, Wijk aan Zee",
    year: 2013,
    result: "1-0",
    opening: "Siciliana, variante Kalashnikov",
    themes: ["attack", "sacrifice"],
    summary:
      "Carlsen risponde con precisione all'aggressiva difesa di Nakamura e, in sole 31 mosse, travolge il re nero con i pedoni f e g e un sacrificio d'alfiere.",
    intro:
      "Wijk aan Zee, 2013: Carlsen contro Hikaru Nakamura, uno dei giocatori più aggressivi del circuito. Il Nero sceglie la Siciliana Kalashnikov e lancia subito il pedone h, ma Carlsen risponde con calma, chiude il centro con un pedone in d5 e poi contrattacca proprio sul lato di re con f4–f5. In 31 mosse un sacrificio d’alfiere scardina le difese nere. Impara a non farti spaventare da un attacco prematuro e a contrattaccare quando l’avversario ha indebolito il proprio re.",
    lessons: [
      "Un attacco sul re funziona meglio quando pedoni e pezzi collaborano.",
      "Un sacrificio d'alfiere può scardinare la copertura del re e dare un vantaggio decisivo.",
      "Contro un attacco prematuro conviene mantenere la calma e rispondere con precisione.",
    ],
    pgn: `1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 e5 {La Siciliana Kalashnikov: il Nero spinge subito e5, indebolendo però la casa d5.} 5.Nb5 d6 6.g3 {Una scelta solida: l'alfiere in g2 controllerà la lunga diagonale.} h5 {Il Nero ha già avviato un'azione sul lato di re: il Bianco deve rispondere con precisione.} 7.N1c3 a6 8.Na3 b5
9.Nd5 Nge7 10.Bg2 Bg4 11.f3 Be6 12.c3 h4 13.Nc2 Bxd5 14.exd5 {Il pedone bianco in d5 limita i cavalli neri.} Na5 15.f4 {Il Bianco apre il gioco sul lato di re e contrattacca subito.} Nf5 16.g4 h3
17.Be4 Nh4 18.O-O g6 19.Kh1 Bg7 20.f5 {Rompe la catena di pedoni: l'attacco sul re nero è iniziato.} gxf5 21.gxf5 Ng2 22.f6 {Il pedone f6 è una spina: il Nero non riesce più a difendere bene il suo re.} Bf8 23.Qf3 Qc7 24.Nb4 Nb7
25.Nc6 Nc5 26.Bf5 Nd7 27.Bg5 Rg8 28.Qh5 {La donna si unisce all'attacco.} Nb6 29.Be6 {Sacrificio d'alfiere: il Bianco scardina la difesa del re nero.} Rxg5 30.Qxg5 fxe6 31.dxe6 {Il Nero abbandona: la posizione è senza speranza.}`,
  },
  {
    id: "spassky-fischer-3",
    title: "Spassky–Fischer, terza partita",
    white: "Boris Spassky",
    black: "Bobby Fischer",
    event: "Campionato del mondo, Reykjavík",
    year: 1972,
    result: "0-1",
    opening: "Difesa Benoni",
    themes: ["strategy", "attack"],
    summary:
      "La prima vittoria di Fischer contro Spassky: un cavallo sul bordo, in h5, e un gioco sul lato di re che mette in difficoltà il campione del mondo.",
    intro:
      "Reykjavík, 1972, terza partita: Fischer ha perso la prima e non si è presentato alla seconda, ed è sotto di due punti. Questa partita viene giocata in una saletta lontana dal pubblico, e qui Fischer batte Spassky per la prima volta in carriera. Con la Benoni sceglie una mossa sorprendente, il cavallo in h5, accettando i pedoni doppiati in cambio di pezzi attivi e di pressione sul re bianco. Impara che le regole generali (niente cavalli sul bordo, niente pedoni doppiati) cedono davanti a un piano concreto.",
    lessons: [
      "Un cavallo sul bordo può essere strano ma efficace se serve a un piano chiaro.",
      "Pedoni doppiati sono accettabili se in cambio si ottengono pezzi attivi.",
      "Un vantaggio di spazio si sfrutta spingendo e creando minacce, non rimanendo fermi.",
    ],
    pgn: `1.d4 Nf6 2.c4 e6 3.Nf3 c5 4.d5 {Il Benoni moderno: il Nero rinuncia al centro in cambio di spazio e attività sul lato di donna.} exd5 5.cxd5 d6 6.Nc3 g6 7.Nd2 Nbd7 8.e4 Bg7
9.Be2 O-O 10.O-O Re8 11.Qc2 Nh5 {Una mossa sorprendente: il cavallo va in h5 per cambiare l'alfiere bianco.} 12.Bxh5 gxh5 {Il Nero accetta i pedoni doppiati in cambio di pezzi attivi e dell'attacco sul re.} 13.Nc4 Ne5 14.Ne3 Qh4 {La donna nera sfrutta la linea aperta: pressione sul re bianco.} 15.Bd2 Ng4 16.Nxg4 hxg4
17.Bf4 Qf6 18.g3 Bd7 19.a4 b6 20.Rfe1 a6 21.Re2 b5 22.Rae1 Qg6 23.b3 Re7 24.Qd3 Rb8
25.axb5 axb5 26.b4 c4 27.Qd2 Rbe8 28.Re3 h5 29.R3e2 Kh7 30.Re3 Kg8 31.R3e2 Bxc3 32.Qxc3 Rxe4
33.Rxe4 Rxe4 34.Rxe4 Qxe4 35.Bh6 Qg6 36.Bc1 Qb1 37.Kf1 Bf5 38.Ke2 Qe4+ 39.Qe3 Qc2+ 40.Qd2 Qb3
41.Qd4 Bd3+ {Scacco decisivo: il Bianco perde materiale e Spassky abbandona.}`,
  },
  {
    id: "karpov-kasparov-1985-24",
    title: "Karpov–Kasparov, ventiquattresima partita",
    white: "Anatoly Karpov",
    black: "Garry Kasparov",
    event: "Campionato del mondo, Mosca",
    year: 1985,
    result: "0-1",
    opening: "Siciliana, variante Scheveningen",
    themes: ["attack", "strategy", "sacrifice"],
    summary:
      "L'ultima partita del match: con il Nero Kasparov vince e, a 22 anni, diventa il più giovane campione del mondo della storia.",
    intro:
      "Mosca, 1985: ultima partita del campionato del mondo. Kasparov conduce di un punto e Anatoly Karpov, il campione, deve vincere per conservare il titolo. Karpov attacca con i pedoni sul lato di re, ma così indebolisce la propria posizione; Kasparov, con il Nero in una Siciliana Scheveningen, resiste, contrattacca al centro e con l’alfiere sulla lunga diagonale chiude la partita. A 22 anni diventa il più giovane campione del mondo. Impara come rispondere a un attacco di pedoni: colpendo al centro.",
    lessons: [
      "Il Nero può contrattaccare al centro mentre il Bianco attacca sul lato di re.",
      "Un alfiere sulla lunga diagonale può decidere una partita da lontano.",
      "Un attacco con pedoni (g4–g5) indebolisce anche il proprio re.",
    ],
    pgn: `1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2 e6 7.O-O Be7 8.f4 {Il Bianco prepara un attacco sul lato di re con i pedoni.} O-O
9.Kh1 Qc7 10.a4 Nc6 11.Be3 Re8 12.Bf3 Rb8 13.Qd2 Bd7 14.Nb3 b6 15.g4 {Karpov attacca sul lato di re con i pedoni.} Bc8 16.g5 {Il pedone g5 caccia il cavallo, ma indebolisce il re bianco.} Nd7
17.Qf2 Bf8 18.Bg2 Bb7 19.Rad1 g6 20.Bc1 Rbc8 21.Rd3 Nb4 {Il cavallo nero minaccia la torre in d3 e la casa c2.} 22.Rh3 Bg7 23.Be3 Re7 24.Kg1 Rce8
25.Rd1 f5 {Kasparov contrattacca al centro con f5.} 26.gxf6 Nxf6 27.Rg3 Rf7 28.Bxb6 {Il Bianco prende il pedone b6, ma i suoi pezzi restano lontani dal proprio re.} Qb8 29.Be3 Nh5 30.Rg4 Nf6 31.Rh4 g5 32.fxg5 Ng4
33.Qd2 Nxe3 34.Qxe3 Nxc2 35.Qb6 Ba8 {L'alfiere guarda il re bianco lungo la lunga diagonale: il Nero ha l'iniziativa.} 36.Rxd6 {Il Bianco prende pedoni, ma il suo re è troppo scoperto.} Rb7 37.Qxa6 Rxb3 38.Rxe6 Rxb2 39.Qc4 Kh8 40.e5 Qa7+
41.Kh1 Bxg2+ {L'alfiere si sacrifica sul re: la mossa decisiva.} 42.Kxg2 Nd4+ {Scacco di scoperta della torre in b2: Karpov abbandona.}`,
  },
];

const gameById = new Map(FAMOUS_GAMES.map((g) => [g.id, g]));

export function findGame(id: string): FamousGame | undefined {
  return gameById.get(id);
}
