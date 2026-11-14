import { useSyncExternalStore } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import {
  countPieces,
  isBoardView,
  normalizeGrid,
  placementToRanks,
  ranksToGrid,
  type BoardView,
} from './boardReading';
import { plausibleCorners, type Corners } from '../vision/geometry';
import { resolveReading, type ReadingReference, type ResolvedReading } from './boardResolve';
import { fuseEvidence, gridEvidence, hintGrid, informative, temper, uncertainCount, YOLO_WEIGHT, type Evidence } from '../vision/evidence';
import type { VisionResult } from '../vision/hybrid';

/**
 * Assistente con Claude (API Anthropic), usato da «Analizza»:
 * 1. legge la posizione da una foto della scacchiera (visione + output strutturato);
 * 2. spiega in italiano la valutazione calcolata da Stockfish.
 *
 * La chiave API è dell'utente: resta solo in questo browser (localStorage) e
 * viene inviata soltanto ad api.anthropic.com. Non entra nei backup né nel cloud.
 */

export const ASSISTANT_MODEL = 'claude-opus-5-5';

const KEY_STORAGE = 'cm.anthropic.apiKey';
const keyListeners = new Set<() => void>();

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // archivio non disponibile: la chiave resta solo per questa pagina
  }
  keyListeners.forEach((l) => l());
}

export function useApiKey(): string {
  return useSyncExternalStore(
    (l) => {
      keyListeners.add(l);
      return () => keyListeners.delete(l);
    },
    getApiKey,
    () => '',
  );
}

// Modalità veloce (fast mode dell'API): la risposta arriva prima, ma ogni lettura costa circa il doppio.
const FAST_STORAGE = 'cm.anthropic.fast';
const fastListeners = new Set<() => void>();

export function getFastMode(): boolean {
  try {
    return localStorage.getItem(FAST_STORAGE) !== '0';
  } catch {
    return true;
  }
}

export function setFastMode(on: boolean): void {
  try {
    localStorage.setItem(FAST_STORAGE, on ? '1' : '0');
  } catch {
    // preferenza non salvata
  }
  fastListeners.forEach((l) => l());
}

export function useFastMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      fastListeners.add(l);
      return () => fastListeners.delete(l);
    },
    getFastMode,
    () => true,
  );
}

/** Formato plausibile di una chiave Anthropic (controllo locale, non verifica la validità). */
export function looksLikeApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

export type AssistantErrorKind = 'no-key' | 'auth' | 'rate' | 'network' | 'refusal' | 'unreadable' | 'other';

