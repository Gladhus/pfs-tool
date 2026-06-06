import { useMemo } from 'react';
import type { Account, CategoryMeta, Group } from '@/types/sheets';
import { StatCard } from '@/ui/StatCard';
import { Delta } from '@/ui/Delta';
import { Sparkline } from './Sparkline';
import { EmptyGroupsState } from './EmptyGroupsState';
import { foldCategoryId, accountMatchesGroup, groupColor } from '@/utils/colors';
import { categoryIcon } from '@/utils/icons';
import { tr } from '@/i18n';
import { useTranslation } from 'react-i18next';

// Inline SVG for equity — no icon glyph in the set
const EQUITY_SVG = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

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
  equityValue?: number;
  prevEquityValue?: number | null;
  period: string;
  locale: string;
  currency: string;
  isPrivate: boolean;
}

function buildCategorySpark(
  catId: string,
  accounts: Account[],
  sparkDates: string[],
  sweepForSpark: Record<string, number>[],
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return sweepForSpark.map(balances => {
    let total = 0;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || foldCategoryId(a.category) !== catId) continue;
      total += balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
    }
    return total;
  });
}

function buildGroupSpark(
  group: Group,
  accounts: Account[],
  sweepForSpark: Record<string, number>[],
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return sweepForSpark.map(balances => {
    let total = 0;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || !accountMatchesGroup(a, group)) continue;
      total += balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
    }
    return total;
  });
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
  equityValue,
  prevEquityValue,
  period,
  locale,
  currency,
  isPrivate,
}: Props) {
  const { t } = useTranslation();
  const periodLabel = t(`period_${period.toLowerCase()}`);

  const catSparks = useMemo(() =>
    effectiveCats.reduce<Record<string, number[]>>((acc, cat) => {
      acc[cat.id] = buildCategorySpark(cat.id, accounts, sparkDates, sweepForSpark);
      return acc;
    }, {}),
    [effectiveCats, accounts, sparkDates, sweepForSpark],
  );

  const groupSparks = useMemo(() =>
    groupStats.map(({ group }) => buildGroupSpark(group, accounts, sweepForSpark)),
    [groupStats, accounts, sweepForSpark],
  );

  if (view === 'group') {
    if (!groupStats.length) return <EmptyGroupsState />;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {groupStats.map(({ group, value, prevValue }, i) => {
          const delta = prevValue != null ? value - prevValue : null;
          return (
            <StatCard
              key={group.name}
              groupColor={groupColor(group)}
              head={{ dot: true, label: group.name }}
              value={value}
              valueNegative={value < 0}
              locale={locale}
              currency={currency}
              isPrivate={isPrivate}
              spark={
                <Sparkline
                  series={groupSparks[i]}
                  className="mt-1 w-full"
                  width={120}
                  height={28}
                />
              }
              delta={
                delta != null ? (
                  <Delta
                    value={delta}
                    baseValue={prevValue}
                    periodLabel={periodLabel}
                    layout="stacked"
                    locale={locale}
                    currency={currency}
                    isPrivate={isPrivate}
                    className="text-xs mt-0.5"
                  />
                ) : undefined
              }
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
      const delta = prev != null ? val - prev : null;
      return (
        <StatCard
          key={cat.id}
          head={{ iconKey: categoryIcon(cat.id), label: tr(cat) }}
          value={val}
          valueNegative={cat.kind === 'debt'}
          locale={locale}
          currency={currency}
          isPrivate={isPrivate}
          spark={
            <Sparkline
              series={catSparks[cat.id] ?? []}
              className="mt-1 w-full"
              width={120}
              height={28}
            />
          }
          delta={
            delta != null ? (
              <Delta
                value={delta}
                baseValue={prev}
                periodLabel={periodLabel}
                layout="stacked"
                locale={locale}
                currency={currency}
                isPrivate={isPrivate}
                className="text-xs mt-0.5"
              />
            ) : undefined
          }
        />
      );
    });

  // Equity card
  if (equityValue != null && equityValue > 0) {
    const delta = prevEquityValue != null ? equityValue - prevEquityValue : null;
    cards.push(
      <StatCard
        key="equity"
        head={{ label: t('equity_label') }}
        value={equityValue}
        locale={locale}
        currency={currency}
        isPrivate={isPrivate}
        spark={
          <span className="mt-1 flex items-center justify-center">{EQUITY_SVG}</span>
        }
        delta={
          delta != null ? (
            <Delta
              value={delta}
              baseValue={prevEquityValue ?? 0}
              periodLabel={periodLabel}
              layout="stacked"
              locale={locale}
              currency={currency}
              isPrivate={isPrivate}
              className="text-xs mt-0.5"
            />
          ) : undefined
        }
      />,
    );
  }

  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards}</div>;
}
