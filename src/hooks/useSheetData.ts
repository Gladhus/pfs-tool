import {
  useAccountsQuery,
  useSnapshotsQuery,
  useCategoryMetaQuery,
  useConfigQuery,
  useTagsQuery,
  useGroupsQuery,
} from '@/queries/sheetQueries';

export function useSheetData() {
  const accounts     = useAccountsQuery();
  const snapshots    = useSnapshotsQuery();
  const categoryMeta = useCategoryMetaQuery();
  const config       = useConfigQuery();
  const tags         = useTagsQuery();
  const groups       = useGroupsQuery();

  const isLoading = accounts.isLoading || snapshots.isLoading || config.isLoading;
  const isError   = accounts.isError   || snapshots.isError   || config.isError;

  return {
    accounts:     accounts.data     ?? [],
    snapshots:    snapshots.data    ?? [],
    categoryMeta: categoryMeta.data ?? [],
    config:       config.data,
    tags:         tags.data         ?? [],
    groups:       groups.data       ?? [],
    isLoading,
    isError,
  };
}
