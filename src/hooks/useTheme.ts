import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui.store';

export function useTheme() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme !== 'system') {
      root.setAttribute('data-theme', theme);
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) =>
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);
}
