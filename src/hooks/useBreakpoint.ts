import { useEffect, useState } from 'react';

const PX: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };

export function useBreakpoint(bp: 'sm' | 'md' | 'lg' | 'xl'): boolean {
  const px = PX[bp] ?? 768;
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
