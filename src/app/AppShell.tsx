import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import StatusBar from '@/components/StatusBar';
import NavTabs from '@/components/NavTabs';
import BottomTabBar from '@/components/BottomTabBar';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function AppShell() {
  const isDesktop = useBreakpoint('md');
  useKeyboardShortcuts();

  return (
    <div className="min-h-dvh bg-slate-950 text-white flex flex-col">
      <Header />
      <StatusBar />
      {isDesktop ? <NavTabs /> : null}
      <main className={`flex-1 max-w-5xl mx-auto w-full px-4 py-6 ${isDesktop ? '' : 'pb-[calc(60px+env(safe-area-inset-bottom))]'}`}>
        <Outlet />
      </main>
      {!isDesktop && <BottomTabBar />}
    </div>
  );
}
