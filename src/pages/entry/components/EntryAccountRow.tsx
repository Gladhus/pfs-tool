import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n';
import { fmtMoney, parseMoney } from '@/utils/format';
import { Amount } from '@/ui/Amount';
import type { Account, Currency } from '@/types/sheets';

interface Props {
  account: Account;
  balance: string;
  comment: string;
  prevValue: number | null;
  projected: number | null;
  locale: string;
  currency: Currency;
  onBalanceChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onEnter: () => void;
}

const OWNER_KEYS: Record<string, string> = {
  self: 'owner_self',
  partner: 'owner_partner',
  joint: 'owner_joint',
};

export function EntryAccountRow({
  account,
  balance,
  comment,
  prevValue,
  projected,
  locale,
  currency,
  onBalanceChange,
  onCommentChange,
  onEnter,
}: Props) {
  const { t } = useTranslation();

  const ownerLbl = OWNER_KEYS[account.owner] ? t(OWNER_KEYS[account.owner]) : account.owner;
  const sharePct = Math.round((account.ownership_share ?? 1) * 100);

  const current = parseMoney(balance);
  let arrow = '';
  let arrowClass = 'text-muted';
  if (prevValue !== null && current !== null) {
    if (current > prevValue) { arrow = '▲'; arrowClass = 'text-ok'; }
    else if (current < prevValue) { arrow = '▼'; arrowClass = 'text-red'; }
    else { arrow = '='; arrowClass = 'text-muted'; }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const n = parseMoney(e.target.value);
    onBalanceChange(n === null ? '' : String(n));
    requestAnimationFrame(() => e.target.select());
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const n = parseMoney(e.target.value);
    onBalanceChange(n === null ? '' : fmtMoney(n, locale, currency));
  };

  return (
    <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="flex flex-col">
        <span className="text-sm text-fg">{tr(account)}</span>
        <span className="text-xs text-muted">{ownerLbl} · {sharePct}%</span>
      </div>

      <div className="flex items-center gap-2">
        {projected !== null && (
          <button
            type="button"
            tabIndex={-1}
            className="rounded bg-surface-2 px-2 py-1 text-xs text-fg-2 hover:bg-border"
            title={fmtMoney(projected, locale, currency)}
            onClick={() => onBalanceChange(fmtMoney(projected, locale, currency))}
          >
            {t('calculate_value')}
          </button>
        )}
        <div className="flex flex-col items-end">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="—"
            data-balance={account.id}
            value={balance}
            className="h-8 w-32 rounded border border-border bg-surface-1 px-2 text-right text-sm tabular-nums text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onChange={e => onBalanceChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
          />
          {prevValue !== null && (
            <span className="mt-0.5 text-xs text-muted">
              <span className={arrowClass}>{arrow}</span> <Amount value={prevValue} currency={currency} className="text-muted" />
            </span>
          )}
        </div>
      </div>

      <input
        type="text"
        tabIndex={-1}
        placeholder={t('comment_placeholder')}
        value={comment}
        className="h-8 rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onChange={e => onCommentChange(e.target.value)}
      />
    </div>
  );
}
