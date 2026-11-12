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
];

const gameById = new Map(FAMOUS_GAMES.map((g) => [g.id, g]));

export function findGame(id: string): FamousGame | undefined {
  return gameById.get(id);
}
