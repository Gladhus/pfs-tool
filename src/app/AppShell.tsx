import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import StatusBar from '@/components/StatusBar';
import BottomTabBar from '@/components/BottomTabBar';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncPreferencesFromConfig } from '@/hooks/useSyncPreferencesFromConfig';
import { useFxAutoFill } from '@/hooks/useFxAutoFill';

export default function AppShell() {
  const isDesktop = useBreakpoint('md');
  useKeyboardShortcuts();
  useSyncPreferencesFromConfig();
  useFxAutoFill();

  return (
    <div className="min-h-dvh bg-bg text-fg flex flex-col">
      <Header />
      <StatusBar />
      <main className={`flex-1 max-w-5xl mx-auto w-full px-4 py-6 ${isDesktop ? '' : 'pb-[calc(60px+env(safe-area-inset-bottom)+1.5rem)]'}`}>
        <Outlet />
      </main>
      {!isDesktop && <BottomTabBar />}
    </div>
  );
}
