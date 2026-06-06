import { useTranslation } from 'react-i18next';
import { chartColors } from '@/utils/chartOptions';

export interface SeriesState {
  investments: boolean;
  realEstate: boolean;
  other: boolean;
}

interface Props {
  value: SeriesState;
  onChange: (next: SeriesState) => void;
}

export function SeriesToggleBar({ value, onChange }: Props) {
  const { t } = useTranslation();
  const colors = chartColors();

  const toggle = (key: keyof SeriesState) =>
    onChange({ ...value, [key]: !value[key] });

  const chip = (key: keyof SeriesState, label: string, color: string) => (
    <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={value[key]}
        onChange={() => toggle(key)}
      />
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className={`text-xs transition-opacity ${value[key] ? 'text-foreground' : 'text-muted opacity-50'}`}>
        {label}
      </span>
    </label>
  );

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {chip('investments', t('show_investments'), colors.invest)}
      {chip('realEstate', t('show_real_estate'), colors.realEstate)}
      {chip('other', t('show_other'), colors.cash)}
    </div>
  );
}
