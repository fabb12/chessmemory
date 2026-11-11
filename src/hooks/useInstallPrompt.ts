import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// L'evento può scattare prima che React sia montato: lo si cattura subito.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unavailable';

export function useInstallPrompt(): { state: InstallState; install: () => Promise<void> } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const state: InstallState =
    installed || isStandalone() ? 'installed' : deferred ? 'available' : isIos() ? 'ios' : 'unavailable';

  const install = async () => {
    if (!deferred) return;
    const ev = deferred;
    deferred = null;
    notify();
    await ev.prompt();
    await ev.userChoice;
  };

  return { state, install };
}
