import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, selectIsSignedIn } from '@/shared/stores/auth.store';
import { useDatasourceStore } from '@/shared/stores/datasource.store';

export default function ProtectedLayout() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const isDataLoaded = useAuthStore((s) => s.isDataLoaded);
  const datasource = useDatasourceStore(s => s.datasource);

  // XLSX mode: datasource is set but user is not signed in to Google
  if (datasource?.kind === 'xlsx') return <Outlet />;

  if (!isSignedIn) return <Navigate to="/" replace />;

  if (isBootstrapping || !isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-bg text-muted text-sm animate-pulse">
        Setting up…
      </div>
    );
  }

  return <Outlet />;
}
