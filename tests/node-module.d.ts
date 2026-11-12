/** Dichiarazione minima per il test del motore (l'app non usa i tipi di Node). */
declare module 'node:module' {
  export function createRequire(url: string): (id: string) => unknown;
}
