import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { useToastStore } from '@/stores/toast.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery, useConfigQuery, useFxRatesQuery } from '@/queries/sheetQueries';
import { useSaveMonthMutation } from '@/queries/sheetMutations';
import { tr } from '@/i18n';
import { fmtMoney, parseMoney } from '@/utils/format';
import { fxMap as buildFxMap, signedMain, rateFor } from '@/utils/currency';
import { deriveDatesSorted, normalizeDate, prevDate, todayISO } from '@/utils/dates';
import { snapshotForDate, buildEffectiveBalances, computeNetWorthFromSnapshots } from '@/utils/stats';
import { activeAccounts, categoriesInOrder, accountsForCategory, projectBalance } from '@/utils/balance';
import { categoryIcon } from '@/utils/icons';
import { Icon } from '@/ui/Icon';
import { Amount } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Delta } from '@/ui/Delta';
import { ProgressBar } from '@/ui/ProgressBar';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Skeleton } from '@/ui/Skeleton';
import { EmptyState } from '@/ui/EmptyState';
import { DateField } from './components/DateField';
import { EntryAccountRow } from './components/EntryAccountRow';
import type { Snapshot, Currency } from '@/types/sheets';

interface FormEntry {
  balance: string;
  comment: string;
}

function defaultDate(datesSorted: string[]): string {
  if (datesSorted.length) return datesSorted[datesSorted.length - 1];
  return todayISO();
}

