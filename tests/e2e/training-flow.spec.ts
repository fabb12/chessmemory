import { expect, test, type Locator, type Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { EXERCISES } from '../../src/data/exercises/index';

const exerciseById = new Map(EXERCISES.map((e) => [e.id, e]));

function exerciseOf(id: string | null) {
  const exercise = id ? exerciseById.get(id) : undefined;
  if (!exercise) throw new Error(`Esercizio non trovato: ${id}`);
  return exercise;
}

async function clickMove(task: Locator, uci: string) {
  await task.locator(`[data-sq="${uci.slice(0, 2)}"]`).click();
  await task.locator(`[data-sq="${uci.slice(2, 4)}"]`).click();
}

/** Una mossa legale che il dataset non accetta per la posizione iniziale. */
function wrongMoveFor(exerciseId: string): string {
  const exercise = exerciseOf(exerciseId);
  const step = exercise.solution[0]!;
  const accepted = new Set([step.move, ...(step.alternatives ?? [])]);
  const move = new Chess(exercise.fen)
    .moves({ verbose: true })
    .find((m) => !accepted.has(m.from + m.to) && !m.promotion);
  if (!move) throw new Error('nessuna mossa errata disponibile');
  return move.from + move.to;
}

/** Risolve un compito di mossa giocando la soluzione del dataset, passo per passo. */
async function solveTask(page: Page, testId: string, options: { mistakeFirst?: boolean } = {}) {
  const task = page.getByTestId(testId);
  await expect(task).toBeVisible();
  const exercise = exerciseOf(await task.getAttribute('data-exercise-id'));

  if (options.mistakeFirst) {
    await clickMove(task, wrongMoveFor(exercise.id));
    await expect(task).toHaveAttribute('data-status', 'wrong');
    const feedback = page.getByTestId('wrong-feedback');
    await expect(feedback).toContainText(exercise.hints[0]!);
    await expect(page.getByTestId('failed-feedback')).toHaveCount(0);
    await page.getByRole('button', { name: /Annulla la mossa/ }).click();
    await expect(task).toHaveAttribute('data-status', 'awaiting');
  }

  for (let i = 0; i < exercise.solution.length; i++) {
    await expect(task).toHaveAttribute('data-step', String(i));
    await expect(task).toHaveAttribute('data-status', 'awaiting');
    await clickMove(task, exercise.solution[i]!.move);
  }
  await expect(task).toHaveAttribute('data-status', 'solved');
  await expect(page.getByTestId('solved-feedback')).toBeVisible();
  await page.getByRole('button', { name: 'Continua' }).click();
  return exercise;
}

async function answerQuestion(page: Page) {
  const card = page.getByTestId('question-card');
  await expect(card).toBeVisible();
  const exercise = exerciseOf(await card.getAttribute('data-exercise-id'));
  await card.locator(`[data-option-id="${exercise.question.correctOptionId}"]`).click();
  await page.getByRole('button', { name: 'Conferma risposta' }).click();
  await expect(page.getByTestId('question-feedback')).toHaveAttribute('data-correct', 'true');
  await page.getByRole('button', { name: 'Continua' }).click();
}

async function completeOnboarding(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('daily-card')).toBeVisible();
}

