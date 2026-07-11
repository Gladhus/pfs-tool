import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, SelectItem } from '@/shared/ui/Select';
import { Label } from '@/shared/ui/Label';
import { tr } from '@/shared/i18n';
import { migrateLegacyOwnership } from '@/shared/utils/ownership';
import { OwnerSplitField, ownershipToSplit, splitToOwnership, splitInvalid } from './OwnerSplitField';
import type { Currency, Person, Spending, SpendingCategory } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

interface Props {
  open: boolean;
  onClose: () => void;
  spending: Spending | null;
  categories: SpendingCategory[];
  people: Person[];
  mainCurrency: Currency;
  defaultDate: string;
  onSave: (spending: Spending) => void;
  onDelete: () => void;
}

function newId(): string {
  return `sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function SpendingDialog({ open, onClose, spending, categories, people, mainCurrency, defaultDate, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = spending === null;
  const activePeople = people.filter(p => p.active);
  const activeCats = categories.filter(c => c.active || c.id === spending?.category_id);
  const primaryId = people.find(p => p.primary)?.id ?? activePeople[0]?.id ?? '';

  const build = () => ({
    date: spending?.date ?? defaultDate,
    amount: spending ? String(spending.amount) : '',
    currency: spending?.currency ?? mainCurrency,
    category_id: spending?.category_id ?? activeCats[0]?.id ?? '',
    split: ownershipToSplit(spending?.ownership ?? migrateLegacyOwnership(primaryId, 1), activePeople),
    comment: spending?.comment ?? '',
  });
  const [form, setForm] = useState(build);

  useEffect(() => {
    if (open) setForm(build());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, spending]);

  const set = <K extends keyof ReturnType<typeof build>>(k: K, v: ReturnType<typeof build>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const invalid = splitInvalid(form.split, activePeople);
  const amountNum = Number(form.amount);
  const canSave = form.date && Number.isFinite(amountNum) && amountNum > 0 && form.category_id && !invalid;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: isNew ? newId() : spending!.id,
      date: form.date,
      amount: amountNum,
      currency: form.currency,
      category_id: form.category_id,
      ownership: splitToOwnership(form.split, activePeople),
      comment: form.comment.trim() || undefined,
      entered_at: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('sp_add_spending') : t('sp_edit_spending')} className="max-w-lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('sp_date')}</Label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div>
            <Label>{t('sp_amount')}</Label>
            <Input type="number" min={0} step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('sp_category')}</Label>
            <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
              {activeCats.map(c => <SelectItem key={c.id} value={c.id}>{tr(c)}</SelectItem>)}
            </Select>
          </div>
          <div>
            <Label>{t('currency_label')}</Label>
            <Select value={form.currency} onValueChange={v => set('currency', v as Currency)}>
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </Select>
          </div>
        </div>

        <OwnerSplitField people={activePeople} value={form.split} onChange={v => set('split', v)} />

        <div>
          <Label>{t('sp_comment')}</Label>
          <Input value={form.comment} onChange={e => set('comment', e.target.value)} placeholder={t('sp_comment_placeholder')} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew
          ? <Button variant="danger" size="sm" onClick={onDelete}>{t('delete')}</Button>
          : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