export default function EntryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date: dateParam } = useParams();
  const lang = useUIStore(s => s.lang);
  const locale = lang === 'fr' ? 'fr' : 'en';
  const addToast = useToastStore(s => s.addToast);

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const configQ = useConfigQuery();
  const fxRatesQ = useFxRatesQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const currency = mainCurrency;
  const fxRateMap = useMemo(() => buildFxMap(fxRatesQ.data ?? []), [fxRatesQ.data]);
  const saveMonth = useSaveMonthMutation();

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const snapshots = useMemo(() => snapshotsQ.data ?? [], [snapshotsQ.data]);
  const categoryMeta = useMemo(() => categoryMetaQ.data ?? [], [categoryMetaQ.data]);

  const datesSorted = useMemo(() => deriveDatesSorted(snapshots), [snapshots]);
  const date = useMemo(() => {
    const norm = dateParam ? normalizeDate(dateParam) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(norm) ? norm : defaultDate(datesSorted);
  }, [dateParam, datesSorted]);

  const isEditing = datesSorted.includes(date);
  const existing = useMemo(() => snapshotForDate(snapshots, date), [snapshots, date]);
  const prevD = useMemo(() => prevDate(datesSorted, date), [datesSorted, date]);
  const prevBalances = useMemo(
    () => (prevD ? buildEffectiveBalances(snapshots, prevD) : {}),
    [snapshots, prevD],
  );

  const active = useMemo(() => activeAccounts(accounts), [accounts]);
  const categories = useMemo(
    () => categoriesInOrder(accounts, categoryMeta),
    [accounts, categoryMeta],
  );

  const [form, setForm] = useState<Record<string, FormEntry>>({});
  const [dayComment, setDayComment] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ names: string[]; rows: Snapshot[] } | null>(null);

  // Seed the form whenever the target month changes or the underlying data first loads.
  const seedKey = `${date}|${accountsQ.isSuccess}|${snapshotsQ.isSuccess}`;
  const seededRef = useRef('');
  useEffect(() => {
    if (!accountsQ.isSuccess) return;
    if (seededRef.current === seedKey) return;
    seededRef.current = seedKey;
    const init: Record<string, FormEntry> = {};
    for (const a of active) {
      const seed = existing.balances[a.id];
      init[a.id] = {
        balance: seed !== undefined ? fmtMoney(seed, locale, a.currency ?? mainCurrency) : '',
        comment: existing.comments[a.id] ?? '',
      };
    }
    setForm(init);
    setDayComment(existing.dayComment ?? '');
  }, [seedKey, accountsQ.isSuccess, active, existing, locale, mainCurrency]);

  const setBalance = (id: string, balance: string) =>
    setForm(f => ({ ...f, [id]: { balance, comment: f[id]?.comment ?? '' } }));
  const setComment = (id: string, comment: string) =>
    setForm(f => ({ ...f, [id]: { balance: f[id]?.balance ?? '', comment } }));

  // ── Derived totals ────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const byCategory: Record<string, number> = {};
    let netWorth = 0;
    let filled = 0;
    let usingFallback = false;
    const usdCad = rateFor(fxRateMap, date);
    for (const a of active) {
      const parsed = parseMoney(form[a.id]?.balance ?? '');
      let balance: number;
      if (parsed !== null) { filled++; balance = parsed; }
      else if (prevBalances[a.id] !== undefined) { balance = prevBalances[a.id]; usingFallback = true; }
      else continue;
      // Entered amounts are in the account's native currency → convert to main.
      const signed = signedMain(a, balance, mainCurrency, usdCad);
      byCategory[a.category] = (byCategory[a.category] ?? 0) + signed;
      netWorth += signed;
    }
    return { byCategory, netWorth, filled, total: active.length, usingFallback };
  }, [active, form, prevBalances, date, mainCurrency, fxRateMap]);

  const prevNet = useMemo(
    () => (prevD ? computeNetWorthFromSnapshots(snapshots, accounts, prevD, mainCurrency, fxRateMap) : null),
    [prevD, snapshots, accounts, mainCurrency, fxRateMap],
  );

  const balanceInputs = useRef<string[]>([]);
  balanceInputs.current = active.map(a => a.id);
  const focusNext = (id: string) => {
    const ids = balanceInputs.current;
    const idx = ids.indexOf(id);
    const nextId = ids[(idx + 1) % ids.length];
    const el = document.querySelector<HTMLInputElement>(`[data-balance="${nextId}"]`);
    el?.focus();
  };

  // ── Actions ───────────────────────────────────────────────────────────
  const buildRowsForDate = (): { rows: Snapshot[]; deletedNames: string[] } => {
    const enteredAt = new Date().toISOString();
    const activeIds = new Set(active.map(a => a.id));
    const rows: Snapshot[] = [];
    for (const a of active) {
      const parsed = parseMoney(form[a.id]?.balance ?? '');
      if (parsed !== null) {
        rows.push({
          date,
          account_id: a.id,
          balance_raw: parsed,
          comment: (form[a.id]?.comment ?? '').trim(),
          entered_at: enteredAt,
        });
      }
    }
    const dc = dayComment.trim();
    if (dc) rows.push({ date, account_id: '__day__', balance_raw: 0, comment: dc, entered_at: enteredAt });

    // Preserve rows on this date for accounts not in the active form (e.g. inactive).
    for (const s of snapshots) {
      if (s.date !== date || s.account_id === '__day__') continue;
      if (!activeIds.has(s.account_id)) rows.push(s);
    }

    // Accounts that had a saved value on this date but are now cleared → deleted.
    const writtenIds = new Set(rows.map(r => r.account_id));
    const deletedNames = active
      .filter(a => existing.balances[a.id] !== undefined && !writtenIds.has(a.id))
      .map(a => tr(a));

    return { rows, deletedNames };
  };

  const doSave = (rows: Snapshot[]) => {
    saveMonth.mutate(
      { date, rows },
      {
        onSuccess: () => addToast(t('snapshot_saved', { date }), 'ok'),
        onError: () => addToast(t('save_snapshot_failed'), 'error'),
      },
    );
  };

  const onSave = () => {
    const { rows, deletedNames } = buildRowsForDate();
    if (!rows.length) { addToast(t('nothing_to_save'), 'warn'); return; }
    if (deletedNames.length) { setPendingDelete({ names: deletedNames, rows }); return; }
    doSave(rows);
  };

  const onReset = () => {
    setForm(f => {
      const next: Record<string, FormEntry> = {};
      for (const id of Object.keys(f)) next[id] = { balance: '', comment: f[id].comment };
      return next;
    });
    setDayComment('');
  };

  const onCopyPrev = () => {
    if (!prevD) { addToast(t('no_prev_entry'), 'warn'); return; }
    const pb = buildEffectiveBalances(snapshots, prevD);
    setForm(f => {
      const next = { ...f };
      for (const a of active) {
        const v = pb[a.id];
        if (v !== undefined) next[a.id] = { balance: fmtMoney(v, locale, a.currency ?? mainCurrency), comment: f[a.id]?.comment ?? '' };
      }
      return next;
    });
    addToast(t('prefilled_from', { date: prevD }), 'ok');
  };

  const onDateChange = (d: string) => navigate(`/entry/${d}`);

  // ── Render ────────────────────────────────────────────────────────────
  if (accountsQ.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" className="h-12" />
        <Skeleton variant="card" className="h-[400px]" />
      </div>
    );
  }

  if (!active.length) {
    return (
      <EmptyState
        icon={<Icon name="inbox" size={28} />}
        title={t('empty_overview_title')}
        description={t('empty_overview_body')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: month picker + status + actions */}
      <div className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-fg-2">{t('date_label')}</span>
          <DateField value={date} onChange={onDateChange} />
          <Badge variant={isEditing ? 'warn' : 'accent'}>{isEditing ? t('existing_date') : t('new_date')}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onCopyPrev} disabled={!prevD}>
            <Icon name="copy" size={14} />
            {t('copy_prev_entry')}
          </Button>
          <Button variant="default" size="sm" onClick={onReset}>{t('reset_entry')}</Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={saveMonth.isPending}>
            <Icon name="save" size={14} />
            {t('save_snapshot')}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 px-1">
        <ProgressBar value={totals.filled} max={totals.total} className="flex-1" aria-label={t('entry_progress', { filled: totals.filled, total: totals.total })} />
        <span className="text-xs tabular-nums text-muted">{t('entry_progress', { filled: totals.filled, total: totals.total })}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        {/* Categories + accounts */}
        <div className="space-y-4">
          {categories.map(cat => {
            const accts = accountsForCategory(accounts, cat.id);
            if (!accts.length) return null;
            return (
              <section key={cat.id} className="rounded-xl bg-surface-1 p-4 shadow-sm">
                <h3 className="mb-2 flex items-center justify-between border-b border-border pb-2">
                  <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                    <Icon name={categoryIcon(cat.id)} size={14} />
                    {tr(cat)}
                  </span>
                  <span className="text-sm tabular-nums text-muted">
                    <Amount value={totals.byCategory[cat.id] ?? 0} />
                  </span>
                </h3>
                <div className="divide-y divide-border/40">
                  {accts.map(a => (
                    <div key={a.id} data-row={a.id}>
                      <EntryAccountRow
                        account={a}
                        balance={form[a.id]?.balance ?? ''}
                        comment={form[a.id]?.comment ?? ''}
                        prevValue={prevBalances[a.id] ?? null}
                        projected={a.annual_rate ? projectBalance(accounts, snapshots, a.id, date) : null}
                        locale={locale}
                        currency={a.currency ?? mainCurrency}
                        onBalanceChange={v => setBalance(a.id, v)}
                        onCommentChange={v => setComment(a.id, v)}
                        onEnter={() => focusNext(a.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Month comment */}
          <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-fg-2" htmlFor="day-comment">
              {t('day_comment')}
            </label>
            <textarea
              id="day-comment"
              rows={2}
              placeholder={t('month_comment_placeholder')}
              value={dayComment}
              onChange={e => setDayComment(e.target.value)}
              className="w-full rounded border border-border bg-surface-1 px-2 py-1.5 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </section>
        </div>

        {/* Totals panel */}
        <aside className="space-y-3 self-start rounded-xl bg-surface-1 p-4 shadow-sm lg:sticky lg:top-4">
          <h3 className="text-sm font-medium text-fg-2">{t('net_worth')}</h3>
          <div className="flex items-center gap-2">
            {totals.usingFallback && (
              <span title={t('net_worth_fallback')}>
                <Icon name="alert" size={18} className="text-warn" />
              </span>
            )}
            <span className="text-2xl font-semibold tabular-nums text-fg">
              <Amount value={totals.netWorth} />
            </span>
          </div>
          {prevNet !== null && (
            <Delta
              value={totals.netWorth - prevNet}
              baseValue={prevNet}
              periodLabel={`vs ${prevD}`}
              locale={locale}
              currency={currency}
            />
          )}
          <div className="space-y-1 border-t border-border pt-3">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between text-sm">
                <span className="text-fg-2">{tr(cat)}</span>
                <span className="tabular-nums text-fg"><Amount value={totals.byCategory[cat.id] ?? 0} /></span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) doSave(pendingDelete.rows); }}
        message={`${t('confirm_delete_entries')} ${pendingDelete?.names.join(', ') ?? ''}`}
        confirmLabel={t('confirm_delete_ok')}
      />
    </div>
  );
}
