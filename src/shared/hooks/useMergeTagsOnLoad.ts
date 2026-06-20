import { useEffect, useRef } from 'react';
import { useAccountsQuery, useTagsQuery } from '@/shared/io/queries/sheetQueries';
import { useMergeTagsMutation } from '@/shared/io/queries/sheetMutations';
import { mergeTags } from '@/shared/utils/tags';

/**
 * Fires once per session when both accounts and tags have loaded.
 * If the tags catalog is missing any tag found on accounts, writes the merged set.
 */
export function useMergeTagsOnLoad() {
  const accountsQuery = useAccountsQuery();
  const tagsQuery = useTagsQuery();
  const mergeTagsMutation = useMergeTagsMutation();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!accountsQuery.isSuccess || !tagsQuery.isSuccess) return;

    const { merged, grew } = mergeTags(tagsQuery.data, accountsQuery.data);
    if (grew) {
      ranRef.current = true;
      mergeTagsMutation.mutate(merged);
    } else {
      ranRef.current = true;
    }
  }, [accountsQuery.isSuccess, tagsQuery.isSuccess, accountsQuery.data, tagsQuery.data, mergeTagsMutation]);
}
