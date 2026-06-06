import { tr } from '@/i18n';
import type { CategoryMeta } from '@/types/sheets';

export interface OptionItem {
  value: string;
  category: string;
  label: string;
}

interface Props {
  items: OptionItem[];
  categoryMeta: CategoryMeta[];
  value: string;
  onChange: (value: string) => void;
  /** Extra non-grouped options rendered before the groups (e.g. Skip). */
  leadingOptions?: { value: string; label: string }[];
  id?: string;
  className?: string;
}

/** A <select> whose options are grouped into <optgroup>s by category, in category sort order. */
export function CategorySelect({
  items,
  categoryMeta,
  value,
  onChange,
  leadingOptions = [],
  id,
  className = '',
}: Props) {
  const orderedCats = [...categoryMeta].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const byCat = new Map<string, OptionItem[]>();
  for (const it of items) {
    if (!byCat.has(it.category)) byCat.set(it.category, []);
    byCat.get(it.category)!.push(it);
  }

  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`h-8 rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {leadingOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {orderedCats.map(cat => {
        const opts = byCat.get(cat.id);
        if (!opts?.length) return null;
        return (
          <optgroup key={cat.id} label={tr(cat)}>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}
