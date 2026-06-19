import { useMemo } from 'react';
import type { Account, CategoryMeta, Group } from '@/types/sheets';
import { StatCard } from '@/ui/StatCard';
import { Delta } from '@/ui/Delta';
import { Sparkline } from './Sparkline';
import { EmptyGroupsState } from './EmptyGroupsState';
import type { PersonStat } from '../hooks/useOverviewStats';
import type { EquityData } from '@/core/options/selectors';
import { groupColor } from '@/utils/colors';
import { categoryKey } from '@/utils/icons';
import { LEGACY_SELF_ID } from '@/utils/ownership';
import { categorySparkline, groupSparkline, personSparkline, equitySparkline } from '@/core/sparklines';
import type { Currency } from '@/types/sheets';
import { tr } from '@/i18n';
import { useTranslation } from 'react-i18next';

interface GroupStat {
  group: Group;
  value: number;
  prevValue: number | null;
}

interface Props {
  view: 'category' | 'group' | 'person';
  effectiveCats: CategoryMeta[];
  byCategory: Record<string, number>;
  prevByCategory: Record<string, number> | null;
  groupStats: GroupStat[];
  personStats: PersonStat[];
  accounts: Account[];
  sparkDates: string[];
  sweepForSpark: Record<string, number>[];
  optionData?: EquityData;
  main: Currency;
  fxMap: Map<string, number>;
  viewer?: string;
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

export function StatCardGrid({
  view,
  effectiveCats,
  byCategory,
  prevByCategory,
  groupStats,
  personStats,
  accounts,
  sparkDates,
  sweepForSpark,
  optionData,
  main,
  fxMap,
  viewer = LEGACY_SELF_ID,
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
      acc[cat.id] = categorySparkline(cat.id, accounts, sweepForSpark, sparkDates, main, fxMap, viewer);
      return acc;
    }, {}),
    [effectiveCats, accounts, sweepForSpark, sparkDates, main, fxMap, viewer],
  );

  const groupSparks = useMemo(() =>
    groupStats.map(({ group }) => groupSparkline(group, accounts, sweepForSpark, sparkDates, main, fxMap, optionData, viewer)),
    [groupStats, accounts, sweepForSpark, sparkDates, main, fxMap, optionData, viewer],
  );

  const personSparks = useMemo(() =>
    personStats.map(({ person }) => personSparkline(person.id, accounts, sweepForSpark, sparkDates, main, fxMap, optionData)),
    [personStats, accounts, sweepForSpark, sparkDates, main, fxMap, optionData],
  );

  const equitySpark = useMemo(
    () => equitySparkline(optionData, sparkDates, main, fxMap, viewer),
    [optionData, sparkDates, main, fxMap, viewer],
  );

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

  if (view === 'person') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {personStats.map(({ person, color, value, prevValue }, i) => (
          <StatCard
            key={person.id}
            accentColor={color}
            head={{ dot: true, label: person.name || person.id }}
            value={value}
            valueNegative={value < 0}
            spark={<Sparkline series={personSparks[i]} color={color} className="mt-3 w-full" height={56} />}
            delta={renderDelta(prevValue != null ? value - prevValue : null, prevValue)}
          />
        ))}
      </div>
    );
  }

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
