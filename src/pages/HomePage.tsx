import { Link } from 'react-router-dom';
import { buttonClass } from '../components/ui/Button';
import { Card, PageTitle } from '../components/ui/Card';
import { InstallCard } from '../components/layout/InstallCard';
import { Icon } from '../components/ui/Icon';
import type { Profile } from '../db/schema';
import { isDue } from '../features/memory/scheduler';
import { currentStreak, trainedToday } from '../features/progress/streak';
import { useActiveSession, useCards, useMistakes, useNow } from '../hooks/useData';
import { dueMistakes } from '../services/mistakes';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { t } from '../i18n';

export function HomePage({ profile }: { profile: Profile }) {
  const now = useNow();
  const cards = useCards();
  const active = useActiveSession();
  const plan = useTrainingPlan(now);
  const mistakes = useMistakes();
  const dueMistakeCount = mistakes ? dueMistakes(mistakes, now).length : 0;

  const dueCount = cards?.filter((c) => isDue(c, now)).length ?? 0;
  const streak = currentStreak(profile.streak, now);
  const doneToday = trainedToday(profile.streak, now);
  const level = profile.adaptive.level;
  const hasActive = Boolean(active && active.results.length < active.items.length);

  const reviews = plan?.items.filter((i) => i.kind === 'review').length ?? 0;
  const targeted = plan?.items.filter((i) => i.kind === 'weakness').length ?? 0;
  const fresh = plan?.items.filter((i) => i.kind === 'new').length ?? 0;
  const minutes = plan ? Math.max(1, Math.round(plan.estimatedSeconds / 60)) : 5;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <PageTitle>{t.home.greeting(new Date(now).getHours())}</PageTitle>
        <p className="mt-1 text-muted">{t.home.subtitle}</p>
      </header>

      <Card className="border-accent/40 bg-accent-soft" data-testid="daily-card">
        {hasActive && active ? (
          <>
            <h2 className="font-display text-2xl font-semibold">{t.home.dailyTitle}</h2>
            <p className="mt-1">{t.home.resumeText(active.results.length, active.items.length)}</p>
            <Link to="/allenati" className={`${buttonClass('primary', 'lg', true)} mt-4`} data-testid="resume-training">
              <Icon name="play" />
              {t.home.resume}
            </Link>
          </>
        ) : (
          <>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              {doneToday && <Icon name="check" className="text-ok" />}
              {doneToday ? t.home.dailyDone : t.home.dailyTitle}
            </h2>
            <p className="mt-1">
              {doneToday ? t.home.dailyDoneText : plan ? t.home.planLine(reviews, targeted, fresh) : t.app.loading}
            </p>
            {!doneToday && plan && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <Icon name="clock" size={16} />
                {t.home.minutes(minutes)}
              </p>
            )}
            <Link
              to="/allenati?avvia=1"
              className={`${buttonClass(doneToday ? 'secondary' : 'primary', 'lg', true)} mt-4`}
              data-testid="start-training"
            >
              <Icon name="train" />
              {doneToday ? t.home.startAnother : t.home.start}
            </Link>
          </>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card data-testid="stat-level">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="sparkle" size={16} />
            {t.home.currentLevel}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">{t.level.label(level)}</p>
          <p className="text-sm text-muted">{t.level.names[level]}</p>
        </Card>
        <Card data-testid="stat-due">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="calendar" size={16} />
            {t.home.dueToday}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums" data-testid="due-count">
            {dueCount}
          </p>
        </Card>
        <Card data-testid="stat-streak">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="flame" size={16} />
            {t.home.streak}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums" data-testid="streak-count">
            {t.home.streakDays(streak)}
          </p>
          {profile.streak.best > 0 && <p className="text-sm text-muted">{t.home.streakBest(profile.streak.best)}</p>}
        </Card>
        <Card data-testid="stat-category">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="book" size={16} />
            {t.home.lastCategory}
          </p>
          <p className="mt-1 font-display text-xl font-semibold" data-testid="last-category">
            {profile.lastCategory ? t.categories[profile.lastCategory] : t.home.none}
          </p>
        </Card>
      </div>

      <Card data-testid="home-mistakes">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Icon name="flag" />
              {t.mistakes.homeTitle}
            </h2>
            <p className="mt-1 text-muted">
              {dueMistakeCount > 0 ? t.mistakes.homeDue(dueMistakeCount) : t.mistakes.homeNone}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {dueMistakeCount > 0 && (
              <Link to="/errori/ripasso" className={buttonClass('primary')} data-testid="home-review-mistakes">
                <Icon name="train" size={18} />
                {t.mistakes.review(dueMistakeCount)}
              </Link>
            )}
            <Link to="/errori/nuovo" className={buttonClass('secondary')} data-testid="home-add-mistake">
              <Icon name="camera" size={18} />
              {t.mistakes.add}
            </Link>
          </div>
        </div>
      </Card>

      <InstallCard />

      <p className="text-sm text-muted">{t.level.notElo}</p>
    </div>
  );
}
