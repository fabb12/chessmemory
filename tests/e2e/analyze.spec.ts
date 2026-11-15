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
  await expect(page.getByTestId('read-info')).toContainText('1 foto');
  // Foto dal lato del Bianco → sei il Bianco; muove il Nero → tocca all'avversario: si vede la sua minaccia, niente consigli.
  await expect(page.getByTestId('analyze-turn')).toContainText('Tocca all’avversario (Nero)');
  await expect(page.getByTestId('opponent-turn')).toContainText('mossa più pericolosa', { timeout: 30_000 });
  await expect(page.getByTestId('candidate-moves')).toHaveCount(0);
  expect(bodies).toHaveLength(1);

  // Modello predefinito Haiku: sforzo basso, nessuna seconda lettura perché la posizione è valida.
  // Haiku non ha modalità rapida né ripiego lato server: quei parametri non si inviano.
  expect(bodies[0]).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low', format: { type: 'json_schema' } } });
  expect(bodies[0]).not.toHaveProperty('speed');
  expect(bodies[0]).not.toHaveProperty('fallbacks');

  // «Io sono: Nero» → ora tocca a te: mosse consigliate, linea vincente e spiegazione.
  await page.getByTestId('my-color').getByRole('button', { name: 'Nero' }).click();
  await expect(page.getByTestId('analyze-turn')).toContainText('Tocca a te (Nero)');
  await expect(page.getByTestId('analyze-best')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByTestId('candidate-1')).toBeVisible();
  await expect(page.getByTestId('winning-line')).toBeVisible();
  await expect(page.getByTestId('analyze-explanation')).toContainText(EXPLANATION);
  expect(bodies).toHaveLength(2);
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
  await expect(page.getByTestId('read-info')).toContainText('1 foto');
  await expect(page.getByTestId('opponent-turn')).toBeVisible({ timeout: 30_000 });

  // Lettura sbagliata, poi seconda lettura corretta (nessuna spiegazione: tocca all'avversario).
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toMatchObject({ output_config: { effort: 'medium' } });
  expect(JSON.stringify(bodies[1]!.messages)).toContain('White has 2 kings');
});

