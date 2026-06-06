import { NavLink } from 'react-router-dom';
import { useConfigQuery } from '@/queries/sheetQueries';

const BASE = 'inline-flex h-14 items-center border-b-2 px-3 text-sm font-medium transition-colors whitespace-nowrap';
const ACTIVE = 'border-accent text-fg';
const INACTIVE = 'border-transparent text-muted hover:text-fg';

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `${BASE} ${isActive ? ACTIVE : INACTIVE}`}>
      {label}
    </NavLink>
  );
}

/** Inline desktop nav tabs (rendered inside the header, beside the logo). */
export default function NavTabs() {
  const configQuery = useConfigQuery();
  const stockOptionsEnabled = configQuery.data?.stock_options_enabled;

  return (
    <nav aria-label="Main navigation" className="no-scrollbar flex h-full items-stretch gap-1 overflow-x-auto">
      <Tab to="/overview" label="Overview" />
      <Tab to="/accounts" label="Accounts" />
      {stockOptionsEnabled && <Tab to="/options" label="Stock Options" />}
    </nav>
  );
}
