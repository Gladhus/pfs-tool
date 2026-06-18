import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast.store';
import {
  useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery,
  useAccountTypesQuery, useTagsQuery, useConfigQuery, usePeopleQuery,
} from '@/queries/sheetQueries';
import type { Currency } from '@/types/sheets';
import { useWriteAccountsMutation, useWriteTagsMutation } from '@/queries/sheetMutations';
import { ownershipLabel } from '@/utils/ownership';
import { tr } from '@/i18n';
import { Amount } from '@/ui/Amount';
import { allKnownTags } from '@/utils/tags';
import { categoryIcon } from '@/utils/icons';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { AccountDialog } from '../components/AccountDialog';
import type { Account, Snapshot, Tag } from '@/types/sheets';

function latestBalanceFor(snapshots: Snapshot[], id: string): Snapshot | null {
  let best: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.account_id !== id) continue;
    if (!best || s.date > best.date) best = s;
  }
  return best;
}

export function AccountsSection() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const accountTypesQ = useAccountTypesQuery();
  const tagsQ = useTagsQuery();
  const peopleQ = usePeopleQuery();
  const configQ = useConfigQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const writeAccounts = useWriteAccountsMutation();
  const writeTags = useWriteTagsMutation();

  const accounts = accountsQ.data ?? [];
  const snapshots = snapshotsQ.data ?? [];
  const categoryMeta = useMemo(() => categoryMetaQ.data ?? [], [categoryMetaQ.data]);
  const accountTypes = accountTypesQ.data ?? [];
  const tagsCatalog = tagsQ.data ?? [];
  const people = peopleQ.data ?? [];

  const [editing, setEditing] = useState<Account | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const catOrder = useMemo(
    () => Object.fromEntries(categoryMeta.map(c => [c.id, c.sort_order ?? 0])),
    [categoryMeta],
  );
  const sortAccts = (list: Account[]) =>
    [...list].sort((a, b) => {
      const co = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99);
      return co !== 0 ? co : (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  const active = sortAccts(accounts.filter(a => a.active));
  const inactive = sortAccts(accounts.filter(a => !a.active));
  const availableTags = allKnownTags(tagsCatalog, accounts);

  const openNew = () => { setEditing(null); setCreating(true); setDialogOpen(true); };
  const openEdit = (a: Account) => { setEditing(a); setCreating(false); setDialogOpen(true); };

  const persist = async (nextAll: Account[], newTags: string[]) => {
    // Persist the "assume main currency" default for any account still missing one.
    const normalized = nextAll.map(a => ({ ...a, currency: a.currency ?? mainCurrency }));
    try {
      await writeAccounts.mutateAsync(normalized);
      if (newTags.length) {
        const existing = new Set(tagsCatalog.map(tg => tg.name));
        const merged: Tag[] = [...tagsCatalog, ...newTags.filter(n => !existing.has(n)).map(n => ({ name: n }))];
        try { await writeTags.mutateAsync(merged); } catch { /* non-fatal */ }
      }
      addToast(t('account_saved'), 'ok');
      setDialogOpen(false);
    } catch {
      addToast(t('acct_save_failed'), 'error');
    }
  };

  const onSave = (acct: Account) => {
    const isNew = !accounts.some(a => a.id === acct.id);
    const nextAll = isNew ? [...accounts, acct] : accounts.map(a => a.id === acct.id ? acct : a);
    void persist(nextAll, acct.tags);
  };

  const onDelete = () => {
    if (!editing) return;
    const nextAll = accounts.filter(a => a.id !== editing.id).map(a => ({ ...a, currency: a.currency ?? mainCurrency }));
    writeAccounts.mutate(nextAll, {
      onSuccess: () => { addToast(t('account_deleted'), 'ok'); setDialogOpen(false); },
      onError: () => addToast(t('acct_delete_failed'), 'error'),
    });
  };

  const renderCard = (a: Account) => {
    const latest = latestBalanceFor(snapshots, a.id);
    const meta = ownershipLabel(a.ownership, people, t('owner_joint'));
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => openEdit(a)}
        className={`flex w-full items-center gap-3 rounded-lg bg-surface-1 p-3 text-left shadow-sm transition-colors hover:bg-surface-2 ${a.active ? '' : 'opacity-60'}`}
      >
        <Icon name={categoryIcon(a.category)} size={16} className="text-fg-2" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-fg">{tr(a)}</div>
          <div className="text-xs text-muted">{meta}</div>
        </div>
        <div className="text-right">
          {latest ? (
            <>
              <div className="text-sm tabular-nums text-fg"><Amount value={latest.balance_raw} currency={a.currency ?? mainCurrency} /></div>
              <div className="text-xs text-muted">{latest.date}</div>
            </>
          ) : (
            <div className="text-xs text-muted">{t('no_data')}</div>
          )}
        </div>
        <Icon name="chevronRight" size={16} className="text-muted" />
      </button>
    );
  };

  if (accountsQ.isPending) {
    return <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="card" className="h-16" />)}</div>;
  }

  // Group active accounts by category with a header before each new category.
  let lastCat: string | null = null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{t('manage_accounts_hint')}</p>
        <Button variant="primary" size="sm" onClick={openNew} className="shrink-0">
          <Icon name="plus" size={14} />
          {t('add_account')}
        </Button>
      </div>

      <div className="space-y-2">
        {active.map(a => {
          const header = a.category !== lastCat
            ? (lastCat = a.category, categoryMeta.find(c => c.id === a.category))
            : null;
          return (
            <div key={a.id}>
              {header && (
                <h3 className="mt-3 mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Icon name={categoryIcon(a.category)} size={13} />
                  {tr(header)}
                </h3>
              )}
              {renderCard(a)}
            </div>
          );
        })}
      </div>

      {inactive.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="text-xs font-medium text-fg-2 hover:text-fg"
            onClick={() => setShowArchived(v => !v)}
          >
            {showArchived ? t('hide_archived', { count: inactive.length }) : t('show_archived', { count: inactive.length })}
          </button>
          {showArchived && inactive.map(renderCard)}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        account={creating ? null : editing}
        accounts={accounts}
        accountTypes={accountTypes}
        people={people}
        categoryMeta={categoryMeta}
        availableTags={availableTags}
        mainCurrency={mainCurrency}
        hasHistory={editing ? snapshots.some(s => s.account_id === editing.id) : false}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
