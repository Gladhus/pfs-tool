import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';

interface Props {
  hasAccounts: boolean;
}

export function EmptyOverviewState({ hasAccounts }: Props) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Icon name="inbox" size={32} />}
      title={t('empty_overview_title')}
      description={hasAccounts ? t('empty_overview_body') : t('empty_overview_no_accounts_body')}
      action={
        <Button asChild variant="primary" size="sm">
          {hasAccounts
            ? <Link to="/entry">{t('empty_overview_cta')}</Link>
            : <Link to="/portfolio/manage">{t('empty_overview_no_accounts_cta')}</Link>
          }
        </Button>
      }
      className="col-span-full"
    />
  );
}
