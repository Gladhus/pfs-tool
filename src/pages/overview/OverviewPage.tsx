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
} from '@/queries/sheetQueries';
import { deriveDatesSorted, getDatesForPeriod } from '@/utils/dates';
import { Skeleton } from '@/ui/Skeleton';
import { PeriodPills, type Period } from '@/ui/PeriodPills';
import { useOverviewStats } from './hooks/useOverviewStats';
import { HeroCard } from './components/HeroCard';
import { OverviewChart } from './components/OverviewChart';
import { StatCardGrid } from './components/StatCardGrid';
import { SeriesToggle } from './components/SeriesToggle';
import { ViewToggle } from './components/ViewToggle';
import { EmptyOverviewState } from './components/EmptyOverviewState';
import { chartColors } from '@/utils/chartOptions';
import { categoryKey } from '@/utils/icons';
import cfg from '@/config';

const OVERVIEW_PERIODS: Period[] = ['3m', '6m', '1y', '3y', '5y', 'all'];
const DEFAULT_PERIOD: Period = '1y';

export default function OverviewPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const ovView = useUIStore(s => s.ovView);
  const seriesVisible = useUIStore(s => s.ovSeriesVisible);
  const setOvView = useUIStore(s => s.setOvView);

  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const currency = cfg.CURRENCY;

  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as Period) ?? DEFAULT_PERIOD;

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const groupsQ = useGroupsQuery();
  const configQ = useConfigQuery();

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
    optionData,
    filteredDates,
    datesSorted,
    view: ovView,
    seriesVisible,
    stockOptEnabled,
  });

  const colors = chartColors();
  const cs = getComputedStyle(document.documentElement);
  const catColor = (id?: string): string => {
    if (!id || id === 'equity') return cs.getPropertyValue('--cat-equity').trim() || '#06b6d4';
    return cs.getPropertyValue('--cat-' + categoryKey(id)).trim() || colors.accent;
  };

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
    return <EmptyOverviewState />;
  }

  return (
    <div className="space-y-4">
      <HeroCard
        netWorth={stats.netWorth}
        prevNetWorth={stats.prevNetWorth}
        latestDate={stats.latestDate}
        period={period}
        locale={locale}
        currency={currency}
        isPrivate={privateMode}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PeriodPills
          value={period}
          onChange={onPeriodChange}
          options={OVERVIEW_PERIODS}
        />
        <ViewToggle value={ovView} onChange={setOvView} />
      </div>

      {stats.chartDates.length > 0 && (
        <div className="rounded-xl bg-surface-1 shadow-sm p-4 space-y-3">
          <SeriesToggle
            netColor={colors.accent}
            buckets={stats.bucketData}
            catsWithData={stats.catsWithData}
            view={ovView}
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
            view={ovView}
          />
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted">{t('allocation_title')}</h2>
        <StatCardGrid
          view={ovView}
          effectiveCats={stats.effectiveCats}
          byCategory={stats.byCategory}
          prevByCategory={stats.prevByCategory}
          groupStats={stats.groupStats}
          accounts={accounts}
          sparkDates={stats.sparkDates}
          sweepForSpark={stats.sweepForSpark}
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
