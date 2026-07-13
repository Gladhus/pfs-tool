import { useTranslation } from 'react-i18next';
import { tr } from '@/shared/i18n';
import { Select, SelectItem } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';
import { Icon } from '@/shared/ui/Icon';
import type { SpendingCategory } from '@/types/sheets';

/** Sentinel target meaning "create a new category". */
export const NEW_CATEGORY = '__new__';

interface Props {
  categories: string[];             // bank categories, unknowns first
  rememberedKeys: Set<string>;
  spendingCategories: SpendingCategory[];
  value: Record<string, string>;    // bankCategory → spending category id | NEW_CATEGORY
  newNames: Record<string, string>; // bankCategory → name to use when creating new
  onChange: (bankCategory: string, target: string) => void;
  onNewNameChange: (bankCategory: string, name: string) => void;
}

/** Wizard step: map each bank category to an existing category or a new one. */
export function ImportCategoriesStep({ categories, rememberedKeys, spendingCategories, value, newNames, onChange, onNewNameChange }: Props) {
  const { t } = useTranslation();
  const options = [...spendingCategories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t('sp_imp_categories_help')}</p>
      <div className="overflow-hidden rounded-xl bg-surface-1 shadow-sm">
        {categories.map(bankCat => {
          const target = value[bankCat] ?? NEW_CATEGORY;
          const isNew = target === NEW_CATEGORY;
          return (
            <div key={bankCat} className="border-b border-border/40 px-4 py-2.5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm text-fg">{bankCat}</span>
                  {!rememberedKeys.has(bankCat) && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase text-accent">{t('sp_imp_new')}</span>
                  )}
                </div>
                <Icon name="chevronRight" size={14} className="shrink-0 text-muted" />
                <div className="w-44 shrink-0">
                  <Select value={target} onValueChange={v => onChange(bankCat, v)}>
                    <SelectItem value={NEW_CATEGORY}>➕ {t('sp_imp_create_new')}</SelectItem>
                    {options.map(c => <SelectItem key={c.id} value={c.id}>{tr(c)}</SelectItem>)}
                  </Select>
                </div>
              </div>
              {isNew && (
                <div className="mt-2 flex items-center gap-2 pl-1">
                  <span className="text-xs text-muted">{t('sp_imp_new_name')}</span>
                  <Input
                    className="h-7 flex-1"
                    value={newNames[bankCat] ?? bankCat}
                    onChange={e => onNewNameChange(bankCat, e.target.value)}
                    placeholder={bankCat}
                    aria-label={t('sp_imp_new_name')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
