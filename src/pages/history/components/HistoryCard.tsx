import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Delta } from '@/ui/Delta';
import { Icon } from '@/ui/Icon';
import { fmtMoney } from '@/utils/format';
import { fmtMonth } from '@/utils/dates';

export interface CardData {
  month: string;       // YYYY-MM
  latestDate: string;
  net: number;
  prevNet: number | null;
  investments: number;
  realEstate: number;
  realEstateDebts: number;
  debts: number;
  incomplete: boolean;
  olderDates: {
    date: string;
    net: number;
    prevNet: number | null;
    incomplete: boolean;
  }[];
}

interface Props {
  card: CardData;
  locale: string;
  currency: string;
  isPrivate: boolean;
}

export function HistoryCard({ card, locale, currency, isPrivate }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [olderOpen, setOlderOpen] = useState(false);

  const reNet = card.realEstate + card.realEstateDebts;
  const delta = card.prevNet != null ? card.net - card.prevNet : null;

  const fmtVal = (v: number) =>
    isPrivate ? '••••••' : fmtMoney(v, locale, currency);

  return (
    <div className="rounded-xl bg-surface-1 border border-border overflow-hidden">
      {/* Main row */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors text-left"
        onClick={() => navigate(`/entry/${card.latestDate}`)}
      >
        <div>
          <div className="text-sm font-medium text-foreground">{fmtMonth(card.month, { locale })}</div>
          <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
            <span>{card.latestDate}</span>
            {card.incomplete && (
              <span
                className="text-warning"
                title={t('incomplete_data')}
                aria-label={t('incomplete_data')}
              >
                <Icon name="alert" size={12} />
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-foreground">{fmtVal(card.net)}</div>
          {delta != null ? (
            <Delta
              value={delta}
              baseValue={card.prevNet ?? 0}
              periodLabel=""
              layout="inline"
              locale={locale}
              currency={currency}
              isPrivate={isPrivate}
              className="text-xs justify-end mt-0.5"
            />
          ) : (
            <div className="h-4" />
          )}
        </div>
      </button>

      {/* Sub-stats */}
      <div className="flex gap-4 px-4 py-2 border-t border-border/50 text-xs text-muted">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--cat-investments)] mr-1" />
          {fmtVal(card.investments)}
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--cat-real-estate)] mr-1" />
          {fmtVal(reNet)}
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--cat-debts)] mr-1" />
          {fmtVal(card.debts)}
        </span>
      </div>

      {/* Older entries */}
      {card.olderDates.length > 0 && (
        <>
          <button
            type="button"
            className="w-full flex items-center gap-1 px-4 py-2 border-t border-border/50 text-xs text-muted hover:text-foreground transition-colors"
            aria-expanded={olderOpen}
            onClick={() => setOlderOpen(v => !v)}
          >
            <Icon name={olderOpen ? 'chevronDown' : 'chevronRight'} size={12} />
            {card.olderDates.length} earlier
          </button>

          {olderOpen && (
            <div className="border-t border-border/50">
              {card.olderDates.map(row => {
                const rDelta = row.prevNet != null ? row.net - row.prevNet : null;
                return (
                  <button
                    key={row.date}
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-2 transition-colors text-left text-xs"
                    onClick={() => navigate(`/entry/${row.date}`)}
                  >
                    <span className="flex items-center gap-1 text-muted">
                      {row.date}
                      {row.incomplete && (
                        <span className="text-warning" title={t('incomplete_data')}>
                          <Icon name="alert" size={10} />
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{fmtVal(row.net)}</span>
                      {rDelta != null ? (
                        <Delta
                          value={rDelta}
                          baseValue={row.prevNet ?? 0}
                          periodLabel=""
                          layout="inline"
                          locale={locale}
                          currency={currency}
                          isPrivate={isPrivate}
                          className="text-xs"
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
