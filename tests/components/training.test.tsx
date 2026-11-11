import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ChessBoard } from '../../src/components/chess/ChessBoard';
import { CategoryCard } from '../../src/components/dashboard/CategoryCard';
import { MoveTask } from '../../src/components/training/MoveTask';
import { PhaseStepper } from '../../src/components/training/PhaseStepper';
import { QuestionCard } from '../../src/components/training/QuestionCard';
import { SessionSummary, comparisonText } from '../../src/components/training/SessionSummary';
import { getExercise } from '../../src/data/exercises';
import type { SessionRecord } from '../../src/db/schema';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sq = (container: HTMLElement, name: string) => container.querySelector<HTMLElement>(`[data-sq="${name}"]`)!;

describe('ChessBoard', () => {
  it('seleziona con il tocco, evidenzia le case legali e comunica la mossa', () => {
    const onMove = vi.fn();
    const { container } = render(<ChessBoard fen={START} orientation="white" interactive onMove={onMove} />);
    fireEvent.click(sq(container, 'g1'));
    expect(sq(container, 'g1')).toHaveAttribute('aria-pressed', 'true');
    expect(sq(container, 'f3').getAttribute('aria-label')).toContain('mossa possibile');
    expect(sq(container, 'e3').getAttribute('aria-label')).not.toContain('mossa possibile');
    fireEvent.click(sq(container, 'f3'));
    expect(onMove).toHaveBeenCalledExactlyOnceWith('g1f3');
  });

  it('non comunica mosse illegali né mosse dei pezzi avversari', () => {
    const onMove = vi.fn();
    const { container } = render(<ChessBoard fen={START} orientation="white" interactive onMove={onMove} />);
    fireEvent.click(sq(container, 'e7'));
    fireEvent.click(sq(container, 'e5'));
    fireEvent.click(sq(container, 'g1'));
    fireEvent.click(sq(container, 'g3'));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('è utilizzabile da tastiera', () => {
    const onMove = vi.fn();
    const { container } = render(<ChessBoard fen={START} orientation="white" interactive onMove={onMove} />);
    const e2 = sq(container, 'e2');
    expect(e2).toHaveAttribute('tabindex', '0');
    e2.focus();
    fireEvent.keyDown(e2, { key: 'Enter' });
    fireEvent.keyDown(e2, { key: 'ArrowUp' });
    expect(sq(container, 'e3')).toHaveFocus();
    fireEvent.keyDown(sq(container, 'e3'), { key: 'ArrowUp' });
    fireEvent.keyDown(sq(container, 'e4'), { key: ' ' });
    expect(onMove).toHaveBeenCalledExactlyOnceWith('e2e4');
  });

  it('chiede il pezzo di promozione', async () => {
    const onMove = vi.fn();
    const { container } = render(<ChessBoard fen="8/P6k/8/8/8/8/8/K7 w - - 0 1" orientation="white" interactive onMove={onMove} />);
    fireEvent.click(sq(container, 'a7'));
    fireEvent.click(sq(container, 'a8'));
    expect(onMove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /Promozione/ });
    await userEvent.click(within(dialog).getByRole('button', { name: /Cavallo/ }));
    expect(onMove).toHaveBeenCalledExactlyOnceWith('a7a8n');
  });

  it('se non è interattiva ignora i tocchi', () => {
    const onMove = vi.fn();
    const { container } = render(<ChessBoard fen={START} orientation="black" onMove={onMove} />);
    fireEvent.click(sq(container, 'e2'));
    fireEvent.click(sq(container, 'e4'));
    expect(onMove).not.toHaveBeenCalled();
    expect(sq(container, 'e2')).toHaveAttribute('tabindex', '-1');
  });
});

describe('MoveTask', () => {
  const exercise = getExercise('develop-knights-a');
  const play = (container: HTMLElement, from: string, to: string) => {
    fireEvent.click(sq(container, from));
    fireEvent.click(sq(container, to));
  };

  it('dopo un errore dà un indizio e non la soluzione; poi accetta la mossa giusta', async () => {
    const onComplete = vi.fn();
    const { container } = render(
      <MoveTask exercise={exercise} title="Titolo" prompt="Consegna" orientation="white" onComplete={onComplete} />,
    );
    play(container, 'a2', 'a3');
    const wrong = screen.getByTestId('wrong-feedback');
    expect(wrong).toHaveTextContent('Non è la mossa che cerchiamo');
    expect(wrong).toHaveTextContent(exercise.hints[0]!);
    expect(wrong).not.toHaveTextContent('Cf3');
    expect(screen.queryByTestId('failed-feedback')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Annulla la mossa/ }));
    expect(screen.getByTestId('chessboard')).toHaveAttribute('data-fen', exercise.fen);

    play(container, 'g1', 'f3');
    expect(screen.getByTestId('solved-feedback')).toHaveTextContent('Esatto');
    await userEvent.click(screen.getByRole('button', { name: 'Continua' }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      exerciseId: exercise.id,
      correct: true,
      attempts: 2,
      mistakes: 1,
      hintsUsed: 1,
    });
  });

  it('accetta un’alternativa valida e lo spiega', () => {
    const { container } = render(
      <MoveTask exercise={exercise} title="T" prompt="P" orientation="white" onComplete={() => {}} />,
    );
    play(container, 'b1', 'c3');
    expect(screen.getByTestId('solved-feedback')).toHaveTextContent('anche questa mossa è valida');
    expect(screen.getByTestId('solved-feedback')).toHaveTextContent('Cf3');
  });

  it('mostra la soluzione spiegata solo dopo aver esaurito gli aiuti', async () => {
    const onComplete = vi.fn();
    const { container } = render(
      <MoveTask exercise={exercise} title="T" prompt="P" orientation="white" onComplete={onComplete} />,
    );
    for (const [from, to] of [['a2', 'a3'], ['b2', 'b3'], ['c2', 'c3']] as const) {
      play(container, from, to);
      expect(screen.queryByTestId('failed-feedback')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: /Annulla la mossa/ }));
    }
    expect(screen.getByTestId('hints')).toHaveTextContent('il cavallo in g1');
    play(container, 'h2', 'h3');
    const failed = screen.getByTestId('failed-feedback');
    expect(failed).toHaveTextContent('1.Cf3');
    expect(failed).toHaveTextContent(exercise.explanation);
    await userEvent.click(screen.getByRole('button', { name: 'Continua' }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ correct: false, mistakes: 4, hintsUsed: 3 });
  });

  it('un indizio richiesto viene mostrato e contato', async () => {
    const onComplete = vi.fn();
    const { container } = render(
      <MoveTask exercise={exercise} title="T" prompt="P" orientation="white" onComplete={onComplete} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Chiedi un indizio/ }));
    expect(screen.getByTestId('hints')).toHaveTextContent(exercise.hints[0]!);
    play(container, 'g1', 'f3');
    await userEvent.click(screen.getByRole('button', { name: 'Continua' }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ correct: true, mistakes: 0, hintsUsed: 1 });
  });
});

