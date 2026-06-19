import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Select, SelectItem } from '@/ui/Select';
import { Checkbox } from '@/ui/Checkbox';
import { Label } from '@/ui/Label';
import { TagChipInput } from '@/pages/settings/components/TagChipInput';
import type { OptionCompany, Currency, Person } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

interface Props {
  open: boolean;
  onClose: () => void;
  company: OptionCompany | null;
  people: Person[];
  availableTags?: string[];
  mainCurrency: Currency;
  onSave: (company: OptionCompany) => void;
  onDelete: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

export function CompanyDialog({ open, onClose, company, people, availableTags = [], mainCurrency, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = company === null;
  const activePeople = people.filter(p => p.active);
  const defaultOwner = people.find(p => p.primary)?.id ?? activePeople[0]?.id ?? '';
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [active, setActive] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>(mainCurrency);
  const [owner, setOwner] = useState(defaultOwner);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? '');
    setTicker(company?.ticker ?? '');
    setActive(company?.active !== false);
    setTags(company?.tags ? [...company.tags] : []);
    setCurrency(company?.currency ?? mainCurrency);
    setOwner(company?.owner ?? defaultOwner);
  }, [open, company, mainCurrency, defaultOwner]);

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
      owner,
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
        <Field label={t('owner_label_field')}>
          <Select value={owner} onValueChange={setOwner} aria-label={t('owner_label_field')}>
            {activePeople.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.id}</SelectItem>)}
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
