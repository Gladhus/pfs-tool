import { useTranslation } from 'react-i18next';
import { SegmentControl } from './SegmentControl';

export type Period = '3m' | '6m' | '1y' | '2y' | '3y' | '5y' | 'ytd' | 'all';

interface PeriodPillsProps {
  value: Period;
  onChange: (p: Period) => void;
  options?: Period[];
  className?: string;
}

const DEFAULT_OPTIONS: Period[] = ['1y', '3y', '5y', 'all'];

export function PeriodPills({ value, onChange, options = DEFAULT_OPTIONS, className }: PeriodPillsProps) {
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
      aria-label="Time period"
    />
  );
}
