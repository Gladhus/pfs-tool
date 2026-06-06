import { Outlet } from 'react-router-dom';
import SubNav, { type SubNavLink } from './SubNav';

/**
 * Two-pane section shell: a sub-nav plus the routed sub-page.
 * Desktop renders the sub-nav as a sticky sidebar beside the content;
 * mobile renders it as a sticky horizontal top bar above the content.
 */
export default function SectionLayout({ links }: { links: SubNavLink[] }) {
  return (
    <div className="md:flex md:gap-6">
      <SubNav links={links} />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
