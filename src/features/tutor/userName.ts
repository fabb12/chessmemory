/**
 * Nome dell'utente, chiesto a voce dal tutor delle partite e da Benot.
 * Resta solo su questo dispositivo (stessa chiave usata dal tutor delle partite).
 */
const NAME_KEY = 'cm.user.name';

export function loadUserName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveUserName(name: string): string {
  const clean = name.trim().slice(0, 40);
  try {
    if (clean) localStorage.setItem(NAME_KEY, clean);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // archivio non disponibile: vale solo per questa visita
  }
  return clean;
}
