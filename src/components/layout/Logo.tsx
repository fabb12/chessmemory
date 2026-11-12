import { t } from '../../i18n';

/** Marchio: una casa di scacchiera con un cavallo stilizzato. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cm-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f66ff" />
          <stop offset="1" stopColor="#0a1430" />
        </linearGradient>
        <linearGradient id="cm-logo-piece" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dd" />
          <stop offset="1" stopColor="#e3b553" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#cm-logo-bg)" />
      <rect x="8" y="8" width="24" height="24" rx="4" fill="#ffffff" opacity="0.1" />
      <rect x="32" y="32" width="24" height="24" rx="4" fill="#ffffff" opacity="0.1" />
      <path
        d="M22 50h22c0-9-3-13-7-17 4-1 7-4 7-8l-9-9-3 4c-7 1-12 7-12 14 0 3 1 5 3 6l5-4c1 4-2 8-6 14z"
        fill="url(#cm-logo-piece)"
      />
      <circle cx="33" cy="24" r="1.8" fill="#0a1430" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="#ffffff" strokeOpacity="0.18" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="rounded-2xl shadow-[0_6px_16px_-6px_rgb(37_87_233/0.7)]">
        <LogoMark />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">{t.app.name}</span>
    </span>
  );
}
