import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';

export function EmptyGroupsState() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Icon name="inbox" size={28} />}
      title={t('no_groups_title')}
      description={t('no_groups_body')}
      action={
        <Button asChild variant="primary" size="sm">
          <Link to="/settings">{t('manage_groups')}</Link>
        </Button>
      }
      className="col-span-full"
    />
  );
}
