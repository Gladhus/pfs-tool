import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfigQuery } from '@/shared/io/queries/sheetQueries';

const BASE = 'inline-flex h-14 items-center border-b-2 px-3 text-sm font-medium transition-colors whitespace-nowrap';
const ACTIVE = 'border-[#72bf48] text-white';
const INACTIVE = 'border-transparent text-white/60 hover:text-white';

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `${BASE} ${isActive ? ACTIVE : INACTIVE}`}>
      {label}
    </NavLink>
  );
}

/** Inline desktop nav tabs (rendered inside the header, beside the logo). */
export default function NavTabs() {
  const { t } = useTranslation();
  const configQuery = useConfigQuery();
  const stockOptionsEnabled = configQuery.data?.stock_options_enabled;

  return (
    <nav aria-label="Main navigation" className="no-scrollbar flex h-full items-stretch gap-1 overflow-x-auto">
      <Tab to="/overview" label={t('tab_overview')} />
      <Tab to="/portfolio" label={t('tab_portfolio')} />
      {stockOptionsEnabled && <Tab to="/options" label={t('tab_stock_options')} />}
    </nav>
  );
}
