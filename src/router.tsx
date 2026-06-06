import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';
import RootLayout from '@/app/RootLayout';
import ProtectedLayout from '@/app/ProtectedLayout';
import AppShell from '@/app/AppShell';
import NotFound from '@/app/NotFound';
import OptionsGuard from '@/app/OptionsGuard';
import SignedOutScreen from '@/components/SignedOutScreen';
import OverviewPage from '@/pages/overview/OverviewPage';
import HistoryPage from '@/pages/history/HistoryPage';
import DetailPage from '@/pages/detail/DetailPage';
import EntryPage from '@/pages/entry/EntryPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import OptionsPage from '@/pages/options/OptionsPage';
import OptionsManagePage from '@/pages/options/OptionsManagePage';

function RootIndex() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  return isSignedIn ? <Navigate to="/overview" replace /> : <SignedOutScreen />;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: <RootIndex /> },
        {
          element: <ProtectedLayout />,
          children: [
            {
              element: <AppShell />,
              children: [
                { path: 'overview', element: <OverviewPage /> },
                { path: 'history', element: <HistoryPage /> },
                { path: 'detail', element: <DetailPage /> },
                { path: 'entry', element: <EntryPage /> },
                { path: 'entry/:date', element: <EntryPage /> },
                { path: 'settings', element: <SettingsPage /> },
                { path: 'settings/accounts', element: <SettingsPage /> },
                { path: 'settings/groups', element: <SettingsPage /> },
                { path: 'settings/import', element: <SettingsPage /> },
                {
                  element: <OptionsGuard />,
                  children: [
                    { path: 'options', element: <OptionsPage /> },
                    { path: 'options/manage', element: <OptionsManagePage /> },
                  ],
                },
              ],
            },
          ],
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/pfs-tool-react/' },
);
