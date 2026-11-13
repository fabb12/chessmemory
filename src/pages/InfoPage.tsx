import { BRAND, BRAND_INCOMPLETE } from '../config/brand';
import { Card, PageTitle, SectionTitle } from '../components/ui/Card';
import { t } from '../i18n';

/**
 * Informazioni sull'app: privacy, condizioni d'uso e licenze dei componenti
 * open source. I testi descrivono ciò che il codice fa davvero; prima della
 * vendita vanno completati con i dati del titolare (src/config/brand.ts) e
 * fatti verificare da un consulente.
 */
export function InfoPage() {
  const info = t.info;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <PageTitle>{info.title}</PageTitle>
        <p className="mt-1.5 text-muted">{info.intro}</p>
      </header>

      {import.meta.env.DEV && BRAND_INCOMPLETE && (
        <p role="note" className="rounded-xl border border-warn/50 bg-warn-soft p-3 text-sm text-warn">
          {info.devIncomplete}
        </p>
      )}

      <Card className="space-y-2" id="privacy">
        <SectionTitle>{info.privacy.title}</SectionTitle>
        {(BRAND.company || BRAND.supportEmail) && (
          <p className="text-sm">
            {info.privacy.controller}{' '}
            <strong>{[BRAND.company, BRAND.address, BRAND.vatNumber && `P. IVA ${BRAND.vatNumber}`].filter(Boolean).join(' · ')}</strong>
            {BRAND.supportEmail && (
              <>
                {' · '}
                <a className="font-semibold text-accent-strong underline" href={`mailto:${BRAND.supportEmail}`}>
                  {BRAND.supportEmail}
                </a>
              </>
            )}
          </p>
        )}
        {info.privacy.items.map((item) => (
          <div key={item.title}>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-muted">{item.text}</p>
          </div>
        ))}
        {BRAND.policyUpdated && <p className="text-xs text-muted">{info.updated(BRAND.policyUpdated)}</p>}
      </Card>

      <Card className="space-y-2" id="condizioni">
        <SectionTitle>{info.terms.title}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {info.terms.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2" id="licenze">
        <SectionTitle>{info.licenses.title}</SectionTitle>
        <p className="text-sm text-muted">{info.licenses.intro}</p>
        <ul className="divide-y divide-line text-sm" data-testid="licenses">
          {info.licenses.items.map((item) => (
            <li key={item.name} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
              <a className="font-semibold text-accent-strong underline" href={item.url} target="_blank" rel="noreferrer">
                {item.name}
              </a>
              <span className="text-muted">{item.license}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{info.licenses.stockfish}</p>
      </Card>

      <p className="text-center text-xs text-muted" data-testid="app-version">
        {t.app.name} · {t.app.versionLabel(__APP_VERSION__.split('+')[0] ?? __APP_VERSION__)}
        <span className="sr-only"> ({__APP_VERSION__})</span>
      </p>
    </div>
  );
}
