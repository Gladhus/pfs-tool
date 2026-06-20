import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore, selectIsSignedIn } from '@/shared/stores/auth.store';
import { useDatasourceStore } from '@/shared/stores/datasource.store';
import RootLayout from '@/app/RootLayout';
import ProtectedLayout from '@/app/ProtectedLayout';
import AppShell from '@/app/AppShell';
import NotFound from '@/app/NotFound';
import RouteError from '@/app/RouteError';
import OptionsGuard from '@/app/OptionsGuard';
import SignedOutScreen from '@/shared/components/SignedOutScreen';
import SectionLayout from '@/shared/components/SectionLayout';
import SettingsSectionLayout from '@/shared/components/SettingsSectionLayout';
import type { SubNavLink } from '@/shared/components/SubNav';
import OverviewPage from '@/features/networth/OverviewPage';
import HistoryPage from '@/features/accounts/history/HistoryPage';
import DetailPage from '@/features/accounts/detail/DetailPage';
import EntryPage from '@/features/accounts/entry/EntryPage';
import { AccountsSection } from '@/features/settings/sections/AccountsSection';
import { PreferencesSection } from '@/features/settings/sections/PreferencesSection';
import { GroupsSection } from '@/features/settings/sections/GroupsSection';
import { PeopleSection } from '@/features/settings/sections/PeopleSection';
import { ImportSection } from '@/features/settings/sections/ImportSection';
import OptionsPage from '@/features/options/OptionsPage';
import OptionsManagePage from '@/features/options/OptionsManagePage';

const ACCOUNTS_LINKS: SubNavLink[] = [
  { to: '/portfolio/history', label: 'History', icon: 'calendar' },
  { to: '/portfolio/detail', label: 'Detail', icon: 'table' },
  { to: '/portfolio/manage', label: 'Manage', icon: 'wallet' },
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
      errorElement: <RouteError />,
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
                  path: 'portfolio',
                  element: <SectionLayout links={ACCOUNTS_LINKS} />,
                  children: [
                    { index: true, element: <Navigate to="/portfolio/history" replace /> },
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
                  element: <SettingsSectionLayout />,
                  children: [
                    { index: true, element: <PreferencesSection /> },
                    { path: 'groups', element: <GroupsSection /> },
                    { path: 'people', element: <PeopleSection /> },
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
                { path: 'history', element: <Navigate to="/portfolio/history" replace /> },
                { path: 'detail', element: <Navigate to="/portfolio/detail" replace /> },
                { path: 'settings/accounts', element: <Navigate to="/portfolio/manage" replace /> },
              ],
            },
          ],
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/pfs-tool/' },
);
