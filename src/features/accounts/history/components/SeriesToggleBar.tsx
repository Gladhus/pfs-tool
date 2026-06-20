import { useTranslation } from 'react-i18next';
import { ChipToggle } from '@/shared/ui/ChipToggle';

export interface SeriesState {
  investments: boolean;
  realEstate: boolean;
  other: boolean;
}

interface Props {
  value: SeriesState;
  onChange: (next: SeriesState) => void;
  hasOther?: boolean;
}

const SERIES_COLORS: Record<keyof SeriesState, string> = {
  investments: 'var(--cat-investments)',
  realEstate: 'var(--cat-real-estate)',
  other: 'var(--cat-cash)',
};

export function SeriesToggleBar({ value, onChange, hasOther = true }: Props) {
  const { t } = useTranslation();

  const toggle = (key: keyof SeriesState) =>
    onChange({ ...value, [key]: !value[key] });

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1">
      <ChipToggle label={t('show_investments')} color={SERIES_COLORS.investments} active={value.investments} onToggle={() => toggle('investments')} />
      <ChipToggle label={t('show_real_estate')} color={SERIES_COLORS.realEstate} active={value.realEstate} onToggle={() => toggle('realEstate')} />
      {hasOther && <ChipToggle label={t('show_other')} color={SERIES_COLORS.other} active={value.other} onToggle={() => toggle('other')} />}
    </div>
  );
}
