import { useTranslation } from 'react-i18next';
import { Amount } from '@/shared/ui/Amount';
import { Checkbox } from '@/shared/ui/Checkbox';
import type { Currency } from '@/types/sheets';
import type { KeyedTxn } from '../../import/prepare';

interface Props {
  keyed: KeyedTxn[];
  excluded: Set<string>;
  duplicateIds: Set<string>;
  onToggle: (id: string) => void;
  targetCategoryLabel: (bankCategory: string) => string;
  ownerLabelFor: (account: string) => string;
  mainCurrency: Currency;
}

/** Wizard step: review the resulting spendings; untick any to skip. */
export function ImportReviewStep({ keyed, excluded, duplicateIds, onToggle, targetCategoryLabel, ownerLabelFor, mainCurrency }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t('sp_imp_review_help')}</p>
      <div className="overflow-x-auto rounded-xl bg-surface-1 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted">
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2">{t('sp_date')}</th>
              <th className="px-3 py-2">{t('sp_comment')}</th>
              <th className="px-3 py-2">{t('sp_category')}</th>
              <th className="px-3 py-2">{t('owner_label_field')}</th>
              <th className="px-3 py-2 text-right">{t('sp_amount')}</th>
            </tr>
          </thead>
          <tbody>
            {keyed.map(({ txn, id }) => {
              const dup = duplicateIds.has(id);
              const off = dup || excluded.has(id);
              return (
                <tr key={id} className={`border-b border-border/40 last:border-0 ${off ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-1.5">
                    <Checkbox
                      checked={!off}
                      disabled={dup}
                      onCheckedChange={() => onToggle(id)}
                      aria-label={txn.description || txn.category}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-fg-2">{txn.date}</td>
                  <td className="max-w-48 truncate px-3 py-1.5 text-fg">
                    {txn.description || '—'}
                    {dup && <span className="ml-2 text-[10px] uppercase text-muted">{t('sp_imp_duplicate')}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">{targetCategoryLabel(txn.category)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">{ownerLabelFor(txn.account)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right text-fg">
                    <Amount value={txn.amount} currency={txn.currency === mainCurrency ? undefined : txn.currency} sensitive={false} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
