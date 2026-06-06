import { useState, useEffect } from 'react';
import { chartColors } from '@/utils/chartOptions';

type ChartColors = ReturnType<typeof chartColors>;

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(() => {
    try { return chartColors(); }
    catch { return { muted: '#94a3b8', grid: 'rgba(15,23,42,.06)', accent: '#10b981', debt: '#f43f5e', invest: '#3b82f6', realEstate: '#f59e0b', cash: '#10b981' }; }
  });

  useEffect(() => {
    setColors(chartColors());

    const observer = new MutationObserver(() => setColors(chartColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMq = () => setColors(chartColors());
    mq.addEventListener('change', onMq);

    return () => { observer.disconnect(); mq.removeEventListener('change', onMq); };
  }, []);

  return colors;
}
