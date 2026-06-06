import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '@/ui/Icon';

export interface SubNavLink {
  to: string;
  label: string;
  icon?: IconName;
  /** Match exactly (use for the section index route). */
  end?: boolean;
}

/**
 * Section sub-navigation.
 * - Desktop (md+): vertical sidebar that sticks and follows scroll.
 * - Mobile: horizontal top bar (sticky under the header), like the old Settings sub-nav.
 */
export default function SubNav({ links }: { links: SubNavLink[] }) {
  return (
    <nav
      aria-label="Section navigation"
      className="
        no-scrollbar sticky top-14 z-30 -mx-4 mb-2 flex gap-1 overflow-x-auto border-b border-border bg-bg px-4 py-2
        md:top-[4.5rem] md:z-0 md:mx-0 md:mb-0 md:w-44 md:shrink-0 md:flex-col md:overflow-visible md:self-start md:border-0 md:bg-transparent md:px-0 md:py-0
      "
    >
      {links.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors md:w-full ${
              isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
            }`
          }
        >
          {icon && <Icon name={icon} size={15} />}
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
