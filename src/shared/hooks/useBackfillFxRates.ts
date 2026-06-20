import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useFxRatesQuery } from '@/shared/io/queries/sheetQueries';
import { qk } from '@/shared/io/queries/keys';
import { todayISO } from '@/shared/utils/dates';
import { fetchRateRange, writeFxRates } from '@/shared/io/api/fx';
import type { FxRate } from '@/types/sheets';

/**
 * Dense, self-healing FX backfill. Maintains a daily USD→CAD series covering
 * [start, today] in the fx_rates tab. On load it checks the latest persisted rate
 * and fetches forward to today; it also fills a head gap if `start` predates the
 * earliest persisted rate. Each gap is one batched time-series request.
 *
 * @param start    earliest date we convert at (first snapshot/fmv day), or null
 * @param enabled  only run when multi-currency is actually in play
 */
export function useBackfillFxRates(start: string | null, enabled: boolean) {
  const sheetId = useAuthStore(s => s.sheetId);
  const q = useFxRatesQuery();
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || !sheetId || !start || !q.isSuccess || running.current) return;

    const rates = q.data ?? [];
    const dates = rates.map(r => r.date).sort();
    const today = todayISO();

    // Determine the gap ranges to fetch: a head gap before the earliest stored rate,
    // and a tail gap from the latest stored rate up to today.
    const gaps: [string, string][] = [];
    if (!dates.length) {
      gaps.push([start, today]);
    } else {
      const first = dates[0];
      const last = dates[dates.length - 1];
      if (start < first) gaps.push([start, first]);
      if (last < today) gaps.push([last, today]);
    }
    if (!gaps.length) return;

    running.current = true;
    void (async () => {
      try {
        const fetched: FxRate[] = [];
        for (const [s, e] of gaps) fetched.push(...await fetchRateRange(s, e));
        if (fetched.length) {
          const byDate = new Map(rates.map(r => [r.date, r]));
          for (const r of fetched) byDate.set(r.date, r);
          const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
          if (merged.length !== rates.length) {
            await writeFxRates(sheetId, merged, rates.length);
            qc.setQueryData(qk.fxRates(sheetId), merged);
          }
        }
      } catch {
        /* leave it; next load retries */
      } finally {
        running.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sheetId, start, q.isSuccess, q.data]);
}
