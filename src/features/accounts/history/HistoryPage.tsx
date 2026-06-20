import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery, useConfigQuery, useFxRatesQuery } from '@/queries/sheetQueries';
import { deriveDatesSorted, getDatesForPeriod } from '@/utils/dates';
import { activeAccounts } from '@/utils/balance';
import { fxMap as buildFxMap } from '@/utils/currency';
import { resolveFilterSpec } from '@/core/filters';
import { isViewerLockedOut } from '@/core/scope';
import { computeSeries, buildHistoryCards } from '@/features/accounts/data/history.selectors';
import { Skeleton } from '@/ui/Skeleton';
import { PeriodPills, APP_PERIODS, type Period } from '@/ui/PeriodPills';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { ViewingAsBadge } from '@/components/ViewingAsBadge';
import { AccountSelect } from './components/AccountSelect';
import { SeriesToggleBar, type SeriesState } from './components/SeriesToggleBar';
import { HistoryChart } from './components/HistoryChart';
import { HistoryCard } from './components/HistoryCard';
import { Pagination } from './components/Pagination';
import type { Currency } from '@/types/sheets';

const HIST_PAGE_SIZE = 12;

export default function HistoryPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const viewer = useUIStore(s => s.currentViewer);
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const configQ = useConfigQuery();
  const fxRatesQ = useFxRatesQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const currency = mainCurrency;
  const fxRateMap = useMemo(() => buildFxMap(fxRatesQ.data ?? []), [fxRatesQ.data]);

  const [searchParams, setSearchParams] = useSearchParams();
  const spec = resolveFilterSpec(searchParams, { viewer });
  const period = spec.period;
  const selectedAccount = spec.accountId;

  const [seriesVisible, setSeriesVisible] = useState<SeriesState>({
    investments: true,
    realEstate: true,
    other: true,
  });
  const [page, setPage] = useState(0);

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();

  const isPending = snapshotsQ.isPending || accountsQ.isPending;
  const snapshots = useMemo(() => snapshotsQ.data ?? [], [snapshotsQ.data]);
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const categoryMeta = categoryMetaQ.data ?? [];

  const datesSorted = useMemo(() => deriveDatesSorted(snapshots), [snapshots]);
  const filteredDates = useMemo(() => getDatesForPeriod(datesSorted, period), [datesSorted, period]);

  const overviewSeries = useMemo(
    () => computeSeries(filteredDates, activeAccounts(accounts), snapshots, mainCurrency, fxRateMap, viewer),
    [filteredDates, accounts, snapshots, mainCurrency, fxRateMap, viewer],
  );

  const hasOtherData = useMemo(
    () => overviewSeries.other.some(v => v !== null && Math.abs(v) > 0.005),
    [overviewSeries.other],
  );

  const cardData = useMemo(
    () => buildHistoryCards(datesSorted, accounts, snapshots, mainCurrency, fxRateMap, viewer),
    [datesSorted, accounts, snapshots, mainCurrency, fxRateMap, viewer],
  );

  const totalPages = Math.ceil(cardData.length / HIST_PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageCards = cardData.slice(safePage * HIST_PAGE_SIZE, (safePage + 1) * HIST_PAGE_SIZE);

  const onPeriodChange = (p: Period) =>
    setSearchParams(prev => { prev.set('period', p); return prev; }, { replace: false });

  const onAccountChange = (id: string) =>
    setSearchParams(prev => {
      if (id) prev.set('account', id); else prev.delete('account');
      return prev;
    }, { replace: false });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" className="h-[280px]" />
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!datesSorted.length) {
    return (
      <EmptyState
        icon={<Icon name="database" size={28} />}
        title={t('empty_history_title')}
        description={t('empty_history_body')}
        action={
          <Button variant="primary" size="sm" asChild>
            <Link to="/portfolio/manage">{t('empty_overview_no_accounts_cta')}</Link>
          </Button>
        }
      />
    );
  }

  // There's snapshot data, but none of it belongs to the current viewer — so every series
  // would just plot zero. Surface the filter instead of a misleading all-zero chart.
  if (isViewerLockedOut(accounts, viewer)) {
    return (
      <EmptyState
        icon={<Icon name="user" size={28} />}
        title={t('viewer_empty_title')}
        description={t('viewer_empty_body')}
      />
    );
  }

  const isOverview = selectedAccount === '';
  const summaryFirst = datesSorted[0];
  const summaryLast = datesSorted[datesSorted.length - 1];

  return (
    <div className="space-y-4">
      {/* Chart section */}
      <div className="rounded-xl bg-surface-1 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <ViewingAsBadge />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{t('filter_account')}</span>
            <AccountSelect
              accounts={accounts}
              categoryMeta={categoryMeta}
              value={selectedAccount}
              onChange={onAccountChange}
              viewer={viewer}
            />
          </div>
        </div>

        {isOverview && (
          <SeriesToggleBar value={seriesVisible} onChange={setSeriesVisible} hasOther={hasOtherData} />
        )}

        <HistoryChart
          filteredDates={filteredDates}
          snapshots={snapshots}
          series={overviewSeries}
          seriesVisible={seriesVisible}
          hasOtherData={hasOtherData}
          selectedAccount={selectedAccount}
          accounts={accounts}
          locale={locale}
          currency={currency}
          isPrivate={privateMode}
        />

        <PeriodPills value={period} onChange={onPeriodChange} options={APP_PERIODS} responsive />
      </div>

      {/* Card list */}
      <div className="space-y-3">
        <p className="text-xs text-muted">
          {t('history_summary', { count: datesSorted.length, from: summaryFirst, to: summaryLast })}
        </p>

        <div className="grid grid-cols-1 gap-3">
          {pageCards.map(card => (
            <HistoryCard
              key={card.month}
              card={card}
              locale={locale}
              currency={currency}
              isPrivate={privateMode}
            />
          ))}
        </div>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage(p => Math.max(0, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
        />
      </div>
    </div>
  );
}
