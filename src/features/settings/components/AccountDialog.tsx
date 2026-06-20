import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, SelectItem } from '@/shared/ui/Select';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Label } from '@/shared/ui/Label';
import { tr } from '@/shared/i18n';
import { KINDS } from '@/constants';
import { migrateLegacyOwnership, shareFor } from '@/shared/utils/ownership';
import { TagChipInput } from './TagChipInput';
import type { Account, AccountType, CategoryMeta, Currency, OwnershipEntry, Person } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

interface Props {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  accounts: Account[];
  accountTypes: AccountType[];
  people: Person[];
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
  split: boolean;
  shares: Record<string, number>;
  sort_order: number;
  growthPct: string;
  active: boolean;
  tags: string[];
  currency: Currency;
}

function nextId(prefix: string, accounts: Account[]): string {
  const ids = new Set(accounts.map(a => a.id));
  let n = 1;
  while (ids.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

/** Maps an ownership array onto the dialog's owner/split/shares fields. */
function ownershipToForm(ownership: OwnershipEntry[], people: Person[]): { owner: string; split: boolean; shares: Record<string, number> } {
  const isSingle = ownership.length === 1 && Math.round(ownership[0].share * 100) === 100;
  const shares: Record<string, number> = {};
  for (const p of people) shares[p.id] = Math.round(shareFor(ownership, p.id) * 100);
  return {
    owner: isSingle ? ownership[0].person_id : (people[0]?.id ?? ''),
    split: !isSingle,
    shares,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

export function AccountDialog({
  open, onClose, account, accounts, accountTypes, people, categoryMeta, availableTags, mainCurrency, hasHistory, onSave, onDelete,
}: Props) {
  const { t } = useTranslation();
  const isNew = account === null;
  const activePeople = people.filter(p => p.active);
  const [form, setForm] = useState<FormState>(() => buildInitial());

  function buildInitial(): FormState {
    if (account) {
      return {
        type: account.type,
        name_fr: account.name_fr,
        name_en: account.name_en,
        category: account.category,
        kind: account.kind,
        ...ownershipToForm(account.ownership, activePeople),
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
      ...ownershipToForm(migrateLegacyOwnership(first?.default_owner, first?.default_ownership_share), activePeople),
      sort_order: 0,
      growthPct: '',
      active: true,
      tags: [],
      currency: mainCurrency,
    };
  }

  useEffect(() => {
    if (open) setForm(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const setShare = (personId: string, pct: number) => setForm(f => ({ ...f, shares: { ...f.shares, [personId]: Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0)) } }));

  const onTypeChange = (prefix: string) => {
    const type = accountTypes.find(at => at.id_prefix === prefix);
    if (!type) { set('type', prefix); return; }
    const orderInCat = accounts.filter(a => a.category === type.category).map(a => a.sort_order ?? 0);
    setForm(f => ({
      ...f,
      type: prefix,
      category: type.category,
      kind: type.kind,
      ...ownershipToForm(migrateLegacyOwnership(type.default_owner, type.default_ownership_share), activePeople),
      sort_order: (orderInCat.length ? Math.max(...orderInCat) : 0) + 10,
      name_fr: f.name_fr || type.name_fr,
      name_en: f.name_en || type.name_en,
    }));
  };

  const sharesTotal = activePeople.reduce((sum, p) => sum + (form.shares[p.id] ?? 0), 0);
  const splitInvalid = form.split && sharesTotal !== 100;

  const handleSave = () => {
    const nameFr = form.name_fr.trim();
    const nameEn = form.name_en.trim();
    if (!nameFr && !nameEn) return;
    if (splitInvalid) return;
    const ownership: OwnershipEntry[] = form.split
      ? activePeople.filter(p => (form.shares[p.id] ?? 0) > 0).map(p => ({ person_id: p.id, share: (form.shares[p.id] ?? 0) / 100 }))
      : (form.owner ? [{ person_id: form.owner, share: 1 }] : []);
    const id = isNew ? nextId(form.type, accounts) : account!.id;
    onSave({
      id,
      type: form.type,
      name_fr: nameFr || nameEn,
      name_en: nameEn || nameFr,
      category: form.category,
      kind: form.kind,
      ownership,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      tags: form.tags,
      annual_rate: Number(form.growthPct) / 100 || 0,
      currency: form.currency,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('add_account') : t('edit_account')} className="max-w-lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
        {isNew && (
          <Field label={t('account_type_label')}>
            <Select value={form.type} onValueChange={onTypeChange}>
              {accountTypes.map(at => (
                <SelectItem key={at.id_prefix} value={at.id_prefix}>{tr(at)}</SelectItem>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('name_fr_label')}>
            <Input value={form.name_fr} onChange={e => set('name_fr', e.target.value)} />
          </Field>
          <Field label={t('name_en_label')}>
            <Input value={form.name_en} onChange={e => set('name_en', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('category_label')}>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              {[...categoryMeta].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(c => (
                <SelectItem key={c.id} value={c.id}>{tr(c)}</SelectItem>
              ))}
            </Select>
          </Field>
          <Field label={t('kind_label')}>
            <Select value={form.kind} onValueChange={v => set('kind', v as 'asset' | 'debt')}>
              {KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </Select>
          </Field>
        </div>

        <Checkbox checked={form.split} onCheckedChange={v => set('split', v)} label={t('split_ownership_label')} />

        {!form.split ? (
          <Field label={t('owner_label_field')}>
            <Select value={form.owner} onValueChange={v => set('owner', v)} aria-label={t('owner_label_field')}>
              {activePeople.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.id}</SelectItem>)}
            </Select>
          </Field>
        ) : (
          <div className="space-y-2 rounded-lg bg-surface-2 p-3">
            {activePeople.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <Label>{p.name || p.id}</Label>
                <Input
                  type="number" min={0} max={100} className="w-20"
                  value={form.shares[p.id] ?? 0}
                  onChange={e => setShare(p.id, Number(e.target.value))}
                />
              </div>
            ))}
            <p className={`text-xs ${splitInvalid ? 'text-red' : 'text-muted'}`}>
              {t('share_total_label', { pct: sharesTotal })}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('order_label')}>
            <Input type="number" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} />
          </Field>
          <Field label={t('growth_rate_label')}>
            <Input type="number" step="0.01" value={form.growthPct} onChange={e => set('growthPct', e.target.value)} />
          </Field>
        </div>

        <Field label={t('currency_label')}>
          <Select value={form.currency} onValueChange={v => set('currency', v as Currency)}>
            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </Select>
        </Field>

        <Field label={t('tags_label')}>
          <TagChipInput value={form.tags} onChange={tags => set('tags', tags)} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </Field>

        <Checkbox checked={form.active} onCheckedChange={v => set('active', v)} label={t('active_label')} />

        {!isNew && <p className="text-xs text-muted">ID: <code>{account!.id}</code></p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew && !hasHistory
          ? <Button variant="danger" size="sm" onClick={onDelete}>{t('delete')}</Button>
          : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={splitInvalid}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
