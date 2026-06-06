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
    // Mobile: 2-col grid [name | amount] with comment spanning full width on row 2.
    // Desktop (sm+): 3-col grid [name | amount | comment] all on row 1, top-aligned.
    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 py-2 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
      {/* Col 1: account name + owner */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-fg">{tr(account)}</span>
        <span className="text-xs text-muted">{ownerLbl} · {sharePct}%</span>
      </div>

      {/* Col 2: optional projected button + balance input + prev value */}
      <div className="flex items-start gap-2">
        {projected !== null && (
          <button
            type="button"
            tabIndex={-1}
            className="mt-0.5 rounded bg-surface-2 px-2 py-1 text-xs text-fg-2 hover:bg-border"
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
              <span className={arrowClass}>{arrow}</span>{' '}
              <Amount value={prevValue} currency={currency} className="text-muted" />
            </span>
          )}
        </div>
      </div>

      {/* Mobile: full-width row 2. Desktop: col 3 row 1. */}
      <input
        type="text"
        tabIndex={-1}
        placeholder={t('comment_placeholder')}
        value={comment}
        className="col-span-2 h-8 rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:col-span-1"
        onChange={e => onCommentChange(e.target.value)}
      />
    </div>
  );
}
