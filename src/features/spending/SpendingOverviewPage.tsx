import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tr } from '@/shared/i18n';
import { fmtMonth, todayISO } from '@/shared/utils/dates';
import { useUIStore } from '@/shared/stores/ui.store';
import { Amount } from '@/shared/ui/Amount';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import { useSpendingData } from './data/useSpendingData';
import { SpendingBarChart } from './components/SpendingBarChart';
import { SpendingStackedChart } from './components/SpendingStackedChart';
import { monthWindow, shiftMonthKey, periodWindow, spendingSummary, monthlyTotals, monthlyByCategory, OTHER_CATEGORY, type SpendingPeriod } from './data/spending.selectors';

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
  const { categories, spendings, recurrences, people, ctx, viewer, mainCurrency, isPending } = useSpendingData();
  const isPrivate = useUIStore(s => s.privateMode);
  const [period, setPeriod] = useState<SpendingPeriod>('month');
  const [monthKey, setMonthKey] = useState(() => todayISO().slice(0, 7));

  const today = todayISO();
  const window = period === 'month' ? monthWindow(monthKey) : periodWindow(period, today);
  const summary = spendingSummary(spendings, recurrences, window, ctx, viewer);
  const cat = (id: string) => categories.find(c => c.id === id);
  const personName = (id: string) => people.find(p => p.id === id)?.name || (id || t('sp_unassigned'));
  const locale = i18n.language === 'fr' ? 'fr' : 'en';

  const [chartMode, setChartMode] = useState<'total' | 'category'>('total');
  const hasAnyData = spendings.length > 0 || recurrences.length > 0;
  const chartData = useMemo(() => monthlyTotals(spendings, recurrences, ctx, viewer, today, 12), [spendings, recurrences, ctx, viewer, today]);
  const stacked = useMemo(() => monthlyByCategory(spendings, recurrences, ctx, viewer, today, 12, 6), [spendings, recurrences, ctx, viewer, today]);
  const startM = window.start.slice(0, 7), endM = window.end.slice(0, 7);
  const selectedMonths = useMemo(() => new Set(chartData.filter(d => d.month >= startM && d.month <= endM).map(d => d.month)), [chartData, startM, endM]);
  const selectMonth = (m: string) => { setPeriod('month'); setMonthKey(m); };
  const catColor = (k: string) => (k === OTHER_CATEGORY ? '#9ca3af' : (categories.find(c => c.id === k)?.color ?? '#888'));
  const catLabel = (k: string) => { if (k === OTHER_CATEGORY) return t('sp_other'); const c = categories.find(x => x.id === k); return c ? tr(c) : k; };

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
      ) : !hasAnyData ? (
        <EmptyState
          icon={<Icon name="cash" size={28} />}
          title={t('sp_no_spending_month')}
          description={t('sp_no_spending_month_hint')}
          action={<Button variant="primary" size="sm" asChild><Link to="/spending/entries">{t('sp_add_spending')}</Link></Button>}
        />
      ) : (
        <>
          {/* Monthly trend */}
          <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg">{t('sp_monthly_spending')}</h3>
              <SegmentControl<'total' | 'category'>
                options={[
                  { value: 'total', label: t('sp_chart_total') },
                  { value: 'category', label: t('sp_chart_category') },
                ]}
                value={chartMode}
                onChange={setChartMode}
                aria-label={t('sp_monthly_spending')}
              />
            </div>
            {chartMode === 'total' ? (
              <SpendingBarChart
                data={chartData}
                selectedMonths={selectedMonths}
                locale={locale}
                currency={mainCurrency}
                isPrivate={isPrivate}
                onSelectMonth={selectMonth}
              />
            ) : (
              <SpendingStackedChart
                data={stacked.data}
                categoryKeys={stacked.categories}
                colorFor={catColor}
                nameFor={catLabel}
                selectedMonths={selectedMonths}
                locale={locale}
                currency={mainCurrency}
                isPrivate={isPrivate}
                onSelectMonth={selectMonth}
              />
            )}
          </section>

          {summary.count === 0 ? (
            <EmptyState
              icon={<Icon name="cash" size={28} />}
              title={t('sp_no_spending_period')}
              description={t('sp_no_spending_period_hint')}
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
        </>
      )}
    </div>
  );
}
