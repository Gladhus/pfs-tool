import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise, Currency } from '@/types/sheets';
import {
  computeVestedShares, computeUnvestedShares, computeIntrinsicValue, computeUnvestedValue,
  computeCompanyEquityValue, computeCompanyUnvestedValue,
  getEffectiveFmv, grantFullyVestedDate, generateMonthlyDates,
} from '@/shared/utils/options';
import { toMain, rateFor } from '@/shared/utils/currency';
import { getDatesForPeriod } from '@/shared/utils/dates';

/**
 * Stock-Options domain selectors. Pure data for the Options page; the components
 * render what these return and compute nothing themselves. Equity detail (vested
 * vs unvested shares, vesting schedules) lives here — shapes the net-worth Dataset
 * can't express — beside the `equityContributor` that feeds Overview.
 */

/** The four option tables, bundled — the equity domain's raw input shape. */
export interface EquityData {
  companies: OptionCompany[];
  grants: OptionGrant[];
  fmv: OptionFmv[];
  exercises: OptionExercise[];
}

/** Per-company headline numbers for a card, as of `now`. */
export function companyEquitySummary(
  company: OptionCompany,
  grants: OptionGrant[],
  fmv: OptionFmv[],
  exercises: OptionExercise[],
  now: string,
) {
  const cGrants = grants.filter(g => g.company_id === company.id);
  const fmvEntry = getEffectiveFmv(fmv, company.id, now);
  const fmvVal = fmvEntry?.fmv ?? null;
  return {
    cGrants,
    fmvVal,
    vestedShares: cGrants.reduce((s, g) => s + computeVestedShares(g, now), 0),
    unvestedShares: cGrants.reduce((s, g) => s + computeUnvestedShares(g, now), 0),
    vestedVal: fmvVal !== null ? cGrants.reduce((s, g) => s + computeIntrinsicValue(g, exercises, fmvVal, now), 0) : null,
    unvestedVal: fmvVal !== null ? cGrants.reduce((s, g) => s + computeUnvestedValue(g, fmvVal, now), 0) : null,
    hasFmvHistory: fmv.some(f => f.company_id === company.id),
  };
}

/** Vested-shares-over-time series for one company's grants, split past/future at `now`. */
export function buildVestingSeries(grants: OptionGrant[], now: string) {
  const empty = { dates: [] as string[], data: [] as Record<string, number | string | null>[], todayDate: null as string | null, grantValues: [] as number[][] };
  if (!grants.length) return empty;

  const starts = grants.map(g => g.vesting_start || g.grant_date).filter(Boolean).sort();
  const ends = grants.map(g => grantFullyVestedDate(g)).filter((d): d is string => !!d).sort();
  if (!starts.length || !ends.length) return empty;
  if (ends[ends.length - 1] < starts[0]) return empty;

  const startDt = new Date(starts[0] + 'T12:00:00');
  startDt.setMonth(startDt.getMonth() - 1);
  const endDt = new Date(ends[ends.length - 1] + 'T12:00:00');
  endDt.setMonth(endDt.getMonth() + 1);
  const dates = generateMonthlyDates(startDt.toISOString().slice(0, 10), endDt.toISOString().slice(0, 10));
  if (dates.length < 2) return empty;

  let todayIdx = -1;
  for (let i = 0; i < dates.length; i++) if (dates[i] <= now) todayIdx = i;

  const grantValues = grants.map(g => dates.map(d => computeVestedShares(g, d)));

  // g{i} — past solid areas (null after todayIdx); gf{i} — future dashed areas
  // (null before todayIdx). Both include todayIdx so the stacks meet seamlessly.
  const data = dates.map((date, di) => {
    const pt: Record<string, number | string | null> = { date };
    const isPast = todayIdx < 0 ? false : di <= todayIdx;
    const isFuture = todayIdx < 0 ? true : di >= todayIdx;
    grants.forEach((_, gi) => {
      pt[`g${gi}`] = isPast ? grantValues[gi][di] : null;
      pt[`gf${gi}`] = isFuture ? grantValues[gi][di] : null;
    });
    return pt;
  });

  return { dates, data, todayDate: todayIdx >= 0 ? dates[todayIdx] : null, grantValues };
}

