import { useTranslation } from 'react-i18next';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import { Amount } from '@/shared/ui/Amount';
import type { Currency } from '@/types/sheets';
import type { KindDecision } from '../../import/mappings';

interface Props {
  categories: string[];              // uncertain bank categories, undecided first
  rememberedKeys: Set<string>;
  value: Record<string, KindDecision>;
  summaryFor: (cat: string) => { count: number; total: number; example: string };
  mainCurrency: Currency;
  onChange: (cat: string, d: KindDecision) => void;
}

/** Wizard step: decide whether each ambiguous category counts as spending. */
export function ImportUncertainStep({ categories, rememberedKeys, value, summaryFor, mainCurrency, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('sp_imp_uncertain_help')}</p>
      {categories.map(cat => {
        const s = summaryFor(cat);
        return (
          <section key={cat} className="rounded-xl bg-surface-1 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-fg">{cat}</span>
                  {!rememberedKeys.has(cat) && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase text-accent">{t('sp_imp_new')}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {t('sp_imp_uncertain_detail', { count: s.count })} ·{' '}
                  <Amount value={s.total} currency={mainCurrency} sensitive={false} />
                  {s.example && ` · ${s.example}`}
                </p>
              </div>
              <div className="shrink-0">
                <SegmentControl<KindDecision>
                  options={[
                    { value: 'exclude', label: t('sp_imp_skip') },
                    { value: 'include', label: t('sp_imp_include') },
                  ]}
                  value={value[cat] ?? 'exclude'}
                  onChange={d => onChange(cat, d)}
                  aria-label={cat}
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
