import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './styles/index.css';

// Service worker: precache dell'app per l'uso offline, aggiornamento automatico.
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
