import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, SelectItem } from '@/shared/ui/Select';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Label } from '@/shared/ui/Label';
import { tr } from '@/shared/i18n';
import { migrateLegacyOwnership } from '@/shared/utils/ownership';
import { OwnerSplitField, ownershipToSplit, splitToOwnership, splitInvalid } from './OwnerSplitField';
import type { Currency, Person, RecurrenceFrequency, SpendingCategory, SpendingRecurrence } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];
const FREQUENCIES: RecurrenceFrequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

interface Props {
  open: boolean;
  onClose: () => void;
  recurrence: SpendingRecurrence | null;
  categories: SpendingCategory[];
  people: Person[];
  mainCurrency: Currency;
  defaultDate: string;
  onSave: (recurrence: SpendingRecurrence) => void;
  onDelete: () => void;
}

function newId(): string {
  return `rec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function RecurrenceDialog({ open, onClose, recurrence, categories, people, mainCurrency, defaultDate, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = recurrence === null;
  const activePeople = people.filter(p => p.active);
  const activeCats = categories.filter(c => c.active || c.id === recurrence?.category_id);
  const primaryId = people.find(p => p.primary)?.id ?? activePeople[0]?.id ?? '';

  const build = () => ({
    label: recurrence?.label ?? '',
    amount: recurrence ? String(recurrence.amount) : '',
    currency: recurrence?.currency ?? mainCurrency,
    category_id: recurrence?.category_id ?? activeCats[0]?.id ?? '',
    frequency: recurrence?.frequency ?? ('monthly' as RecurrenceFrequency),
    interval: recurrence ? String(recurrence.interval) : '1',
    start_date: recurrence?.start_date ?? defaultDate,
    end_date: recurrence?.end_date ?? '',
    active: recurrence?.active ?? true,
    split: ownershipToSplit(recurrence?.ownership ?? migrateLegacyOwnership(primaryId, 1), activePeople),
    comment: recurrence?.comment ?? '',
  });
  const [form, setForm] = useState(build);

  useEffect(() => {
    if (open) setForm(build());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurrence]);

  const set = <K extends keyof ReturnType<typeof build>>(k: K, v: ReturnType<typeof build>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const invalid = splitInvalid(form.split, activePeople);
  const amountNum = Number(form.amount);
  const intervalNum = Math.max(1, Math.floor(Number(form.interval) || 1));
  const canSave = form.label.trim() && Number.isFinite(amountNum) && amountNum > 0
    && form.category_id && form.start_date && !invalid
    && (!form.end_date || form.end_date >= form.start_date);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: isNew ? newId() : recurrence!.id,
      label: form.label.trim(),
      amount: amountNum,
      currency: form.currency,
      category_id: form.category_id,
      ownership: splitToOwnership(form.split, activePeople),
      frequency: form.frequency,
      interval: intervalNum,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      active: form.active,
      comment: form.comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('sp_add_recurrence') : t('sp_edit_recurrence')} className="max-w-lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
        <div>
          <Label>{t('sp_recurrence_label')}</Label>
          <Input value={form.label} onChange={e => set('label', e.target.value)} placeholder={t('sp_recurrence_label_placeholder')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('sp_amount')}</Label>
            <Input type="number" min={0} step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>{t('currency_label')}</Label>
            <Select value={form.currency} onValueChange={v => set('currency', v as Currency)}>
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </Select>
          </div>
        </div>

        <div>
          <Label>{t('sp_category')}</Label>
          <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
            {activeCats.map(c => <SelectItem key={c.id} value={c.id}>{tr(c)}</SelectItem>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('sp_frequency')}</Label>
            <Select value={form.frequency} onValueChange={v => set('frequency', v as RecurrenceFrequency)}>
              {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{t(`sp_freq_${f}`)}</SelectItem>)}
            </Select>
          </div>
          <div>
            <Label>{t('sp_every_n')}</Label>
            <Input type="number" min={1} step="1" value={form.interval} onChange={e => set('interval', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('sp_starts')}</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <Label>{t('sp_ends_optional')}</Label>
            <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>

        <OwnerSplitField people={activePeople} value={form.split} onChange={v => set('split', v)} />

        <div>
          <Label>{t('sp_comment')}</Label>
          <Input value={form.comment} onChange={e => set('comment', e.target.value)} placeholder={t('sp_comment_placeholder')} />
        </div>

        <Checkbox checked={form.active} onCheckedChange={v => set('active', v)} label={t('active_label')} />
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
