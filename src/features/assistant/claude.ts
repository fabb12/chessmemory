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
import { resolveReading, type ReadingReference, type ResolvedReading } from './boardResolve';

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
  /** Lettura più accurata (più lenta): per le letture singole su richiesta. */
  careful?: boolean;
}

const READING_SCHEMA = {
  type: 'object',
  properties: {
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
    notes: { type: 'string', description: 'Short notes in Italian about doubtful squares; empty if none.' },
  },
  required: ['white_count', 'black_count', 'grid', 'white_side', 'side_to_move', 'confidence', 'notes'],
  additionalProperties: false,
} as const;

const READING_PROMPT = `This is a photo of a physical chess board with a game in progress. Transcribe the position you see.

1. Look only at the 64 playing squares (ignore the frame, printed coordinates, captured pieces beside the board, hands).
2. Count the pieces first: white_count and black_count (the starting position has 16 each; there can never be more).
3. Fill "grid" exactly as the image shows it: 8 rows from the TOP of the image to the BOTTOM, each row from LEFT to RIGHT, 8 characters per row. Do NOT rotate, flip or reorder anything and do NOT try to put White at the bottom: just report what stands on each square as you see it. The number of letters in the grid must match your counts.
4. white_side: the edge of the image (bottom, top, left or right) next to which the White pieces stand. Use the coordinates printed on the board if visible; otherwise the starting setup / which army is on which side, and the rule that each player has a LIGHT square in his right-hand corner.
5. The photo is usually taken at an angle: every piece stands on the square under its BASE. Tall pieces lean toward the far side and their heads overlap the square behind: assign each piece by its base, never by its head.
6. Identify each piece by its silhouette: king = tallest, cross on top; queen = tall, crown with points or a small ball; bishop = mitre with a diagonal slit, medium height; knight = horse head; rook = short tower with battlements; pawn = smallest, plain round ball. Bishops/pawns and kings/queens are the usual mistakes: compare heights with the neighbours.
7. Colour: judge the colour of the piece material, not of the square it stands on.
If a square is hidden or unclear, make your best guess and say so in "notes" (Italian, one short sentence). side_to_move: only if something in the photo shows it (e.g. a chess clock), otherwise "unknown".`;

const FEN_PLACEMENT = /^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+$/;

export interface RawReading {
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

/** Interpreta la risposta JSON di Claude (esportata per i test). */
export function parseReadingJson(parsed: Record<string, unknown>): RawReading {
  const grid = Array.isArray(parsed.grid) ? normalizeGrid(parsed.grid) : null;
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
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
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } } as const;

    const ask = (effort: 'low' | 'medium', extra: string) =>
      created.client.beta.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: { type: 'json_schema', schema: READING_SCHEMA } },
        messages: [{ role: 'user', content: [image, { type: 'text', text: READING_PROMPT + hint + extra }] }],
      });

    const interpret = (reading: RawReading): ResolvedReading | null =>
      reading.grid
        ? resolveReading({
            grid: reading.grid,
            claimedView: reading.whiteSide,
            forcedView,
            reference,
            lastRawPlacement: options.lastRawPlacement ?? null,
          })
        : null;

    let reading = parseReading(await ask(options.careful ? 'medium' : 'low', ''));
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
    return {
      placement: resolved.placement,
      sideToMove: resolved.turn ?? reading.sideToMove,
      turnKnown: resolved.turn !== null,
      confidence: problems.length > 0 ? 'low' : reading.confidence,
      notes: reading.notes,
      grid: reading.grid,
      view: resolved.view,
      rawPlacement: resolved.rawPlacement,
      corrected: resolved.corrected,
      moves: resolved.moves,
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
    const message = await created.client.beta.messages.create({
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
${input.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}${player}`,
        },
      ],
    });
    if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
    const text = textOf(message);
    if (!text) throw new AssistantError('unreadable');
    return text;
  } catch (error) {
    throw mapError(error, sdk);
  }
}
