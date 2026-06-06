import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';

export default function ProtectedLayout() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const isDataLoaded = useAuthStore((s) => s.isDataLoaded);

  if (!isSignedIn) return <Navigate to="/" replace />;

  if (isBootstrapping || !isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-dvh text-slate-400 text-sm animate-pulse">
        Setting up…
      </div>
    );
  }

  return <Outlet />;
}
