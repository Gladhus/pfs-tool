import { NavLink } from 'react-router-dom';
import { useConfigQuery } from '@/queries/sheetQueries';

const BASE = 'px-4 py-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap';
const ACTIVE = 'border-emerald-500 text-white';
const INACTIVE = 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600';

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${BASE} ${isActive ? ACTIVE : INACTIVE}`}
    >
      {label}
    </NavLink>
  );
}

export default function NavTabs() {
  const configQuery = useConfigQuery();
  const stockOptionsEnabled = configQuery.data?.stock_options_enabled;

  return (
    <nav aria-label="Main navigation" className="bg-slate-900 border-b border-slate-800 flex gap-1 px-4 overflow-x-auto">
      <Tab to="/overview" label="Overview" />
      <Tab to="/history" label="History" />
      <Tab to="/detail" label="Detail" />
      <Tab to="/entry" label="Entry" />
      <Tab to="/settings" label="Settings" />
      {stockOptionsEnabled && <Tab to="/options" label="Options" />}
    </nav>
  );
}
