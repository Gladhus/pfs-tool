import { NavLink, Link, useLocation } from 'react-router-dom';
import { useConfigQuery } from '@/queries/sheetQueries';
import { todayISO } from '@/utils/dates';
import { Icon, type IconName } from '@/ui/Icon';

const LINK = 'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors';
const ACTIVE = 'text-accent';
const INACTIVE = 'text-muted hover:text-fg';

function TabItem({ to, label, icon, grow = 1 }: { to: string; label: string; icon: IconName; grow?: 1 | 2 }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) => `${LINK} ${grow === 2 ? 'flex-[2]' : 'flex-1'} ${isActive ? ACTIVE : INACTIVE}`}
    >
      <Icon name={icon} size={20} />
      {label}
    </NavLink>
  );
}

export default function BottomTabBar() {
  const configQuery = useConfigQuery();
  const stockOptionsEnabled = configQuery.data?.stock_options_enabled;
  const onEntry = useLocation().pathname.startsWith('/entry');

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface-1 border-t border-border flex items-stretch h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]"
    >
      <TabItem to="/overview" label="Overview" icon="dashboard" />
      <TabItem to="/portfolio" label="Portfolio" icon="wallet" />

      {/* Entry FAB in center slot — always opens a new entry for today */}
      <Link
        to={`/entry/${todayISO()}`}
        aria-label="New entry"
        className="flex flex-col items-center justify-center flex-1 py-2"
      >
        <span className={`w-10 h-10 rounded-full flex items-center justify-center -mt-4 shadow-lg transition-colors ${onEntry ? 'bg-accent hover:bg-accent-dark text-accent-fg' : 'bg-surface-3 text-fg-2 hover:bg-border hover:text-fg'}`}>
          <Icon name="plus" size={22} />
        </span>
      </Link>

      {stockOptionsEnabled && <TabItem to="/options" label="Stock Options" icon="trendingUp" />}
      {/* When Stock Options is hidden, Settings fills the right half so the + stays centered. */}
      <TabItem to="/settings" label="Settings" icon="settings" grow={stockOptionsEnabled ? 1 : 2} />
    </nav>
  );
}