/** Risposta simulata dell'API: la lettura per le foto, il testo per la spiegazione. */
async function mockClaude(page: import('@playwright/test').Page, grid: string[], extra: Record<string, unknown> = {}) {
  const counter = { readings: 0, explanations: 0, bodies: [] as Record<string, unknown>[] };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const isReading = JSON.stringify(body.messages).includes('"image"');
    if (isReading) counter.readings++;
    else counter.explanations++;
    counter.bodies.push(body);
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
  // Foto dal lato del Nero → sei il Nero, e tocca proprio a te.
  await expect(page.getByTestId('analyze-best')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByTestId('my-color').getByRole('button', { name: 'Nero' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('analyze-turn')).toContainText('Tocca a te (Nero)');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} b`));
  await expect(page.getByText('Pezzi bianchi in alto nella foto.')).toBeVisible();
});

test('analizza: l\'orientamento sbagliato si corregge senza rileggere la foto', async ({ page }) => {
  const rotated = [...RANKS].reverse().map((row) => [...row].reverse().join(''));
  // Claude sbaglia a dichiarare il lato del Bianco («bottom» invece di «top»).
  const counter = await mockClaude(page, rotated, { white_side: 'bottom' });
  await openAnalyze(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('analyze-turn')).toBeVisible({ timeout: 30_000 });
  // Con l'orientamento sbagliato la posizione risulta ruotata.
  await expect(page.getByTestId('chessboard')).not.toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} `));
  await page.getByText('Opzioni di lettura').click();
  await page.getByTestId('photo-orientation').selectOption('top');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} `));
  // La foto non viene riletta: si ricalcola solo la posizione.
  expect(counter.readings).toBe(1);
});

test('analizza: allenamento — prima provi una mossa, poi vedi il giudizio e le mosse migliori', async ({ page }) => {
  // Foto dal lato del Nero: sei il Nero e tocca a te.
  await mockClaude(page, [...RANKS].reverse().map((row) => [...row].reverse().join('')), { white_side: 'top' });
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

test('analizza: se c\'è un matto forzato mostra la sequenza fino al matto', async ({ page }) => {
  // Il Bianco (che sei tu: foto dal suo lato) ha il matto del barbiere: Dxf7#.
  const mate = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR'.split('/').map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  await mockClaude(page, mate, { side_to_move: 'w' });
  await openAnalyze(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('winning-line')).toHaveAttribute('data-kind', 'mate', { timeout: 30_000 });
  await expect(page.getByTestId('winning-line')).toContainText('Matto in 1!');
  await expect(page.getByTestId('winning-line')).toContainText('Dxf7#');
  await page.getByTestId('winning-line').getByRole('button').click();
  await expect(page.getByTestId('analyze-line')).toBeVisible();
});

test('analizza: con Opus la lettura rapida (che si può spegnere) e il ripiego lato server', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: reading(RANKS) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });
  await openAnalyze(page);
  // Il modello si sceglie nelle Impostazioni (Analizza mostra quello in uso e il collegamento, nelle opzioni).
  await page.getByText('Opzioni di lettura').click();
  await expect(page.getByTestId('model-link')).toContainText('Haiku 5.5');
  await page.getByTestId('model-link').getByRole('link').click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
  // Con Haiku (predefinito) la lettura rapida non c'è.
  await expect(page.getByTestId('claude-model')).toHaveValue('claude-haiku-5-5');
  await expect(page.getByTestId('fast-toggle')).toHaveCount(0);
  await page.getByTestId('claude-model').selectOption('claude-opus-5-5');
  await expect(page.getByTestId('fast-toggle')).toBeChecked();
  await page.getByTestId('nav-settings').click();
  await page.goBack();
  await page.getByText('Opzioni di lettura').click();
  await expect(page.getByTestId('model-link')).toContainText('Opus 5.5');
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('analyze-turn')).toBeVisible({ timeout: 30_000 });
  expect(bodies[0]).toMatchObject({ model: 'claude-opus-5-5', speed: 'fast', fallbacks: 'default' });
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('fast-toggle').uncheck();
  await page.goBack();
  await page.locator('input[type=file]').setInputFiles({ name: 'board2.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(2);
  expect(bodies[bodies.length - 1]).toMatchObject({ model: 'claude-opus-5-5' });
  expect(bodies[bodies.length - 1]).not.toHaveProperty('speed');
});

/** Fotocamera finta: un canvas che disegna una scacchiera (vista dall'alto, Bianco in basso) con i pezzi di window.__board. */
const FAKE_CAMERA = `
(() => {
  const W = 640, H = 480, X0BASE = 120, Y0 = 40, S = 50;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  window.__board = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const ctx = canvas.getContext('2d');
  function draw() {
    const X0 = X0BASE;
    ctx.fillStyle = '#5a6b4a'; ctx.fillRect(0, 0, W, H);
    const rows = window.__board.split('/');
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const dark = (f + (8 - r)) % 2 === 1;
      ctx.fillStyle = dark ? 'rgb(181,136,99)' : 'rgb(240,217,181)';
      ctx.fillRect(X0 + f * S, Y0 + r * S, S, S);
    }
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (/\\d/.test(ch)) { f += Number(ch); continue; }
        const white = ch === ch.toUpperCase();
        ctx.beginPath();
        ctx.arc(X0 + f * S + S / 2, Y0 + r * S + S / 2, 20, 0, Math.PI * 2);
        ctx.fillStyle = white ? '#ffffff' : '#1e1e1e';
        ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
        f++;
      }
    }
  }
  setInterval(draw, 50);
  draw();
  canvas.style.cssText = 'position:fixed;left:-10000px;top:0';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(canvas));
  const stream = canvas.captureStream(20);
  navigator.mediaDevices.getUserMedia = async () => stream;
})();
`;

test('foto guidate: dal tuo lato e di lato, poi la posizione fusa', async ({ page }) => {
  const counter = await mockClaude(page, RANKS);
  await page.addInitScript(FAKE_CAMERA);
  await openAnalyze(page);
  await page.getByTestId('camera-start').click();
  await expect(page.getByTestId('shot-title')).toContainText('Foto 1 di 2 · dal tuo lato');
  await page.waitForFunction(() => (document.querySelector('[data-testid=camera-video]') as HTMLVideoElement | null)?.videoWidth === 640);

  await page.getByTestId('shot-take').click();
  // Mentre la prima foto viene letta si scatta già la seconda.
  await expect(page.getByTestId('shot-title')).toContainText('Foto 2 di 2 · di lato');
  await page.getByTestId('shot-take').click();

  await expect(page.getByTestId('read-info')).toContainText('2 foto', { timeout: 30_000 });
  await expect(page.getByTestId('shot-thumbs').locator('img')).toHaveCount(2);
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', new RegExp(`^${PLACEMENT.replace(/\//g, '\\/')} `), { timeout: 30_000 });
  // La fotocamera si spegne; si può fotografare la posizione successiva.
  await expect(page.getByTestId('camera-video')).toHaveCount(0);
  await expect(page.getByTestId('camera-start')).toContainText('nuova posizione');
  // Ogni foto letta da Claude una volta (YOLO non riconosce i pezzi disegnati).
  expect(counter.readings).toBe(2);
  // Le istruzioni fisse della lettura sono nel prompt di sistema, in cache.
  expect(counter.bodies[0]).toMatchObject({ system: [{ type: 'text', cache_control: { type: 'ephemeral' } }] });
});

