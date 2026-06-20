import { Select, SelectItem, SelectGroup } from '@/shared/ui/Select';
import type { Account, CategoryMeta } from '@/types/sheets';
import { tr } from '@/shared/i18n';
import { activeAccounts } from '@/shared/utils/balance';
import { accountsVisibleToViewer, LEGACY_SELF_ID } from '@/shared/utils/ownership';
import { useTranslation } from 'react-i18next';

interface Props {
  accounts: Account[];
  categoryMeta: CategoryMeta[];
  value: string;
  onChange: (value: string) => void;
  viewer?: string;
}

export function AccountSelect({ accounts, categoryMeta, value, onChange, viewer = LEGACY_SELF_ID }: Props) {
  const { t } = useTranslation();

  const catOrder = Object.fromEntries(categoryMeta.map(c => [c.id, c.sort_order ?? 0]));
  const active = [...accountsVisibleToViewer(activeAccounts(accounts), viewer)].sort((a, b) => {
    const co = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99);
    return co !== 0 ? co : (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const byCat: Record<string, Account[]> = {};
  for (const a of active) (byCat[a.category] ??= []).push(a);
  const orderedCats = [...categoryMeta].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const ALL = '__all__';

  return (
    <Select value={value === '' ? ALL : value} onValueChange={v => onChange(v === ALL ? '' : v)}>
      <SelectItem value={ALL}>{t('overview_option')}</SelectItem>
      {orderedCats.map(cat => {
        const accts = byCat[cat.id];
        if (!accts?.length) return null;
        return (
          <SelectGroup key={cat.id} label={tr(cat)}>
            {accts.map(a => (
              <SelectItem key={a.id} value={a.id}>{tr(a)}</SelectItem>
            ))}
          </SelectGroup>
        );
      })}
    </Select>
  );
}
