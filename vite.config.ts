/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

/**
 * Base URL.
 * - In sviluppo l'app è servita dalla radice ("/").
 * - In produzione è servita da GitHub Pages sotto "/<nome-repository>/".
 *   Il workflow di deploy imposta BASE_PATH con il nome reale del repository;
 *   senza variabile si usa il nome previsto "chessmemory-ai".
 */
const DEFAULT_PAGES_BASE = '/chessmemory-ai/';

/**
 * Versione mostrata nell'app: "<versione package.json>+<build>.<commit>".
 * Su GitHub Actions il numero di build cresce a ogni deploy, così ogni push
 * produce una versione diversa anche senza toccare package.json.
 */
function appVersion(): string {
  const run = process.env.GITHUB_RUN_NUMBER;
  let sha = process.env.GITHUB_SHA?.slice(0, 7);
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      sha = undefined;
    }
  }
  const build = [run, sha].filter(Boolean).join('.');
  return build ? `${pkg.version}+${build}` : pkg.version;
}

export default defineConfig(({ command, isPreview }) => {
  // `vite preview` serve la build di produzione, quindi usa la stessa base.
  const production = command === 'build' || isPreview === true;
  const base = process.env.BASE_PATH ?? (production ? DEFAULT_PAGES_BASE : '/');

  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(appVersion()) },
    // Bundle principale unico (circa 200 kB gzip); la libreria Supabase è caricata a parte, solo se configurata.
    build: { chunkSizeWarningLimit: 800 },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'ChessMemoryBen',
          short_name: 'ChessMemoryBen',
          description:
            'Palestra della memoria scacchistica: allenamenti adattivi di 5 minuti con ripetizione dilazionata.',
          lang: 'it',
          dir: 'ltr',
          start_url: '.',
          scope: '.',
          display: 'standalone',
          orientation: 'any',
          background_color: '#f3f5fa',
          theme_color: '#0a1430',
          categories: ['education', 'games'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Tutta l'app (shell, dataset, pezzi) è nel bundle: precache completo,
          // compreso il motore Stockfish (WebAssembly, circa 1,9 MB) per l'analisi offline.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2,wasm}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
      css: false,
    },
  };
});
