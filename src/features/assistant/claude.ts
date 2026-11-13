import { useSyncExternalStore } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import { placementProblems, placementToRanks, ranksToPlacement } from './boardReading';

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
  /** Primo campo della FEN (disposizione dei pezzi, dall'ottava traversa). */
  placement: string;
  sideToMove: 'w' | 'b' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  /** Note sui dubbi (pezzi coperti, riflessi…), in italiano. */
  notes: string;
}

export interface ReadOptions {
  /**
   * Posizione precedente (campo FEN dei pezzi), se nota: nell'analisi continua
   * di solito è cambiata una sola mossa, e serve a Claude per risolvere i pezzi
   * dubbi (alfiere o pedone? re o donna?) senza ripartire da zero.
   */
  previous?: string | null;
}

const READING_SCHEMA = {
  type: 'object',
  properties: {
    white_at_bottom: {
      type: 'boolean',
      description: 'True if the white pieces started on the side of the board nearest the camera.',
    },
    ranks: {
      type: 'array',
      items: { type: 'string' },
      description:
        "Exactly 8 strings, rank 8 first down to rank 1, always from White's point of view. Each string has exactly 8 characters, files a to h: K Q R B N P for White, k q r b n p for Black, '.' for an empty square. Example start position: rnbqkbnr, pppppppp, ........ (x4), PPPPPPPP, RNBQKBNR.",
    },
    side_to_move: { type: 'string', enum: ['w', 'b', 'unknown'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string', description: 'Short notes in Italian about doubtful squares; empty if none.' },
  },
  required: ['white_at_bottom', 'ranks', 'side_to_move', 'confidence', 'notes'],
  additionalProperties: false,
} as const;

const READING_PROMPT = `This is a photo of a physical chess board during a game in progress. Read the position.

1. Orientation: use the coordinates printed on the board if visible; otherwise h1 and a8 are light squares (light square in each player's right-hand corner). White usually sits on the side where most white pieces are.
2. The photo is usually taken at an angle: every piece stands on the square under its BASE. Tall pieces lean toward the far side and their heads overlap the square behind: assign each piece by its base, never by its head.
3. Identify each piece by its silhouette: king = tallest, with a cross on top; queen = tall, crown with points or a small ball; bishop = mitre with a diagonal slit, medium height; knight = horse head; rook = short tower with battlements; pawn = smallest, plain round ball. Bishops and pawns, kings and queens are the usual mistakes: compare heights with the neighbours.
4. Colour: judge the colour of the piece material, not of the square it stands on.
5. Write "ranks" from White's point of view (rank 8 first, files a to h) whichever way the photo is oriented, exactly 8 characters per rank.
6. Check before answering: one king per side, at most 8 pawns per side, no pawns on ranks 1 or 8, at most 16 pieces per side.
If a square is hidden or unclear, make your best guess and say so in "notes" (Italian, one short sentence). side_to_move: only if something in the photo shows it (e.g. a chess clock), otherwise "unknown".`;

const FEN_PLACEMENT = /^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+$/;

interface RawReading {
  placement: string | null;
  sideToMove: BoardReading['sideToMove'];
  confidence: BoardReading['confidence'];
  notes: string;
}

function parseReading(message: BetaMessage): RawReading {
  if (message.stop_reason === 'refusal') throw new AssistantError('refusal');
  let parsed: { ranks?: unknown; placement?: unknown; side_to_move?: unknown; confidence?: unknown; notes?: unknown };
  try {
    parsed = JSON.parse(textOf(message));
  } catch {
    throw new AssistantError('unreadable');
  }
  let placement: string | null = null;
  if (Array.isArray(parsed.ranks) && parsed.ranks.every((r) => typeof r === 'string')) {
    placement = ranksToPlacement(parsed.ranks as string[]);
  } else if (typeof parsed.placement === 'string' && FEN_PLACEMENT.test(parsed.placement.trim())) {
    placement = parsed.placement.trim();
  }
  const side = parsed.side_to_move === 'w' || parsed.side_to_move === 'b' ? parsed.side_to_move : 'unknown';
  const confidence = parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium';
  return { placement, sideToMove: side, confidence, notes: typeof parsed.notes === 'string' ? parsed.notes : '' };
}

/**
 * Legge la posizione da una foto (JPEG base64, già ridotta a bassa risoluzione).
 *
 * Velocità: prima lettura con sforzo basso, così la risposta arriva in pochi
 * secondi. Affidabilità: la posizione viene controllata qui (re, pedoni,
 * traverse impossibili) e, solo se non torna, Claude rilegge la foto con più
 * attenzione sapendo che cosa era sbagliato.
 */
export async function readBoardFromImage(base64Jpeg: string, options: ReadOptions = {}): Promise<BoardReading> {
  let sdk: typeof Anthropic | null = null;
  try {
    const created = await createClient();
    sdk = created.sdk;
    const previous = options.previous && FEN_PLACEMENT.test(options.previous) ? options.previous : null;
    const hint = previous
      ? `\n\nThe previous position on this board (ranks 8→1) was:\n${placementToRanks(previous).join('\n')}\nUsually only one move has been played since (two squares change; four for castling). Use it to resolve doubtful pieces, but the photo is what counts: report what you see.`
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

    let reading = parseReading(await ask('low', ''));
    const problems = reading.placement ? placementProblems(reading.placement) : ['the ranks were not 8 strings of 8 characters'];
    if (problems.length > 0) {
      const first = reading.placement ? `\nA first quick reading gave (ranks 8→1):\n${placementToRanks(reading.placement).join('\n')}\n` : '';
      const retry = parseReading(
        await ask(
          'medium',
          `\n\nCareful: a first reading was impossible: ${problems.join('; ')}.${first}Look at the photo again square by square and fix it.`,
        ),
      );
      // Si tiene la seconda lettura se è valida, o comunque se la prima non lo era affatto.
      if (retry.placement && (placementProblems(retry.placement).length === 0 || !reading.placement)) reading = retry;
    }
    if (!reading.placement) throw new AssistantError('unreadable');
    const stillWrong = placementProblems(reading.placement).length > 0;
    return {
      placement: reading.placement,
      sideToMove: reading.sideToMove,
      confidence: stillWrong ? 'low' : reading.confidence,
      notes: reading.notes,
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
