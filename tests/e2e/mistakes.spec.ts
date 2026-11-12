import { expect, test, type Page } from '@playwright/test';

/** Il Bianco ha giocato Tb1 invece del matto Ta8#. */
const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
/** Immagine PNG minima (1×1) usata come «foto» della scacchiera. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function openApp(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('daily-card')).toBeVisible();
}

async function clickSquares(page: Page, scope: string, ...squares: string[]) {
  for (const sq of squares) await page.getByTestId(scope).locator(`[data-sq="${sq}"]`).click();
}

test.describe('i miei errori', () => {
  test('posizione manuale, analisi con Stockfish, note e ripasso', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openApp(page);

    await page.getByTestId('home-add-mistake').click();
    await expect(page.getByTestId('wizard-step')).toContainText('Passo 1 di 5');
    await page.getByTestId('source-manual').click();

    // Posizione da FEN
    await page.getByTestId('fen-input').fill(BACK_RANK);
    await page.getByTestId('fen-apply').click();
    await page.getByTestId('position-next').click();

    // La mossa giocata in partita
    await expect(page.getByTestId('played-step')).toBeVisible();
    await clickSquares(page, 'played-step', 'a1', 'b1');
    await expect(page.getByTestId('played-move')).toContainText('Tb1');
    await page.getByTestId('played-next').click();

    // Il motore nel browser trova il matto
    const suggestion = page.getByTestId('engine-suggestion');
    await expect(suggestion).toHaveAttribute('data-best', 'a1a8', { timeout: 45_000 });
    await expect(suggestion).toContainText('Ta8#');
    // Anche senza matto il Bianco resta molto avanti: per il calo delle
    // probabilità di vittoria è un'imprecisione, non un errore grave.
    await expect(suggestion).toContainText('Imprecisione');
    await expect(suggestion).toContainText('M1 con la mossa migliore');
    await page.getByTestId('use-engine').click();

    // Note
    await expect(page.getByTestId('mistake-title')).toHaveValue('Errore in partita');
    await page.getByTestId('mistake-title').fill('Traversa dimenticata');
    await page.getByTestId('mistake-wrong').fill('Non ho controllato gli scacchi sulla traversa.');
    await page.getByTestId('mistake-continue').fill('Ta8 è matto: il re è chiuso dai suoi pedoni.');
    await page.getByTestId('mistake-save').click();

    // Dettaglio
    await expect(page.getByTestId('mistake-saved')).toBeVisible();
    await expect(page.getByTestId('mistake-title-heading')).toHaveText('Traversa dimenticata');
    await expect(page.getByTestId('detail-played')).toHaveText('Tb1');
    await expect(page.getByTestId('detail-best')).toHaveText('Ta8#');
    await expect(page.getByTestId('note-wrong')).toContainText('traversa');

    // Elenco e ripasso
    await page.getByRole('link', { name: 'Torna ai miei errori' }).click();
    await expect(page.getByTestId('mistake-row')).toHaveCount(1);
    await page.getByTestId('review-mistakes').click();
    const task = page.getByTestId('mistake-task');
    await expect(task).toHaveAttribute('data-status', 'awaiting');
    // Prima si ripete l'errore: il primo indizio è la nota scritta dall'utente.
    await clickSquares(page, 'mistake-task', 'a1', 'b1');
    await expect(page.getByTestId('wrong-feedback')).toContainText('Non ho controllato gli scacchi sulla traversa.');
    await page.getByRole('button', { name: /Annulla la mossa/ }).click();
    await clickSquares(page, 'mistake-task', 'a1', 'a8');
    await expect(task).toHaveAttribute('data-status', 'solved');
    await page.getByRole('button', { name: 'Continua' }).click();

    await expect(page.getByTestId('mistake-review-after')).toBeVisible();
    await expect(page.getByTestId('review-next-due')).toContainText(/Prossimo ripasso: (domani|tra \d+ giorni)/);
    await page.getByTestId('review-continue').click();
    await expect(page.getByTestId('mistake-review-done')).toContainText('Hai ripassato 1 errore.');

    // Dopo la riapertura l'errore è ancora salvato e non è più in scadenza oggi.
    await page.reload();
    await page.goto('./#/errori');
    await expect(page.getByTestId('mistake-row')).toHaveCount(1);
    await expect(page.getByTestId('no-due-mistakes')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('foto della scacchiera ed editor della posizione', async ({ page }) => {
    await openApp(page);
    await page.goto('./#/errori/nuovo');
    await page.getByTestId('source-photo').click();

    await page.getByTestId('photo-input').setInputFiles({ name: 'scacchiera.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('photo-preview')).toBeVisible();
    await expect(page.getByTestId('photo-preview')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

    // Senza re la posizione non è valida.
    await page.locator('[data-tool="wQ"]').click();
    await clickSquares(page, 'board-editor', 'd1');
    await expect(page.getByTestId('position-error')).toContainText('un re bianco e un re nero');
    await expect(page.getByTestId('position-next')).toBeDisabled();

    await page.locator('[data-tool="wK"]').click();
    await clickSquares(page, 'board-editor', 'g1');
    await page.locator('[data-tool="bK"]').click();
    await clickSquares(page, 'board-editor', 'g8');
    await page.locator('[data-tool="bP"]').click();
    await clickSquares(page, 'board-editor', 'f7', 'g7', 'h7');
    await expect(page.getByTestId('position-error')).toHaveCount(0);
    await page.getByTestId('position-next').click();

    await page.getByTestId('played-skip').click();
    await expect(page.getByTestId('engine-suggestion')).toHaveAttribute('data-best', 'd1d8', { timeout: 45_000 });

    // Continuazione inserita a mano
    await page.getByTestId('own-line-mode').click();
    await clickSquares(page, 'best-step', 'd1', 'd8');
    await expect(page.getByTestId('own-line')).toContainText('Dd8#');
    await page.getByTestId('confirm-own-line').click();
    await page.getByTestId('mistake-save').click();

    await expect(page.getByTestId('detail-best')).toHaveText('Dd8#');
    await expect(page.getByTestId('detail-played')).toContainText('mossa non indicata');
    await expect(page.getByTestId('detail-photo')).toBeVisible();
  });

  test('partita in PGN: il motore trova l’errore del giocatore', async ({ page }) => {
    await openApp(page);
    await page.goto('./#/errori/nuovo');
    await page.getByTestId('source-pgn').click();
    await page
      .getByTestId('pgn-input')
      .fill('[White "Rossi"]\n[Black "Bianchi"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0');
    await page.getByTestId('pgn-load').click();
    await expect(page.getByTestId('game-label')).toHaveText('Rossi – Bianchi');
    await page.getByLabel(/^Nero/).check();
    await page.getByTestId('scan-game').click();

    const found = page.getByTestId('found-mistake');
    await expect(found.first()).toBeVisible({ timeout: 60_000 });
    await expect(found.first()).toContainText('3…Cf6');
    await expect(found.first()).toContainText('Errore grave');
    await found.first().click();

    await expect(page.getByTestId('best-step')).toBeVisible();
    await expect(page.getByTestId('use-engine')).toBeEnabled({ timeout: 45_000 });
    await page.getByTestId('use-engine').click();
    await expect(page.getByTestId('mistake-title')).toHaveValue('Errore alla mossa 3');
    await page.getByTestId('mistake-save').click();
    await expect(page.getByTestId('detail-played')).toHaveText('Cf6');
  });

  test('profilo: account non configurato e nuove preferenze', async ({ page }) => {
    await openApp(page);
    await page.goto('./#/profilo');
    await expect(page.getByTestId('account-card')).toHaveAttribute('data-status', 'disabled');
    await page.getByTestId('player-name').fill('Bianchi');
    await page.getByTestId('player-name').press('Enter');
    await page.getByLabel('Approfondita (più lenta)').click();
    await expect(page.getByLabel('Approfondita (più lenta)')).toBeChecked();
    await page.reload();
    await expect(page.getByTestId('player-name')).toHaveValue('Bianchi');
    await expect(page.getByLabel('Approfondita (più lenta)')).toBeChecked();
  });
});
