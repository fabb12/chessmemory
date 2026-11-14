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
  // Foto dal lato del Bianco → sei il Bianco; muove il Nero → tocca all'avversario: si vede la sua minaccia, niente consigli.
  await expect(page.getByTestId('analyze-turn')).toContainText('Tocca all’avversario (Nero)');
  await expect(page.getByTestId('opponent-turn')).toContainText('mossa più pericolosa', { timeout: 30_000 });
  await expect(page.getByTestId('candidate-moves')).toHaveCount(0);
  expect(bodies).toHaveLength(1);

  // Lettura veloce: sforzo basso, modalità rapida, nessuna seconda lettura perché la posizione è valida.
  expect(bodies[0]).toMatchObject({ model: 'claude-opus-5-5', speed: 'fast', output_config: { effort: 'low', format: { type: 'json_schema' } } });

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
  await expect(page.getByText('Lettura sicura')).toBeVisible();
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

test('analizza: la lettura rapida si può spegnere', async ({ page }) => {
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
  await page.getByTestId('fast-toggle').uncheck();
  await page.locator('input[type=file]').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('analyze-turn')).toBeVisible({ timeout: 30_000 });
  expect(bodies[0]).not.toHaveProperty('speed');
});

/**
 * Fotocamera finta: un canvas che disegna una scacchiera (vista dall'alto, Bianco in basso)
 * con i pezzi della disposizione in window.__board; window.__hand = true fa passare una «mano».
 */
