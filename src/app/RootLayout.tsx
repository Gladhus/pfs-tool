import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastHost } from '@/ui/ToastHost';
import { useTheme } from '@/hooks/useTheme';
import { useAppLang } from '@/hooks/useAppLang';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { queryClient } from '@/lib/queryClient';

const TAB_ROUTE_MAP: Record<string, string> = {
  overview: '/overview',
  history: '/history',
  detail: '/detail',
  entry: '/entry',
  settings: '/settings',
  options: '/options',
};

export default function RootLayout() {
  const navigate = useNavigate();
  const didRedirect = useRef(false);

  useTheme();
  useAppLang();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as Window & { __pfs?: unknown }).__pfs = {
      get auth() { return useAuthStore.getState(); },
      get ui() { return useUIStore.getState(); },
      queryClient,
    };
    return () => { delete (window as Window & { __pfs?: unknown }).__pfs; };
  }, []);

  useEffect(() => {
    if (didRedirect.current) return;
    didRedirect.current = true;
    try {
      const tab = localStorage.getItem('pfs_active_tab');
      localStorage.removeItem('pfs_active_tab');
      if (tab && TAB_ROUTE_MAP[tab]) navigate(TAB_ROUTE_MAP[tab], { replace: true });
    } catch { /* ignore */ }
  }, [navigate]);

  return (
    <AuthProvider>
      <ToastHost />
      <Outlet />
    </AuthProvider>
  );
}
