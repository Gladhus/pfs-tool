import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/shared/stores/toast.store';
import { tr } from '@/shared/i18n';
import { fmtMonth, todayISO } from '@/shared/utils/dates';
import { ownershipLabel, HOUSEHOLD_VIEWER, viewerShare } from '@/shared/utils/ownership';
import { useWriteSpendingsMutation } from '@/shared/io/queries/sheetMutations';
import { Amount } from '@/shared/ui/Amount';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { useSpendingData } from './data/useSpendingData';
import { ledgerFor, monthWindow, shiftMonthKey, viewerAmount, type LedgerRow } from './data/spending.selectors';
import { SpendingDialog } from './components/SpendingDialog';
import type { Spending } from '@/types/sheets';

export default function SpendingEntriesPage() {
  const { t } = useTranslation();
  const lang = useTranslation().i18n.language;
  const addToast = useToastStore(s => s.addToast);
  const { categories, spendings, recurrences, people, mainCurrency, ctx, viewer, isPending } = useSpendingData();

  const [monthKey, setMonthKey] = useState(() => todayISO().slice(0, 7));
  const [dlg, setDlg] = useState<{ spending: Spending | null } | null>(null);

  const writeSpendings = useWriteSpendingsMutation();
  const fail = () => addToast(t('sp_save_failed'), 'error');

  const window = monthWindow(monthKey);
  const rows = ledgerFor(spendings, recurrences, window)
    .filter(r => viewer === HOUSEHOLD_VIEWER || viewerShare(r.ownership, viewer) > 0);

  const cat = (id: string) => categories.find(c => c.id === id);

  const saveSpending = (s: Spending) => {
    const exists = spendings.some(x => x.id === s.id);
    const next = exists ? spendings.map(x => x.id === s.id ? s : x) : [...spendings, s];
    writeSpendings.mutate(next, { onSuccess: () => setDlg(null), onError: fail });
  };
  const deleteSpending = (id: string) => {
    writeSpendings.mutate(spendings.filter(s => s.id !== id), { onSuccess: () => setDlg(null), onError: fail });
  };

  const openRow = (row: LedgerRow) => {
    if (row.recurring) { addToast(t('sp_recurring_hint'), 'default'); return; }
    setDlg({ spending: row });
  };

  return (
    <div className="space-y-4">
      {/* Month nav + add */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label={t('sp_prev_month')} onClick={() => setMonthKey(m => shiftMonthKey(m, -1))}>
            <Icon name="chevronRight" size={16} className="rotate-180" />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-fg">{fmtMonth(monthKey, { locale: lang })}</span>
          <Button variant="ghost" size="sm" aria-label={t('sp_next_month')} onClick={() => setMonthKey(m => shiftMonthKey(m, 1))}>
            <Icon name="chevronRight" size={16} />
          </Button>
        </div>
        <Button variant="primary" size="sm" onClick={() => setDlg({ spending: null })}>
          <Icon name="plus" size={14} /> {t('sp_add_spending')}
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Icon name="cash" size={28} />}
          title={t('sp_no_entries')}
          description={t('sp_no_entries_hint')}
          action={<Button variant="primary" size="sm" onClick={() => setDlg({ spending: null })}>{t('sp_add_spending')}</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface-1 shadow-sm">
          {rows.map(row => {
            const c = cat(row.category_id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => openRow(row)}
                className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left last:border-0 hover:bg-surface-2"
              >
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: c?.color ?? '#888' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{c ? tr(c) : row.category_id}</span>
                    {row.recurring && (
                      <span className="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-muted">
                        <Icon name="refresh" size={10} /> {t('sp_recurring')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {row.date} · {ownershipLabel(row.ownership, people, t('viewer_household'))}
                    {row.comment && ` · ${row.comment}`}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium text-fg">
                  <Amount value={viewerAmount(row, ctx, viewer)} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {dlg && (
        <SpendingDialog
          open
          onClose={() => setDlg(null)}
          spending={dlg.spending}
          categories={categories}
          people={people}
          mainCurrency={mainCurrency}
          defaultDate={monthKey === todayISO().slice(0, 7) ? todayISO() : window.start}
          onSave={saveSpending}
          onDelete={() => dlg.spending && deleteSpending(dlg.spending.id)}
        />
      )}
    </div>
  );
}
