import { useState } from 'react';
import { setTone, TONE_LABELS, TONES, useTone, type Tone } from '../../features/tutor/tone';
import { setUserName, useUserName } from '../../features/user/userName';
import { t } from '../../i18n';
import { Button } from './Button';

/** Nome dell'allievo e tono del tutor, nelle impostazioni del Profilo. */
export function NameField() {
  const name = useUserName();
  const tone = useTone();
  const [draft, setDraft] = useState(name);
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-4">
      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          setUserName(draft);
          setSaved(true);
        }}
      >
        <label htmlFor="user-name" className="font-semibold">
          {t.profile.name}
        </label>
        <div className="flex gap-2">
          <input
            id="user-name"
            type="text"
            value={draft}
            autoComplete="given-name"
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
            data-testid="profile-name"
          />
          <Button type="submit" variant="secondary" disabled={draft.trim() === name} data-testid="profile-name-save">
            {t.gameTutor.nameSave}
          </Button>
        </div>
        <p className="text-sm text-muted" role="status">
          {saved && name ? t.profile.nameSaved(name) : t.profile.nameHelp}
        </p>
      </form>
      <label className="block">
        <span className="font-semibold">{t.gameTutor.toneLabel}</span>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold"
          data-testid="profile-tone"
        >
          {TONES.map((value) => (
            <option key={value} value={value}>
              {TONE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
