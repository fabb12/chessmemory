/**
 * Dati del prodotto e del titolare. Compilali prima della pubblicazione
 * commerciale: compaiono nella pagina «Informazioni e privacy».
 *
 * Il nome dell'app è in `src/i18n/it.ts` (app.name), insieme agli altri testi.
 */
export const BRAND = {
  /** Ragione sociale o nome del titolare del trattamento dei dati (es. «Rossi Srl»). */
  company: '',
  /** Indirizzo del titolare (sede legale). */
  address: '',
  /** Partita IVA, se presente. */
  vatNumber: '',
  /** Email per assistenza e richieste sulla privacy. */
  supportEmail: '',
  /** Sito del prodotto, se esiste. */
  website: '',
  /** Data dell'ultimo aggiornamento dell'informativa (testo libero, es. «13 novembre 2026»). */
  policyUpdated: '',
} as const;

/** true se mancano i dati del titolare (la pagina lo segnala solo in sviluppo). */
export const BRAND_INCOMPLETE = !BRAND.company || !BRAND.supportEmail;
