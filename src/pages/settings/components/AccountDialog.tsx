import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { tr } from '@/i18n';
import { OWNERS, KINDS } from '@/constants';
import { TagChipInput } from './TagChipInput';
import type { Account, AccountType, CategoryMeta, Currency } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Account being edited, or null when creating. */
  account: Account | null;
  accounts: Account[];
  accountTypes: AccountType[];
  categoryMeta: CategoryMeta[];
  availableTags: string[];
  mainCurrency: Currency;
  hasHistory: boolean;
  onSave: (account: Account) => void;
  onDelete: () => void;
}

interface FormState {
  type: string;
  name_fr: string;
  name_en: string;
  category: string;
  kind: 'asset' | 'debt';
  owner: string;
  sharePct: number;
  sort_order: number;
  growthPct: string;
  active: boolean;
  tags: string[];
  currency: Currency;
}

const OWNER_KEYS: Record<string, string> = { self: 'owner_self', partner: 'owner_partner', joint: 'owner_joint' };

function nextId(prefix: string, accounts: Account[]): string {
  const ids = new Set(accounts.map(a => a.id));
  let n = 1;
  while (ids.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

export function AccountDialog({
  open, onClose, account, accounts, accountTypes, categoryMeta, availableTags, mainCurrency, hasHistory, onSave, onDelete,
}: Props) {
  const { t } = useTranslation();
  const isNew = account === null;

  const [form, setForm] = useState<FormState>(() => buildInitial());

  function buildInitial(): FormState {
    if (account) {
      return {
        type: account.type,
        name_fr: account.name_fr,
        name_en: account.name_en,
        category: account.category,
        kind: account.kind,
        owner: account.owner,
        sharePct: Math.round((account.ownership_share ?? 1) * 100),
        sort_order: account.sort_order ?? 0,
        growthPct: account.annual_rate ? String(+(account.annual_rate * 100).toFixed(4)) : '',
        active: account.active,
        tags: [...account.tags],
        currency: account.currency ?? mainCurrency,
      };
    }
    const first = accountTypes[0];
    return {
      type: first?.id_prefix ?? '',
      name_fr: '', name_en: '',
      category: first?.category ?? categoryMeta[0]?.id ?? '',
      kind: first?.kind ?? 'asset',
      owner: first?.default_owner ?? 'self',
      sharePct: Math.round((first?.default_ownership_share ?? 1) * 100),
      sort_order: 0,
      growthPct: '',
      active: true,
      tags: [],
      currency: mainCurrency,
    };
  }

  // Re-seed whenever the dialog opens for a different account.
  useEffect(() => {
    if (open) setForm(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const onTypeChange = (prefix: string) => {
    const type = accountTypes.find(at => at.id_prefix === prefix);
    if (!type) { set('type', prefix); return; }
    const orderInCat = accounts.filter(a => a.category === type.category).map(a => a.sort_order ?? 0);
    setForm(f => ({
      ...f,
      type: prefix,
      category: type.category,
      kind: type.kind,
      owner: type.default_owner || 'self',
      sharePct: Math.round((type.default_ownership_share ?? 1) * 100),
      sort_order: (orderInCat.length ? Math.max(...orderInCat) : 0) + 10,
      name_fr: f.name_fr || type.name_fr,
      name_en: f.name_en || type.name_en,
    }));
  };

  const handleSave = () => {
    const nameFr = form.name_fr.trim();
    const nameEn = form.name_en.trim();
    if (!nameFr && !nameEn) return;
    const id = isNew ? nextId(form.type, accounts) : account!.id;
    onSave({
      id,
      type: form.type,
      name_fr: nameFr || nameEn,
      name_en: nameEn || nameFr,
      category: form.category,
      kind: form.kind,
      owner: form.owner,
      ownership_share: Math.max(0, Math.min(100, Number(form.sharePct) || 0)) / 100,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      tags: form.tags,
      annual_rate: Number(form.growthPct) / 100 || 0,
      currency: form.currency,
    });
  };

  const inputCls = 'h-8 w-full rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const labelCls = 'block text-xs font-medium text-fg-2 mb-1';

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('add_account') : t('edit_account')} className="max-w-lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        {isNew && (
          <div>
            <label className={labelCls} htmlFor="acct-type">{t('account_type_label')}</label>
            <select id="acct-type" className={inputCls} value={form.type} onChange={e => onTypeChange(e.target.value)}>
              {accountTypes.map(at => (
                <option key={at.id_prefix} value={at.id_prefix}>{tr(at)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="acct-name-fr">{t('name_fr_label')}</label>
            <input id="acct-name-fr" className={inputCls} value={form.name_fr} onChange={e => set('name_fr', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="acct-name-en">{t('name_en_label')}</label>
            <input id="acct-name-en" className={inputCls} value={form.name_en} onChange={e => set('name_en', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="acct-category">{t('category_label')}</label>
            <select id="acct-category" className={inputCls} value={form.category} onChange={e => set('category', e.target.value)}>
              {[...categoryMeta].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(c => (
                <option key={c.id} value={c.id}>{tr(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="acct-kind">{t('kind_label')}</label>
            <select id="acct-kind" className={inputCls} value={form.kind} onChange={e => set('kind', e.target.value as 'asset' | 'debt')}>
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="acct-owner">{t('owner_label_field')}</label>
            <select id="acct-owner" className={inputCls} value={form.owner} onChange={e => set('owner', e.target.value)}>
              {OWNERS.map(o => <option key={o} value={o}>{t(OWNER_KEYS[o] ?? o)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="acct-share">{t('share_label')}</label>
            <input id="acct-share" type="number" min={0} max={100} className={inputCls} value={form.sharePct} onChange={e => set('sharePct', Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="acct-order">{t('order_label')}</label>
            <input id="acct-order" type="number" className={inputCls} value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="acct-growth">{t('growth_rate_label')}</label>
            <input id="acct-growth" type="number" step="0.01" className={inputCls} value={form.growthPct} onChange={e => set('growthPct', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="acct-currency">{t('currency_label')}</label>
          <select id="acct-currency" className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value as Currency)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>{t('tags_label')}</label>
          <TagChipInput value={form.tags} onChange={tags => set('tags', tags)} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </div>

        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
          {t('active_label')}
        </label>

        {!isNew && (
          <p className="text-xs text-muted">ID: <code>{account!.id}</code></p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew && !hasHistory ? (
          <Button variant="danger" size="sm" onClick={onDelete}>{t('delete')}</Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
