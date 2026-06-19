import { useQuery } from '@tanstack/react-query';
import { useDatasourceStore } from '@/stores/datasource.store';
import type { Datasource } from '@/datasource/types';
import { qk } from './keys';
import { loadCategoryMeta, loadAccountTypes } from '@/api/accounts';

const STALE_5M = 5 * 60_000;

function useDatasource() {
  return useDatasourceStore(s => s.datasource);
}

/**
 * Shared wiring for every datasource-backed query: keys the cache by the active
 * datasource id, only runs once a datasource exists, and forwards the loader.
 * `extraEnabled` lets callers gate on additional conditions (e.g. a feature flag).
 */
function useDatasourceQuery<T>(
  keyFor: (id: string) => readonly unknown[],
  load: (ds: Datasource) => Promise<T>,
  opts: { staleTime?: number; extraEnabled?: boolean } = {},
) {
  const ds = useDatasource();
  return useQuery({
    queryKey: keyFor(ds?.id ?? ''),
    queryFn: () => load(ds!),
    enabled: !!ds && (opts.extraEnabled ?? true),
    staleTime: opts.staleTime,
  });
}

export function useAccountsQuery() {
  return useDatasourceQuery(qk.accounts, ds => ds.loadAccounts(), { staleTime: STALE_5M });
}

export function useSnapshotsQuery() {
  return useDatasourceQuery(qk.snapshots, ds => ds.loadSnapshots(), { staleTime: STALE_5M });
}

export function useCategoryMetaQuery() {
  return useQuery({
    queryKey: qk.categoryMeta(),
    queryFn: loadCategoryMeta,
    staleTime: Infinity,
  });
}

export function useAccountTypesQuery() {
  return useQuery({
    queryKey: qk.accountTypes(),
    queryFn: loadAccountTypes,
    staleTime: Infinity,
  });
}

export function useFxRatesQuery() {
  return useDatasourceQuery(qk.fxRates, ds => ds.loadFxRates(), { staleTime: STALE_5M });
}

export function useConfigQuery() {
  return useDatasourceQuery(qk.config, ds => ds.loadConfig());
}

export function useTagsQuery() {
  return useDatasourceQuery(qk.tags, ds => ds.loadTags());
}

export function useGroupsQuery() {
  return useDatasourceQuery(qk.groups, ds => ds.loadGroups());
}

export function usePeopleQuery() {
  return useDatasourceQuery(qk.people, ds => ds.loadPeople());
}

function useOptionsEnabled() {
  const configQuery = useConfigQuery();
  return configQuery.isSuccess && configQuery.data?.stock_options_enabled === true;
}

export function useOptionCompaniesQuery() {
  return useDatasourceQuery(qk.optCompanies, ds => ds.loadOptionCompanies(), { extraEnabled: useOptionsEnabled() });
}

export function useOptionGrantsQuery() {
  return useDatasourceQuery(qk.optGrants, ds => ds.loadOptionGrants(), { extraEnabled: useOptionsEnabled() });
}

export function useOptionFmvQuery() {
  return useDatasourceQuery(qk.optFmv, ds => ds.loadOptionFmv(), { extraEnabled: useOptionsEnabled() });
}

export function useOptionExercisesQuery() {
  return useDatasourceQuery(qk.optExercises, ds => ds.loadOptionExercises(), { extraEnabled: useOptionsEnabled() });
}
