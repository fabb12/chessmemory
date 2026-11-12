/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** URL del progetto Supabase, es. https://xyzcompany.supabase.co (facoltativo). */
  readonly VITE_SUPABASE_URL?: string;
  /** Chiave pubblica (anon / publishable) del progetto Supabase (facoltativa). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
