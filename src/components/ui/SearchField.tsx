import { Icon } from './Icon';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  testId?: string;
}

/** Campo di ricerca con lente e pulsante per cancellare. */
export function SearchField({ value, onChange, label, placeholder, testId }: SearchFieldProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
        <Icon name="search" size={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder ?? label}
        data-testid={testId}
        className="min-h-12 w-full rounded-2xl border border-line bg-surface pl-10 pr-11 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Cancella la ricerca"
          className="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Icon name="cross" size={16} />
        </button>
      )}
    </div>
  );
}
