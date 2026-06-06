import { NavLink, Link } from 'react-router-dom';
import { useConfigQuery } from '@/queries/sheetQueries';

const LINK = 'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] font-medium transition-colors';
const ACTIVE = 'text-emerald-400';
const INACTIVE = 'text-slate-500 hover:text-slate-300';

function TabItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) => `${LINK} ${isActive ? ACTIVE : INACTIVE}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function BottomTabBar() {
  const configQuery = useConfigQuery();
  const stockOptionsEnabled = configQuery.data?.stock_options_enabled;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex items-stretch h-[60px] pb-[env(safe-area-inset-bottom)]"
    >
      <TabItem to="/overview" label="Overview" icon="📊" />
      <TabItem to="/history" label="History" icon="📅" />

      {/* Entry FAB in center slot */}
      <Link
        to="/entry"
        aria-label="New entry"
        className="flex flex-col items-center justify-center flex-1 py-2"
      >
        <span className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white text-xl transition-colors -mt-4 shadow-lg">
          +
        </span>
      </Link>

      <TabItem to="/detail" label="Detail" icon="📋" />
      <TabItem to="/settings" label="Settings" icon="⚙️" />
      {stockOptionsEnabled && <TabItem to="/options" label="Options" icon="📈" />}
    </nav>
  );
}
