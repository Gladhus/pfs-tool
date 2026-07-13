import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tr } from '@/shared/i18n';
import { useToastStore } from '@/shared/stores/toast.store';
import { TAG_PALETTE } from '@/shared/utils/colors';
import { migrateLegacyOwnership, ownershipLabel } from '@/shared/utils/ownership';
import { useWriteSpendingsMutation, useWriteSpendingCategoriesMutation } from '@/shared/io/queries/sheetMutations';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { OwnershipEntry, SpendingCategory } from '@/types/sheets';
import { useSpendingData } from './data/useSpendingData';
import { extractPdf } from './import/pdf';
import { detectImporter } from './import/registry';
import type { RawTxn, SpendingImporter } from './import/types';
import {
  summarize, expenseTxns, distinct, assignImportIds, suggestCategory, slugCategoryId, buildSpendings,
} from './import/prepare';
import { loadAccountMap, saveAccountMap, loadCategoryMap, saveCategoryMap } from './import/mappings';
import { ownershipToSplit, splitToOwnership, splitInvalid, type OwnerSplitValue } from './components/OwnerSplitField';
import { ImportAccountsStep } from './components/import/ImportAccountsStep';
import { ImportCategoriesStep, NEW_CATEGORY } from './components/import/ImportCategoriesStep';
import { ImportReviewStep } from './components/import/ImportReviewStep';

type Step = 'upload' | 'accounts' | 'categories' | 'review' | 'done';
const STEPS: Step[] = ['upload', 'accounts', 'categories', 'review'];