export class AssistantError extends Error {
  constructor(
    readonly kind: AssistantErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

async function createClient(): Promise<{ client: Anthropic; sdk: typeof Anthropic }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new AssistantError('no-key');
  // Caricato solo quando serve: il resto dell'app non scarica l'SDK.
  const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
  // L'app non ha un server: la chiave è dell'utente e resta nel suo browser.
  const client = new AnthropicSdk({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  return { client, sdk: AnthropicSdk };
}

function mapError(error: unknown, sdk: typeof Anthropic | null): AssistantError {
  if (error instanceof AssistantError) return error;
  if (sdk) {
    if (error instanceof sdk.AuthenticationError || error instanceof sdk.PermissionDeniedError) return new AssistantError('auth');
    if (error instanceof sdk.RateLimitError) return new AssistantError('rate');
    if (error instanceof sdk.APIConnectionError) return new AssistantError('network');
    if (error instanceof sdk.APIError) return new AssistantError('other', error.message);
  }
  return new AssistantError('other', error instanceof Error ? error.message : String(error));
}

type BetaMessage = Anthropic.Beta.BetaMessage;
type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

// ───── Consumo di token (per mostrarlo all'utente) ─────

export interface AssistantUsage {
  readings: number;
  explanations: number;
  /** Token in ingresso a prezzo pieno (testo e immagini nuovi). */
  input: number;
  /** Token in ingresso letti dalla cache (costano circa un ventesimo). */
  cached: number;
  output: number;
}

const EMPTY_USAGE: AssistantUsage = { readings: 0, explanations: 0, input: 0, cached: 0, output: 0 };
let usage: AssistantUsage = EMPTY_USAGE;
const usageListeners = new Set<() => void>();

function recordUsage(kind: 'reading' | 'explanation', message: BetaMessage): void {
  const u = message.usage;
  usage = {
    readings: usage.readings + (kind === 'reading' ? 1 : 0),
    explanations: usage.explanations + (kind === 'explanation' ? 1 : 0),
    input: usage.input + (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0),
    cached: usage.cached + (u?.cache_read_input_tokens ?? 0),
    output: usage.output + (u?.output_tokens ?? 0),
  };
  usageListeners.forEach((l) => l());
}

export function resetAssistantUsage(): void {
  usage = EMPTY_USAGE;
  usageListeners.forEach((l) => l());
}

/** Consumo delle chiamate a Claude in questa sessione della pagina. */
export function useAssistantUsage(): AssistantUsage {
  return useSyncExternalStore(
    (l) => {
      usageListeners.add(l);
      return () => usageListeners.delete(l);
    },
    () => usage,
    () => EMPTY_USAGE,
  );
}

/**
 * Invia la richiesta, in modalità veloce se è attiva. La modalità veloce ha un
 * limite di richieste a parte: se viene rifiutata si ripete subito a velocità normale.
 */
async function createMessage(client: Anthropic, sdk: typeof Anthropic, params: CreateParams): Promise<BetaMessage> {
  if (!getFastMode()) return client.beta.messages.create(params);
  try {
    return await client.beta.messages.create({ ...params, speed: 'fast' });
  } catch (error) {
    if (error instanceof sdk.RateLimitError || error instanceof sdk.BadRequestError) return client.beta.messages.create(params);
    throw error;
  }
}

function textOf(message: BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// ───── 1. Lettura della scacchiera dalla foto ─────

export interface BoardReading {
  /** Primo campo della FEN (disposizione dei pezzi, dall'ottava traversa), già orientato e corretto. */
  placement: string;
  /** Tratto: quello dedotto dalla mossa riconosciuta, altrimenti quello visto da Claude. */
  sideToMove: 'w' | 'b' | 'unknown';
  /** true se il tratto è stato dedotto con certezza dalle mosse (non è un'ipotesi). */
  turnKnown: boolean;
  confidence: 'high' | 'medium' | 'low';
  /** Note sui dubbi (pezzi coperti, riflessi…), in italiano. */
  notes: string;
  /** Griglia come appare nella foto: serve a ruotare l'orientamento senza rileggere. */
  grid: string[];
  /** Lato dell'immagine dove stanno i pezzi del Bianco. */
  view: BoardView;
  /** Disposizione letta prima delle correzioni con le regole. */
  rawPlacement: string;
  /** Case sistemate perché la lettura non era una posizione raggiungibile con mosse legali. */
  corrected: string[];
  /** Mosse (SAN) riconosciute rispetto alla posizione precedente. */
  moves: string[];
  /** Angoli dell'area di gioco nell'immagine inviata (frazioni 0–1), se plausibili (rifiniti con la geometria quando possibile). */
  corners: Corners | null;
  /** FEN completa quando la posizione è stata raggiunta con mosse legali (conserva arrocchi ed en passant). */
  fen: string | null;
  /** Chi ha letto la posizione: solo Claude, Claude + YOLO, o solo la visione locale (YOLO + regole). */
  source: 'claude' | 'hybrid' | 'local';
}

export interface ReadOptions {
  /**
   * Posizione precedente, se nota: nell'analisi continua di solito è cambiata
   * una sola mossa. Serve a Claude per risolvere i pezzi dubbi (alfiere o
   * pedone? re o donna?) e al codice per scartare le letture impossibili.
   */
  reference?: ReadingReference | null;
  /** Orientamento fissato dall'utente (null = automatico). */
  view?: BoardView | null;
  /** Ultimo orientamento riconosciuto: serve a mostrare a Claude la posizione precedente nella stessa prospettiva della foto. */
  lastView?: BoardView | null;
  /** Lettura grezza precedente. */
  lastRawPlacement?: string | null;
  /** Visione locale già fatta su questa foto (angoli noti): l'evidenza YOLO entra nel prompt e nella fusione. */
  vision?: VisionResult | null;
  /** Coordinate stampate rovesciate: il Nero sta sulle righe 1-2 (non vanno usate per capire dove sta il Bianco). */
  flippedCoordinates?: boolean;
  /** Visione locale da fare dopo, con gli angoli trovati da Claude (prima lettura o foto dalla galleria). */
  analyze?: (corners: Corners) => Promise<VisionResult>;
}

const CORNER = {
  type: 'object',
  properties: { x: { type: 'integer' }, y: { type: 'integer' } },
  required: ['x', 'y'],
  additionalProperties: false,
} as const;

const READING_SCHEMA = {
  type: 'object',
  properties: {
    board_corners: {
      type: 'object',
      description:
        'The 4 corners of the 8x8 playing area (where the outer squares end, not the wooden frame), in image coordinates from 0 to 1000: x from the left edge, y from the top edge.',
      properties: {
        top_left: CORNER,
        top_right: CORNER,
        bottom_right: CORNER,
        bottom_left: CORNER,
      },
      required: ['top_left', 'top_right', 'bottom_right', 'bottom_left'],
      additionalProperties: false,
    },
    white_count: { type: 'integer', description: 'How many WHITE pieces you can see on the board (0-16). Count them first.' },
    black_count: { type: 'integer', description: 'How many BLACK pieces you can see on the board (0-16). Count them first.' },
    grid: {
      type: 'array',
      items: { type: 'string' },
      description:
        "Exactly 8 strings of exactly 8 characters: the 8x8 playing squares EXACTLY AS THEY APPEAR IN THE IMAGE. The first string is the top row of squares in the image, the last string is the bottom row; each string goes from the LEFT of the image to the RIGHT. Do not rotate, flip or renumber. K Q R B N P = white king, queen, rook, bishop, knight, pawn; k q r b n p = black; '.' = empty square.",
    },
    white_side: {
      type: 'string',
      enum: ['bottom', 'top', 'left', 'right'],
      description: 'The edge of the image next to which the White army stands (the side where White pieces started, ranks 1-2).',
    },
    side_to_move: { type: 'string', enum: ['w', 'b', 'unknown'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string', description: 'At most 8 words in Italian about doubtful squares; empty string if none.' },
  },
  required: ['board_corners', 'white_count', 'black_count', 'grid', 'white_side', 'side_to_move', 'confidence', 'notes'],
  additionalProperties: false,
} as const;

const READING_PROMPT = `This is a photo of a physical chess board with a game in progress. Transcribe the position you see.

1. Locate the board: board_corners = the 4 corners of the 8x8 playing area as seen in the image (0-1000 coordinates). Then look only at the 64 playing squares (ignore the frame, printed coordinates, captured pieces beside the board, hands).
2. Count the pieces first: white_count and black_count (the starting position has 16 each; there can never be more).
3. Fill "grid" exactly as the image shows it: 8 rows from the TOP of the image to the BOTTOM, each row from LEFT to RIGHT, 8 characters per row. Do NOT rotate, flip or reorder anything and do NOT try to put White at the bottom: just report what stands on each square as you see it. The number of letters in the grid must match your counts.
4. white_side: the edge of the image (bottom, top, left or right) next to which the White pieces stand. Use the coordinates printed on the board if visible; otherwise the starting setup / which army is on which side, and the rule that each player has a LIGHT square in his right-hand corner.
5. The photo is usually taken at an angle: every piece stands on the square under its BASE. Tall pieces lean toward the far side and their heads overlap the square behind: assign each piece by its base, never by its head.
6. Identify each piece by its silhouette: king = tallest, cross on top; queen = tall, crown with points or a small ball; bishop = mitre with a diagonal slit, medium height; knight = horse head; rook = short tower with battlements; pawn = smallest, plain round ball. Bishops/pawns and kings/queens are the usual mistakes: compare heights with the neighbours.
7. Colour: judge the colour of the piece material, not of the square it stands on.
If a square is hidden or unclear, make your best guess and mention it in "notes" (Italian, at most 8 words; leave it empty otherwise). side_to_move: only if something in the photo shows it (e.g. a chess clock), otherwise "unknown".`;

const FEN_PLACEMENT = /^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+$/;

export interface RawReading {
  corners: Corners | null;
  grid: string[] | null;
  whiteSide: BoardView;
  whiteCount: number | null;
  blackCount: number | null;
  sideToMove: BoardReading['sideToMove'];
  confidence: BoardReading['confidence'];
  notes: string;
}

function parseReading(message: BetaMessage): RawReading {
  if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textOf(message)) as Record<string, unknown>;
  } catch {
    throw new AssistantError('unreadable');
  }
  return parseReadingJson(parsed);
}

function parseCorners(raw: unknown): Corners | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const point = (p: unknown) => {
    const q = p as { x?: unknown; y?: unknown } | null;
    return q && typeof q.x === 'number' && typeof q.y === 'number' ? { x: q.x / 1000, y: q.y / 1000 } : null;
  };
  const corners = [point(value.top_left), point(value.top_right), point(value.bottom_right), point(value.bottom_left)];
  if (corners.some((p) => p === null)) return null;
  const quad = corners as Corners;
  return plausibleCorners(quad, 0.08) ? quad : null;
}

/** Interpreta la risposta JSON di Claude (esportata per i test). */
export function parseReadingJson(parsed: Record<string, unknown>): RawReading {
  const grid = Array.isArray(parsed.grid) ? normalizeGrid(parsed.grid) : null;
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
    corners: parseCorners(parsed.board_corners),
    grid,
    whiteSide: isBoardView(parsed.white_side) ? parsed.white_side : 'bottom',
    whiteCount: count(parsed.white_count),
    blackCount: count(parsed.black_count),
    sideToMove: parsed.side_to_move === 'w' || parsed.side_to_move === 'b' ? parsed.side_to_move : 'unknown',
    confidence: parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium',
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  };
}

/** Problemi (in inglese, vanno nel prompt della seconda lettura) di una lettura e della posizione che ne risulta. */
function readingProblems(reading: RawReading, resolved: ResolvedReading | null): string[] {
  if (!reading.grid || !resolved) return ['"grid" was not 8 strings of exactly 8 characters'];
  const problems = [...resolved.problems];
  const seen = countPieces(reading.grid);
  if (reading.whiteCount !== null && reading.whiteCount !== seen.white) {
    problems.push(`you counted ${reading.whiteCount} white pieces but wrote ${seen.white} in the grid`);
  }
  if (reading.blackCount !== null && reading.blackCount !== seen.black) {
    problems.push(`you counted ${reading.blackCount} black pieces but wrote ${seen.black} in the grid`);
  }
  return problems;
}

/**
 * Legge la posizione da una foto (JPEG base64, già ridotta a bassa risoluzione).
 *
 * Affidabilità, in tre passi:
 *  1. Claude trascrive le case come le vede (senza ruotare) e conta i pezzi;
 *  2. il codice orienta la griglia e la confronta con le posizioni raggiungibili
 *     con mosse legali dalla precedente: gli errori di riconoscimento isolati
 *     vengono corretti e si ricava il tratto;
 *  3. se la posizione è comunque impossibile (due re, conteggi che non tornano…)
 *     Claude rilegge la foto con più attenzione sapendo che cosa era sbagliato.
 */
export async function readBoardFromImage(base64Jpeg: string, options: ReadOptions = {}): Promise<BoardReading> {
  let sdk: typeof Anthropic | null = null;
  try {
    const created = await createClient();
    sdk = created.sdk;
    const reference = options.reference ?? null;
    const forcedView = options.view ?? null;
    const hintView = forcedView ?? options.lastView ?? null;
    const referencePlacement = reference?.fen.split(' ')[0];
    const hint =
      referencePlacement && hintView && FEN_PLACEMENT.test(referencePlacement)
        ? `\n\nFor reference, if the board has not been moved, the previous position would look like this in the photo (rows top to bottom):\n${ranksToGrid(placementToRanks(referencePlacement), hintView).join('\n')}\nUsually only one move has been played since (two squares change; four for castling). Use it to resolve doubtful pieces, but the photo is what counts: report what you see.`
        : '';
    let vision = options.vision ?? null;
    const local = vision?.evidence ?? null;
    // Che cosa ha visto YOLO: Claude conferma le case sicure e si concentra su quelle incerte («?»).
    const detectorHint = local
      ? `\n\nA local piece detector read the board like this (same orientation as the photo, rows top to bottom; '?' = unsure):\n${hintGrid(local).join('\n')}\nIt is often right on clear squares but can confuse bishops/pawns and kings/queens and miss pieces. Check every square, especially the '?' ones; the photo is what counts.`
      : '';
    // Fuori dal prompt di sistema (che resta uguale e in cache): vale solo per chi lo sceglie.
    const flippedHint = options.flippedCoordinates
      ? '\n\nThe coordinates printed on this board are REVERSED: the Black army was set up next to the printed ranks 1-2 and White next to 7-8. Do NOT use the printed numbers or letters to decide white_side: decide only by where the White pieces actually stand.'
      : '';
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } } as const;

    const ask = (effort: 'low' | 'medium', extra: string) =>
      createMessage(created.client, created.sdk, {
        model: ASSISTANT_MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: { type: 'json_schema', schema: READING_SCHEMA } },
        // Le istruzioni fisse vanno nel prompt di sistema, in cache: dalla seconda lettura
        // (entro 5 minuti) costano circa un ventesimo. Dopo, solo la foto e il poco che cambia.
        system: [{ type: 'text', text: READING_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [
          { role: 'user', content: hint + flippedHint + detectorHint + extra ? [image, { type: 'text', text: (hint + flippedHint + detectorHint + extra).trim() }] : [image] },
        ],
      }).then((message) => {
        recordUsage('reading', message);
        return message;
      });

    // YOLO entra nella fusione solo se vede buona parte dei pezzi letti da Claude.
    const evidenceFor = (reading: RawReading): Evidence | null => {
      if (!reading.grid || !vision?.evidence) return null;
      const seen = countPieces(reading.grid);
      if (!informative(vision.evidence, seen.white + seen.black)) return null;
      return fuseEvidence(gridEvidence(reading.grid), temper(vision.evidence, YOLO_WEIGHT));
    };
    const interpret = (reading: RawReading): ResolvedReading | null =>
      reading.grid
        ? resolveReading({
            grid: reading.grid,
            evidence: evidenceFor(reading),
            claimedView: reading.whiteSide,
            forcedView,
            reference,
            lastRawPlacement: options.lastRawPlacement ?? null,
          })
        : null;

    // Sforzo basso: la lettura è rapida, e gli errori isolati li corregge il codice con le regole.
    let reading = parseReading(await ask('low', ''));
    // Prima lettura (angoli ignoti): ora che Claude ha trovato la scacchiera, la geometria
    // rifinisce gli angoli e YOLO legge i pezzi sulla stessa foto.
    if (!vision && options.analyze && reading.corners) {
      try {
        vision = await options.analyze(reading.corners);
      } catch {
        vision = null;
      }
    }
    let resolved = interpret(reading);
    let problems = readingProblems(reading, resolved);
    if (problems.length > 0) {
      const first = reading.grid ? `\nYour first reading was (rows top to bottom):\n${reading.grid.join('\n')}\n` : '';
      const retry = parseReading(
        await ask(
          'medium',
          `\n\nCareful: your first reading was inconsistent: ${problems.join('; ')}.${first}Look at the photo again square by square, recount the pieces and fix it.`,
        ),
      );
      const retryResolved = interpret(retry);
      const retryProblems = readingProblems(retry, retryResolved);
      // Si tiene la seconda lettura se è meglio della prima.
      if (retryResolved && retryProblems.length <= problems.length) {
        reading = retry;
        resolved = retryResolved;
        problems = retryProblems;
      }
    }
    if (!reading.grid || !resolved) throw new AssistantError('unreadable');
    const fused = evidenceFor(reading);
    return {
      placement: resolved.placement,
      fen: resolved.fen,
      sideToMove: resolved.turn ?? reading.sideToMove,
      turnKnown: resolved.turn !== null,
      confidence: problems.length > 0 ? 'low' : fused && uncertainCount(fused) > 3 && reading.confidence === 'high' ? 'medium' : reading.confidence,
      notes: reading.notes,
      grid: reading.grid,
      view: resolved.view,
      rawPlacement: resolved.rawPlacement,
      corrected: resolved.corrected,
      moves: resolved.moves,
      corners: vision?.corners ?? reading.corners,
      source: fused ? 'hybrid' : 'claude',
    };
  } catch (error) {
    throw mapError(error, sdk);
  }
}

// ───── 2. Spiegazione della valutazione ─────

export interface ExplainInput {
  fen: string;
  /** Valutazione leggibile dal punto di vista del Bianco, es. «+1,25» o «M3». */
  evaluation: string;
  /** Varianti migliori in notazione italiana, la prima è la migliore. */
  lines: string[];
  /** Colore con cui gioca l'utente, se l'ha indicato. */
  playerSide: 'w' | 'b' | null;
  /** Risposta breve (2–3 frasi) sulla sola mossa migliore: meno token, adatta alla voce del tutor. */
  brief?: boolean;
}

const EXPLAIN_SYSTEM = `Sei un istruttore di scacchi che parla a principianti e giocatori intermedi, anche bambini.
Ricevi una posizione (FEN) e l'analisi del motore Stockfish, che è corretta: non contraddirla e non inventare varianti diverse.
Spiega in italiano semplice, in 4–6 frasi brevi e senza elenchi né titoli:
- chi sta meglio e perché, in parole (materiale, re, pezzi attivi, pedoni);
- qual è la mossa migliore e l'idea che c'è dietro (minaccia, difesa, piano);
- un errore naturale da evitare in questa posizione, se c'è.
Usa la notazione italiana (R, D, T, A, C) come nelle varianti che ricevi. Il testo verrà anche letto ad alta voce: niente simboli strani.`;

export async function explainPosition(input: ExplainInput): Promise<string> {
  let sdk: typeof Anthropic | null = null;
  try {
    const created = await createClient();
    sdk = created.sdk;
    const side = input.fen.split(' ')[1] === 'b' ? 'il Nero' : 'il Bianco';
    const player = input.playerSide ? `\nL'utente gioca con ${input.playerSide === 'w' ? 'il Bianco' : 'il Nero'}: parla dal suo punto di vista.` : '';
    const message = await createMessage(created.client, created.sdk, {
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: EXPLAIN_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Posizione (FEN): ${input.fen}
Muove ${side}.
Valutazione di Stockfish (dal punto di vista del Bianco): ${input.evaluation}
Varianti migliori:
${(input.brief ? input.lines.slice(0, 2) : input.lines).map((l, i) => `${i + 1}. ${l}`).join('\n')}${player}${
            input.brief ? '\nRispondi solo in 2–3 frasi brevi: perché la mossa migliore è buona e che cosa minaccia o impedisce.' : ''
          }`,
        },
      ],
    });
    recordUsage('explanation', message);
    if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
    const text = textOf(message);
    if (!text) throw new AssistantError('unreadable');
    return text;
  } catch (error) {
    throw mapError(error, sdk);
  }
}

// ───────────── Tutor delle Grandi Partite ─────────────

export interface MasterMoveInput {
  /** Posizione PRIMA della mossa. */
  fen: string;
  /** Mossa del Maestro in notazione italiana, con il numero (es. «10.Cxb5!»). */
  move: string;
  /** Chi la gioca, es. «Paul Morphy (Bianco)». */
  player: string;
  game: string;
  /** Commento del PGN su questa mossa, se c'è. */
  comment?: string;
  /** Le mosse successive della partita (notazione italiana), per capire il piano. */
  continuation: string;
}

const MASTER_SYSTEM = `Sei un istruttore di scacchi che accompagna un allievo (principiante o intermedio) mentre rigioca sulla scacchiera una partita storica di un grande maestro.
Spiega in italiano semplice, in 2–3 frasi brevi, senza elenchi né titoli, PERCHÉ il maestro ha giocato la mossa indicata: l'idea, la minaccia o il piano, e che cosa ottiene.
Le mosse della partita sono storiche e corrette: non contraddirle e non inventare varianti diverse. Usa la notazione italiana (R, D, T, A, C). Il testo verrà letto ad alta voce: niente simboli strani.`;

/** Spiegazione breve di una mossa di una partita famosa (generata in anticipo e messa in cache). */
export async function explainMasterMove(input: MasterMoveInput): Promise<string> {
  let sdk: typeof Anthropic | null = null;
  try {
    const created = await createClient();
    sdk = created.sdk;
    const message = await createMessage(created.client, created.sdk, {
      model: ASSISTANT_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: MASTER_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Partita: ${input.game}
Posizione prima della mossa (FEN): ${input.fen}
Mossa: ${input.move}, giocata da ${input.player}.${input.comment ? `\nCommento dell'annotatore: ${input.comment}` : ''}
Seguito della partita: ${input.continuation || '(fine della partita)'}`,
        },
      ],
    });
    recordUsage('explanation', message);
    if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
    const text = textOf(message);
    if (!text) throw new AssistantError('unreadable');
    return text;
  } catch (error) {
    throw mapError(error, sdk);
  }
}

export interface DeviationInput {
  fen: string;
  /** Mossa giocata dall'utente e mossa del maestro, in notazione italiana. */
  played: string;
  master: string;
  player: string;
  /** Valutazioni di Stockfish (dal punto di vista di chi muove) dopo le due mosse. */
  playedEval: string;
  masterEval: string;
  /** Migliore variante di Stockfish dopo la mossa dell'utente, in notazione italiana. */
  refutation: string;
}

/** «Perché la mia mossa non va bene?»: chiamata live, solo su richiesta dell'utente. */
export async function explainDeviation(input: DeviationInput): Promise<string> {
  let sdk: typeof Anthropic | null = null;
  try {
    const created = await createClient();
    sdk = created.sdk;
    const message = await createMessage(created.client, created.sdk, {
      model: ASSISTANT_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: EXPLAIN_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Posizione (FEN): ${input.fen}
L'allievo, al posto di ${input.player}, ha giocato ${input.played} invece della mossa del maestro ${input.master}.
Stockfish: dopo ${input.played} la valutazione è ${input.playedEval}, dopo ${input.master} è ${input.masterEval} (dal punto di vista di chi muove).
Migliore risposta dopo ${input.played}: ${input.refutation || 'nessuna variante'}.
Rispondi in 2–3 frasi brevi: che cosa non va nella mossa dell'allievo (o, se è buona anche lei, dillo) e perché ${input.master} è migliore.`,
        },
      ],
    });
    recordUsage('explanation', message);
    if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
    const text = textOf(message);
    if (!text) throw new AssistantError('unreadable');
    return text;
  } catch (error) {
    throw mapError(error, sdk);
  }
}

