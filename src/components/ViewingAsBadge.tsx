import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { usePeopleQuery } from '@/queries/sheetQueries';
import { HOUSEHOLD_VIEWER } from '@/utils/ownership';
import { Icon } from '@/ui/Icon';

/**
 * A small muted "Viewing as X" chip for viewer-filtered pages, so the active lens is
 * visible without hunting for the header dropdown. Renders nothing when there's one (or
 * no) active person — there's nothing to filter by, and the header hides the selector too.
 */
export function ViewingAsBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const viewer = useUIStore(s => s.currentViewer);
  const peopleQ = usePeopleQuery();
  const activePeople = (peopleQ.data ?? []).filter(p => p.active);
  if (activePeople.length <= 1) return null;

  const isHousehold = viewer === HOUSEHOLD_VIEWER;
  const name = isHousehold
    ? t('viewer_household')
    : (activePeople.find(p => p.id === viewer)?.name ?? viewer);

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <Icon name={isHousehold ? 'users' : 'user'} size={13} />
      {t('viewing_as', { name })}
    </span>
  );
}
