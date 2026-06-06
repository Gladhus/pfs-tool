import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Select, SelectItem } from '@/ui/Select';
import { Checkbox } from '@/ui/Checkbox';
import { Label } from '@/ui/Label';
import { TagChipInput } from '@/pages/settings/components/TagChipInput';
import type { OptionCompany, Currency } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

interface Props {
  open: boolean;
  onClose: () => void;
  company: OptionCompany | null;
  availableTags?: string[];
  mainCurrency: Currency;
  onSave: (company: OptionCompany) => void;
  onDelete: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

export function CompanyDialog({ open, onClose, company, availableTags = [], mainCurrency, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = company === null;
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [active, setActive] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>(mainCurrency);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? '');
    setTicker(company?.ticker ?? '');
    setActive(company?.active !== false);
    setTags(company?.tags ? [...company.tags] : []);
    setCurrency(company?.currency ?? mainCurrency);
  }, [open, company, mainCurrency]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: company?.id ?? `comp_${Date.now()}`,
      name: trimmed,
      ticker: ticker.trim(),
      active,
      tags,
      currency,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('opt_new_company') : t('opt_edit_company')}>
      <div className="space-y-3">
        <Field label={t('opt_company_name')}>
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('opt_ticker')}>
          <Input value={ticker} onChange={e => setTicker(e.target.value)} />
        </Field>
        <Field label={t('currency_label')}>
          <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </Select>
        </Field>
        <Field label={t('opt_equity_tags')}>
          <TagChipInput value={tags} onChange={setTags} available={availableTags} placeholder={t('add_tag_placeholder')} />
          <p className="mt-1 text-xs text-muted">{t('opt_equity_tags_hint')}</p>
        </Field>
        <Checkbox checked={active} onCheckedChange={setActive} label={t('opt_active')} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        {!isNew ? <Button variant="danger" size="sm" onClick={onDelete}>{t('opt_delete_company')}</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