const FAKE_CAMERA = `
(() => {
  const W = 640, H = 480, X0 = 120, Y0 = 40, S = 50;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  window.__board = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  window.__hand = false;
  const ctx = canvas.getContext('2d');
  function draw() {
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
    if (window.__hand) {
      ctx.fillStyle = 'rgb(224,172,105)';
      ctx.beginPath();
      ctx.ellipse(250 + Math.random() * 120, 200 + Math.random() * 120, 150, 110, 0, 0, Math.PI * 2);
      ctx.fill();
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

test('modalità tutor: legge una volta, poi riconosce le mosse senza Claude e parla a ogni mossa', async ({ page }) => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const startGrid = START.split('/').map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  // Nel quadrato centrale inviato (480×480 da x=80) la scacchiera va da 40 a 440 px: 83–917 su 1000.
  const counter = await mockClaude(page, startGrid, {
    side_to_move: 'unknown',
    board_corners: { top_left: { x: 83, y: 83 }, top_right: { x: 917, y: 83 }, bottom_right: { x: 917, y: 917 }, bottom_left: { x: 83, y: 917 } },
  });
  await page.addInitScript(FAKE_CAMERA);
  // Sintesi vocale finta: registra le frasi pronunciate.
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u: SpeechSynthesisUtterance) => spoken.push(u.text), cancel: () => undefined, getVoices: () => [] },
    });
  });
  await openAnalyze(page);
  await page.getByTestId('camera-start').click();
  await expect(page.getByTestId('camera-video')).toBeVisible();
  await page.waitForFunction(() => (document.querySelector('[data-testid=camera-video]') as HTMLVideoElement | null)?.videoWidth === 640);

  await page.getByTestId('live-toggle').click();
  // Prima lettura: posizione iniziale, griglia sulla scacchiera, e tocca a te (Bianco).
  await expect(page.getByTestId('board-overlay')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('live-banner')).toHaveAttribute('data-tone', 'mine', { timeout: 30_000 });
  await expect(page.getByTestId('live-banner')).toContainText('Tocca a te: ti consiglio');
  expect(counter.readings).toBe(1);
  // Le istruzioni fisse della lettura sono nel prompt di sistema, in cache; nella richiesta resta solo la foto.
  expect(counter.bodies[0]).toMatchObject({ system: [{ type: 'text', cache_control: { type: 'ephemeral' } }] });

  const play = async (placement: string) => {
    await page.evaluate(() => ((window as unknown as { __hand: boolean }).__hand = true));
    await expect(page.getByTestId('live-banner')).toContainText('Mano sulla scacchiera');
    await page.evaluate((p) => {
      const w = window as unknown as { __hand: boolean; __board: string };
      w.__board = p;
      w.__hand = false;
    }, placement);
  };

  // 1.e4: vista senza Claude; il tutor giudica la tua mossa e passa la parola all'avversario.
  await play('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('live-history')).toContainText('e4', { timeout: 10_000 });
  await expect(page.getByTestId('live-banner')).toHaveAttribute('data-tone', 'theirs', { timeout: 30_000 });
  await expect(page.getByTestId('live-banner')).toContainText(/mossa.*Tocca all’avversario|Imprecisione|Errore/);
  await expect(page.getByTestId('opponent-turn')).toBeVisible();

  // 1…e5: di nuovo senza Claude, e torna il tuo turno con la mossa consigliata.
  await play('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('live-history')).toContainText('e5', { timeout: 10_000 });
  await expect(page.getByTestId('live-banner')).toHaveAttribute('data-tone', 'mine', { timeout: 30_000 });
  await expect(page.getByTestId('live-banner')).toContainText('Il Nero ha giocato e5. Tocca a te: ti consiglio');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', /^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/8\/PPPP1PPP\/RNBQKBNR w /);
  // Nessuna nuova lettura della foto e nessuna spiegazione automatica: zero token dopo la prima lettura.
  expect(counter.readings).toBe(1);
  expect(counter.explanations).toBe(0);
  await expect(page.getByTestId('tutor-usage')).toContainText('1 lettura, 0 spiegazioni');
  await expect(page.getByTestId('tutor-usage')).toContainText('Mosse riconosciute senza Claude: 2');

  // «Perché?»: solo ora una spiegazione, breve.
  await page.getByTestId('tutor-why').click();
  await expect(page.getByTestId('tutor-explanation')).toContainText(EXPLANATION);
  expect(counter.explanations).toBe(1);

  // Il tutor ha parlato a voce, con le mosse pronunciate per esteso.
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken.some((text) => text.startsWith('Il Nero ha giocato e5. Tocca a te: ti consiglio'))).toBe(true);
  expect(spoken.at(-1)).toContain('Il Bianco minaccia matto');
  expect(JSON.stringify(counter.bodies.at(-1))).toContain('2–3 frasi');
});

test('modalità tutor con foto: legge solo quando scatti, una foto per mossa', async ({ page }) => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const startGrid = START.split('/').map((row) => row.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  const counter = await mockClaude(page, startGrid, {
    side_to_move: 'unknown',
    board_corners: { top_left: { x: 83, y: 83 }, top_right: { x: 917, y: 83 }, bottom_right: { x: 917, y: 917 }, bottom_left: { x: 83, y: 917 } },
  });
  await page.addInitScript(FAKE_CAMERA);
  await openAnalyze(page);
  await page.getByTestId('camera-start').click();
  await page.waitForFunction(() => (document.querySelector('[data-testid=camera-video]') as HTMLVideoElement | null)?.videoWidth === 640);

  await page.getByTestId('tutor-mode-photo').click();
  await expect(page.getByTestId('tutor-mode-photo')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('live-toggle').click();
  // Avvio: prima foto subito.
  await expect(page.getByTestId('live-banner')).toHaveAttribute('data-tone', 'mine', { timeout: 30_000 });
  expect(counter.readings).toBe(1);

  // La mossa sulla scacchiera non viene vista finché non si scatta.
  await page.evaluate(() => ((window as unknown as { __board: string }).__board = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR'));
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('live-history')).toHaveCount(0);

  await page.getByTestId('tutor-shoot').click();
  await expect(page.getByTestId('live-history')).toContainText('e4', { timeout: 10_000 });
  await expect(page.getByTestId('live-banner')).toHaveAttribute('data-tone', 'theirs', { timeout: 30_000 });

  // Foto senza mosse nuove: lo dice, senza chiamare Claude.
  await page.getByTestId('tutor-shoot').click();
  await expect(page.getByTestId('live-banner')).toContainText('Nessuna mossa nuova');
  expect(counter.readings).toBe(1);
});
