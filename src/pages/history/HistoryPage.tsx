import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery } from '@/queries/sheetQueries';
import { deriveDatesSorted, getDatesForPeriod } from '@/utils/dates';
import { buildBalanceSweep } from '@/utils/stats';
import { activeAccounts } from '@/utils/balance';
import { foldCategoryId } from '@/utils/colors';
import { Skeleton } from '@/ui/Skeleton';
import { PeriodPills, type Period } from '@/ui/PeriodPills';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { AccountSelect } from './components/AccountSelect';
import { SeriesToggleBar, type SeriesState } from './components/SeriesToggleBar';
import { HistoryChart } from './components/HistoryChart';
import { HistoryCard, type CardData } from './components/HistoryCard';
import { Pagination } from './components/Pagination';
import { ExportCsvButton } from './components/ExportCsvButton';
import type { Account, Snapshot } from '@/types/sheets';
import cfg from '@/config';

const HISTORY_PERIODS: Period[] = ['3m', '6m', '1y', '3y', '5y', 'all'];
const HIST_PAGE_SIZE = 12;

function computeSeries(
  dates: string[],
  accounts: Account[],
  snapshots: Snapshot[],
) {
  if (!dates.length) return { dates: [], investments: [], realEstateNet: [], other: [] };
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const sweep = buildBalanceSweep(snapshots, dates);
  const outDates: string[] = [];
  const investments: number[] = [];
  const realEstateNet: number[] = [];
  const other: number[] = [];

  for (let i = 0; i < dates.length; i++) {
    const balances = sweep[i];
    if (!Object.keys(balances).length) continue;
    let n = 0, inv = 0, re = 0, red = 0;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a) continue;
      const signed = balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
      n += signed;
      if (a.category === 'investments') inv += signed;
      else if (a.category === 'real_estate') re += signed;
      else if (a.category === 'real_estate_debt') red += signed;
    }
    outDates.push(dates[i]);
    investments.push(inv);
    realEstateNet.push(re + red);
    other.push(n - inv - (re + red));
  }

  const nullBeforeFirst = (arr: number[]): (number | null)[] => {
    const first = arr.findIndex(v => v !== 0);
    return first <= 0 ? arr : arr.map((v, i) => (i < first ? null : v));
  };

  return {
    dates: outDates,
    investments: nullBeforeFirst(investments),
    realEstateNet: nullBeforeFirst(realEstateNet),
    other: nullBeforeFirst(other),
  };
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const currency = cfg.CURRENCY;

  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as Period) ?? '1y';
  const selectedAccount = searchParams.get('account') ?? '';

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
  const snapshots = snapshotsQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const categoryMeta = categoryMetaQ.data ?? [];

  const datesSorted = useMemo(() => deriveDatesSorted(snapshots), [snapshots]);
  const filteredDates = useMemo(() => getDatesForPeriod(datesSorted, period), [datesSorted, period]);

  const overviewSeries = useMemo(
    () => computeSeries(filteredDates, activeAccounts(accounts), snapshots),
    [filteredDates, accounts, snapshots],
  );

  const cardData = useMemo((): CardData[] => {
    if (!datesSorted.length) return [];
    const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
    const sweep = buildBalanceSweep(snapshots, datesSorted);

    const exactByDate = new Map<string, Set<string>>();
    for (const s of snapshots) {
      if (s.account_id === '__day__') continue;
      if (!exactByDate.has(s.date)) exactByDate.set(s.date, new Set());
      exactByDate.get(s.date)!.add(s.account_id);
    }
    const activeIds = new Set(activeAccounts(accounts).map(a => a.id));

    const byDate = new Map<string, {
      net: number; investments: number; realEstate: number;
      realEstateDebts: number; debts: number; incomplete: boolean;
    }>();

    for (let i = 0; i < datesSorted.length; i++) {
      const date = datesSorted[i];
      const balances = sweep[i];
      if (!Object.keys(balances).length) continue;
      let net = 0, inv = 0, re = 0, red = 0, debts = 0;
      for (const [id, balance_raw] of Object.entries(balances)) {
        const a = acctById[id];
        if (!a) continue;
        const signed = balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
        net += signed;
        if (a.kind === 'debt') debts += signed;
        const folded = foldCategoryId(a.category);
        if (folded === 'investments') inv += signed;
        else if (folded === 'real_estate') re += signed;
        if (a.category === 'real_estate_debt') red += signed;
      }
      const exact = exactByDate.get(date) ?? new Set<string>();
      byDate.set(date, {
        net, investments: inv, realEstate: re, realEstateDebts: red, debts,
        incomplete: [...activeIds].some(id => !exact.has(id)),
      });
    }

    const allDatesList = [...byDate.keys()].sort();
    const byMonth = new Map<string, string[]>();
    for (const d of allDatesList) {
      const mo = d.slice(0, 7);
      if (!byMonth.has(mo)) byMonth.set(mo, []);
      byMonth.get(mo)!.push(d);
    }
    const monthsDesc = [...byMonth.keys()].sort().reverse();

    return monthsDesc.map((mo, moIdx) => {
      const datesInMonth = [...byMonth.get(mo)!].reverse(); // newest first
      const latestDate = datesInMonth[0];
      const latest = byDate.get(latestDate)!;
      const prevMoKey = monthsDesc[moIdx + 1];
      const prevLatest = prevMoKey ? [...byMonth.get(prevMoKey)!].sort().pop() : undefined;
      const prevNet = prevLatest ? byDate.get(prevLatest)!.net : null;

      const olderDates = datesInMonth.slice(1).map(date => {
        const d = byDate.get(date)!;
        const prevI = allDatesList.indexOf(date) - 1;
        const prevK = prevI >= 0 ? allDatesList[prevI] : null;
        return {
          date,
          net: d.net,
          prevNet: prevK ? byDate.get(prevK)!.net : null,
          incomplete: d.incomplete,
        };
      });

      return {
        month: mo,
        latestDate,
        net: latest.net,
        prevNet,
        investments: latest.investments,
        realEstate: latest.realEstate,
        realEstateDebts: latest.realEstateDebts,
        debts: latest.debts,
        incomplete: latest.incomplete,
        olderDates,
      };
    });
  }, [datesSorted, accounts, snapshots]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <PeriodPills value={period} onChange={onPeriodChange} options={HISTORY_PERIODS} />
          <div className="flex items-center gap-2">
            <AccountSelect
              accounts={accounts}
              categoryMeta={categoryMeta}
              value={selectedAccount}
              onChange={onAccountChange}
            />
            <ExportCsvButton snapshots={snapshots} accounts={accounts} />
          </div>
        </div>

        {isOverview && (
          <SeriesToggleBar value={seriesVisible} onChange={setSeriesVisible} />
        )}

        <HistoryChart
          filteredDates={filteredDates}
          snapshots={snapshots}
          series={overviewSeries}
          seriesVisible={seriesVisible}
          selectedAccount={selectedAccount}
          accounts={accounts}
          locale={locale}
          currency={currency}
          isPrivate={privateMode}
        />
      </div>

      {/* Card list */}
      <div className="space-y-3">
        <p className="text-xs text-muted">
          {t('history_summary', { count: datesSorted.length, from: summaryFirst, to: summaryLast })}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
