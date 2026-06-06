import { Select, SelectItem, SelectGroup } from '@/ui/Select';
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
  leadingOptions?: { value: string; label: string }[];
  id?: string;
  className?: string;
}

export function CategorySelect({ items, categoryMeta, value, onChange, leadingOptions = [] }: Props) {
  const orderedCats = [...categoryMeta].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const byCat = new Map<string, OptionItem[]>();
  for (const it of items) {
    if (!byCat.has(it.category)) byCat.set(it.category, []);
    byCat.get(it.category)!.push(it);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      {leadingOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      {orderedCats.map(cat => {
        const opts = byCat.get(cat.id);
        if (!opts?.length) return null;
        return (
          <SelectGroup key={cat.id} label={tr(cat)}>
            {opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectGroup>
        );
      })}
    </Select>
  );
}
