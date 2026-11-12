// Copia il motore Stockfish (WebAssembly, versione «lite» a thread singolo)
// da node_modules a public/engine, da dove viene servito come file statico.
// Eseguito automaticamente dopo `npm install` / `npm ci`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'stockfish');
const target = join(root, 'public', 'engine');

const FILES = [
  ['bin/stockfish-19-lite-single.js', 'stockfish.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish.wasm'],
  ['Copying.txt', 'COPYING-stockfish.txt'],
];

if (!existsSync(source)) {
  console.warn('[copy-engine] pacchetto "stockfish" non installato: analisi con il motore non disponibile.');
  process.exit(0);
}
mkdirSync(target, { recursive: true });
for (const [from, to] of FILES) copyFileSync(join(source, from), join(target, to));
console.log('[copy-engine] Stockfish copiato in public/engine');
