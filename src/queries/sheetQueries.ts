import { useQuery } from '@tanstack/react-query';
import { useDatasourceStore } from '@/stores/datasource.store';
import { qk } from './keys';
import { loadCategoryMeta, loadAccountTypes } from '@/api/accounts';

const STALE_5M = 5 * 60_000;

function useDatasource() {
  return useDatasourceStore(s => s.datasource);
}

export function useAccountsQuery() {
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.accounts(ds?.id ?? ''),
    queryFn: () => ds!.loadAccounts(),
    enabled: !!ds,
    staleTime: STALE_5M,
  });
}

export function useSnapshotsQuery() {
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.snapshots(ds?.id ?? ''),
    queryFn: () => ds!.loadSnapshots(),
    enabled: !!ds,
    staleTime: STALE_5M,
  });
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
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.fxRates(ds?.id ?? ''),
    queryFn: () => ds!.loadFxRates(),
    enabled: !!ds,
    staleTime: STALE_5M,
  });
}

export function useConfigQuery() {
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.config(ds?.id ?? ''),
    queryFn: () => ds!.loadConfig(),
    enabled: !!ds,
  });
}

export function useTagsQuery() {
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.tags(ds?.id ?? ''),
    queryFn: () => ds!.loadTags(),
    enabled: !!ds,
  });
}

export function useGroupsQuery() {
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.groups(ds?.id ?? ''),
    queryFn: () => ds!.loadGroups(),
    enabled: !!ds,
  });
}

export function usePeopleQuery() {
  const ds = useDatasource();
  return useQuery({
    queryKey: qk.people(ds?.id ?? ''),
    queryFn: () => ds!.loadPeople(),
    enabled: !!ds,
  });
}

function useOptionsEnabled() {
  const configQuery = useConfigQuery();
  return configQuery.isSuccess && configQuery.data?.stock_options_enabled === true;
}

export function useOptionCompaniesQuery() {
  const ds = useDatasource();
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optCompanies(ds?.id ?? ''),
    queryFn: () => ds!.loadOptionCompanies(),
    enabled: enabled && !!ds,
  });
}

export function useOptionGrantsQuery() {
  const ds = useDatasource();
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optGrants(ds?.id ?? ''),
    queryFn: () => ds!.loadOptionGrants(),
    enabled: enabled && !!ds,
  });
}

export function useOptionFmvQuery() {
  const ds = useDatasource();
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optFmv(ds?.id ?? ''),
    queryFn: () => ds!.loadOptionFmv(),
    enabled: enabled && !!ds,
  });
}

export function useOptionExercisesQuery() {
  const ds = useDatasource();
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optExercises(ds?.id ?? ''),
    queryFn: () => ds!.loadOptionExercises(),
    enabled: enabled && !!ds,
  });
}
