import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { qk } from './keys';
import { loadAccounts, loadSnapshots, loadCategoryMeta } from '@/api/accounts';
import { loadConfig } from '@/api/config';
import { loadTagsCatalog } from '@/api/tags';
import { loadGroupsCatalog } from '@/api/groups';
import { loadOptionCompanies, loadOptionGrants, loadOptionFmv, loadOptionExercises } from '@/api/options';

const STALE_5M = 5 * 60_000;

export function useAccountsQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const gapiReady = useAuthStore(s => s.gapiReady);
  return useQuery({
    queryKey: qk.accounts(sheetId ?? ''),
    queryFn: () => loadAccounts(sheetId!),
    enabled: gapiReady && !!sheetId,
    staleTime: STALE_5M,
  });
}

export function useSnapshotsQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const gapiReady = useAuthStore(s => s.gapiReady);
  return useQuery({
    queryKey: qk.snapshots(sheetId ?? ''),
    queryFn: () => loadSnapshots(sheetId!),
    enabled: gapiReady && !!sheetId,
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

export function useConfigQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const gapiReady = useAuthStore(s => s.gapiReady);
  return useQuery({
    queryKey: qk.config(sheetId ?? ''),
    queryFn: () => loadConfig(sheetId!),
    enabled: gapiReady && !!sheetId,
  });
}

export function useTagsQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const gapiReady = useAuthStore(s => s.gapiReady);
  return useQuery({
    queryKey: qk.tags(sheetId ?? ''),
    queryFn: () => loadTagsCatalog(sheetId!),
    enabled: gapiReady && !!sheetId,
  });
}

export function useGroupsQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const gapiReady = useAuthStore(s => s.gapiReady);
  return useQuery({
    queryKey: qk.groups(sheetId ?? ''),
    queryFn: () => loadGroupsCatalog(sheetId!),
    enabled: gapiReady && !!sheetId,
  });
}

function useOptionsEnabled() {
  const configQuery = useConfigQuery();
  return configQuery.isSuccess && configQuery.data.stock_options_enabled === true;
}

export function useOptionCompaniesQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optCompanies(sheetId ?? ''),
    queryFn: () => loadOptionCompanies(sheetId!),
    enabled: enabled && !!sheetId,
  });
}

export function useOptionGrantsQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optGrants(sheetId ?? ''),
    queryFn: () => loadOptionGrants(sheetId!),
    enabled: enabled && !!sheetId,
  });
}

export function useOptionFmvQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optFmv(sheetId ?? ''),
    queryFn: () => loadOptionFmv(sheetId!),
    enabled: enabled && !!sheetId,
  });
}

export function useOptionExercisesQuery() {
  const sheetId = useAuthStore(s => s.sheetId);
  const enabled = useOptionsEnabled();
  return useQuery({
    queryKey: qk.optExercises(sheetId ?? ''),
    queryFn: () => loadOptionExercises(sheetId!),
    enabled: enabled && !!sheetId,
  });
}
