import { useTranslation } from 'react-i18next';
import { Amount } from '@/shared/ui/Amount';
import { Delta } from '@/shared/ui/Delta';

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

/** Hero header: eyebrow, value, delta, period label, data-as-of. */
export function HeroCard({ netWorth, prevNetWorth, latestDate, period, locale, currency, isPrivate }: HeroCardProps) {
  const { t } = useTranslation();
  const delta = prevNetWorth != null ? netWorth - prevNetWorth : null;
  const periodLabel = t(`period_long_${period.toLowerCase()}`);

  return (
    <div>
      <p className="text-xs font-medium text-muted">{t('net_worth')}</p>
      <div className="mt-1 text-4xl md:text-5xl font-bold text-fg tabular-nums leading-tight">
        <Amount value={netWorth} />
      </div>
      {delta != null && (
        <Delta
          value={delta}
          baseValue={prevNetWorth}
          layout="inline"
          locale={locale}
          currency={currency}
          isPrivate={isPrivate}
          className="mt-1 text-sm md:text-base font-semibold"
        />
      )}
      <div className="mt-1 text-sm text-fg-2">{periodLabel}</div>
      {latestDate && (
        <div className="text-xs text-muted">
          {t('data_as_of', { date: fmtDateLong(latestDate, locale) })}
        </div>
      )}
    </div>
  );
}