export interface GameQuestionInput {
  /** «Morphy – Duca di Brunswick e Conte Isouard, Parigi 1858». */
  game: string;
  /** Introduzione storica della partita. */
  intro: string;
  /** Mosse già giocate (notazione italiana). */
  played: string;
  /** Posizione attuale (FEN). */
  fen: string;
  /** Mossa che il tutor ha appena indicato, con la sua spiegazione. */
  current: string;
  question: string;
  /** Domande e risposte precedenti, per le domande di seguito («e se invece…?»). */
  history: { question: string; answer: string }[];
}

const QUESTION_SYSTEM = `Sei un istruttore di scacchi che accompagna un allievo (principiante o intermedio) mentre rigioca sulla sua scacchiera una partita storica di un grande maestro. L'allievo ti fa una domanda a voce.
Rispondi in italiano semplice, in 2–4 frasi brevi, senza elenchi né titoli, restando sul contesto della partita e della posizione attuale. Le mosse della partita sono storiche: non contraddirle. Se la domanda non riguarda gli scacchi o la partita, riportala gentilmente alla partita.
Usa la notazione italiana (R, D, T, A, C). Il testo verrà letto ad alta voce: niente simboli strani.`;

/** Risposta a una domanda libera dell'allievo sulla partita che sta rigiocando. */
export async function askAboutGame(input: GameQuestionInput): Promise<string> {
  let sdk: typeof Anthropic | null = null;
  try {
    const created = await createClient();
    sdk = created.sdk;
    const context = `Partita: ${input.game}
Introduzione: ${input.intro}
Mosse giocate finora: ${input.played || '(nessuna, posizione iniziale)'}
Posizione attuale (FEN): ${input.fen}
Mossa indicata adesso: ${input.current}`;
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    input.history.slice(-3).forEach((h, i) => {
      messages.push({ role: 'user', content: i === 0 ? `${context}\n\nDomanda: ${h.question}` : h.question });
      messages.push({ role: 'assistant', content: h.answer });
    });
    messages.push({ role: 'user', content: messages.length === 0 ? `${context}\n\nDomanda: ${input.question}` : `(Posizione ora: ${input.fen}; mossa indicata: ${input.current})\n${input.question}` });
    const message = await createMessage(created.client, created.sdk, {
      model: ASSISTANT_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: QUESTION_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    recordUsage('explanation', message);
    if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
    const text = textOf(message);
    if (!text) throw new AssistantError('unreadable');
    return text;
  } catch (error) {
    throw mapError(error, sdk);
  }
}
