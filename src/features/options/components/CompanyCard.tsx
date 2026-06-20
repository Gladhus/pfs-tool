import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { privShares } from '@/shared/utils/privacy';
import { Amount } from '@/shared/ui/Amount';
import { fmtMonth } from '@/shared/utils/dates';
import {
  computeVestedShares, computeIntrinsicValue,
  grantFirstVestDate, exercisableShares, exercisedSharesForGrant,
} from '@/shared/utils/options';
import { companyEquitySummary } from '@/features/options/data/equity.selectors';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import { Tooltip } from '@/shared/ui/Tooltip';
import { CompanyValueChart } from './CompanyValueChart';
import { CompanyVestingChart } from './CompanyVestingChart';
import { COMPANY_COLORS, GRANT_COLORS } from './charts';
import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise, Currency } from '@/types/sheets';

interface Props {
  company: OptionCompany;
  index: number;
  grants: OptionGrant[];
  fmv: OptionFmv[];
  exercises: OptionExercise[];
  now: string;
  locale: string;
  currency: Currency;
  isPrivate: boolean;
}

export function CompanyCard({ company, index, grants, fmv, exercises, now, locale, currency, isPrivate }: Props) {
  const { t } = useTranslation();
  const [openExercises, setOpenExercises] = useState<Record<string, boolean>>({});
  const [chartView, setChartView] = useState<'vesting' | 'value'>('vesting');

  // Memoized so the per-company charts don't recreate on unrelated parent re-renders (e.g. period change).
  const { cGrants, fmvVal, vestedShares, unvestedShares, vestedVal, unvestedVal, hasFmvHistory } = useMemo(
    () => companyEquitySummary(company, grants, fmv, exercises, now),
    [company, grants, fmv, exercises, now],
  );
  const color = COMPANY_COLORS[index % COMPANY_COLORS.length];

  return (
    <div className="rounded-xl bg-surface-1 p-4 shadow-sm" style={{ borderTop: `3px solid ${color}` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <strong className="text-fg">{company.name}</strong>
            {company.ticker && <span className="text-xs text-muted">{company.ticker}</span>}
          </div>
          <div className="mt-1 text-xs">
            {fmvVal !== null ? (
              <span className="text-fg-2">
                {t('opt_last_fmv')} <Amount value={fmvVal} currency={currency} sensitive={false} />
                <span className="ml-1 text-muted">{fmtMonth(fmvEntry!.date.slice(0, 7), { locale, style: 'short' })}</span>
              </span>
            ) : (
              <span className="text-muted">{t('opt_no_fmv')}</span>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="tabular-nums text-fg">
            {privShares(vestedShares, isPrivate)} <span className="text-xs text-muted">{t('opt_shares_vested')}</span>
          </div>
          <div className="tabular-nums text-muted">
            {privShares(unvestedShares, isPrivate)} <span className="text-xs">{t('opt_shares_unvested')}</span>
          </div>
          {vestedVal !== null && (
            <div className="mt-1 tabular-nums text-fg">
              <Amount value={vestedVal} currency={currency} />
              {unvestedVal !== null && <span className="text-muted"> / <Amount value={vestedVal + unvestedVal} currency={currency} /></span>}
            </div>
          )}
        </div>
      </div>

      {/* Chart with vesting / value toggle */}
      {cGrants.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-end">
            <SegmentControl<'vesting' | 'value'>
              options={[
                { value: 'vesting', label: t('opt_pill_vesting') },
                { value: 'value', label: t('opt_pill_value') },
              ]}
              value={chartView}
              onChange={setChartView}
              aria-label={t('opt_value_over_time')}
            />
          </div>
          {chartView === 'vesting' ? (
            <CompanyVestingChart grants={cGrants} now={now} locale={locale} isPrivate={isPrivate} />
          ) : hasFmvHistory ? (
            <CompanyValueChart
              company={company} grants={cGrants} fmv={fmv} exercises={exercises}
              color={color} now={now} locale={locale} currency={currency} isPrivate={isPrivate}
            />
          ) : (
            <p className="py-8 text-center text-xs text-muted">{t('opt_no_fmv_history')}</p>
          )}
        </div>
      )}

      {/* Grants */}
      <div className="mt-3 space-y-3">
        {cGrants.length === 0 && <p className="text-sm text-muted">{t('opt_no_grants')}</p>}
        {cGrants.map((grant, gi) => {
          const gColor = GRANT_COLORS[gi % GRANT_COLORS.length];
          const vested = computeVestedShares(grant, now);
          const exercised = exercisedSharesForGrant(exercises, grant.id, now);
          const exercisable = exercisableShares(grant, exercises, now);
          const total = Number(grant.total_shares) || 0;
          const pct = total ? Math.min(100, (vested / total) * 100) : 0;
          const vestVal = fmvVal !== null ? computeIntrinsicValue(grant, exercises, fmvVal, now) : null;
          const fullyVested = vested >= total;
          const firstVest = grantFirstVestDate(grant);
          const cliffPending = !fullyVested && firstVest && firstVest > now;
          const cliffMonths = cliffPending
            ? Math.ceil((new Date(firstVest + 'T12:00:00').getTime() - new Date(now + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24 * 30.44))
            : 0;

          const metaLeft = cliffPending
            ? t('opt_cliff_pending', { months: cliffMonths })
            : (fullyVested && exercised === 0)
              ? t('opt_fully_vested')
              : (
                <>
                  {privShares(vested, isPrivate)}
                  {exercised > 0 && (
                    <>
                      {' ('}
                      <Tooltip content={t('opt_exercisable_tip')}>
                        <span className="cursor-help underline decoration-dotted">
                          {privShares(exercisable, isPrivate)}
                        </span>
                      </Tooltip>
                      {')'}
                    </>
                  )}
                  {` / ${privShares(total, isPrivate)} ${t('opt_shares_vested')}`}
                </>
              );

          const grantExercises = exercises
            .filter(e => e.grant_id === grant.id)
            .sort((a, b) => a.date.localeCompare(b.date));
          const isOpen = openExercises[grant.id];

          return (
            <div key={grant.id} className="rounded-lg bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gColor }} />
                <span className="text-sm font-medium text-fg">{grant.label || grant.grant_type || 'Grant'}</span>
                {grant.grant_type && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-muted">{grant.grant_type}</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={pct} className="flex-1" />
                <span className="text-xs tabular-nums text-muted">{Math.round(pct)}%</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-fg-2">{metaLeft}</span>
                {vestVal !== null && <span className="tabular-nums text-fg"><Amount value={vestVal} currency={currency} /></span>}
              </div>

              {grantExercises.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="text-xs text-fg-2 hover:text-fg"
                    onClick={() => setOpenExercises(s => ({ ...s, [grant.id]: !s[grant.id] }))}
                  >
                    {isOpen ? '▾' : '▸'} {t('opt_exercises_label')} · {t('opt_exercises_count', { count: grantExercises.length })}
                  </button>
                  {isOpen && (
                    <div className="mt-1 space-y-1">
                      {grantExercises.map(ex => (
                        <div key={ex.id} className="flex items-center gap-2 text-xs text-muted">
                          <span>{ex.date}</span>
                          <span className="tabular-nums">{privShares(Number(ex.shares_exercised) || 0, isPrivate)} {t('opt_shares_exercised_suffix')}</span>
                          <span className="tabular-nums">@ <Amount value={Number(ex.price_paid) || 0} currency={currency} sensitive={false} /></span>
                          {ex.note && <span className="truncate">{ex.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
