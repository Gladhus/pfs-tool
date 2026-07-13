import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/shared/i18n';
import { fmtMonth, todayISO } from '@/shared/utils/dates';
import { Amount } from '@/shared/ui/Amount';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import { useSpendingData } from './data/useSpendingData';
import { categoryPeriodTable } from './data/spending.selectors';

type Granularity = 'month' | 'year';

export default function SpendingDetailPage() {
  const { t, i18n } = useTranslation();
  const { categories, spendings, recurrences, ctx, viewer, isPending } = useSpendingData();
  const [granularity, setGranularity] = useState<Granularity>('month');

  const table = categoryPeriodTable(spendings, recurrences, ctx, viewer, granularity, todayISO(), 6);
  const cat = (id: string) => categories.find(c => c.id === id);
  const colLabel = (key: string) => (granularity === 'month' ? fmtMonth(key, { locale: i18n.language, style: 'short' }) : key);

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
                      <td key={i} className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                        {v ? <Amount value={v} /> : <span className="text-muted">—</span>}
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
                  <td key={i} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-fg"><Amount value={v} /></td>
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
