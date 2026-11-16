import { expect, test } from '@playwright/test';

test('gioca con l’AI al livello scelto, con il tutor che giudica la mossa e spiega quella dell’AI', async ({ page }) => {
  await page.goto('./');
  await page.goto('./#/gioca');
  await page.getByTestId('play-level-1').check();
  await page.getByTestId('play-color-w').click();
  await expect(page.getByTestId('play-tutor-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('play-start').click();
  await expect(page.getByTestId('play-level-badge')).toContainText('Principiante');
  // Benot, il robot, si presenta e chiede come ti chiami.
  await expect(page.getByTestId('robot-bubble')).toContainText('Io sono Benot');
  await expect(page.getByTestId('robot-bubble')).toContainText('come ti chiami');
  await expect(page.getByTestId('robot').locator('svg.robot')).toHaveAttribute('data-mood', 'happy');
  // Senza microfono (browser di test) il nome si può scrivere.
  await page.getByTestId('play-name-input').fill('marco');
  await page.getByTestId('play-name-ok').click();
  await expect(page.getByTestId('robot-bubble')).toContainText('Piacere, Marco!');
  await expect(page.getByTestId('play-name')).toHaveCount(0);

  const click = async (square: string) => page.locator(`[data-square="${square}"]`).first().click();
  await click('e2');
  await click('e4');

  await expect(page.getByTestId('tutor-feedback')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('tutor-ai-note')).toContainText('Io gioco', { timeout: 60_000 });
  await expect(page.getByTestId('play-moves').locator('span:not(.text-muted)')).toHaveCount(2);
  await expect(page.getByTestId('play-status')).toHaveText('Tocca a te.');

  // Annullando si torna alla posizione iniziale.
  await page.getByTestId('play-undo').click();
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', /^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w/);
});

test('con il Nero e il tutor spento l’AI muove per prima', async ({ page }) => {
  await page.goto('./');
  await page.goto('./#/gioca');
  await page.getByTestId('play-color-b').click();
  await page.getByTestId('play-tutor-toggle').click();
  await page.getByTestId('play-start').click();
  // Benot aspetta il nome prima di muovere: qui la domanda si salta.
  await expect(page.getByTestId('play-name')).toBeVisible();
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', / w /);
  await page.getByTestId('play-name-skip').click();
  await expect(page.getByTestId('play-status')).toHaveText('Tocca a te.', { timeout: 60_000 });
  await expect(page.getByTestId('tutor-panel')).toHaveCount(0);
  // Anche senza tutor Benot annuncia la sua mossa.
  await expect(page.getByTestId('robot-bubble')).toContainText('Io gioco');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', / b /);
  // La lampadina accanto alla scacchiera dà il suggerimento anche senza tutor.
  await page.getByTestId('play-hint').click();
  await expect(page.getByTestId('play-hint-text')).toContainText('Prova a considerare', { timeout: 60_000 });
});

test('Benot ricorda il nome: alla partita dopo saluta per nome senza richiederlo', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('cm.user.name', 'Giulia'));
  await page.goto('./#/gioca');
  await expect(page.getByTestId('play-known-name')).toContainText('Giulia');
  await page.getByTestId('play-color-w').click();
  await page.getByTestId('play-start').click();
  await expect(page.getByTestId('robot-bubble')).toContainText('Ciao Giulia');
  await expect(page.getByTestId('play-name')).toHaveCount(0);
});

test('Benot chiede il nome e lo ascolta con il microfono', async ({ page }) => {
  // Riconoscimento vocale finto: il test «dice» la frase al posto dell'utente.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      start() {
        (window as unknown as { __say: (text: string) => void }).__say = (text: string) =>
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
        this.onstart?.();
      }
      stop() {}
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await page.goto('./');
  await page.goto('./#/gioca');
  await page.getByTestId('play-color-w').click();
  await page.getByTestId('play-start').click();
  await expect(page.getByTestId('play-name-listening')).toBeVisible();
  // L'eco della domanda di Benot non vale come risposta.
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say('io sono Benot'));
  await expect(page.getByTestId('play-name')).toBeVisible();
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say('mi chiamo luca'));
  await expect(page.getByTestId('robot-bubble')).toContainText('Piacere, Luca!');
  await expect(page.getByTestId('play-name')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('cm.user.name'))).toBe('Luca');
});
