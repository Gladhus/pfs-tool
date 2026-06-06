import { useMemo } from 'react';
import type { Account, CategoryMeta, Group } from '@/types/sheets';
import { StatCard } from '@/ui/StatCard';
import { Delta } from '@/ui/Delta';
import { Sparkline } from './Sparkline';
import { EmptyGroupsState } from './EmptyGroupsState';
import type { EquityData } from '../hooks/useOverviewStats';
import { foldCategoryId, accountMatchesGroup, groupColor } from '@/utils/colors';
import { categoryKey } from '@/utils/icons';
import { computeCompanyEquityValue } from '@/utils/options';
import { signedMain, toMain, rateFor } from '@/utils/currency';
import type { Currency } from '@/types/sheets';
import { tr } from '@/i18n';
import { useTranslation } from 'react-i18next';

interface GroupStat {
  group: Group;
  value: number;
  prevValue: number | null;
}

interface Props {
  view: 'category' | 'group';
  effectiveCats: CategoryMeta[];
  byCategory: Record<string, number>;
  prevByCategory: Record<string, number> | null;
  groupStats: GroupStat[];
  accounts: Account[];
  sparkDates: string[];
  sweepForSpark: Record<string, number>[];
  optionData?: EquityData;
  main: Currency;
  fxMap: Map<string, number>;
  equityValue?: number;
  prevEquityValue?: number | null;
  period: string;
  locale: string;
  currency: string;
  isPrivate: boolean;
}

/** Read a category accent color from the CSS theme tokens. */
function catColorVar(catId?: string): string {
  const cs = getComputedStyle(document.documentElement);
  if (!catId || catId === 'equity') return cs.getPropertyValue('--cat-equity').trim() || '#06b6d4';
  return cs.getPropertyValue('--cat-' + categoryKey(catId)).trim() || cs.getPropertyValue('--accent').trim();
}

/** Drop leading entries that have no underlying data so the line starts at the first real point. */
function trimLeading(raw: { total: number; has: boolean }[]): number[] {
  const first = raw.findIndex(r => r.has);
  return first < 0 ? [] : raw.slice(first).map(r => r.total);
}

function buildCategorySpark(
  catId: string,
  accounts: Account[],
  sweepForSpark: Record<string, number>[],
  sparkDates: string[],
  main: Currency,
  fxMap: Map<string, number>,
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return trimLeading(sweepForSpark.map((balances, i) => {
    const usdCad = rateFor(fxMap, sparkDates[i]);
    let total = 0;
    let has = false;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || foldCategoryId(a.category) !== catId) continue;
      total += signedMain(a, balance_raw, main, usdCad);
      has = true;
    }
    return { total, has };
  }));
}

function buildGroupSpark(
  group: Group,
  accounts: Account[],
  sweepForSpark: Record<string, number>[],
  sparkDates: string[],
  main: Currency,
  fxMap: Map<string, number>,
  optionData?: EquityData,
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return trimLeading(sweepForSpark.map((balances, i) => {
    const usdCad = rateFor(fxMap, sparkDates[i]);
    let total = 0;
    let has = false;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || !accountMatchesGroup(a, group)) continue;
      total += signedMain(a, balance_raw, main, usdCad);
      has = true;
    }
    if (optionData) {
      for (const c of optionData.companies) {
        if (c.active === false) continue;
        if (accountMatchesGroup({ tags: c.tags }, group)) {
          const raw = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, sparkDates[i]);
          if (raw) { total += toMain(raw, c.currency ?? main, main, usdCad); has = true; }
        }
      }
    }
    return { total, has };
  }));
}

export function StatCardGrid({
  view,
  effectiveCats,
  byCategory,
  prevByCategory,
  groupStats,
  accounts,
  sparkDates,
  sweepForSpark,
  optionData,
  main,
  fxMap,
  equityValue,
  prevEquityValue,
  period,
  locale,
  currency,
  isPrivate,
}: Props) {
  const { t } = useTranslation();
  const periodLabel = t(`period_long_${period.toLowerCase()}`);

  const catSparks = useMemo(() =>
    effectiveCats.reduce<Record<string, number[]>>((acc, cat) => {
      acc[cat.id] = buildCategorySpark(cat.id, accounts, sweepForSpark, sparkDates, main, fxMap);
      return acc;
    }, {}),
    [effectiveCats, accounts, sweepForSpark, sparkDates, main, fxMap],
  );

  const groupSparks = useMemo(() =>
    groupStats.map(({ group }) => buildGroupSpark(group, accounts, sweepForSpark, sparkDates, main, fxMap, optionData)),
    [groupStats, accounts, sweepForSpark, sparkDates, main, fxMap, optionData],
  );

  const equitySpark = useMemo(() => {
    if (!optionData) return [];
    const raw = sparkDates.map(d => {
      const usdCad = rateFor(fxMap, d);
      return optionData.companies.reduce((s, c) => {
        if (c.active === false) return s;
        const v = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, d);
        return s + toMain(v, c.currency ?? main, main, usdCad);
      }, 0);
    });
    const first = raw.findIndex(v => v !== 0);
    return first < 0 ? [] : raw.slice(first);
  }, [optionData, sparkDates, main, fxMap]);

  const renderDelta = (delta: number | null, base: number | null) =>
    delta != null ? (
      <Delta
        value={delta}
        baseValue={base}
        periodLabel={periodLabel}
        layout="stacked"
        locale={locale}
        currency={currency}
        isPrivate={isPrivate}
        className="mt-2 text-xs"
      />
    ) : undefined;

  if (view === 'group') {
    if (!groupStats.length) return <EmptyGroupsState />;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groupStats.map(({ group, value, prevValue }, i) => {
          const color = groupColor(group);
          return (
            <StatCard
              key={group.name}
              accentColor={color}
              head={{ dot: true, label: group.name }}
              value={value}
              valueNegative={value < 0}
              spark={<Sparkline series={groupSparks[i]} color={color} className="mt-3 w-full" height={56} />}
              delta={renderDelta(prevValue != null ? value - prevValue : null, prevValue)}
            />
          );
        })}
      </div>
    );
  }

  // Category view
  const cards = effectiveCats
    .filter(cat => byCategory[cat.id] != null)
    .map(cat => {
      const val = byCategory[cat.id];
      const prev = prevByCategory?.[cat.id] ?? null;
      const color = catColorVar(cat.id);
      return (
        <StatCard
          key={cat.id}
          accentColor={color}
          head={{ dot: true, label: tr(cat) }}
          value={val}
          valueNegative={cat.kind === 'debt'}
          spark={<Sparkline series={catSparks[cat.id] ?? []} color={color} className="mt-3 w-full" height={56} />}
          delta={renderDelta(prev != null ? val - prev : null, prev)}
        />
      );
    });

  // Equity card (category view)
  if (equityValue != null && equityValue > 0) {
    const color = catColorVar('equity');
    cards.push(
      <StatCard
        key="equity"
        accentColor={color}
        head={{ dot: true, label: t('equity_label') }}
        value={equityValue}
        spark={<Sparkline series={equitySpark} color={color} className="mt-3 w-full" height={56} />}
        delta={renderDelta(prevEquityValue != null ? equityValue - prevEquityValue : null, prevEquityValue ?? 0)}
      />,
    );
  }

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{cards}</div>;
}
