import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AccountProvider } from '../features/account/AccountProvider';
import { useProfile } from '../hooks/useData';
import { useTheme } from '../hooks/useTheme';
import { t } from '../i18n';
import { AnalyzePage } from '../pages/AnalyzePage';
import { ConceptPage } from '../pages/ConceptPage';
import { GamePage } from '../pages/GamePage';
import { GameTutorPage } from '../pages/GameTutorPage';
import { GamesPage } from '../pages/GamesPage';
import { HomePage } from '../pages/HomePage';
import { InfoPage } from '../pages/InfoPage';
import { MemoryDnaPage } from '../pages/MemoryDnaPage';
import { ProfilePage } from '../pages/ProfilePage';
import { StrategiesPage } from '../pages/StrategiesPage';
import { TrainPage } from '../pages/TrainPage';
import { completePlacement, ensureProfile } from '../services/progress';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Titolo della scheda del browser per ogni sezione. */
const TITLES: [RegExp, string][] = [
  [/^\/allenati/, t.nav.train],
  [/^\/strategie/, t.nav.strategies],
  [/^\/analizza/, t.analyze.title],
  [/^\/partite/, t.games.title],
  [/^\/progressi/, t.dna.title],
  [/^\/profilo/, t.nav.profile],
  [/^\/informazioni/, t.info.title],
];

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const section = TITLES.find(([re]) => re.test(pathname))?.[1];
    document.title = section ? `${section} · ${t.app.name}` : `${t.app.name} · ${t.app.tagline}`;
  }, [pathname]);
  return null;
}

function StorageBanner() {
  return (
    <p role="alert" className="border-b border-bad/40 bg-bad-soft px-4 py-2 text-center text-sm" data-testid="storage-error">
      {t.app.storageError}
    </p>
  );
}

/**
 * HashRouter: su GitHub Pages non esiste riscrittura lato server, quindi le
 * rotte vivono nel frammento (#/allenati) e ogni ricaricamento funziona.
 */
export function App() {
  const profile = useProfile();
  const [storageFailed, setStorageFailed] = useState(false);
  useTheme(profile?.settings.theme);

  useEffect(() => {
    ensureProfile().catch(() => setStorageFailed(true));
    // Chiede al browser di non eliminare automaticamente i dati (se supportato).
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  // Dopo un ripristino o un'importazione il profilo può mancare: lo si ricrea.
  useEffect(() => {
    if (profile === null && !storageFailed) ensureProfile().catch(() => setStorageFailed(true));
  }, [profile, storageFailed]);

  // Nessuna valutazione iniziale: l'app è pensata anche per i bambini, si parte
  // dal livello più semplice e la difficoltà si adatta ai risultati.
  const needsStart = profile ? !profile.placementDone : false;
  useEffect(() => {
    if (needsStart) {
      completePlacement({ declaredLevel: 'beginner', level: 1, answers: [] }).catch(() => setStorageFailed(true));
    }
  }, [needsStart]);

  if (!profile || !profile.placementDone) {
    return (
      <AppShell bare banner={storageFailed ? <StorageBanner /> : undefined}>
        {!storageFailed && <p className="text-muted">{t.app.loading}</p>}
      </AppShell>
    );
  }

  return (
    <HashRouter>
      <ScrollToTop />
      <DocumentTitle />
      <AccountProvider settings={profile.settings}>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage profile={profile} />} />
            <Route path="/allenati" element={<TrainPage profile={profile} />} />
            <Route path="/strategie" element={<StrategiesPage />} />
            <Route path="/strategie/:id" element={<ConceptPage profile={profile} />} />
            <Route path="/analizza" element={<AnalyzePage profile={profile} />} />
            <Route path="/partite" element={<GamesPage />} />
            <Route path="/partite/:id" element={<GamePage profile={profile} />} />
            <Route path="/partite/:id/tutor" element={<GameTutorPage />} />
            <Route path="/progressi" element={<MemoryDnaPage />} />
            <Route path="/memory-dna" element={<Navigate to="/progressi" replace />} />
            <Route path="/informazioni" element={<InfoPage />} />
            <Route path="/profilo" element={<ProfilePage profile={profile} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </AccountProvider>
    </HashRouter>
  );
}
