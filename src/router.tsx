import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';
import { useDatasourceStore } from '@/stores/datasource.store';
import RootLayout from '@/app/RootLayout';
import ProtectedLayout from '@/app/ProtectedLayout';
import AppShell from '@/app/AppShell';
import NotFound from '@/app/NotFound';
import OptionsGuard from '@/app/OptionsGuard';
import SignedOutScreen from '@/components/SignedOutScreen';
import SectionLayout from '@/components/SectionLayout';
import type { SubNavLink } from '@/components/SubNav';
import OverviewPage from '@/pages/overview/OverviewPage';
import HistoryPage from '@/pages/history/HistoryPage';
import DetailPage from '@/pages/detail/DetailPage';
import EntryPage from '@/pages/entry/EntryPage';
import { AccountsSection } from '@/pages/settings/sections/AccountsSection';
import { PreferencesSection } from '@/pages/settings/sections/PreferencesSection';
import { GroupsSection } from '@/pages/settings/sections/GroupsSection';
import { ImportSection } from '@/pages/settings/sections/ImportSection';
import OptionsPage from '@/pages/options/OptionsPage';
import OptionsManagePage from '@/pages/options/OptionsManagePage';

const ACCOUNTS_LINKS: SubNavLink[] = [
  { to: '/accounts/history', label: 'History', icon: 'calendar' },
  { to: '/accounts/detail', label: 'Detail', icon: 'table' },
  { to: '/accounts/manage', label: 'Manage', icon: 'wallet' },
];

const SETTINGS_LINKS: SubNavLink[] = [
  { to: '/settings', label: 'Preferences', icon: 'settings', end: true },
  { to: '/settings/groups', label: 'Groups', icon: 'users' },
  { to: '/settings/import', label: 'Import', icon: 'upload' },
];

const OPTIONS_LINKS: SubNavLink[] = [
  { to: '/options', label: 'Overview', icon: 'dashboard', end: true },
  { to: '/options/manage', label: 'Manage', icon: 'settings' },
];

function RootIndex() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const datasource = useDatasourceStore(s => s.datasource);
  if (isSignedIn || datasource) return <Navigate to="/overview" replace />;
  return <SignedOutScreen />;
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

                // Accounts section
                {
                  path: 'accounts',
                  element: <SectionLayout links={ACCOUNTS_LINKS} />,
                  children: [
                    { index: true, element: <Navigate to="/accounts/history" replace /> },
                    { path: 'history', element: <HistoryPage /> },
                    { path: 'detail', element: <DetailPage /> },
                    { path: 'manage', element: <AccountsSection /> },
                  ],
                },

                // Entry (reached via the + button)
                { path: 'entry', element: <EntryPage /> },
                { path: 'entry/:date', element: <EntryPage /> },

                // Settings section
                {
                  path: 'settings',
                  element: <SectionLayout links={SETTINGS_LINKS} />,
                  children: [
                    { index: true, element: <PreferencesSection /> },
                    { path: 'groups', element: <GroupsSection /> },
                    { path: 'import', element: <ImportSection /> },
                  ],
                },

                // Stock Options section (gated by the feature flag)
                {
                  element: <OptionsGuard />,
                  children: [
                    {
                      path: 'options',
                      element: <SectionLayout links={OPTIONS_LINKS} />,
                      children: [
                        { index: true, element: <OptionsPage /> },
                        { path: 'manage', element: <OptionsManagePage /> },
                      ],
                    },
                  ],
                },

                // Redirects from the pre-restructure URLs
                { path: 'history', element: <Navigate to="/accounts/history" replace /> },
                { path: 'detail', element: <Navigate to="/accounts/detail" replace /> },
                { path: 'settings/accounts', element: <Navigate to="/accounts/manage" replace /> },
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
