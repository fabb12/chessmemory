import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { t } from '../../i18n';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Icon, type IconName } from '../ui/Icon';
import { Logo } from './Logo';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: t.nav.home, icon: 'home', end: true },
  { to: '/allenati', label: t.nav.train, icon: 'train' },
  { to: '/strategie', label: t.nav.strategies, icon: 'book' },
  { to: '/errori', label: t.nav.mistakes, icon: 'flag' },
  { to: '/memory-dna', label: t.nav.dna, icon: 'dna' },
  { to: '/profilo', label: t.nav.profile, icon: 'user' },
];

interface AppShellProps {
  children: ReactNode;
  /** Nasconde la navigazione (onboarding). */
  bare?: boolean;
  banner?: ReactNode;
}

export function AppShell({ children, bare = false, banner }: AppShellProps) {
  const online = useOnlineStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.app.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/75 backdrop-blur-xl backdrop-saturate-150 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center gap-3 px-4">
          <Logo />
          {!online && (
            <span
              role="status"
              title={t.app.offline}
              data-testid="offline-indicator"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-warn/50 bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn md:ml-2"
            >
              <Icon name="wifiOff" size={14} />
              {t.app.offlineShort}
            </span>
          )}
          {!bare && (
            <nav aria-label={t.nav.label} className="ml-auto hidden md:block">
              <ul className="flex items-center gap-1 rounded-2xl border border-line/80 bg-surface/70 p-1 shadow-sm">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-all ${
                          isActive
                            ? 'cm-btn-primary bg-accent text-on-accent'
                            : 'text-muted hover:bg-surface-2 hover:text-fg'
                        }`
                      }
                    >
                      <Icon name={item.icon} size={18} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        {!online && (
          <p className="sr-only" role="status">
            {t.app.offline}
          </p>
        )}
      </header>

      {banner}

      <main id="contenuto" tabIndex={-1} className={`mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 outline-none ${bare ? '' : 'pb-4'}`}>
        {children}
      </main>

      <p className={`pt-2 text-center text-[0.7rem] tracking-wide text-muted/80 ${bare ? '' : 'pb-24 md:pb-4'}`} data-testid="app-version">
        {t.app.versionLabel(__APP_VERSION__)}
      </p>

      {!bare && (
        <nav
          aria-label={t.nav.label}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgb(10_20_48/0.25)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        >
          <ul className="mx-auto grid max-w-xl grid-cols-6">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[0.64rem] font-semibold leading-tight ${
                      isActive ? 'text-accent-strong' : 'text-muted'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`rounded-full px-2.5 py-1 transition-all ${isActive ? 'cm-btn-primary bg-accent text-on-accent' : ''}`}>
                        <Icon name={item.icon} size={22} />
                      </span>
                      <span className={isActive ? 'text-fg' : ''}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
