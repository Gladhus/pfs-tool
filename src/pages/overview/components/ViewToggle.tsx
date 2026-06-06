import { useTranslation } from 'react-i18next';
import { SegmentControl } from '@/ui/SegmentControl';

interface ViewToggleProps {
  value: 'category' | 'group';
  onChange: (v: 'category' | 'group') => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  const { t } = useTranslation();
  return (
    <SegmentControl
      options={[
        { value: 'category', label: t('view_by_category') },
        { value: 'group', label: t('view_by_group') },
      ]}
      value={value}
      onChange={onChange}
      className={className}
      aria-label="View mode"
    />
  );
}
