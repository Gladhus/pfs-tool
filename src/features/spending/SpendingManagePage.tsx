import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/shared/stores/toast.store';
import { tr } from '@/shared/i18n';
import { todayISO } from '@/shared/utils/dates';
import { ownershipLabel } from '@/shared/utils/ownership';
import {
  useWriteSpendingCategoriesMutation, useWriteSpendingsMutation, useWriteSpendingRecurrencesMutation,
} from '@/shared/io/queries/sheetMutations';
import { Amount } from '@/shared/ui/Amount';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useSpendingData } from './data/useSpendingData';
import { SpendingCategoryDialog } from './components/SpendingCategoryDialog';
import { RecurrenceDialog } from './components/RecurrenceDialog';
import type { SpendingCategory, SpendingRecurrence } from '@/types/sheets';

export default function SpendingManagePage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const { categories, spendings, recurrences, people, mainCurrency, isPending } = useSpendingData();

  const writeCategories = useWriteSpendingCategoriesMutation();
  const writeSpendings = useWriteSpendingsMutation();
  const writeRecurrences = useWriteSpendingRecurrencesMutation();
  const fail = () => addToast(t('sp_save_failed'), 'error');

  const [catDlg, setCatDlg] = useState<{ category: SpendingCategory | null } | null>(null);
  const [recDlg, setRecDlg] = useState<{ recurrence: SpendingRecurrence | null } | null>(null);

  const sortedCats = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const catName = (id: string) => { const c = categories.find(x => x.id === id); return c ? tr(c) : id; };

  // ── Category CRUD ───────────────────────────────────────────────────
  const saveCategory = (c: SpendingCategory) => {
    const exists = categories.some(x => x.id === c.id);
    const next = exists ? categories.map(x => x.id === c.id ? c : x) : [...categories, c];
    writeCategories.mutate(next, { onSuccess: () => setCatDlg(null), onError: fail });
  };
  const deleteCategory = (id: string) => {
    writeCategories.mutate(categories.filter(c => c.id !== id), { onSuccess: () => setCatDlg(null), onError: fail });
  };
  // A category is safe to delete only when nothing references it.
  const categoryInUse = (id: string) =>
    spendings.some(s => s.category_id === id) || recurrences.some(r => r.category_id === id);

  // ── Recurrence CRUD ─────────────────────────────────────────────────
  const saveRecurrence = (r: SpendingRecurrence) => {
    const exists = recurrences.some(x => x.id === r.id);
    const next = exists ? recurrences.map(x => x.id === r.id ? r : x) : [...recurrences, r];
    writeRecurrences.mutate(next, { onSuccess: () => setRecDlg(null), onError: fail });
  };
  const deleteRecurrence = (id: string) => {
    // Also drop any stored per-occurrence overrides for this rule.
    const prefix = `recur:${id}:`;
    if (spendings.some(s => s.id.startsWith(prefix))) {
      writeSpendings.mutate(spendings.filter(s => !s.id.startsWith(prefix)), { onError: fail });
    }
    writeRecurrences.mutate(recurrences.filter(r => r.id !== id), { onSuccess: () => setRecDlg(null), onError: fail });
  };

  if (isPending) {
    return <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" className="h-24" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">{t('sp_categories')}</h3>
          <Button variant="primary" size="sm" onClick={() => setCatDlg({ category: null })}>
            <Icon name="plus" size={14} /> {t('sp_add_category')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedCats.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatDlg({ category: c })}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-fg hover:bg-border"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {tr(c)}
              {c.active === false && <span className="text-[10px] uppercase text-muted">{t('sp_inactive')}</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Recurring rules */}
      <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">{t('sp_recurring_rules')}</h3>
          <Button variant="primary" size="sm" onClick={() => setRecDlg({ recurrence: null })}>
            <Icon name="plus" size={14} /> {t('sp_add_recurrence')}
          </Button>
        </div>
        {recurrences.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{t('sp_no_recurrences')}</p>
        ) : (
          <div className="space-y-2">
            {recurrences.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecDlg({ recurrence: r })}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-left hover:bg-border"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{r.label}</span>
                    {r.active === false && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-muted">{t('sp_inactive')}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {catName(r.category_id)} · {t(`sp_freq_${r.frequency}`)}{r.interval > 1 ? ` ×${r.interval}` : ''} · {ownershipLabel(r.ownership, people, t('viewer_household'))}
                  </div>
                </div>
                <span className="shrink-0 text-sm text-fg">
                  <Amount value={r.amount} currency={r.currency ?? mainCurrency} sensitive={false} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {catDlg && (
        <SpendingCategoryDialog
          open
          onClose={() => setCatDlg(null)}
          category={catDlg.category}
          categories={categories}
          onSave={saveCategory}
          onDelete={() => catDlg.category && deleteCategory(catDlg.category.id)}
          canDelete={!!catDlg.category && !categoryInUse(catDlg.category.id)}
        />
      )}
      {recDlg && (
        <RecurrenceDialog
          open
          onClose={() => setRecDlg(null)}
          recurrence={recDlg.recurrence}
          categories={categories}
          people={people}
          mainCurrency={mainCurrency}
          defaultDate={todayISO()}
          onSave={saveRecurrence}
          onDelete={() => recDlg.recurrence && deleteRecurrence(recDlg.recurrence.id)}
        />
      )}
    </div>
  );
}
