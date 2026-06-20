import { Navigate, Outlet } from 'react-router-dom';
import { useConfigQuery } from '@/shared/io/queries/sheetQueries';
import { Skeleton } from '@/shared/ui';

export default function OptionsGuard() {
  const configQuery = useConfigQuery();

  if (configQuery.isPending) return <Skeleton className="m-4 h-32 rounded-lg" />;
  if (!configQuery.isSuccess || !configQuery.data.stock_options_enabled) {
    return <Navigate to="/overview" replace />;
  }

  return <Outlet />;
}
