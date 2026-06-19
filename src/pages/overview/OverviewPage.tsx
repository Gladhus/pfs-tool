import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import {
  useAccountsQuery,
  useSnapshotsQuery,
  useCategoryMetaQuery,
  useGroupsQuery,
  useConfigQuery,
  useOptionCompaniesQuery,
  useOptionGrantsQuery,
  useOptionFmvQuery,
  useOptionExercisesQuery,
  useFxRatesQuery,
  usePeopleQuery,
} from '@/queries/sheetQueries';
import { deriveDatesSorted, getDatesForPeriod } from '@/utils/dates';
import { fxMap as buildFxMap } from '@/utils/currency';
import { HOUSEHOLD_VIEWER } from '@/utils/ownership';
import type { Currency } from '@/types/sheets';
import { Skeleton } from '@/ui/Skeleton';
import { PeriodPills, APP_PERIODS, type Period } from '@/ui/PeriodPills';
import { useOverviewStats } from './hooks/useOverviewStats';
import { HeroCard } from './components/HeroCard';
import { OverviewChart } from './components/OverviewChart';
import { StatCardGrid } from './components/StatCardGrid';
import { SeriesToggle } from './components/SeriesToggle';
import { ViewToggle } from './components/ViewToggle';
import { EmptyOverviewState } from './components/EmptyOverviewState';
import { categoryKey } from '@/utils/icons';
import { useMemo } from 'react';

const DEFAULT_PERIOD: Period = 'all';

export default function OverviewPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const ovView = useUIStore(s => s.ovView);
  const seriesVisible = useUIStore(s => s.ovSeriesVisible);
  const setOvView = useUIStore(s => s.setOvView);
  const viewer = useUIStore(s => s.currentViewer);

  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';

  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as Period) ?? DEFAULT_PERIOD;

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const groupsQ = useGroupsQuery();
  const configQ = useConfigQuery();
  const peopleQ = usePeopleQuery();
  const fxRatesQ = useFxRatesQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const currency = mainCurrency;
  const fxRateMap = useMemo(() => buildFxMap(fxRatesQ.data ?? []), [fxRatesQ.data]);

  const stockOptEnabled = configQ.isSuccess && configQ.data.stock_options_enabled === true;
  const optCompaniesQ = useOptionCompaniesQuery();
  const optGrantsQ = useOptionGrantsQuery();
  const optFmvQ = useOptionFmvQuery();
  const optExercisesQ = useOptionExercisesQuery();

  const isPending = snapshotsQ.isPending || accountsQ.isPending;

  const snapshots = snapshotsQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const categoryMeta = categoryMetaQ.data ?? [];
  const groups = groupsQ.data ?? [];
  const people = peopleQ.data ?? [];
  const showPerson = viewer === HOUSEHOLD_VIEWER;
  const effectiveView = !showPerson && ovView === 'person' ? 'category' : ovView;

  const datesSorted = deriveDatesSorted(snapshots);
  const filteredDates = getDatesForPeriod(datesSorted, period);

  const hasEquityData =
    stockOptEnabled &&
    optCompaniesQ.isSuccess &&
    optGrantsQ.isSuccess &&
    optFmvQ.isSuccess &&
    optExercisesQ.isSuccess &&
    (optCompaniesQ.data?.length ?? 0) > 0;

  const optionData = hasEquityData
    ? {
        companies: optCompaniesQ.data!,
        grants: optGrantsQ.data!,
        fmv: optFmvQ.data!,
        exercises: optExercisesQ.data!,
      }
    : undefined;

  const stats = useOverviewStats({
    snapshots,
    accounts,
    categoryMeta,
    groups,
    people,
    optionData,
    filteredDates,
    datesSorted,
    view: effectiveView,
    seriesVisible,
    stockOptEnabled,
    main: mainCurrency,
    fxMap: fxRateMap,
    viewer,
  });

  const catColor = (id?: string): string =>
    !id || id === 'equity' ? 'var(--cat-equity)' : `var(--cat-${categoryKey(id)})`;

  const onPeriodChange = (p: Period) => setSearchParams({ period: p }, { replace: false });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" className="h-28" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!datesSorted.length) {
    return <EmptyOverviewState hasAccounts={accounts.length > 0} />;
  }

  return (
    <div className="space-y-4">
      {/* Hero card — header, period pills, legend, chart */}
      <div className="rounded-xl bg-surface-1 shadow-sm p-5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <HeroCard
            netWorth={stats.netWorth}
            prevNetWorth={stats.prevNetWorth}
            latestDate={stats.latestDate}
            period={period}
            locale={locale}
            currency={currency}
            isPrivate={privateMode}
          />
          <div className="hidden md:block max-w-full shrink-0 overflow-x-auto no-scrollbar">
            <PeriodPills value={period} onChange={onPeriodChange} options={APP_PERIODS} />
          </div>
        </div>

        {stats.chartDates.length > 0 && (
          <>
            <SeriesToggle
              netColor="var(--accent)"
              buckets={stats.bucketData}
              catsWithData={stats.catsWithData}
              view={effectiveView}
              catColor={catColor}
            />
            <OverviewChart
              dates={stats.chartDates}
              netData={stats.netData}
              buckets={stats.bucketData}
              seriesVisible={seriesVisible}
              locale={locale}
              currency={currency}
              isPrivate={privateMode}
              netLabel={t('net_worth_chart')}
              view={effectiveView}
            />
          </>
        )}

        {/* Mobile: period pills pinned to the bottom of the card */}
        <div className="md:hidden">
          <PeriodPills value={period} onChange={onPeriodChange} options={APP_PERIODS} responsive />
        </div>
      </div>

      {/* Allocation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted">{t('allocation_title')}</h2>
          <ViewToggle value={effectiveView} onChange={setOvView} showPerson={showPerson} />
        </div>
        <StatCardGrid
          view={effectiveView}
          effectiveCats={stats.effectiveCats}
          byCategory={stats.byCategory}
          prevByCategory={stats.prevByCategory}
          groupStats={stats.groupStats}
          personStats={stats.personStats}
          accounts={accounts}
          sparkDates={stats.sparkDates}
          sweepForSpark={stats.sweepForSpark}
          optionData={optionData}
          main={mainCurrency}
          fxMap={fxRateMap}
          viewer={viewer}
          equityValue={stats.byCategory['equity']}
          prevEquityValue={stats.prevByCategory?.['equity']}
          period={period}
          locale={locale}
          currency={currency}
          isPrivate={privateMode}
        />
      </div>
    </div>
  );
}
