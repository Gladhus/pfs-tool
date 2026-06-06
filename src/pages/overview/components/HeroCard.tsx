import { useTranslation } from 'react-i18next';
import { privMoney } from '@/utils/privacy';
import { Delta } from '@/ui/Delta';

interface HeroCardProps {
  netWorth: number;
  prevNetWorth: number | null;
  latestDate: string | null;
  period: string;
  locale: string;
  currency: string;
  isPrivate: boolean;
}

function fmtDateLong(yyyymmdd: string, locale: string): string {
  const [year, month, day] = yyyymmdd.split('-');
  return new Date(+year, +month - 1, +day).toLocaleDateString(
    locale === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
}

export function HeroCard({ netWorth, prevNetWorth, latestDate, period, locale, currency, isPrivate }: HeroCardProps) {
  const { t } = useTranslation();
  const delta = prevNetWorth != null ? netWorth - prevNetWorth : null;
  const periodLabel = t(`period_${period.toLowerCase()}`);

  return (
    <div className="rounded-xl bg-surface-1 shadow-sm p-5 flex flex-col gap-1">
      <div className="text-3xl font-bold text-fg tabular-nums">
        {privMoney(netWorth, isPrivate, locale, currency)}
      </div>
      {latestDate && (
        <div className="text-xs text-muted">
          {t('data_as_of', { date: fmtDateLong(latestDate, locale) })}
        </div>
      )}
      {delta != null && (
        <Delta
          value={delta}
          baseValue={prevNetWorth}
          periodLabel={periodLabel}
          layout="stacked"
          locale={locale}
          currency={currency}
          isPrivate={isPrivate}
          className="mt-1 text-sm"
        />
      )}
    </div>
  );
}
