import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast.store';
import { useGroupsQuery, useAccountsQuery, useTagsQuery } from '@/queries/sheetQueries';
import { useWriteGroupsMutation, useWriteTagsMutation } from '@/queries/sheetMutations';
import { allKnownTags, mergeTagNames } from '@/utils/tags';
import { groupColor } from '@/utils/colors';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { GroupDialog } from '../components/GroupDialog';
import type { Group } from '@/types/sheets';

export function GroupsSection() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);

  const groupsQ = useGroupsQuery();
  const accountsQ = useAccountsQuery();
  const tagsQ = useTagsQuery();
  const writeGroups = useWriteGroupsMutation();
  const writeTags = useWriteTagsMutation();

  const groups = groupsQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const tagsCatalog = tagsQ.data ?? [];
  const availableTags = allKnownTags(tagsCatalog, accounts);

  const persistNewTags = (names: string[]) => {
    const { merged, grew } = mergeTagNames(tagsCatalog, names);
    if (grew) writeTags.mutate(merged);
  };

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => { setEditIdx(null); setDialogOpen(true); };
  const openEdit = (i: number) => { setEditIdx(i); setDialogOpen(true); };

  const onSave = (group: Group) => {
    persistNewTags([...group.all, ...group.any, ...group.exclude]);
    const next = [...groups];
    if (editIdx !== null) next[editIdx] = group; else next.push(group);
    writeGroups.mutate(next, {
      onSuccess: () => { addToast(t('group_saved'), 'ok'); setDialogOpen(false); },
      onError: () => addToast(t('group_save_failed'), 'error'),
    });
  };

  const onDelete = () => {
    if (editIdx === null) return;
    const next = groups.filter((_, i) => i !== editIdx);
    writeGroups.mutate(next, {
      onSuccess: () => { addToast(t('group_deleted'), 'ok'); setDialogOpen(false); },
      onError: () => addToast(t('group_save_failed'), 'error'),
    });
  };

  const filterText = (g: Group) => {
    const parts: string[] = [];
    if (g.all?.length) parts.push(`All: ${g.all.join(', ')}`);
    if (g.any?.length) parts.push(`Any: ${g.any.join(', ')}`);
    if (g.exclude?.length) parts.push(`Excl: ${g.exclude.join(', ')}`);
    return parts.join(' · ') || t('group_no_filter');
  };

  if (groupsQ.isPending) {
    return <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" className="h-14" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{t('groups_hint')}</p>
        <Button variant="primary" size="sm" onClick={openNew} className="shrink-0">
          <Icon name="plus" size={14} />
          {t('add_group')}
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-sm text-muted">{t('no_groups_hint')}</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g, i) => (
            <button
              key={`${g.name}-${i}`}
              type="button"
              onClick={() => openEdit(i)}
              className="flex w-full items-center gap-3 rounded-lg bg-surface-1 p-3 text-left shadow-sm transition-colors hover:bg-surface-2"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: groupColor(g) }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{g.name}</div>
                <div className="truncate text-xs text-muted">{filterText(g)}</div>
              </div>
              <Icon name="chevronRight" size={16} className="text-muted" />
            </button>
          ))}
        </div>
      )}

      <GroupDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        group={editIdx !== null ? groups[editIdx] : null}
        availableTags={availableTags}
        hasExisting={editIdx !== null}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
