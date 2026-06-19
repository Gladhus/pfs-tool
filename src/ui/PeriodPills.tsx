import { useTranslation } from 'react-i18next';
import { SegmentControl } from './SegmentControl';
import type { Period } from '@/core/filters';

export type { Period };

/** Canonical period set used app-wide (Overview, History). Detail uses its own YoY set. */
export const APP_PERIODS: Period[] = ['3m', '6m', 'ytd', '1y', '2y', '5y', 'all'];

interface PeriodPillsProps {
  value: Period;
  onChange: (p: Period) => void;
  options?: Period[];
  className?: string;
  block?: boolean;
  responsive?: boolean;
}

export function PeriodPills({ value, onChange, options = APP_PERIODS, className, block, responsive }: PeriodPillsProps) {
  const { t } = useTranslation();

  const segOptions = options.map((p) => ({
    value: p,
    label: t(`period_${p}`),
  }));

  return (
    <SegmentControl
      options={segOptions}
      value={value}
      onChange={onChange}
      className={className}
      block={block}
      responsive={responsive}
      aria-label="Time period"
    />
  );
}
