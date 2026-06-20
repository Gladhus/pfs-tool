import { useTranslation } from 'react-i18next';
import { SegmentControl } from '@/ui/SegmentControl';

export type OvView = 'category' | 'group' | 'person';

interface ViewToggleProps {
  value: OvView;
  onChange: (v: OvView) => void;
  showPerson?: boolean;
  className?: string;
}

export function ViewToggle({ value, onChange, showPerson = false, className }: ViewToggleProps) {
  const { t } = useTranslation();
  const options: { value: OvView; label: string }[] = [
    { value: 'category', label: t('view_by_category') },
    { value: 'group', label: t('view_by_group') },
    ...(showPerson ? [{ value: 'person' as const, label: t('view_by_person') }] : []),
  ];
  return (
    <SegmentControl
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      aria-label="View mode"
    />
  );
}
