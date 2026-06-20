import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/shared/stores/ui.store';
import { useAccountsQuery, useSnapshotsQuery, useCategoryMetaQuery, useConfigQuery, useFxRatesQuery } from '@/shared/io/queries/sheetQueries';
import { tr } from '@/shared/i18n';
import { deriveDatesSorted } from '@/shared/utils/dates';
import { fxMap as buildFxMap } from '@/shared/utils/currency';
import { resolveFilterSpec } from '@/core/filters';
import { activeVisibleAccounts, isViewerLockedOut } from '@/core/scope';
import { getDetailYears, buildDetailModel } from '@/features/accounts/data/detail.selectors';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { PeriodPills, type Period } from '@/shared/ui/PeriodPills';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { ViewingAsBadge } from '@/shared/components/ViewingAsBadge';
import { DetailTable } from './components/DetailTable';
import type { Currency } from '@/types/sheets';

// Detail is year-over-year, so it keeps its own period set (exempt from APP_PERIODS).
const DETAIL_PERIODS: Period[] = ['3y', '5y', 'all'];

export default function DetailPage() {
  const { t } = useTranslation();
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const viewer = useUIStore(s => s.currentViewer);
  const locale = lang === 'fr' ? 'fr' : 'en';

  const [searchParams, setSearchParams] = useSearchParams();
  const period = resolveFilterSpec(searchParams, { viewer }).period;

  const accountsQ = useAccountsQuery();
  const snapshotsQ = useSnapshotsQuery();
  const categoryMetaQ = useCategoryMetaQuery();
  const configQ = useConfigQuery();
  const fxRatesQ = useFxRatesQuery();
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const currency = mainCurrency;
  const fxRateMap = useMemo(() => buildFxMap(fxRatesQ.data ?? []), [fxRatesQ.data]);

  const isPending = snapshotsQ.isPending || accountsQ.isPending;
  const snapshots = useMemo(() => snapshotsQ.data ?? [], [snapshotsQ.data]);
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const categoryMeta = useMemo(() => categoryMetaQ.data ?? [], [categoryMetaQ.data]);

  const datesSorted = useMemo(() => deriveDatesSorted(snapshots), [snapshots]);
  const visibleIds = useMemo(
    () => new Set(activeVisibleAccounts(accounts, viewer).map(a => a.id)),
    [accounts, viewer],
  );
  const years = useMemo(
    () => getDetailYears(snapshots, datesSorted, period, visibleIds),
    [snapshots, datesSorted, period, visibleIds],
  );
  const model = useMemo(
    () => (years.length && accounts.length
      ? buildDetailModel(snapshots, accounts, categoryMeta, years, mainCurrency, fxRateMap, viewer,
          { net: t('net_worth'), total: t('detail_total'), tr })
      : null),
    [snapshots, accounts, categoryMeta, years, t, mainCurrency, fxRateMap, viewer],
  );

  // True when there's data, but none of it belongs to the current viewer — so the page is
  // blank because of the "View as" filter, not because the account list is genuinely empty.
  const viewerHasNoAccounts = useMemo(() => isViewerLockedOut(accounts, viewer), [accounts, viewer]);

  const onPeriodChange = (p: Period) =>
    setSearchParams(prev => { prev.set('period', p); return prev; });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" className="h-10 w-64" />
        <Skeleton variant="card" className="h-[420px]" />
      </div>
    );
  }

  if (viewerHasNoAccounts) {
    return (
      <EmptyState
        icon={<Icon name="user" size={28} />}
        title={t('viewer_empty_title')}
        description={t('viewer_empty_body')}
      />
    );
  }

  if (!model) {
    return (
      <EmptyState
        icon={<Icon name="database" size={28} />}
        title={t('empty_detail_title')}
        description={t('empty_detail_body')}
        action={
          <Button variant="primary" size="sm" asChild>
            <Link to="/portfolio/manage">{t('empty_overview_no_accounts_cta')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PeriodPills value={period} onChange={onPeriodChange} options={DETAIL_PERIODS} />
        <ViewingAsBadge />
      </div>

      <DetailTable
        model={model}
        accountHeader={t('detail_account')}
        locale={locale}
        currency={currency}
        isPrivate={privateMode}
      />
    </div>
  );
}
