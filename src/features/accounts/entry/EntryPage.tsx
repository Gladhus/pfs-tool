import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/shared/stores/ui.store';
import { useToastStore } from '@/shared/stores/toast.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery, useConfigQuery, useFxRatesQuery, usePeopleQuery } from '@/shared/io/queries/sheetQueries';
import { useSaveMonthMutation } from '@/shared/io/queries/sheetMutations';
import { tr } from '@/shared/i18n';
import { fmtMoney } from '@/shared/utils/format';
import { fxMap as buildFxMap } from '@/shared/utils/currency';
import { computeEntryTotals, buildEntryRows } from '@/features/accounts/data/entry.selectors';
import { deriveDatesSorted, normalizeDate, prevDate, todayISO } from '@/shared/utils/dates';
import { snapshotForDate, buildEffectiveBalances, computeNetWorthFromSnapshots } from '@/shared/utils/stats';
import { activeAccounts, categoriesInOrder, accountsForCategory, projectBalance } from '@/shared/utils/balance';
import { accountsVisibleToViewer } from '@/shared/utils/ownership';
import { categoryIcon } from '@/shared/utils/icons';
import { Icon } from '@/shared/ui/Icon';
import { Amount } from '@/shared/ui/Amount';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Delta } from '@/shared/ui/Delta';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ViewingAsBadge } from '@/shared/components/ViewingAsBadge';
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
  const privateMode = useUIStore(s => s.privateMode);
  const viewer = useUIStore(s => s.currentViewer);
  const addToast = useToastStore(s => s.addToast);

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const configQ = useConfigQuery();
  const fxRatesQ = useFxRatesQuery();
  const peopleQ = usePeopleQuery();
  const people = peopleQ.data ?? [];
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
  // Accounts the current header viewer ("View as") has a stake in — drives what's shown/counted.
  // Seeding and saving still use the full `active` list so hidden owners' data is never lost.
  const visible = useMemo(() => accountsVisibleToViewer(active, viewer), [active, viewer]);
  const visibleCatIds = useMemo(() => new Set(visible.map(a => a.category)), [visible]);
  const categories = useMemo(
    () => categoriesInOrder(accounts, categoryMeta),
    [accounts, categoryMeta],
  );

  const [form, setForm] = useState<Record<string, FormEntry>>({});
  const [dayComment, setDayComment] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ names: string[]; rows: Snapshot[] } | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingCopyPrev, setPendingCopyPrev] = useState(false);

  // Measure sticky bar height so the sidebar knows where to stick.
  const stickyBarRef = useRef<HTMLDivElement>(null);
  const [stickyBarH, setStickyBarH] = useState(0);
  useEffect(() => {
    const bar = stickyBarRef.current;
    if (!bar) return;
    const obs = new ResizeObserver(() => setStickyBarH(bar.offsetHeight));
    obs.observe(bar);
    return () => obs.disconnect();
  }, []);

  // Seed form when the target date or underlying data changes.
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

  const hasEnteredData = useMemo(
    () => Object.values(form).some(e => e.balance !== '') || dayComment !== '',
    [form, dayComment],
  );

  // ── Derived totals ────────────────────────────────────────────────────
  const totals = useMemo(
    () => computeEntryTotals({ visible, form, prevBalances, date, mainCurrency, fxRateMap, viewer }),
    [visible, form, prevBalances, date, mainCurrency, fxRateMap, viewer],
  );

  const prevNet = useMemo(
    () => (prevD ? computeNetWorthFromSnapshots(snapshots, accounts, prevD, mainCurrency, fxRateMap, viewer) : null),
    [prevD, snapshots, accounts, mainCurrency, fxRateMap, viewer],
  );

  const daysSincePrev = useMemo(() => {
    if (!prevD) return null;
    return Math.round((new Date(date).getTime() - new Date(prevD).getTime()) / 86_400_000);
  }, [date, prevD]);

  const balanceInputs = useRef<string[]>([]);
  balanceInputs.current = visible.map(a => a.id);
  const focusNext = (id: string) => {
    const ids = balanceInputs.current;
    const idx = ids.indexOf(id);
    const nextId = ids[(idx + 1) % ids.length];
    const el = document.querySelector<HTMLInputElement>(`[data-balance="${nextId}"]`);
    el?.focus();
  };

  // ── Actions ───────────────────────────────────────────────────────────
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
    const { rows, deleted } = buildEntryRows({
      active, form, dayComment, snapshots, date, existingBalances: existing.balances,
    });
    if (!rows.length) { addToast(t('nothing_to_save'), 'warn'); return; }
    if (deleted.length) { setPendingDelete({ names: deleted.map(tr), rows }); return; }
    doSave(rows);
  };

  const doReset = () => {
    setForm(f => {
      const next: Record<string, FormEntry> = {};
      for (const id of Object.keys(f)) next[id] = { balance: '', comment: f[id].comment };
      return next;
    });
    setDayComment('');
  };

  const onReset = () => {
    if (hasEnteredData) { setPendingReset(true); return; }
    doReset();
  };

  const doCopyPrev = () => {
    if (!prevD) return;
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

  const onCopyPrev = () => {
    if (!prevD) { addToast(t('no_prev_entry'), 'warn'); return; }
    if (hasEnteredData) { setPendingCopyPrev(true); return; }
    doCopyPrev();
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

  if (!visible.length) {
    return (
      <EmptyState
        icon={<Icon name="inbox" size={28} />}
        title={t('viewer_empty_title')}
        description={t('viewer_empty_body')}
      />
    );
  }

  return (
    <div>
      {/* Sticky bar: action controls + progress — sticks just below the global header (top-14 = 3.5rem) */}
      <div
        ref={stickyBarRef}
        className="sticky top-16 md:top-14 z-30 -mx-4 mb-4 bg-bg px-4 pb-3 pt-2"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-border/50 bg-surface-1 px-3 py-2 shadow-sm sm:px-4">
          {/* Row 1 on mobile / Left on desktop: date picker + status badge */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <span className="hidden shrink-0 text-sm font-medium text-fg-2 sm:block">{t('date_label')}</span>
            <DateField value={date} onChange={onDateChange} />
            {isEditing ? (
              /* Editing: icon-only on small screens, full text on md+ */
              <Badge variant="warn" className="shrink-0 gap-1">
                <Icon name="edit" size={10} className="md:hidden" />
                <span className="hidden md:inline">{t('existing_date')}</span>
              </Badge>
            ) : (
              /* New entry: always show full green text */
              <Badge variant="accent" className="shrink-0">{t('new_date')}</Badge>
            )}
          </div>

          {/* Spacer — desktop only */}
          <div className="hidden flex-1 sm:flex sm:justify-center">
            <ViewingAsBadge />
          </div>

          {/* Row 2 on mobile / Right on desktop: action buttons */}
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto">
            <Button
              variant="default"
              size="sm"
              onClick={onCopyPrev}
              disabled={!prevD}
              aria-label={t('copy_prev_entry')}
            >
              <Icon name="copy" size={14} />
              {t('copy_prev_entry')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onReset}
              aria-label={t('reset_entry')}
            >
              <Icon name="eraser" size={14} />
              {t('reset_entry')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              disabled={saveMonth.isPending}
              aria-label={t('save_snapshot')}
            >
              <Icon name="save" size={14} />
              {t('save_snapshot')}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3 px-1 pt-2">
          <ProgressBar
            value={totals.filled}
            max={totals.total}
            className="flex-1"
            aria-label={t('entry_progress', { filled: totals.filled, total: totals.total })}
          />
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {t('entry_progress', { filled: totals.filled, total: totals.total })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_16rem]">
        {/* Categories + accounts */}
        <div className="space-y-4">
          {categories.map(cat => {
            const accts = accountsVisibleToViewer(accountsForCategory(accounts, cat.id), viewer);
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
                        people={people}
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

          {/* Day comment */}
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

        {/* Net-worth summary sidebar.
            On desktop: sticky below the global header + the measured sticky bar height.
            On mobile: static, appears after the account list. */}
        <aside
          className="space-y-3 self-start rounded-xl bg-surface-1 p-4 shadow-sm sm:sticky"
          style={{ top: `calc(3.5rem + ${stickyBarH}px + 0.5rem)` }}
        >
          <h3 className="text-sm font-medium text-fg-2">{t('net_worth')}</h3>
          <span className="text-2xl font-semibold tabular-nums text-fg">
            <Amount value={totals.netWorth} />
          </span>
          {totals.usingFallback && (
            <div className="flex items-start gap-1.5 text-xs text-warn">
              <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
              <span>{t('net_worth_fallback')}</span>
            </div>
          )}
          {prevNet !== null && (
            <Delta
              value={totals.netWorth - prevNet}
              baseValue={prevNet}
              layout="stacked"
              periodLabel={`vs ${prevD}${daysSincePrev !== null ? ` ${t('days_ago', { count: daysSincePrev })}` : ''}`}
              locale={locale}
              currency={currency}
              isPrivate={privateMode}
            />
          )}
          <div className="space-y-1 border-t border-border pt-3">
            {categories.filter(cat => visibleCatIds.has(cat.id)).map(cat => (
              <div key={cat.id} className="flex items-center justify-between text-sm">
                <span className="text-fg-2">{tr(cat)}</span>
                <span className="tabular-nums text-fg"><Amount value={totals.byCategory[cat.id] ?? 0} /></span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Confirm: accounts that will be deleted on save */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) doSave(pendingDelete.rows); }}
        message={`${t('confirm_delete_entries')} ${pendingDelete?.names.join(', ') ?? ''}`}
        confirmLabel={t('confirm_delete_ok')}
      />

      {/* Confirm: reset clears all balances */}
      <ConfirmDialog
        open={pendingReset}
        onClose={() => setPendingReset(false)}
        onConfirm={doReset}
        message={t('confirm_reset_entry')}
        confirmLabel={t('reset_entry')}
        variant="primary"
      />

      {/* Confirm: copy previous overwrites current entries */}
      <ConfirmDialog
        open={pendingCopyPrev}
        onClose={() => setPendingCopyPrev(false)}
        onConfirm={doCopyPrev}
        message={t('confirm_copy_prev_entry')}
        confirmLabel={t('copy_prev_entry')}
        variant="primary"
      />
    </div>
  );
}
