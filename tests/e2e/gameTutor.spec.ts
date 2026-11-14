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

/** Voce e microfono finti: la sintesi «parla» all'istante, il riconoscimento ascolta window.__say(testo). */
const FAKE_VOICE = `
(() => {
  window.__said = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      // window.__longSpeech = true: la frase non finisce finché non viene interrotta.
      speak: (u) => {
        window.__said.push(u.text);
        window.__current = u;
        if (!window.__longSpeech) setTimeout(() => u.onend && u.onend(), 30);
      },
      cancel: () => {
        window.__cancels = (window.__cancels || 0) + 1;
        const u = window.__current;
        window.__current = null;
        if (u) setTimeout(() => u.onerror && u.onerror(), 0);
      },
      getVoices: () => [],
      addEventListener: () => {},
    },
  });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.SpeechRecognition = class {
    start() { this.onstart && this.onstart(); window.__say = (text) => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
    stop() {}
    abort() {}
  };
})();
`;

async function say(page: Page, text: string) {
  // Si aspetta che il tutor abbia finito di parlare (e la breve pausa anti-eco).
  await page.waitForTimeout(1100);
  await page.evaluate((t) => (window as unknown as { __say: (t: string) => void }).__say(t), text);
}

async function play(page: Page, placement: string) {
  await page.evaluate(() => ((window as unknown as { __hand: boolean }).__hand = true));
  await page.waitForTimeout(400);
  await page.evaluate((p) => {
    const w = window as unknown as { __hand: boolean; __board: string };
    w.__board = p;
    w.__hand = false;
  }, placement);
}

async function openTutor(page: Page, withKey: boolean, nextDelay = '0') {
  await page.addInitScript(FAKE_CAMERA);
  await page.addInitScript(FAKE_VOICE);
  await page.addInitScript(
    ([calibration, key, delay]) => {
      localStorage.setItem('cm.vision.calibration.v1', calibration);
      localStorage.setItem('cm.tutor.nextDelay', delay);
      if (key) localStorage.setItem('cm.anthropic.apiKey', key);
    },
    [CALIBRATION, withKey ? `sk-ant-api03-${'x'.repeat(40)}` : '', nextDelay] as const,
  );
  await page.goto('./');
  await page.goto('./#/partite/opera-game');
  await page.getByTestId('game-tutor-link').click();
  await expect(page.getByTestId('game-tutor')).toBeVisible();
}

const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said);

test('tutor grandi partite: segue le mosse sulla scacchiera e spiega subito il perché', async ({ page }) => {
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
  // Modalità guidata (predefinita): quale pezzo, da dove e dove. Il perché arriva dopo la mossa.
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il pedone da e2 a e4.');
  await expect(page.getByTestId('tutor-explanation')).toHaveCount(0);
  await page.getByTestId('tutor-side').getByRole('button', { name: 'Indovina il Bianco' }).click();
  await expect(page.getByTestId('tutor-next')).toContainText('qual è la mossa di Paul Morphy');

  await page.getByTestId('tutor-camera-start').click();
  await expect(page.getByTestId('board-overlay')).toBeVisible();
  // Griglia AR con i pezzi attesi dalla FEN e anteprima raddrizzata dal worker.
  await expect(page.getByTestId('overlay-piece')).toHaveCount(32);
  await expect(page.getByTestId('tutor-status')).toHaveAttribute('data-status', 'stable', { timeout: 15_000 });
  await expect(page.getByTestId('rectified-preview')).toBeVisible();
  // L'elaborazione dei pixel avviene nel Web Worker della visione, non sul thread dell'interfaccia.
  expect(workers.some((url) => url.includes('cv.worker'))).toBe(true);

  // 1.e4: la mossa del Maestro, trovata al primo colpo; subito il perché (già in cache).
  await play(page, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Esatto! 1.e4', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-explanation')).toContainText('Spiegazione preparata per 1.e4.');
  await expect(page.getByTestId('tutor-score')).toContainText('al primo colpo: 1 su');

  // Poi la mossa del Nero, da eseguire su indicazione (freccia sulla griglia AR).
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Nero muove il pedone da e7 a e5.', { timeout: 10_000 });
  await expect(page.getByTestId('overlay-arrow')).toHaveAttribute('data-move', 'e7e5');
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Bene, 1…e5.', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-explanation')).toContainText('Spiegazione preparata per 1…e5.');
  await expect.poll(async () => (await said(page)).some((t) => t.startsWith('Bene') && t.includes('Spiegazione preparata per'))).toBe(true);
  await expect(page.getByTestId('tutor-next')).toContainText('qual è la mossa di Paul Morphy', { timeout: 10_000 });

  // 2.d4 invece di 2.Cf3: deviazione, giudizio di Stockfish, richiesta di riprovare.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toContainText('d4', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-feedback')).toContainText('Rimetti il pezzo', { timeout: 30_000 });
  await expect(page.getByTestId('tutor-why')).toBeVisible();

  // Il pedone torna in d2: la fotocamera riconosce il ritorno alla posizione della partita.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Posizione ripristinata.', { timeout: 10_000 });

  // 2.Cf3: giusta, ma non al primo colpo.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Giusto, 2.Cf3.', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-explanation')).toContainText('Spiegazione preparata per 2.Cf3.');
  await expect(page.getByTestId('tutor-score')).toContainText('al primo colpo: 1 su');
});

