import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CLAUDE_MODELS, looksLikeApiKey, setApiKey, setFastMode, setModel, useApiKey, useFastMode, useModel } from '../../features/assistant/claude';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

/** Scelta del modello di Claude usato per letture, spiegazioni e domande (salvata sul dispositivo). */
export function ModelPicker() {
  const model = useModel();
  return (
    <div>
      <label htmlFor="claude-model" className="font-semibold">
        {t.analyze.model.label}
      </label>
      <select
        id="claude-model"
        value={model.id}
        onChange={(e) => setModel(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold"
        data-testid="claude-model"
      >
        {CLAUDE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {t.analyze.model.names[m.id]} · ${m.price}
          </option>
        ))}
      </select>
      <p className="mt-1 text-sm text-muted">{t.analyze.model.help[model.id]}</p>
    </div>
  );
}

/** Modello di Claude e, se il modello la permette, lettura rapida: la sezione delle Impostazioni. */
export function ModelSettings() {
  const model = useModel();
  const fast = useFastMode();
  return (
    <div className="space-y-3">
      <ModelPicker />
      {model.fast && (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={fast}
            onChange={(e) => setFastMode(e.target.checked)}
            className="mt-1 size-5 accent-[var(--accent)]"
            data-testid="fast-toggle"
          />
          <span>
            <span className="block text-sm font-semibold">{t.analyze.fast.label}</span>
            <span className="block text-xs text-muted">{t.analyze.fast.help}</span>
          </span>
        </label>
      )}
    </div>
  );
}

/** Riga breve con il modello in uso e il collegamento alle Impostazioni per cambiarlo. */
export function ModelLink() {
  const model = useModel();
  return (
    <p className="text-sm text-muted" data-testid="model-link">
      {t.settings.modelInUse(t.analyze.model.names[model.id] ?? model.id)}{' '}
      <Link to="/impostazioni" className="font-semibold text-accent-strong underline underline-offset-2">
        {t.settings.change}
      </Link>
    </p>
  );
}

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
