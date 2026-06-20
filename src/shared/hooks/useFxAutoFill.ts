import { useMemo } from 'react';
import {
  useAccountsQuery, useSnapshotsQuery, useConfigQuery,
  useOptionCompaniesQuery, useOptionFmvQuery,
} from '@/shared/io/queries/sheetQueries';
import { deriveDatesSorted } from '@/shared/utils/dates';
import { useBackfillFxRates } from './useBackfillFxRates';

/**
 * Finds the earliest date the app will ever convert at (first snapshot day or first
 * FMV day) and keeps a dense daily FX series from there to today — but only when
 * multi-currency is actually in play (some account/company differs from main).
 */
export function useFxAutoFill() {
  const snapshotsData = useSnapshotsQuery().data;
  const fmvData = useOptionFmvQuery().data;
  const accounts = useAccountsQuery().data ?? [];
  const companies = useOptionCompaniesQuery().data ?? [];
  const main = useConfigQuery().data?.currency === 'USD' ? 'USD' : 'CAD';

  const active =
    accounts.some(a => a.currency && a.currency !== main) ||
    companies.some(c => c.currency && c.currency !== main);

  const start = useMemo(() => {
    if (!active) return null;
    const candidates: string[] = [];
    const snapDates = deriveDatesSorted(snapshotsData ?? []);
    if (snapDates.length) candidates.push(snapDates[0]);
    const fmv = fmvData ?? [];
    if (fmv.length) candidates.push([...fmv.map(f => f.date)].sort()[0]);
    return candidates.length ? candidates.sort()[0] : null;
  }, [active, snapshotsData, fmvData]);

  useBackfillFxRates(start, active);
}