/** Vested + total (vested + unvested) value-over-time series for one company. */
export function buildCompanyValueSeries(
  company: OptionCompany,
  grants: OptionGrant[],
  fmv: OptionFmv[],
  exercises: OptionExercise[],
  now: string,
) {
  const empty = { dates: [] as string[], data: [] as { date: string; vested: number | null; total: number | null }[] };
  const history = fmv.filter(f => f.company_id === company.id).sort((a, b) => a.date.localeCompare(b.date));
  if (!history.length) return empty;
  const allDates = generateMonthlyDates(history[0].date, now);
  if (allDates.length < 2) return empty;

  const grantedAt = (d: string) => grants.filter(g => g.grant_date.slice(0, 7) <= d.slice(0, 7));
  const vestedAll = allDates.map(d => {
    const e = getEffectiveFmv(fmv, company.id, d);
    const granted = grantedAt(d);
    if (!e || !granted.length) return null;
    return granted.reduce((s, g) => s + computeIntrinsicValue(g, exercises, e.fmv, d), 0);
  });
  const totalAll = allDates.map((d, i) => {
    const e = getEffectiveFmv(fmv, company.id, d);
    const granted = grantedAt(d);
    if (!e || !granted.length) return null;
    return (vestedAll[i] ?? 0) + granted.reduce((s, g) => s + computeUnvestedValue(g, e.fmv, d), 0);
  });

  let trim = 0;
  while (trim < allDates.length && vestedAll[trim] === null && totalAll[trim] === null) trim++;
  const dates = allDates.slice(trim);
  const vested = vestedAll.slice(trim);
  const total = totalAll.slice(trim);
  if (dates.length < 2) return empty;

  return { dates, data: dates.map((date, di) => ({ date, vested: vested[di], total: total[di] })) };
}

/** Per-company main-currency value series for the multi-company summary chart. */
export function buildSummarySeries(
  companies: OptionCompany[],
  grants: OptionGrant[],
  fmv: OptionFmv[],
  now: string,
  fromDate: string | null,
  hiddenIds: Set<string> | undefined,
  main: Currency,
  fxMap: Map<string, number>,
) {
  const active = companies.filter(c => c.active !== false);
  const shown = active.filter(c => !hiddenIds?.has(c.id));
  const fmvDates = fmv.map(f => f.date).sort();
  const empty = { dates: [] as string[], data: [] as Record<string, number | null | string>[], shown, active };
  if (!shown.length || !fmvDates.length) return empty;

  const start = fromDate && fromDate > fmvDates[0] ? fromDate : fmvDates[0];
  const allDates = generateMonthlyDates(start, now);
  if (allDates.length < 2) return empty;

  const shownValues = shown.map(c => {
    const cGrants = grants.filter(g => g.company_id === c.id);
    return allDates.map(d => {
      const entry = getEffectiveFmv(fmv, c.id, d);
      if (!entry) return null;
      const granted = cGrants.filter(g => g.grant_date.slice(0, 7) <= d.slice(0, 7));
      if (!granted.length) return null;
      const native = granted.reduce((s, g) => s + computeIntrinsicValue(g, [], entry.fmv, d), 0);
      return toMain(native, c.currency ?? main, main, rateFor(fxMap, d));
    });
  });

  let trim = 0;
  while (trim < allDates.length && shownValues.every(v => v[trim] === null)) trim++;
  const dates = allDates.slice(trim);
  const values = shownValues.map(v => v.slice(trim));
  if (dates.length < 2) return empty;

  const data = dates.map((date, di) => {
    const pt: Record<string, number | null | string> = { date };
    shown.forEach((company, ci) => { pt[company.id] = values[ci][di]; });
    return pt;
  });

  return { dates, data, shown, active };
}

/** Total equity value (across companies, converted to main) on a date. */
export function equityValueAt(
  companies: OptionCompany[],
  grants: OptionGrant[],
  fmv: OptionFmv[],
  exercises: OptionExercise[],
  date: string,
  kind: 'vested' | 'unvested',
  main: Currency,
  fxMap: Map<string, number>,
): number {
  const usdCad = rateFor(fxMap, date);
  return companies.reduce((s, c) => {
    if (c.active === false) return s;
    const v = kind === 'vested'
      ? computeCompanyEquityValue(c.id, grants, fmv, exercises, date)
      : computeCompanyUnvestedValue(c.id, grants, fmv, date);
    return s + toMain(v, c.currency ?? main, main, usdCad);
  }, 0);
}

/** Headline totals + period delta for the Options page summary. */
export function equityTotals(
  companies: OptionCompany[],
  grants: OptionGrant[],
  fmv: OptionFmv[],
  exercises: OptionExercise[],
  now: string,
  period: string,
  main: Currency,
  fxMap: Map<string, number>,
) {
  const totalVested = equityValueAt(companies, grants, fmv, exercises, now, 'vested', main, fxMap);
  const totalUnvested = equityValueAt(companies, grants, fmv, exercises, now, 'unvested', main, fxMap);

  let periodStart: string | null = null;
  if (fmv.length) {
    const firstFmv = [...fmv.map(f => f.date)].sort()[0];
    const filtered = getDatesForPeriod(generateMonthlyDates(firstFmv, now), period);
    periodStart = filtered.length ? filtered[0] : null;
  }
  const vestedStart = periodStart ? equityValueAt(companies, grants, fmv, exercises, periodStart, 'vested', main, fxMap) : null;
  const delta = vestedStart != null ? totalVested - vestedStart : null;

  return { totalVested, totalUnvested, periodStart, vestedStart, delta };
}
