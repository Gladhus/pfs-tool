import { useRef, useState } from 'react';
import { Input } from '@/shared/ui/Input';
import type { MerchantSuggestion } from '../data/merchants';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: MerchantSuggestion) => void;
  suggestions: MerchantSuggestion[];
  categoryName: (id: string) => string;
  placeholder?: string;
  'aria-label'?: string;
}

/** Merchant field with a suggestions dropdown built from past spendings. Picking a
    suggestion fills the merchant and its usual category (handled by `onPick`). */
export function MerchantAutocomplete({ value, onChange, onPick, suggestions, categoryName, placeholder, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = open && suggestions.length > 0;

  const pick = (s: MerchantSuggestion) => {
    onPick(s);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!show) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); pick(suggestions[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); setHighlight(-1); }
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
      />
      {show && (
        // Opens upward: this is the dialog's last field, and the dialog body is an
        // overflow-y-auto container that would clip a downward dropdown.
        <ul
          className="absolute bottom-full z-50 mb-1 max-h-52 w-full overflow-auto rounded-lg border border-border bg-surface-3 py-1 shadow-lg"
          onMouseDown={e => e.preventDefault()} // keep focus so the click registers before blur
        >
          {suggestions.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => { if (blurTimer.current) clearTimeout(blurTimer.current); pick(s); }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm ${i === highlight ? 'bg-border' : ''}`}
              >
                <span className="truncate text-fg">{s.name}</span>
                {s.categoryId && <span className="shrink-0 text-xs text-muted">{categoryName(s.categoryId)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