test('tutor grandi partite: modalità guidata sulla scacchiera 2D, con le spiegazioni locali', async ({ page }) => {
  await openTutor(page, false, '1');
  const click = async (square: string) => page.locator(`[data-square="${square}"]`).first().click();
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il pedone da e2 a e4.');
  await click('e2');
  await click('e4');
  // Appena fatta la mossa: il perché (senza chiave, ricavato dalla posizione) e la lezione.
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Bene, 1.e4.');
  await expect(page.getByTestId('tutor-explanation')).toContainText('centro');
  await expect(page.getByTestId('tutor-explanation')).toContainText('La lezione:');
  await expect(page.getByTestId('tutor-reveal')).toBeVisible();
  // Dopo la pausa, la mossa successiva per l'altro colore.
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Nero muove il pedone da e7 a e5.', { timeout: 6_000 });
  // Mossa sbagliata: si chiede di rimettere il pezzo e si ripete la mossa giusta.
  await click('d7');
  await click('d5');
  await expect(page.getByTestId('tutor-feedback')).toContainText('Il Nero muove il pedone da e7 a e5.');
  await page.getByTestId('tutor-takeback').click();
  await click('e7');
  await click('e5');
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il cavallo da g1 a f3.', { timeout: 6_000 });
  // «Avanti»: la mossa si considera fatta (perché, poi la successiva); «Mossa successiva» salta la pausa.
  await page.getByTestId('tutor-skip').click();
  await page.getByTestId('tutor-reveal').click();
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Nero muove il pedone da d7 a d6.');
  await page.getByTestId('tutor-skip').click();
  // 2…d6 ha un commento nel PGN: è il perché della mossa.
  await expect(page.getByTestId('tutor-explanation')).toContainText('Philidor');
});

test('tutor grandi partite: modalità «Indovina tutto» sulla scacchiera 2D', async ({ page }) => {
  await openTutor(page, false);
  await page.getByTestId('tutor-side').getByRole('button', { name: 'Indovina tutto' }).click();
  const click = async (square: string) => page.locator(`[data-square="${square}"]`).first().click();
  await click('e2');
  await click('e4');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Esatto! 1.e4');
  await expect(page.getByTestId('tutor-explanation')).toContainText('centro');
});


test('tutor grandi partite: senza fotocamera, dopo N secondi passa da solo alla mossa successiva', async ({ page }) => {
  await openTutor(page, false, '1');
  await page.getByTestId('tutor-auto-seconds').fill('2');
  await page.getByTestId('tutor-repeat').click();
  await expect(page.getByTestId('tutor-countdown')).toBeVisible();
  // Tempo scaduto: 1.e4 si considera fatta, si spiega, poi la mossa del Nero.
  await expect(page.getByTestId('tutor-feedback')).toHaveText('1.e4.', { timeout: 6_000 });
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Nero muove il pedone da e7 a e5.', { timeout: 6_000 });
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il cavallo da g1 a f3.', { timeout: 10_000 });
  expect((await said(page)).some((s) => s.includes('Il Nero muove il pedone da e7 a e5.'))).toBe(true);
  // 0 = mai: il conto alla rovescia sparisce.
  await page.getByTestId('tutor-auto-seconds').fill('0');
  await expect(page.getByTestId('tutor-countdown')).toHaveCount(0);
});