export default function SpendingImportPage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);
  const { categories, spendings, people, mainCurrency, isPending } = useSpendingData();
  const writeCategories = useWriteSpendingCategoriesMutation();
  const writeSpendings = useWriteSpendingsMutation();

  const [step, setStep] = useState<Step>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [importer, setImporter] = useState<SpendingImporter | null>(null);
  const [raw, setRaw] = useState<RawTxn[]>([]);
  const [acctSplit, setAcctSplit] = useState<Record<string, OwnerSplitValue>>({});
  const [catChoice, setCatChoice] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ imported: number; duplicates: number; newCats: number } | null>(null);

  const activePeople = useMemo(() => people.filter(p => p.active), [people]);
  const primaryId = people.find(p => p.primary)?.id ?? activePeople[0]?.id ?? '';

  const expenses = useMemo(() => expenseTxns(raw), [raw]);
  const keyed = useMemo(() => assignImportIds(expenses), [expenses]);
  const accounts = useMemo(() => distinct(expenses, x => x.account), [expenses]);
  const bankCats = useMemo(() => distinct(expenses, x => x.category), [expenses]);
  const summary = useMemo(() => summarize(raw), [raw]);

  const existingIds = useMemo(() => new Set(spendings.map(s => s.id)), [spendings]);
  const duplicateIds = useMemo(() => new Set(keyed.filter(k => existingIds.has(k.id)).map(k => k.id)), [keyed, existingIds]);

  const rememberedAcctKeys = useMemo(() => new Set(Object.keys(importer ? loadAccountMap(importer.id) : {})), [importer]);
  const rememberedCatKeys = useMemo(() => new Set(Object.keys(importer ? loadCategoryMap(importer.id) : {})), [importer]);
  const orderedAccounts = useMemo(
    () => [...accounts].sort((a, b) => Number(rememberedAcctKeys.has(a)) - Number(rememberedAcctKeys.has(b))),
    [accounts, rememberedAcctKeys]);
  const orderedCats = useMemo(
    () => [...bankCats].sort((a, b) => Number(rememberedCatKeys.has(a)) - Number(rememberedCatKeys.has(b))),
    [bankCats, rememberedCatKeys]);

  // Seed the account/category maps from remembered choices + name suggestions.
  useEffect(() => {
    if (!importer || !raw.length) return;
    const exp = expenseTxns(raw);
    const rAcct = loadAccountMap(importer.id);
    const seededAcct: Record<string, OwnerSplitValue> = {};
    for (const a of distinct(exp, x => x.account)) {
      seededAcct[a] = ownershipToSplit(rAcct[a] ?? migrateLegacyOwnership(primaryId, 1), activePeople);
    }
    setAcctSplit(seededAcct);

    const rCat = loadCategoryMap(importer.id);
    const seededCat: Record<string, string> = {};
    for (const c of distinct(exp, x => x.category)) {
      const remembered = rCat[c];
      seededCat[c] = (remembered && categories.some(x => x.id === remembered))
        ? remembered
        : (suggestCategory(c, categories) || NEW_CATEGORY);
    }
    setCatChoice(seededCat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importer, raw]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(''); setBusy(true); setImporter(null); setRaw([]); setExcluded(new Set());
    try {
      const src = await extractPdf(file);
      const imp = detectImporter(src);
      if (!imp) { setError(t('sp_imp_unrecognized')); return; }
      const parsed = imp.parse(src);
      if (!expenseTxns(parsed).length) { setError(t('sp_imp_empty')); return; }
      setImporter(imp);
      setRaw(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const toggleExclude = (id: string) => setExcluded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const targetCategoryLabel = (bankCat: string): string => {
    const choice = catChoice[bankCat] ?? NEW_CATEGORY;
    if (choice === NEW_CATEGORY) return `${bankCat} (${t('sp_imp_new')})`;
    const c = categories.find(x => x.id === choice);
    return c ? tr(c) : bankCat;
  };
  const ownerLabelForAcct = (acct: string): string => {
    const v = acctSplit[acct];
    return v ? ownershipLabel(splitToOwnership(v, activePeople), people, t('viewer_household')) : '';
  };

  const accountsValid = orderedAccounts.every(a => acctSplit[a] && !splitInvalid(acctSplit[a], activePeople));
  const importCount = keyed.filter(k => !duplicateIds.has(k.id) && !excluded.has(k.id)).length;
  const writing = writeCategories.isPending || writeSpendings.isPending;

  function doImport() {
    if (!importer) return;
    const taken = new Set(categories.map(c => c.id));
    const newCats: SpendingCategory[] = [];
    const catTarget: Record<string, string> = {};
    let sortBase = Math.max(0, ...categories.map(c => c.sort_order ?? 0));
    for (const bankCat of bankCats) {
      const choice = catChoice[bankCat] ?? NEW_CATEGORY;
      if (choice === NEW_CATEGORY) {
        const id = slugCategoryId(bankCat, taken);
        taken.add(id);
        sortBase += 10;
        newCats.push({ id, name_fr: bankCat, name_en: bankCat, color: TAG_PALETTE[newCats.length % TAG_PALETTE.length], icon: 'other', sort_order: sortBase, active: true });
        catTarget[bankCat] = id;
      } else {
        catTarget[bankCat] = choice;
      }
    }
    const acctOwn: Record<string, OwnershipEntry[]> = {};
    for (const a of accounts) acctOwn[a] = splitToOwnership(acctSplit[a], activePeople);

    const { spendings: toAdd, duplicates } = buildSpendings(keyed, catTarget, acctOwn, existingIds, new Date().toISOString(), excluded);

    const finish = () => {
      saveCategoryMap(importer.id, catTarget);
      saveAccountMap(importer.id, acctOwn);
      setResult({ imported: toAdd.length, duplicates, newCats: newCats.length });
      setStep('done');
    };
    const fail = () => addToast(t('sp_save_failed'), 'error');

    if (!toAdd.length && !newCats.length) { finish(); return; }
    const writeAll = () => writeSpendings.mutate([...spendings, ...toAdd], { onSuccess: finish, onError: fail });
    if (newCats.length) {
      writeCategories.mutate([...categories, ...newCats], { onSuccess: writeAll, onError: fail });
    } else {
      writeAll();
    }
  }

  if (isPending) return <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" className="h-24" />)}</div>;

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Stepper */}
      {step !== 'done' && (
        <div className="flex items-center gap-2 text-xs">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i <= stepIndex ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'}`}>{i + 1}</span>
              <span className={i === stepIndex ? 'font-medium text-fg' : 'text-muted'}>{t(`sp_imp_step_${s}`)}</span>
              {i < STEPS.length - 1 && <Icon name="chevronRight" size={12} className="text-muted" />}
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border bg-surface-1 p-6 text-center">
            <Icon name="upload" size={24} className="mx-auto text-muted" />
            <p className="mt-2 text-sm text-fg">{t('sp_imp_upload_prompt')}</p>
            <p className="mt-1 text-xs text-muted">{t('sp_imp_upload_hint')}</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-dark">
              <Icon name="upload" size={14} />
              {t('sp_imp_choose_file')}
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
            </label>
            {busy && <p className="mt-3 text-sm text-muted">{t('sp_imp_parsing')}</p>}
            {error && <p className="mt-3 text-sm text-red">{error}</p>}
          </div>

          {importer && raw.length > 0 && (
            <div className="rounded-xl bg-surface-1 p-4 shadow-sm">
              <p className="text-sm font-medium text-fg">{t('sp_imp_detected', { name: importer.label })}</p>
              <ul className="mt-2 space-y-1 text-sm text-fg-2">
                <li>✓ {t('sp_imp_found_expenses', { count: summary.expenses })}</li>
                <li className="text-muted">{t('sp_imp_skipped', { income: summary.income, transfers: summary.transfers, pending: summary.pending })}</li>
              </ul>
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setStep('accounts')} disabled={!summary.expenses}>
                  {t('sp_imp_continue')} <Icon name="chevronRight" size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accounts */}
      {step === 'accounts' && (
        <>
          <ImportAccountsStep
            accounts={orderedAccounts}
            rememberedKeys={rememberedAcctKeys}
            people={people}
            value={acctSplit}
            onChange={(a, v) => setAcctSplit(prev => ({ ...prev, [a]: v }))}
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>{t('sp_imp_back')}</Button>
            <Button variant="primary" size="sm" onClick={() => setStep('categories')} disabled={!accountsValid}>
              {t('sp_imp_next')} <Icon name="chevronRight" size={14} />
            </Button>
          </div>
        </>
      )}

      {/* Categories */}
      {step === 'categories' && (
        <>
          <ImportCategoriesStep
            categories={orderedCats}
            rememberedKeys={rememberedCatKeys}
            spendingCategories={categories}
            value={catChoice}
            onChange={(c, target) => setCatChoice(prev => ({ ...prev, [c]: target }))}
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep('accounts')}>{t('sp_imp_back')}</Button>
            <Button variant="primary" size="sm" onClick={() => setStep('review')}>
              {t('sp_imp_next')} <Icon name="chevronRight" size={14} />
            </Button>
          </div>
        </>
      )}

      {/* Review */}
      {step === 'review' && (
        <>
          <ImportReviewStep
            keyed={keyed}
            excluded={excluded}
            duplicateIds={duplicateIds}
            onToggle={toggleExclude}
            targetCategoryLabel={targetCategoryLabel}
            ownerLabelFor={ownerLabelForAcct}
            mainCurrency={mainCurrency}
          />
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep('categories')}>{t('sp_imp_back')}</Button>
            <Button variant="primary" size="sm" onClick={doImport} disabled={writing || importCount === 0}>
              {writing ? t('sp_imp_importing') : t('sp_imp_import_n', { count: importCount })}
            </Button>
          </div>
        </>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <div className="rounded-xl bg-surface-1 p-6 text-center shadow-sm">
          <Icon name="check" size={28} className="mx-auto text-ok" />
          <p className="mt-2 text-base font-semibold text-fg">{t('sp_imp_done_title', { count: result.imported })}</p>
          <p className="mt-1 text-sm text-muted">
            {t('sp_imp_done_detail', { newCats: result.newCats, duplicates: result.duplicates })}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="default" size="sm" onClick={() => { setStep('upload'); setImporter(null); setRaw([]); setResult(null); setExcluded(new Set()); }}>
              {t('sp_imp_another')}
            </Button>
            <Button variant="primary" size="sm" asChild><Link to="/spending/entries">{t('sp_imp_view_entries')}</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}
