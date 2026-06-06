import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import {
  useOptionCompaniesQuery, useOptionGrantsQuery,
  useOptionFmvQuery, useOptionExercisesQuery,
  useConfigQuery, useFxRatesQuery,
} from '@/queries/sheetQueries';
import { computeCompanyEquityValue, computeCompanyUnvestedValue, generateMonthlyDates } from '@/utils/options';
import { fxMap as buildFxMap, toMain, rateFor } from '@/utils/currency';
import { getDatesForPeriod, todayISO } from '@/utils/dates';
import type { Currency } from '@/types/sheets';
import { Skeleton } from '@/ui/Skeleton';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Amount } from '@/ui/Amount';
import { Delta } from '@/ui/Delta';
import { EmptyState } from '@/ui/EmptyState';
import { PeriodPills, APP_PERIODS, type Period } from '@/ui/PeriodPills';
import { ChipToggle } from '@/ui/ChipToggle';
import { SummaryChart } from './components/SummaryChart';
import { CompanyCard } from './components/CompanyCard';
import { COMPANY_COLORS } from './components/charts';

export default function OptionsPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const locale = lang === 'fr' ? 'fr' : 'en';
  const privateMode = useUIStore(s => s.privateMode);
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

  const companies = useMemo(() => (companiesQ.data ?? []).filter(c => c.active !== false), [companiesQ.data]);
  const grants = grantsQ.data ?? [];
  const fmv = useMemo(() => fmvQ.data ?? [], [fmvQ.data]);
  const exercises = exercisesQ.data ?? [];

  const isPending = companiesQ.isPending || grantsQ.isPending || fmvQ.isPending;
  const hasFmv = fmv.length > 0;

  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const hiddenIds = useMemo(
    () => new Set(Object.entries(hidden).filter(([, v]) => v).map(([k]) => k)),
    [hidden],
  );

  // Each company's equity is in its own currency → convert to main before summing.
  const equityAt = (date: string, kind: 'vested' | 'unvested') => {
    const usdCad = rateFor(fxRateMap, date);
    return companies.reduce((s, c) => {
      if (c.active === false) return s;
      const v = kind === 'vested'
        ? computeCompanyEquityValue(c.id, grants, fmv, exercises, date)
        : computeCompanyUnvestedValue(c.id, grants, fmv, date);
      return s + toMain(v, c.currency ?? mainCurrency, mainCurrency, usdCad);
    }, 0);
  };

  const totalVested = useMemo(
    () => equityAt(now, 'vested'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, grants, fmv, exercises, now, mainCurrency, fxRateMap],
  );
  const totalUnvested = useMemo(
    () => equityAt(now, 'unvested'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, grants, fmv, now, mainCurrency, fxRateMap],
  );

  // Period → delta of vested value vs the start of the selected range.
  const periodStart = useMemo(() => {
    if (!fmv.length) return null;
    const firstFmv = [...fmv.map(f => f.date)].sort()[0];
    const filtered = getDatesForPeriod(generateMonthlyDates(firstFmv, now), period);
    return filtered.length ? filtered[0] : null;
  }, [fmv, now, period]);

  const vestedStart = useMemo(
    () => (periodStart ? equityAt(periodStart, 'vested') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodStart, companies, grants, fmv, exercises, mainCurrency, fxRateMap],
  );
  const delta = vestedStart != null ? totalVested - vestedStart : null;
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
          <PeriodPills value={period} onChange={onPeriodChange} options={APP_PERIODS} block />
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
