import { useMemo } from 'react';
import {
  useSpendingCategoriesQuery, useSpendingsQuery, useSpendingRecurrencesQuery,
  usePeopleQuery, useConfigQuery, useFxRatesQuery,
} from '@/shared/io/queries/sheetQueries';
import { useUIStore } from '@/shared/stores/ui.store';
import { fxMap, rateFor } from '@/shared/utils/currency';
import type { Currency } from '@/types/sheets';
import type { SpendingCtx } from './spending.selectors';

/** One-stop loader + context builder for the spending pages. */
export function useSpendingData() {
  const categoriesQ = useSpendingCategoriesQuery();
  const spendingsQ = useSpendingsQuery();
  const recurrencesQ = useSpendingRecurrencesQuery();
  const peopleQ = usePeopleQuery();
  const configQ = useConfigQuery();
  const fxQ = useFxRatesQuery();
  const viewer = useUIStore(s => s.currentViewer);

  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';

  const ctx: SpendingCtx = useMemo(() => {
    const map = fxMap(fxQ.data ?? []);
    return { main: mainCurrency, fxRateFor: (date: string) => rateFor(map, date) };
  }, [fxQ.data, mainCurrency]);

  return {
    categories: categoriesQ.data ?? [],
    spendings: spendingsQ.data ?? [],
    recurrences: recurrencesQ.data ?? [],
    people: peopleQ.data ?? [],
    mainCurrency,
    ctx,
    viewer,
    isPending: categoriesQ.isPending || spendingsQ.isPending || recurrencesQ.isPending,
  };
}
