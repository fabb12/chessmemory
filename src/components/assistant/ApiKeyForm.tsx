import { useState } from 'react';
import { looksLikeApiKey, setApiKey, useApiKey } from '../../features/assistant/claude';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

/** Inserimento della chiave API di Anthropic (salvata solo su questo dispositivo). */
export function ApiKeyForm() {
  const saved = useApiKey();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);

  if (saved) {
    return (
      <div className="space-y-2" data-testid="api-key-saved">
        <p className="flex items-center gap-2 font-semibold text-ok">
          <Icon name="check" size={18} />
          {t.analyze.key.saved(`…${saved.slice(-4)}`)}
        </p>
        <Button variant="secondary" icon={<Icon name="trash" size={16} />} onClick={() => setApiKey('')}>
          {t.analyze.key.remove}
        </Button>
      </div>
    );
  }

  const save = () => {
    if (!looksLikeApiKey(draft)) {
      setError(true);
      return;
    }
    setApiKey(draft);
    setDraft('');
    setError(false);
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="api-key" className="font-semibold">
        {t.analyze.key.label}
      </label>
      <input
        id="api-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-ant-…"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(false);
        }}
        aria-invalid={error}
        aria-describedby="api-key-help"
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm"
        data-testid="api-key-input"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {t.analyze.key.invalid}
        </p>
      )}
      <p id="api-key-help" className="text-sm text-muted">
        {t.analyze.key.help}
      </p>
      <Button type="submit" icon={<Icon name="check" size={16} />}>
        {t.analyze.key.save}
      </Button>
    </form>
  );
}
