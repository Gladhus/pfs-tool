import { privDelta, privPct } from '@/utils/privacy';

interface DeltaProps {
  value: number;
  baseValue?: number | null;
  periodLabel?: string;
  layout?: 'inline' | 'stacked';
  locale: string;
  currency: string;
  isPrivate?: boolean;
  className?: string;
}

export function Delta({
  value,
  baseValue = null,
  periodLabel = '',
  layout = 'inline',
  locale,
  currency,
  isPrivate = false,
  className = '',
}: DeltaProps) {
  const dir = value >= 0 ? 'up' : 'down';
  const pct = privPct(value, baseValue ?? 0);
  const numText = privDelta(value, isPrivate, locale, currency) + (pct ? ` (${pct})` : '');

  const dirClass = dir === 'up'
    ? 'text-ok tabular-nums'
    : 'text-red tabular-nums';

  if (layout === 'stacked') {
    return (
      <div className={className}>
        <span className={dirClass}>{numText}</span>
        {periodLabel && (
          <span className="block text-xs text-fg-2">{periodLabel}</span>
        )}
      </div>
    );
  }

  return (
    <span className={`${dirClass} ${className}`}>
      {numText}{periodLabel ? ` ${periodLabel}` : ''}
    </span>
  );
}
