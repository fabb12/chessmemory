import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AccountProvider } from '../features/account/AccountProvider';
import { useProfile } from '../hooks/useData';
import { useTheme } from '../hooks/useTheme';
import { t } from '../i18n';
import { ConceptPage } from '../pages/ConceptPage';
import { HomePage } from '../pages/HomePage';
import { MemoryDnaPage } from '../pages/MemoryDnaPage';
import { MistakeDetailPage } from '../pages/MistakeDetailPage';
import { MistakeNewPage } from '../pages/MistakeNewPage';
import { MistakeReviewPage } from '../pages/MistakeReviewPage';
import { MistakesPage } from '../pages/MistakesPage';
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
      <AccountProvider settings={profile.settings}>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage profile={profile} />} />
            <Route path="/allenati" element={<TrainPage profile={profile} />} />
            <Route path="/strategie" element={<StrategiesPage />} />
            <Route path="/strategie/:id" element={<ConceptPage profile={profile} />} />
            <Route path="/memory-dna" element={<MemoryDnaPage />} />
            <Route path="/errori" element={<MistakesPage />} />
            <Route path="/errori/nuovo" element={<MistakeNewPage profile={profile} />} />
            <Route path="/errori/ripasso" element={<MistakeReviewPage profile={profile} />} />
            <Route path="/errori/:id" element={<MistakeDetailPage profile={profile} />} />
            <Route path="/profilo" element={<ProfilePage profile={profile} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </AccountProvider>
    </HashRouter>
  );
}
