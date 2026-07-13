import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tr } from '@/shared/i18n';
import { fmtMonth, todayISO } from '@/shared/utils/dates';
import { Amount } from '@/shared/ui/Amount';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import { useSpendingData } from './data/useSpendingData';
import { monthWindow, shiftMonthKey, periodWindow, spendingSummary, type SpendingPeriod } from './data/spending.selectors';

const PERIODS: SpendingPeriod[] = ['month', '3m', '6m', 'ytd', '1y', 'all'];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
    </div>
  );
}

export default function SpendingOverviewPage() {
  const { t, i18n } = useTranslation();
  const { categories, spendings, recurrences, people, ctx, viewer, isPending } = useSpendingData();
  const [period, setPeriod] = useState<SpendingPeriod>('month');
  const [monthKey, setMonthKey] = useState(() => todayISO().slice(0, 7));

  const window = period === 'month' ? monthWindow(monthKey) : periodWindow(period, todayISO());
  const summary = spendingSummary(spendings, recurrences, window, ctx, viewer);
  const cat = (id: string) => categories.find(c => c.id === id);
  const personName = (id: string) => people.find(p => p.id === id)?.name || (id || t('sp_unassigned'));

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <SegmentControl<SpendingPeriod>
        options={PERIODS.map(p => ({ value: p, label: p === 'month' ? t('sp_period_month') : t(`period_${p}`) }))}
        value={period}
        onChange={setPeriod}
        responsive
        aria-label={t('sp_period_label')}
      />

      {/* Month stepper — only in "This month" mode */}
      {period === 'month' && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" aria-label={t('sp_prev_month')} onClick={() => setMonthKey(m => shiftMonthKey(m, -1))}>
            <Icon name="chevronRight" size={16} className="rotate-180" />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-fg">{fmtMonth(monthKey, { locale: i18n.language })}</span>
          <Button variant="ghost" size="sm" aria-label={t('sp_next_month')} onClick={() => setMonthKey(m => shiftMonthKey(m, 1))}>
            <Icon name="chevronRight" size={16} />
          </Button>
        </div>
      )}

      {isPending ? (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" className="h-28" />)}</div>
      ) : summary.count === 0 ? (
        <EmptyState
          icon={<Icon name="cash" size={28} />}
          title={t('sp_no_spending_month')}
          description={t('sp_no_spending_month_hint')}
          action={<Button variant="primary" size="sm" asChild><Link to="/spending/entries">{t('sp_add_spending')}</Link></Button>}
        />
      ) : (
        <>
          {/* Hero total */}
          <section className="rounded-xl bg-surface-1 p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('sp_total_spent')}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <span className="text-3xl font-semibold text-fg"><Amount value={summary.total} /></span>
              <Link to="/spending/entries" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                {t('sp_view_entries', { count: summary.count })}
                <Icon name="chevronRight" size={14} />
              </Link>
            </div>
          </section>

          {/* By category */}
          <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-fg">{t('sp_by_category')}</h3>
            <div className="space-y-3">
              {summary.byCategory.map(b => {
                const c = cat(b.categoryId);
                const color = c?.color ?? '#888';
                return (
                  <div key={b.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-fg">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="truncate">{c ? tr(c) : b.categoryId}</span>
                        <span className="shrink-0 text-xs text-muted">{Math.round(b.pct)}%</span>
                      </span>
                      <span className="shrink-0 text-fg"><Amount value={b.amount} /></span>
                    </div>
                    <Bar pct={b.pct} color={color} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* By person */}
          {summary.byPerson.length > 1 && (
            <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-fg">{t('sp_by_person')}</h3>
              <div className="space-y-3">
                {summary.byPerson.map(b => (
                  <div key={b.ownerId || 'unassigned'} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-fg">
                        {personName(b.ownerId)}
                        <span className="text-xs text-muted">{Math.round(b.pct)}%</span>
                      </span>
                      <span className="text-fg"><Amount value={b.amount} /></span>
                    </div>
                    <Bar pct={b.pct} color="var(--accent)" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