test.describe('flusso completo di allenamento', () => {
  test('avvio senza valutazione, allenamento, risultati e progressi salvati dopo la riapertura', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 1–3. Apertura, livello principiante e valutazione iniziale
    await completeOnboarding(page);

    // Home
    await expect(page.getByTestId('daily-card')).toBeVisible();
    await expect(page.getByTestId('streak-count')).toHaveText('0 giorni');
    await expect(page.getByTestId('last-category')).toHaveText('Ancora nessuna');
    await expect(page.getByRole('navigation', { name: 'Navigazione principale' }).first()).toBeVisible();

    // 4. Inizio dell'allenamento
    await page.getByTestId('start-training').click();
    await expect(page.getByTestId('concept-runner')).toBeVisible();
    const total = Number((await page.getByTestId('item-progress').innerText()).match(/di (\d+)/)![1]);
    expect(total).toBeGreaterThan(0);

    const studied: string[] = [];
    for (let i = 1; i <= total; i++) {
      await expect(page.getByTestId('item-progress')).toContainText(`Concetto ${i} di ${total}`);
      const runner = page.getByTestId('concept-runner');
      studied.push((await runner.getAttribute('data-concept-id'))!);

      // OSSERVA: freccia e spiegazione, poi si passa alla prova
      await expect(runner).toHaveAttribute('data-phase', 'observe');
      await expect(page.getByTestId('observe-phase')).toContainText('Il principio');
      await page.getByRole('button', { name: /ora provo io/ }).click();

      // 5. RICORDA: esecuzione della mossa
      await expect(runner).toHaveAttribute('data-phase', 'recall');
      await solveTask(page, 'recall-task');

      // 6. SPIEGA: domanda strategica
      await expect(runner).toHaveAttribute('data-phase', 'explain');
      await answerQuestion(page);

      // RICONOSCI: stessa idea in una posizione diversa
      await expect(runner).toHaveAttribute('data-phase', 'recognize');
      const recalled = await page.getByTestId('transfer-task').getAttribute('data-exercise-id');
      expect(exerciseOf(recalled).conceptId).toBe(studied[i - 1]);
      await solveTask(page, 'transfer-task');

      // 7. Concetto completato con ripasso programmato
      await expect(page.getByTestId('concept-done')).toBeVisible();
      await expect(page.getByTestId('next-review')).toContainText(/Prossimo ripasso: (domani|tra \d+ giorni)/);
      await page.getByTestId('concept-next').click();
    }

    // 8. Risultati
    await expect(page.getByTestId('session-summary')).toBeVisible();
    await expect(page.getByTestId('summary-correct')).toContainText(`${total * 3} su ${total * 3}`);
    await expect(page.getByTestId('summary-learned')).toContainText(String(total));
    await expect(page.getByTestId('summary-hints')).toContainText('0');
    await expect(page.getByTestId('summary-comparison')).toContainText('prima sessione');
    await page.getByTestId('summary-home').click();

    await expect(page.getByTestId('streak-count')).toHaveText('1 giorno');
    await expect(page.getByTestId('last-category')).not.toHaveText('Ancora nessuna');
    await expect(page.getByTestId('daily-card')).toContainText('Allenamento di oggi completato');

    // 9. Riapertura: i progressi sono ancora lì
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect(page.getByTestId('streak-count')).toHaveText('1 giorno');
    await expect(page.getByTestId('onboarding-welcome')).toHaveCount(0);

    await page.getByRole('link', { name: 'Profilo' }).first().click();
    await expect(page.getByTestId('profile-declared')).toHaveText('Principiante');
    await expect(page.getByTestId('sessions-total')).toHaveText('1 allenamento completato');
    await expect(page.getByTestId('session-history').locator('li')).toHaveCount(1);

    await page.getByRole('link', { name: 'Memory DNA' }).first().click();
    const rates = await page.getByTestId('success-rate').allInnerTexts();
    expect(rates).toHaveLength(5);
    expect(rates.filter((r) => r === '100%').length).toBeGreaterThan(0);

    await page.getByRole('link', { name: 'Strategie' }).first().click();
    await expect(page.getByTestId(`concept-link-${studied[0]}`)).toContainText('In apprendimento');

    // Una nuova scheda dello stesso browser ritrova gli stessi dati (IndexedDB)
    const second = await context.newPage();
    await second.goto('./');
    await expect(second.getByTestId('streak-count')).toHaveText('1 giorno');
    await second.close();

    // Funzionamento offline dopo il primo caricamento
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('offline-indicator')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Strategie' })).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).first().click();
    await page.getByTestId('start-training').click();
    await expect(page.getByTestId('concept-runner')).toBeVisible();
    await context.setOffline(false);

    expect(errors).toEqual([]);
  });

  test('schermo da 320 px: nessuno scorrimento orizzontale e sessione ripristinabile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await completeOnboarding(page);
    const noOverflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(await noOverflow()).toBe(true);
    await expect(page.getByTestId('daily-card')).toBeVisible();
    expect(await noOverflow()).toBe(true);

    await page.getByTestId('start-training').click();
    await expect(page.getByTestId('concept-runner')).toBeVisible();
    expect(await noOverflow()).toBe(true);

    // Chiusura a metà: dalla Home si può riprendere la stessa sessione
    await page.reload();
    await expect(page.getByTestId('concept-runner')).toBeVisible();
    await page.goto('./#/');
    await expect(page.getByTestId('resume-training')).toBeVisible();
    await page.getByTestId('resume-training').click();
    await expect(page.getByTestId('concept-runner')).toBeVisible();

    for (const route of ['#/strategie', '#/memory-dna', '#/profilo']) {
      await page.goto(`./${route}`);
      await expect(page.locator('h1')).toBeVisible();
      expect(await noOverflow(), route).toBe(true);
    }
  });
});
