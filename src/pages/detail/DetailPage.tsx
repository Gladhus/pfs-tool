import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery, useConfigQuery, useFxRatesQuery } from '@/queries/sheetQueries';
import { tr } from '@/i18n';
import { deriveDatesSorted } from '@/utils/dates';
import { buildEffectiveBalances } from '@/utils/stats';
import { categoriesInOrder, accountsForCategory } from '@/utils/balance';
import { fxMap as buildFxMap, signedMain, rateFor } from '@/utils/currency';
import { LEGACY_SELF_ID } from '@/utils/ownership';
import { Skeleton } from '@/ui/Skeleton';
import { PeriodPills, type Period } from '@/ui/PeriodPills';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { DetailTable, type DetailModel, type DetailRow } from './components/DetailTable';
import type { Account, CategoryMeta, Snapshot, Currency } from '@/types/sheets';

// Detail is year-over-year, so it keeps its own period set (exempt from APP_PERIODS).
const DETAIL_PERIODS: Period[] = ['3y', '5y', 'all'];
const PERIOD_LIMIT: Record<string, number | null> = { '3y': 3, '5y': 5, all: null };

function getDetailYears(
  snapshots: Snapshot[],
  datesSorted: string[],
  period: Period,
): string[] {
  const currentYear = String(new Date().getFullYear());
  const seen = new Set(datesSorted.map(d => d.slice(0, 4)));
  seen.add(currentYear);
  let sorted = [...seen]
    .sort()
    .filter(y => Object.keys(buildEffectiveBalances(snapshots, `${y}-01-01`)).length > 0);
  const limit = PERIOD_LIMIT[period];
  if (limit && sorted.length > limit) sorted = sorted.slice(-limit);
  return sorted;
}

function buildDetailModel(
  snapshots: Snapshot[],
  accounts: Account[],
  categoryMeta: CategoryMeta[],
  years: string[],
  netLabel: string,
  totalLabel: string,
  main: Currency,
  fxMap: Map<string, number>,
  viewer: string = LEGACY_SELF_ID,
): DetailModel | null {
  const yearBals: Record<string, Record<string, number>> = {};
  const yearRate: Record<string, number | null> = {};
  for (const y of years) {
    yearBals[y] = buildEffectiveBalances(snapshots, `${y}-01-01`);
    yearRate[y] = rateFor(fxMap, `${y}-01-01`);
  }

  const getVal = (acct: Account, year: string): number | null => {
    const raw = yearBals[year][acct.id];
    return raw !== undefined ? signedMain(acct, raw, main, yearRate[year], viewer) : null;
  };

  const rows: DetailRow[] = [];
  const netByYear: Record<string, number> = Object.fromEntries(years.map(y => [y, 0]));
  const netHasData: Record<string, boolean> = Object.fromEntries(years.map(y => [y, false]));
  let anyData = false;

  for (const cat of categoriesInOrder(accounts, categoryMeta)) {
    const accts = accountsForCategory(accounts, cat.id);
    if (!accts.length) continue;

    const catByYear: Record<string, number | null> = Object.fromEntries(years.map(y => [y, null]));
    const catRows: { acct: Account; vals: Record<string, number | null> }[] = [];

    for (const acct of accts) {
      const vals: Record<string, number | null> = Object.fromEntries(years.map(y => [y, getVal(acct, y)]));
      if (!years.some(y => vals[y] !== null)) continue;
      for (const y of years) {
        const v = vals[y];
        if (v !== null) {
          catByYear[y] = (catByYear[y] ?? 0) + v;
          netByYear[y] += v;
          netHasData[y] = true;
          anyData = true;
        }
      }
      catRows.push({ acct, vals });
    }
    if (!catRows.length) continue;

    rows.push({ kind: 'category-header', label: tr(cat), categoryId: cat.id, values: years.map(() => null) });

    if (catRows.length > 1) {
      for (const { acct, vals } of catRows) {
        rows.push({ kind: 'account', label: tr(acct), values: years.map(y => vals[y]) });
      }
    }

    rows.push({ kind: 'category-total', label: totalLabel, values: years.map(y => catByYear[y]) });
  }

  if (!anyData) return null;

  rows.push({
    kind: 'net',
    label: netLabel,
    values: years.map(y => (netHasData[y] ? netByYear[y] : null)),
  });

  return { years, rows };
}

export default function DetailPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const viewer = useUIStore(s => s.currentViewer);
  const locale = lang === 'fr' ? 'fr' : 'en';

  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as Period) ?? 'all';

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const configQ = useConfigQuery();
  const fxRatesQ = useFxRatesQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const currency = mainCurrency;
  const fxRateMap = useMemo(() => buildFxMap(fxRatesQ.data ?? []), [fxRatesQ.data]);

  const isPending = snapshotsQ.isPending || accountsQ.isPending;
  const snapshots = useMemo(() => snapshotsQ.data ?? [], [snapshotsQ.data]);
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const categoryMeta = useMemo(() => categoryMetaQ.data ?? [], [categoryMetaQ.data]);

  const datesSorted = useMemo(() => deriveDatesSorted(snapshots), [snapshots]);
  const years = useMemo(
    () => getDetailYears(snapshots, datesSorted, period),
    [snapshots, datesSorted, period],
  );
  const model = useMemo(
    () => (years.length && accounts.length
      ? buildDetailModel(snapshots, accounts, categoryMeta, years, t('net_worth'), t('detail_total'), mainCurrency, fxRateMap, viewer)
      : null),
    [snapshots, accounts, categoryMeta, years, t, mainCurrency, fxRateMap, viewer],
  );

  const onPeriodChange = (p: Period) =>
    setSearchParams(prev => { prev.set('period', p); return prev; });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" className="h-10 w-64" />
        <Skeleton variant="card" className="h-[420px]" />
      </div>
    );
  }

  if (!model) {
    return (
      <EmptyState
        icon={<Icon name="database" size={28} />}
        title={t('empty_detail_title')}
        description={t('empty_detail_body')}
        action={
          <Button variant="primary" size="sm" asChild>
            <Link to="/portfolio/manage">{t('empty_overview_no_accounts_cta')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <PeriodPills value={period} onChange={onPeriodChange} options={DETAIL_PERIODS} />

      <DetailTable
        model={model}
        accountHeader={t('detail_account')}
        locale={locale}
        currency={currency}
        isPrivate={privateMode}
      />
    </div>
  );
}
