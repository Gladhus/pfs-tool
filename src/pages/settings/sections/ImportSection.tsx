import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery } from '@/queries/sheetQueries';
import { useImportMutation } from '@/queries/sheetMutations';
import { tr } from '@/i18n';
import { parseDelimited, suggestAccount, rememberMapping } from '@/utils/import';
import { parseMonthLabel } from '@/utils/dates';
import { parseMoney } from '@/utils/format';
import { activeAccounts } from '@/utils/balance';
import { Button } from '@/ui/Button';
import { CategorySelect, type OptionItem } from '../components/CategorySelect';
import { LS_KEY_IMPORT_MAP } from '@/constants';
import type { Snapshot } from '@/types/sheets';

const SKIP = '__skip__';
const DAY = '__day__';

interface ParsedValue { date: string; raw: string; num: number | null; }
interface ParsedRow { label: string; values: ParsedValue[]; mapping: string; }
interface Parsed { dates: string[]; rows: ParsedRow[]; }

function readMappings(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) ?? '{}'); } catch { return {}; }
}
function writeMappings(m: Record<string, string>) {
  try { localStorage.setItem(LS_KEY_IMPORT_MAP, JSON.stringify(m)); } catch { /* noop */ }
}

export function ImportSection() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const importMut = useImportMutation();

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const snapshots = snapshotsQ.data ?? [];
  const categoryMeta = categoryMetaQ.data ?? [];

  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  const acctOptions: OptionItem[] = useMemo(
    () => activeAccounts(accounts).map(a => ({ value: a.id, category: a.category, label: tr(a) })),
    [accounts],
  );

  const onParse = () => {
    if (!raw.trim()) { addToast(t('import_paste_first'), 'warn'); return; }
    const grid = parseDelimited(raw);
    if (!grid.length) { addToast(t('import_no_months'), 'warn'); return; }

    let headerIdx = -1;
    let monthCols: { idx: number; date: string }[] = [];
    for (let i = 0; i < Math.min(grid.length, 10); i++) {
      const cols = grid[i]
        .map((c, idx) => { const m = parseMonthLabel(c); return m ? { idx, date: `${m}-01` } : null; })
        .filter((x): x is { idx: number; date: string } => x !== null);
      if (cols.length >= 2) { headerIdx = i; monthCols = cols; break; }
    }
    if (headerIdx < 0) { addToast(t('import_no_months'), 'warn'); return; }

    const mappings = readMappings();
    const firstMonthCol = monthCols[0].idx;
    const rows: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      let label = '';
      for (let c = firstMonthCol - 1; c >= 0; c--) {
        if (r[c] && r[c].trim()) { label = r[c].trim(); break; }
      }
      if (!label) continue;
      const values = monthCols.map(mc => ({ date: mc.date, raw: r[mc.idx] || '', num: parseMoney(r[mc.idx]) }));
      if (!values.some(v => v.num !== null)) continue;
      rows.push({ label, values, mapping: suggestAccount(label, accounts, mappings) ?? SKIP });
    }

    setParsed({ dates: monthCols.map(m => m.date), rows });
  };

  const onClear = () => { setRaw(''); setParsed(null); };

  const setMapping = (rowIdx: number, mapping: string) =>
    setParsed(p => p ? { ...p, rows: p.rows.map((r, i) => i === rowIdx ? { ...r, mapping } : r) } : p);

  const onImport = () => {
    if (!parsed) return;
    const mapped = parsed.rows.filter(r => r.mapping !== SKIP);
    if (!mapped.length) { addToast(t('import_nothing'), 'warn'); return; }

    let mappings = readMappings();
    for (const r of mapped) mappings = rememberMapping(r.label, r.mapping, mappings);
    writeMappings(mappings);

    const enteredAt = new Date().toISOString();
    const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
    const imported: Snapshot[] = [];
    const datesTouched = new Set<string>();
    for (const r of mapped) {
      for (const v of r.values) {
        if (v.num === null) continue;
        datesTouched.add(v.date);
        if (r.mapping === DAY) {
          if (v.raw && v.raw.trim()) {
            imported.push({ date: v.date, account_id: DAY, balance_raw: 0, comment: v.raw.trim(), entered_at: enteredAt });
          }
        } else {
          const acct = acctById[r.mapping];
          let balance = v.num;
          if (acct && acct.kind === 'debt' && balance < 0) balance = -balance;
          imported.push({ date: v.date, account_id: r.mapping, balance_raw: balance, comment: '', entered_at: enteredAt });
        }
      }
    }
    if (!imported.length) { addToast(t('import_nothing'), 'warn'); return; }

    const keep = snapshots.filter(s => (datesTouched.has(s.date) ? !overwrite : true));
    const existingKeys = new Set(snapshots.map(s => `${s.date}|${s.account_id}`));
    const finalImported = overwrite ? imported : imported.filter(r => !existingKeys.has(`${r.date}|${r.account_id}`));
    const merged = [...keep, ...finalImported];

    importMut.mutate(merged, {
      onSuccess: () => {
        addToast(t('import_done', { rows: finalImported.length, dates: datesTouched.size }), 'ok');
        onClear();
      },
      onError: () => addToast(t('import_failed'), 'error'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-1 p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-fg">{t('import_historical')}</h3>
        <p className="mb-3 text-xs text-muted">{t('import_hint')}</p>
        <textarea
          rows={6}
          value={raw}
          placeholder={t('import_placeholder')}
          onChange={e => setRaw(e.target.value)}
          className="w-full rounded border border-border bg-surface-1 p-2 font-mono text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={onParse}>{t('parse')}</Button>
          <Button variant="ghost" size="sm" onClick={onClear}>{t('clear')}</Button>
        </div>
      </div>

      {parsed && (
        <div className="rounded-xl bg-surface-1 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">{t('preview_label')}</h3>
            <span className="text-xs text-muted">
              {t('import_summary', {
                rows: parsed.rows.length,
                months: parsed.dates.length,
                from: parsed.dates[0],
                to: parsed.dates[parsed.dates.length - 1],
              })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-2">
                  <th className="py-2 pr-3">{t('source_row')}</th>
                  <th className="py-2 pr-3">{t('sample_value')}</th>
                  <th className="py-2">{t('map_to_account')}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => {
                  const sample = row.values.find(v => v.num !== null);
                  const skipped = row.mapping === SKIP;
                  return (
                    <tr key={i} className={`border-b border-border/40 ${skipped ? 'opacity-50' : ''}`}>
                      <td className="py-2 pr-3 text-fg">{row.label}</td>
                      <td className="py-2 pr-3 text-muted">{sample ? `${sample.date}: ${sample.raw}` : '—'}</td>
                      <td className="py-2">
                        <CategorySelect
                          items={acctOptions}
                          categoryMeta={categoryMeta}
                          value={row.mapping}
                          onChange={v => setMapping(i, v)}
                          leadingOptions={[
                            { value: SKIP, label: t('import_skip') },
                            { value: DAY, label: t('import_month_comment') },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="mt-3 flex items-start gap-2 text-xs text-fg-2">
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="mt-0.5" />
            {t('overwrite_toggle')}
          </label>

          <div className="mt-3">
            <Button variant="primary" size="sm" onClick={onImport} disabled={importMut.isPending}>
              {t('import_btn')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