test('tutor grandi partite: comandi a voce e domande sulla partita', async ({ page }) => {
  const questions: string[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as { messages: { content: string }[] };
    const last = String(body.messages[body.messages.length - 1]?.content ?? '');
    const isQuestion = last.includes('Domanda:');
    if (isQuestion) questions.push(last);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: 'msg_q',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: isQuestion ? 'Ha vinto Morphy con un matto spettacolare.' : 'Spiegazione di Claude.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });
  await openTutor(page, true, '60');
  await page.getByTestId('tutor-auto-seconds').fill('0');
  await page.getByTestId('tutor-mic').click();
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il pedone da e2 a e4.');

  // «Prossima mossa» con l'indicazione in vista: la mossa si considera fatta e si spiega…
  await say(page, 'prossima mossa');
  await expect(page.getByTestId('tutor-heard')).toContainText('prossima mossa');
  await expect(page.getByTestId('tutor-explanation')).toContainText('Spiegazione di Claude.');
  // … e durante la spiegazione fa arrivare subito la successiva.
  await say(page, 'prossima mossa');
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Nero muove il pedone da e7 a e5.');

  await say(page, 'perché?');
  await expect(page.getByTestId('tutor-answer-text')).toHaveText('Spiegazione di Claude.');

  await say(page, 'chi ha vinto questa partita?');
  await expect(page.getByTestId('tutor-answer-text')).toHaveText('Ha vinto Morphy con un matto spettacolare.');
  expect(questions[0]).toContain('Mosse giocate finora: 1.e4');
  expect(questions[0]).toContain('chi ha vinto');

  // I comandi si possono anche scrivere.
  await page.getByTestId('tutor-question').fill('avanti');
  await page.getByTestId('tutor-ask').click();
  await expect(page.getByTestId('tutor-feedback')).toHaveText('1…e5.');
});

test('tutor grandi partite: con la fotocamera il tempo scaduto ripete l’indicazione e le mosse si recuperano in ordine', async ({ page }) => {
  await openTutor(page, false);
  await page.getByTestId('tutor-camera-start').click();
  await expect(page.getByTestId('tutor-status')).toHaveAttribute('data-status', 'stable', { timeout: 15_000 });
  // Tempo scaduto con la fotocamera: non si va avanti da soli, si ripete la mossa da fare.
  await page.getByTestId('tutor-auto-seconds').fill('2');
  await expect.poll(async () => (await said(page)).some((t) => t.startsWith('Tocca ancora a te.')), { timeout: 8_000 }).toBe(true);
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il pedone da e2 a e4.');
  await page.getByTestId('tutor-auto-seconds').fill('0');

  // «Avanti» due volte: sulla scacchiera vera mancano 1.e4 e 1…e5.
  await page.getByTestId('tutor-skip').click();
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Nero muove il pedone da e7 a e5.');
  await page.getByTestId('tutor-skip').click();
  await expect(page.getByTestId('tutor-behind')).toContainText('mancano 2 mosse');
  await expect(page.getByTestId('tutor-next')).toHaveText('Il Bianco muove il cavallo da g1 a f3.');
  await play(page, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-behind')).toContainText('manca 1 mossa', { timeout: 10_000 });
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  await expect(page.getByTestId('tutor-behind')).toHaveCount(0, { timeout: 10_000 });
  // Allineati: la mossa indicata viene riconosciuta e spiegata subito.
  await play(page, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
  await expect(page.getByTestId('tutor-feedback')).toHaveText('Bene, 2.Cf3.', { timeout: 10_000 });
  await expect(page.getByTestId('tutor-explanation')).toContainText('La lezione:');
});

test('tutor grandi partite: chiede il nome, si interrompe a voce e il microfono resta acceso', async ({ page }) => {
  await openTutor(page, false, '60');
  await page.getByTestId('tutor-auto-seconds').fill('0');
  await page.getByTestId('tutor-mic').click();
  // All'inizio chiede il nome e poi lo usa quando parla.
  await expect.poll(async () => (await said(page)).some((t) => t.includes('Come ti chiami?'))).toBe(true);
  await say(page, 'mi chiamo marco');
  await expect(page.getByTestId('tutor-name')).toContainText('Ti chiami Marco');
  await expect.poll(async () => (await said(page)).some((t) => t.includes('Piacere, Marco! Iniziamo.'))).toBe(true);

  // Mentre il tutor parla, un comando vocale lo interrompe subito.
  await page.evaluate(() => ((window as unknown as { __longSpeech: boolean }).__longSpeech = true));
  await page.getByTestId('tutor-repeat').click();
  await page.waitForTimeout(100);
  const cancels = await page.evaluate(() => (window as unknown as { __cancels?: number }).__cancels ?? 0);
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say('prossima mossa'));
  await expect(page.getByTestId('tutor-feedback')).toHaveText('1.e4.');
  // «Basta» ferma la spiegazione in corso.
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => (window as unknown as { __cancels?: number }).__cancels ?? 0);
  expect(before).toBeGreaterThan(cancels);
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say('basta'));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cancels?: number }).__cancels ?? 0)).toBeGreaterThan(before);
  // Una frase qualsiasi mentre parla (non un comando) non lo interrompe.
  await page.getByTestId('tutor-reveal').click();
  await page.waitForTimeout(100);
  const now = await page.evaluate(() => (window as unknown as { __cancels?: number }).__cancels ?? 0);
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say('chi ha vinto la partita'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __cancels?: number }).__cancels ?? 0)).toBe(now);

  // Alla prossima apertura microfono e nome ci sono ancora.
  await page.reload();
  await expect(page.getByTestId('tutor-mic')).toHaveText('Spegni il microfono');
  await expect(page.getByTestId('tutor-name')).toContainText('Marco');
});
