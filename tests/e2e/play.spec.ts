import { expect, test } from '@playwright/test';

test('gioca con l’AI al livello scelto, con il tutor che giudica la mossa e spiega quella dell’AI', async ({ page }) => {
  await page.goto('./');
  await page.goto('./#/gioca');
  await page.getByTestId('play-level-1').check();
  await page.getByTestId('play-color-w').click();
  await expect(page.getByTestId('play-tutor-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('play-start').click();
  await expect(page.getByTestId('play-level-badge')).toContainText('Principiante');

  const click = async (square: string) => page.locator(`[data-square="${square}"]`).first().click();
  await click('e2');
  await click('e4');

  await expect(page.getByTestId('tutor-feedback')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('tutor-ai-note')).toContainText('L’AI gioca', { timeout: 60_000 });
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
  await expect(page.getByTestId('play-status')).toHaveText('Tocca a te.', { timeout: 60_000 });
  await expect(page.getByTestId('tutor-panel')).toHaveCount(0);
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-fen', / b /);
});
