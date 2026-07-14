import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/shared/i18n';
import { fmtMonth, todayISO } from '@/shared/utils/dates';
import { privDelta, privPct } from '@/shared/utils/privacy';
import { useUIStore } from '@/shared/stores/ui.store';
import { Amount } from '@/shared/ui/Amount';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import type { Currency } from '@/types/sheets';
import { useSpendingData } from './data/useSpendingData';
import { categoryPeriodTable } from './data/spending.selectors';

type Granularity = 'month' | 'year';

/** Period-over-period change for spending: an increase is red (worse), a decrease green (better). */
function DeltaLine({ curr, prev, locale, currency, isPrivate }: { curr: number; prev: number; locale: string; currency: Currency; isPrivate: boolean }) {
  const delta = curr - prev;
  if (delta === 0) return null;
  const tone = delta > 0 ? 'text-red' : 'text-ok';
  const arrow = delta > 0 ? '▲' : '▼';
  const pct = privPct(delta, prev);
  return (
    <span className={`mt-0.5 block text-[10px] tabular-nums ${tone}`}>
      {arrow} {privDelta(delta, isPrivate, locale, currency)}{pct ? ` (${pct})` : ''}
    </span>
  );
}

export default function SpendingDetailPage() {
  const { t, i18n } = useTranslation();
  const { categories, spendings, recurrences, ctx, viewer, mainCurrency, isPending } = useSpendingData();
  const isPrivate = useUIStore(s => s.privateMode);
  const [granularity, setGranularity] = useState<Granularity>('month');

  const table = categoryPeriodTable(spendings, recurrences, ctx, viewer, granularity, todayISO(), 6);
  const cat = (id: string) => categories.find(c => c.id === id);
  const locale = i18n.language === 'fr' ? 'fr' : 'en';
  const colLabel = (key: string) => (granularity === 'month' ? fmtMonth(key, { locale: i18n.language, style: 'short' }) : key);
  const deltaProps = { locale, currency: mainCurrency, isPrivate };

  return (
    <div className="space-y-4">
      <SegmentControl<Granularity>
        options={[
          { value: 'month', label: t('sp_detail_mom') },
          { value: 'year', label: t('sp_detail_yoy') },
        ]}
        value={granularity}
        onChange={setGranularity}
        aria-label={t('sp_detail_granularity')}
      />

      {isPending ? (
        <Skeleton variant="card" className="h-64" />
      ) : table.periods.length === 0 ? (
        <EmptyState icon={<Icon name="table" size={28} />} title={t('sp_no_detail')} description={t('sp_no_detail_hint')} />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface-1 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="sticky left-0 bg-surface-1 px-3 py-2 text-left">{t('sp_category')}</th>
                {table.periods.map(p => (
                  <th key={p} className="whitespace-nowrap px-3 py-2 text-right">{colLabel(p)}</th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-fg-2">{t('sp_detail_total')}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(row => {
                const c = cat(row.categoryId);
                return (
                  <tr key={row.categoryId} className="border-b border-border/40 last:border-0">
                    <td className="sticky left-0 bg-surface-1 px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c?.color ?? '#888' }} />
                        <span className="truncate text-fg">{c ? tr(c) : row.categoryId}</span>
                      </span>
                    </td>
                    {row.cells.map((v, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums">
                        {v ? <Amount value={v} /> : <span className="text-muted">—</span>}
                        {i > 0 && <DeltaLine curr={v} prev={row.cells[i - 1]} {...deltaProps} />}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums text-fg"><Amount value={row.total} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="sticky left-0 bg-surface-1 px-3 py-2 text-fg">{t('sp_detail_total')}</td>
                {table.columnTotals.map((v, i) => (
                  <td key={i} className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-fg">
                    <Amount value={v} />
                    {i > 0 && <DeltaLine curr={v} prev={table.columnTotals[i - 1]} {...deltaProps} />}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-fg"><Amount value={table.grandTotal} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