test('foto guidate: «Basta la prima foto» legge subito con una sola foto', async ({ page }) => {
  const counter = await mockClaude(page, RANKS);
  await page.addInitScript(FAKE_CAMERA);
  await openAnalyze(page);
  await page.getByTestId('camera-start').click();
  await page.waitForFunction(() => (document.querySelector('[data-testid=camera-video]') as HTMLVideoElement | null)?.videoWidth === 640);
  await page.getByTestId('shot-take').click();
  await page.getByTestId('shot-skip').click();
  await expect(page.getByTestId('read-info')).toContainText('1 foto', { timeout: 30_000 });
  expect(counter.readings).toBe(1);
});

test('numerazione invertita: case e coordinate come sulla scacchiera girata, e Claude lo sa', async ({ page }) => {
  const counter = await mockClaude(page, RANKS);
  await openAnalyze(page);
  await page.getByText('Opzioni di lettura').click();
  await page.getByTestId('flip-squares').check();
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('my-color').getByRole('button', { name: 'Nero' }).click();
  await expect(page.getByTestId('analyze-explanation')).toBeVisible({ timeout: 30_000 });

  // Claude non deve usare le coordinate stampate per capire dov'è il Bianco.
  expect(JSON.stringify(counter.bodies[0]!.messages)).toContain('REVERSED');
  // Alla spiegazione le mosse arrivano con i nomi veri delle case; la risposta si mostra rinominata.
  await expect(page.getByTestId('analyze-explanation')).toContainText('Il Bianco minaccia matto in c2: il Nero deve sviluppare il cavallo in c3.');
  // Il Nero in basso, sulle righe 1-2; colonne da A (a destra del Bianco) ad H.
  await expect(page.getByTestId('board-ranks').first()).toHaveText('87654321');
  await expect(page.getByTestId('board-files').first()).toHaveText('abcdefgh', { ignoreCase: true });

  // Tolta l'opzione, tutto torna normale.
  await page.getByTestId('flip-squares').uncheck();
  await expect(page.getByTestId('analyze-explanation')).toContainText('matto in f7');
  await expect(page.getByTestId('board-ranks').first()).toHaveText('12345678');
});
