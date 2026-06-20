import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/shared/stores/ui.store';
import {
  useOptionCompaniesQuery, useOptionGrantsQuery,
  useOptionFmvQuery, useOptionExercisesQuery,
  useConfigQuery, useFxRatesQuery,
} from '@/shared/io/queries/sheetQueries';
import { equityTotals } from '@/features/options/data/equity.selectors';
import { fxMap as buildFxMap } from '@/shared/utils/currency';
import { todayISO } from '@/shared/utils/dates';
import { ownerVisibleToViewer } from '@/shared/utils/ownership';
import type { Currency } from '@/types/sheets';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Amount } from '@/shared/ui/Amount';
import { Delta } from '@/shared/ui/Delta';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PeriodPills, APP_PERIODS, type Period } from '@/shared/ui/PeriodPills';
import { ChipToggle } from '@/shared/ui/ChipToggle';
import { SummaryChart } from './components/SummaryChart';
import { CompanyCard } from './components/CompanyCard';
import { COMPANY_COLORS } from './components/charts';

export default function OptionsPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const locale = lang === 'fr' ? 'fr' : 'en';
  const privateMode = useUIStore(s => s.privateMode);
  const currentViewer = useUIStore(s => s.currentViewer);
  const now = todayISO();

  const configQ = useConfigQuery();
  const fxRatesQ = useFxRatesQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const currency = mainCurrency;
  const fxRateMap = useMemo(() => buildFxMap(fxRatesQ.data ?? []), [fxRatesQ.data]);

  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as Period) ?? 'all';
  const onPeriodChange = (p: Period) =>
    setSearchParams(prev => { prev.set('period', p); return prev; });

  const companiesQ = useOptionCompaniesQuery();
  const grantsQ = useOptionGrantsQuery();
  const fmvQ = useOptionFmvQuery();
  const exercisesQ = useOptionExercisesQuery();

  const companies = useMemo(
    () => (companiesQ.data ?? []).filter(c => c.active !== false && ownerVisibleToViewer(c.owner, currentViewer)),
    [companiesQ.data, currentViewer],
  );
  const grants = useMemo(() => grantsQ.data ?? [], [grantsQ.data]);
  const fmv = useMemo(() => fmvQ.data ?? [], [fmvQ.data]);
  const exercises = useMemo(() => exercisesQ.data ?? [], [exercisesQ.data]);

  const isPending = companiesQ.isPending || grantsQ.isPending || fmvQ.isPending;
  const hasFmv = fmv.length > 0;

  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const hiddenIds = useMemo(
    () => new Set(Object.entries(hidden).filter(([, v]) => v).map(([k]) => k)),
    [hidden],
  );

  const { totalVested, totalUnvested, periodStart, delta } = useMemo(
    () => equityTotals(companies, grants, fmv, exercises, now, period, mainCurrency, fxRateMap),
    [companies, grants, fmv, exercises, now, period, mainCurrency, fxRateMap],
  );
  const periodLabel = t(`period_long_${period}`);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" className="h-64" />
        <Skeleton variant="card" className="h-40" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="trendingUp" size={28} />}
        title={t('opt_no_companies')}
        description={t('opt_no_companies_hint')}
        action={<Button variant="primary" size="sm" asChild><Link to="/options/manage">{t('opt_add_company')}</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="rounded-xl bg-surface-1 shadow-sm p-5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t('equity_label')}</p>
            <div className="mt-1 text-4xl md:text-5xl font-bold text-fg tabular-nums leading-tight">
              <Amount value={totalVested} />
            </div>
            {delta != null && (
              <Delta
                value={delta}
                baseValue={vestedStart}
                layout="inline"
                locale={locale}
                currency={currency}
                isPrivate={privateMode}
                className="mt-1 text-sm md:text-base font-semibold"
              />
            )}
            <div className="mt-1 text-sm text-fg-2">{periodLabel}</div>
            <div className="text-xs text-muted">
              {t('opt_unvested_label')}: <Amount value={totalUnvested} />
            </div>
          </div>
          <div className="hidden md:block max-w-full shrink-0 overflow-x-auto no-scrollbar">
            <PeriodPills value={period} onChange={onPeriodChange} options={APP_PERIODS} />
          </div>
        </div>

        {hasFmv && (
          <>
            {/* Company legend */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1" role="group">
              {companies.map((c, i) => {
                const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
                return (
                  <ChipToggle
                    key={c.id}
                    label={c.ticker ? `${c.name} (${c.ticker})` : c.name}
                    color={color}
                    active={!hidden[c.id]}
                    onToggle={() => setHidden(h => ({ ...h, [c.id]: !hidden[c.id] }))}
                  />
                );
              })}
            </div>

            <SummaryChart
              companies={companies}
              grants={grants}
              fmv={fmv}
              exercises={exercises}
              now={now}
              locale={locale}
              currency={currency}
              isPrivate={privateMode}
              fromDate={periodStart ?? undefined}
              hiddenIds={hiddenIds}
              main={mainCurrency}
              fxMap={fxRateMap}
            />
          </>
        )}

        {/* Mobile: period pills at the bottom of the card */}
        <div className="md:hidden">
          <PeriodPills value={period} onChange={onPeriodChange} options={APP_PERIODS} responsive />
        </div>
      </div>

      {/* Company cards */}
      <div className="space-y-4">
        {companies.map((company, i) => (
          <CompanyCard
            key={company.id}
            company={company}
            index={i}
            grants={grants}
            fmv={fmv}
            exercises={exercises}
            now={now}
            locale={locale}
            currency={company.currency ?? mainCurrency}
            isPrivate={privateMode}
          />
        ))}
      </div>
    </div>
  );
}
