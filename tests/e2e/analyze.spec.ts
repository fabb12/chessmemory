import { expect, test } from '@playwright/test';

/** Immagine PNG minima (1×1) usata come «foto» della scacchiera. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
/** Il Nero deve parare il matto in f7 (Df3 + Ac4). */
const PLACEMENT = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR';
const EXPLANATION = 'Il Bianco minaccia matto in f7: il Nero deve sviluppare il cavallo in f6.';

test('analizza: foto → lettura con Claude (simulato) → Stockfish → spiegazione', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  // L'API di Anthropic è simulata: nessuna chiave reale, nessun costo.
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    const isReading = JSON.stringify(body.messages).includes('"image"');
    const text = isReading
      ? JSON.stringify({ placement: PLACEMENT, white_at_bottom: true, side_to_move: 'b', confidence: 'high', notes: '' })
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
  await expect(page.getByTestId('evaluate')).toContainText('Tocca a Nero');
  await page.getByTestId('evaluate').click();

  await expect(page.getByTestId('analyze-best')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByTestId('analyze-explanation')).toContainText(EXPLANATION);

  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toMatchObject({ model: 'claude-opus-5-5', output_config: { format: { type: 'json_schema' } } });
  expect(String((bodies[1]!.messages as { content: string }[])[0]!.content)).toContain(`${PLACEMENT} b`);
});
