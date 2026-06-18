import { Outlet } from 'react-router-dom';
import { useConfigQuery } from '@/queries/sheetQueries';
import SubNav, { type SubNavLink } from './SubNav';

const BASE_LINKS: SubNavLink[] = [
  { to: '/settings', label: 'Preferences', icon: 'settings', end: true },
  { to: '/settings/groups', label: 'Groups', icon: 'users' },
  { to: '/settings/people', label: 'People', icon: 'users' },
  { to: '/settings/import', label: 'Import', icon: 'upload' },
  { to: '/portfolio/manage', label: 'Manage accounts', icon: 'wallet', external: true },
];

const OPTIONS_LINK: SubNavLink = {
  to: '/options/manage',
  label: 'Manage stock options',
  icon: 'trendingUp',
  external: true,
};

export default function SettingsSectionLayout() {
  const configQ = useConfigQuery();
  const stockOptionsEnabled = configQ.data?.stock_options_enabled === true;

  const links = stockOptionsEnabled ? [...BASE_LINKS, OPTIONS_LINK] : BASE_LINKS;

  return (
    <div className="md:flex md:gap-6">
      <SubNav links={links} />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
