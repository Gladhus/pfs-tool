import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
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

  const inputCls = 'h-8 w-full rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const labelCls = 'block text-xs font-medium text-fg-2 mb-1';

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('opt_new_company') : t('opt_edit_company')}>
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="comp-name">{t('opt_company_name')}</label>
          <input id="comp-name" className={inputCls} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelCls} htmlFor="comp-ticker">{t('opt_ticker')}</label>
          <input id="comp-ticker" className={inputCls} value={ticker} onChange={e => setTicker(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="comp-currency">{t('currency_label')}</label>
          <select id="comp-currency" className={inputCls} value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('opt_equity_tags')}</label>
          <TagChipInput value={tags} onChange={setTags} available={availableTags} placeholder={t('add_tag_placeholder')} />
          <p className="mt-1 text-xs text-muted">{t('opt_equity_tags_hint')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          {t('opt_active')}
        </label>
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
