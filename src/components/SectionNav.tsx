import { NavLink } from 'react-router-dom';

interface SectionNavLink {
  to: string;
  label: string;
}

interface SectionNavProps {
  links: SectionNavLink[];
}

const BASE = 'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors';
const ACTIVE = 'border-emerald-500 text-white';
const INACTIVE = 'border-transparent text-slate-400 hover:text-slate-200';

export default function SectionNav({ links }: SectionNavProps) {
  return (
    <nav
      aria-label="Section navigation"
      className="sticky top-11 z-30 bg-slate-900 border-b border-slate-800 flex overflow-x-auto"
    >
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) => `${BASE} ${isActive ? ACTIVE : INACTIVE}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
