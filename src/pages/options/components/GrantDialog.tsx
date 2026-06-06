import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { todayISO } from '@/utils/dates';
import type { OptionGrant } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  grant: OptionGrant | null;
  companyId: string;
  onSave: (grant: OptionGrant) => void;
  onDelete: () => void;
}

type Draft = Omit<OptionGrant, 'total_shares' | 'strike_price' | 'cliff_months' | 'vesting_months'> & {
  total_shares: string;
  strike_price: string;
  cliff_months: string;
  vesting_months: string;
};

function toDraft(g: OptionGrant | null, companyId: string): Draft {
  return {
    id: g?.id ?? '',
    company_id: companyId,
    label: g?.label ?? '',
    grant_type: g?.grant_type ?? 'ISO',
    grant_date: g?.grant_date ?? todayISO(),
    total_shares: g ? String(g.total_shares) : '',
    strike_price: g ? String(g.strike_price) : '',
    vesting_start: g?.vesting_start ?? todayISO(),
    cliff_months: g ? String(g.cliff_months) : '12',
    vesting_months: g ? String(g.vesting_months) : '48',
    vesting_interval: g?.vesting_interval ?? 'monthly',
    expiry_date: g?.expiry_date ?? '',
  };
}

export function GrantDialog({ open, onClose, grant, companyId, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = grant === null;
  const [d, setD] = useState<Draft>(() => toDraft(grant, companyId));

  useEffect(() => { if (open) setD(toDraft(grant, companyId)); }, [open, grant, companyId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(s => ({ ...s, [k]: v }));

  const handleSave = () => {
    onSave({
      id: grant?.id ?? `grant_${Date.now()}`,
      company_id: companyId,
      label: d.label.trim(),
      grant_type: d.grant_type,
      grant_date: d.grant_date,
      total_shares: Number(d.total_shares) || 0,
      strike_price: Number(d.strike_price) || 0,
      vesting_start: d.vesting_start,
      cliff_months: Number(d.cliff_months) || 0,
      vesting_months: Number(d.vesting_months) || 0,
      vesting_interval: d.vesting_interval,
      expiry_date: d.expiry_date,
    });
  };

  const inputCls = 'h-8 w-full rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const labelCls = 'block text-xs font-medium text-fg-2 mb-1';
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className={labelCls}>{label}</label>{children}</div>
  );

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('opt_new_grant') : t('opt_edit_grant')} className="max-w-lg">
      <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
        <Field label={t('opt_grant_label')}>
          <input className={inputCls} value={d.label} onChange={e => set('label', e.target.value)} />
        </Field>
        <Field label={t('opt_grant_type')}>
          <input className={inputCls} value={d.grant_type} onChange={e => set('grant_type', e.target.value)} placeholder="ISO / NSO / RSU" />
        </Field>
        <Field label={t('opt_grant_date')}>
          <input type="date" className={inputCls} value={d.grant_date} onChange={e => set('grant_date', e.target.value)} />
        </Field>
        <Field label={t('opt_total_shares')}>
          <input type="number" className={inputCls} value={d.total_shares} onChange={e => set('total_shares', e.target.value)} />
        </Field>
        <Field label={t('opt_strike_price')}>
          <input type="number" step="0.0001" className={inputCls} value={d.strike_price} onChange={e => set('strike_price', e.target.value)} placeholder={t('opt_strike_hint')} />
        </Field>
        <Field label={t('opt_vesting_start')}>
          <input type="date" className={inputCls} value={d.vesting_start} onChange={e => set('vesting_start', e.target.value)} />
        </Field>
        <Field label={t('opt_cliff_months')}>
          <input type="number" className={inputCls} value={d.cliff_months} onChange={e => set('cliff_months', e.target.value)} />
        </Field>
        <Field label={t('opt_vesting_months')}>
          <input type="number" className={inputCls} value={d.vesting_months} onChange={e => set('vesting_months', e.target.value)} />
        </Field>
        <Field label={t('opt_vesting_interval')}>
          <select className={inputCls} value={d.vesting_interval} onChange={e => set('vesting_interval', e.target.value)}>
            <option value="monthly">{t('opt_interval_monthly')}</option>
            <option value="quarterly">{t('opt_interval_quarterly')}</option>
            <option value="annual">{t('opt_interval_annual')}</option>
          </select>
        </Field>
        <Field label={t('opt_expiry_date')}>
          <input type="date" className={inputCls} value={d.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between">
        {!isNew ? <Button variant="danger" size="sm" onClick={onDelete}>{t('opt_delete_grant')}</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
