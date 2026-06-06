import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';

export function EmptyOverviewState() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Icon name="inbox" size={32} />}
      title={t('empty_overview_title')}
      description={t('empty_overview_body')}
      action={
        <Button asChild variant="primary" size="sm">
          <Link to="/entry">{t('empty_overview_cta')}</Link>
        </Button>
      }
      className="col-span-full"
    />
  );
}
