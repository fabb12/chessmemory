import { expect, test } from '@playwright/test';

/** Immagine PNG minima (1×1) usata come «foto» della scacchiera. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
/** Il Nero deve parare il matto in f7 (Df3 + Ac4). */
const PLACEMENT = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR';
/** Claude trascrive 8 righe di 8 caratteri come appaiono nella foto («.» = casa vuota): qui il Bianco è in basso. */
const RANKS = PLACEMENT.split('/').map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))));
const reading = (grid: string[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ white_count: 16, black_count: 16, grid, white_side: 'bottom', side_to_move: 'b', confidence: 'high', notes: '', ...extra });
const EXPLANATION = 'Il Bianco minaccia matto in f7: il Nero deve sviluppare il cavallo in f6.';

test('analizza: foto → lettura con Claude (simulato) → Stockfish → spiegazione', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  // L'API di Anthropic è simulata: nessuna chiave reale, nessun costo.
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    const isReading = JSON.stringify(body.messages).includes('"image"');
    const text = isReading
      ? reading(RANKS)
      : EXPLANATION;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });

  await page.goto('./');
  await expect(page.getByTestId('daily-card')).toBeVisible();
  await page.getByTestId('home-analyze').click();
  await expect(page.getByRole('heading', { name: 'Analizza la partita' })).toBeVisible();

  await page.getByTestId('api-key-input').fill(`sk-ant-api03-${'x'.repeat(40)}`);
  await page.getByRole('button', { name: 'Salva la chiave' }).click();
  await expect(page.getByTestId('api-key-input')).toHaveCount(0);

  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Lettura sicura')).toBeVisible();
  await expect(page.getByTestId('analyze-turn')).toContainText('Tocca a Nero');

  // Nessun clic su «Valuta»: le mosse migliori compaiono da sole sulla scacchiera.
  await expect(page.getByTestId('analyze-best')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByTestId('candidate-1')).toBeVisible();
  await expect(page.getByTestId('candidate-3')).toBeVisible();
  await expect(page.getByTestId('analyze-explanation')).toContainText(EXPLANATION);

  expect(bodies).toHaveLength(2);
  // Lettura singola: sforzo medio, nessuna seconda lettura perché la posizione è valida.
  expect(bodies[0]).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'medium', format: { type: 'json_schema' } } });
  expect(String((bodies[1]!.messages as { content: string }[])[0]!.content)).toContain(`${PLACEMENT} b`);
});

test('analizza: una lettura impossibile viene ripetuta con più attenzione', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  // Prima risposta: due re bianchi (un errore tipico re/donna). Seconda: corretta.
  const wrong = [...RANKS.slice(0, 7), 'RNB.K.KR'];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    const ranks = bodies.length === 1 ? wrong : RANKS;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: `msg_${bodies.length}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: reading(ranks) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });

  await page.goto('./');
  await page.getByTestId('home-analyze').click();
  await page.getByTestId('api-key-input').fill(`sk-ant-api03-${'x'.repeat(40)}`);
  await page.getByRole('button', { name: 'Salva la chiave' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Lettura sicura')).toBeVisible();
  await expect(page.getByTestId('analyze-turn')).toBeVisible();
  await expect(page.getByTestId('analyze-explanation')).toBeVisible({ timeout: 30_000 });

  // Lettura sbagliata, seconda lettura corretta, poi la spiegazione.
  expect(bodies).toHaveLength(3);
  expect(bodies[1]).toMatchObject({ output_config: { effort: 'medium' } });
  expect(JSON.stringify(bodies[1]!.messages)).toContain('White has 2 kings');
});

/** Risposta simulata dell'API: la lettura per le foto, il testo per la spiegazione. */
async function mockClaude(page: import('@playwright/test').Page, grid: string[], extra: Record<string, unknown> = {}) {
  const counter = { readings: 0 };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const isReading = JSON.stringify(body.messages).includes('"image"');
    if (isReading) counter.readings++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: isReading ? reading(grid, extra) : EXPLANATION }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });
  return counter;
}

async function openAnalyze(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByTestId('home-analyze').click();
  await page.getByTestId('api-key-input').fill(`sk-ant-api03-${'x'.repeat(40)}`);
  await page.getByRole('button', { name: 'Salva la chiave' }).click();
}

test('analizza: una foto scattata dal lato del Nero viene raddrizzata dal codice', async ({ page }) => {
  // Claude trascrive ciò che vede senza ruotare: con il Bianco in alto la griglia è ruotata di 180°.
  const rotated = [...RANKS].reverse().map((row) => [...row].reverse().join(''));
  await mockClaude(page, rotated, { white_side: 'top' });
  await openAnalyze(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('analyze-best')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} b`));
  await expect(page.getByText('Pezzi bianchi in alto nella foto.')).toBeVisible();
});

test('analizza: l\'orientamento sbagliato si corregge senza rileggere la foto', async ({ page }) => {
  const rotated = [...RANKS].reverse().map((row) => [...row].reverse().join(''));
  // Claude sbaglia a dichiarare il lato del Bianco («bottom» invece di «top»).
  const counter = await mockClaude(page, rotated, { white_side: 'bottom' });
  await openAnalyze(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('analyze-best')).not.toBeEmpty({ timeout: 30_000 });
  // Con l'orientamento sbagliato la posizione risulta ruotata.
  await expect(page.getByTestId('chessboard')).not.toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} `));
  await page.getByTestId('photo-orientation').selectOption('top');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} `));
  // La foto non viene riletta: si ricalcola solo la posizione.
  expect(counter.readings).toBe(1);
});

test('analizza: allenamento — prima provi una mossa, poi vedi il giudizio e le mosse migliori', async ({ page }) => {
  await mockClaude(page, RANKS);
  await openAnalyze(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('candidate-1')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('practice-toggle').check();
  await expect(page.getByTestId('practice-prompt')).toBeVisible();
  await expect(page.getByTestId('candidate-moves')).toHaveCount(0);

  // Il Nero deve parare il matto in f7: Cf6 (g8 → f6).
  await page.locator('[data-sq="g8"]').click();
  await page.locator('[data-sq="f6"]').click();
  await expect(page.getByTestId('move-feedback')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('move-feedback')).toHaveAttribute('data-grade', /best|good/);
  await expect(page.getByTestId('candidate-moves')).toBeVisible();
});