describe('QuestionCard', () => {
  const exercise = getExercise('develop-knights-a');

  it('richiede una scelta, poi conferma la risposta corretta', async () => {
    const onComplete = vi.fn();
    render(<QuestionCard exercise={exercise} onComplete={onComplete} shuffle={false} />);
    expect(screen.getByRole('group', { name: exercise.question.prompt })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Conferma risposta' });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: /Controlla il centro/ }));
    await userEvent.click(submit);
    const feedback = screen.getByTestId('question-feedback');
    expect(feedback).toHaveAttribute('data-correct', 'true');
    expect(feedback).toHaveTextContent('Risposta corretta');
    expect(feedback).toHaveTextContent(exercise.explanation);

    await userEvent.click(screen.getByRole('button', { name: 'Continua' }));
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ exerciseId: exercise.id, correct: true, selectedOptionId: 'c' }),
    );
  });

  it('con una risposta sbagliata mostra quella giusta, a parole e non solo a colori', async () => {
    const onComplete = vi.fn();
    render(<QuestionCard exercise={exercise} onComplete={onComplete} shuffle={false} />);
    await userEvent.click(screen.getByRole('radio', { name: /difendere il pedone e4/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Conferma risposta' }));
    const feedback = screen.getByTestId('question-feedback');
    expect(feedback).toHaveTextContent('Risposta non corretta');
    expect(feedback).toHaveTextContent('La risposta giusta era:');
    expect(feedback).toHaveTextContent('Controlla il centro');
    expect(screen.getByText('sbagliata')).toBeInTheDocument();
    expect(screen.getByText('corretta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continua' }));
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ correct: false, selectedOptionId: 'b' });
  });
});

describe('PhaseStepper', () => {
  it('indica la fase corrente e quelle completate anche con testo', () => {
    render(<PhaseStepper phases={['observe', 'recall', 'explain', 'recognize']} current="explain" />);
    const list = screen.getByRole('list', { name: 'Fase 3 di 4: Spiega' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-state'))).toEqual(['done', 'done', 'current', 'todo']);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('Osserva');
    expect(items[0]).toHaveTextContent('completata');
  });
});

describe('risultati e Memory DNA', () => {
  const session: SessionRecord = {
    id: 's2',
    userId: 'u',
    startedAt: 1_800_000_000_000,
    finishedAt: 1_800_000_240_000,
    items: [{ conceptId: 'knight-fork', kind: 'new', rating: 3, score: 1 }],
    correctAnswers: 5,
    totalAnswers: 6,
    hintsUsed: 1,
    reviewedConcepts: 2,
    newConcepts: 1,
  };

  it('mostra i numeri della sessione e il confronto con le precedenti', () => {
    const previous = [{ ...session, id: 's1', correctAnswers: 3 }];
    render(
      <MemoryRouter>
        <SessionSummary session={session} previous={previous} streak={2} levelBefore={1} levelAfter={2} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('summary-correct')).toHaveTextContent('5 su 6');
    expect(screen.getByTestId('summary-reviewed')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-learned')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-hints')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-comparison')).toHaveTextContent('sopra la tua media precedente (50%)');
    expect(screen.getByText(/Sei salito al livello 2/)).toBeInTheDocument();
    expect(screen.getByText('Forchetta di cavallo')).toBeInTheDocument();
    expect(screen.getByText('4:00', { exact: false })).toBeInTheDocument();
  });

  it('alla prima sessione non inventa un confronto', () => {
    expect(comparisonText(session, [])).toMatch(/prima sessione/);
  });

  it('la scheda di categoria non mostra percentuali senza dati', () => {
    render(
      <CategoryCard
        stats={{
          category: 'strategy',
          answers: 0,
          correct: 0,
          successRate: null,
          exercisesCompleted: 0,
          dueReviews: 0,
          studiedConcepts: 0,
          totalConcepts: 4,
          consolidated: 0,
          toReview: 0,
          trend: [],
        }}
      />,
    );
    expect(screen.getByTestId('success-rate')).toHaveTextContent('—');
    expect(screen.getByText('Nessun dato')).toBeInTheDocument();
    expect(screen.getByText(/dopo il primo allenamento/)).toBeInTheDocument();
  });
});
