import { expect, test, type Page } from '@playwright/test';

/**
 * Fotocamera finta: un canvas che disegna una scacchiera vista dall'alto
 * (Bianco in basso) con i pezzi della disposizione in window.__board;
 * window.__hand = true fa passare una «mano» sopra la scacchiera.
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

/** Calibrazione già salvata: gli angoli esatti della scacchiera finta (640×480, da 120,40 a 520,440). */
const CALIBRATION = JSON.stringify({
  corners: [
    { x: 120 / 640, y: 40 / 480 },
    { x: 520 / 640, y: 40 / 480 },
    { x: 520 / 640, y: 440 / 480 },
    { x: 120 / 640, y: 440 / 480 },
  ],
  aspect: 640 / 480,
  savedAt: 0,
});

async function play(page: Page, placement: string) {
  await page.evaluate(() => ((window as unknown as { __hand: boolean }).__hand = true));
  await page.waitForTimeout(400);
  await page.evaluate((p) => {
    const w = window as unknown as { __hand: boolean; __board: string };
    w.__board = p;
    w.__hand = false;
  }, placement);
}

async function openTutor(page: Page, withKey: boolean) {
  await page.addInitScript(FAKE_CAMERA);
  await page.addInitScript(
    ([calibration, key]) => {
      localStorage.setItem('cm.vision.calibration.v1', calibration);
      if (key) localStorage.setItem('cm.anthropic.apiKey', key);
    },
    [CALIBRATION, withKey ? `sk-ant-api03-${'x'.repeat(40)}` : ''] as const,
  );
  await page.goto('./');
  await page.goto('./#/partite/opera-game');
  await page.getByTestId('game-tutor-link').click();
  await expect(page.getByTestId('game-tutor')).toBeVisible();
}

test('tutor grandi partite: segue le mosse sulla scacchiera, spiega subito e gestisce gli errori', async ({ page }) => {
  // Spiegazioni di Claude simulate: si contano le richieste per verificare il pre-fetching.
  const asked: string[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as { messages: { content: string }[] };
    const content = String(body.messages[0]?.content ?? '');
    const move = /Mossa: ([^,]+),/.exec(content)?.[1] ?? 'deviazione';
    asked.push(move);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: `msg_${asked.length}`,
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: `Spiegazione preparata per ${move}.` }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  await openTutor(page, true);

  // Prima ancora di accendere la fotocamera la coda ha preparato le prime mosse.
  await expect.poll(() => asked.slice(0, 3)).toEqual(['1.e4', '1…e5', '2.Cf3']);
  await expect(page.getByTestId('tutor-next')).toContainText('qual è la mossa di Paul Morphy');

  await page.getByTestId('tutor-camera-start').click();
  await expect(page.getByTestId('tutor-calibration-note')).toContainText('Calibrazione precedente ripristinata');
  await expect(page.getByTestId('board-overlay')).toBeVisible();
  // Griglia AR con i pezzi attesi dalla FEN e anteprima raddrizzata dal worker.
  await expect(page.getByTestId('overlay-piece')).toHaveCount(32);
  await expect(page.getByTestId('tutor-status')).toHaveAttribute('data-status', 'stable', { timeout: 15_000 });
  await expect(page.getByTestId('rectified-preview')).toBeVisible();
  // L'elaborazione dei pixel avviene nel Web Worker della visione, non sul thread dell'interfaccia.
  expect(workers.some((url) => url.includes('cv.worker'))).toBe(true);

  // 1.e4: la mossa del Maestro, trovata al primo colpo; spiegazione già in cache.
  await play(page, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Esatto! 1.e4', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-explanation')).toHaveText('Spiegazione preparata per 1.e4.');
  await expect(page.getByTestId('tutor-score')).toContainText('al primo colpo: 1 su');

  // 1…e5 tocca al Nero: il tutor la indica (freccia sulla griglia AR) e l'utente la esegue.
  await expect(page.getByTestId('tutor-next')).toContainText('1…e5');
  await expect(page.getByTestId('overlay-arrow')).toHaveAttribute('data-move', 'e7e5');
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('1…e5.', { timeout: 10_000 });

  // 2.d4 invece di 2.Cf3: deviazione, giudizio di Stockfish, richiesta di riprovare.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toContainText('d4', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-feedback')).toContainText('Riporta indietro il pezzo', { timeout: 30_000 });
  await expect(page.getByTestId('tutor-why')).toBeVisible();

  // Il pedone torna in d2: la fotocamera riconosce il ritorno alla posizione della partita.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Bene, posizione ripristinata. Riprova!', { timeout: 10_000 });

  // 2.Cf3: giusta, ma non al primo colpo.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Giusto, 2.Cf3.', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-explanation')).toHaveText('Spiegazione preparata per 2.Cf3.');
  await expect(page.getByTestId('tutor-score')).toContainText('al primo colpo: 1 su');
});

test('tutor grandi partite: senza fotocamera si gioca sulla scacchiera 2D, con i commenti del PGN', async ({ page }) => {
  await openTutor(page, false);
  await page.getByTestId('tutor-side').getByRole('button', { name: 'Di entrambi' }).click();
  // Muove con un clic sulla casa di partenza e uno su quella d'arrivo.
  const click = async (square: string) => page.locator(`[data-square="${square}"]`).first().click();
  await click('e2');
  await click('e4');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Esatto! 1.e4');
  await expect(page.getByTestId('tutor-explanation')).toContainText('osserva che cosa cambia');
  await page.getByTestId('tutor-skip').click();
  await page.getByTestId('tutor-skip').click();
  // 2…d6 ha un commento nel PGN: si mostra subito.
  await page.getByTestId('tutor-skip').click();
  await expect(page.getByTestId('tutor-explanation')).toContainText('Philidor');
});
