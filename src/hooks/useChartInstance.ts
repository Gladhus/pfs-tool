import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';

/**
 * Creates and manages a Chart.js instance tied to a canvas ref.
 * - Guards against StrictMode double-init with Chart.getChart check.
 * - Updates data in place on deps change (no destroy/recreate flicker).
 * - Destroys on unmount.
 * Pass a different `viewKey` to force a full recreate (e.g. on chart-type toggle).
 */
export function useChartInstance(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  config: ChartConfiguration,
  deps: unknown[] = [],
  viewKey?: string,
): RefObject<Chart | null> {
  const chartRef = useRef<Chart | null>(null);
  const viewKeyRef = useRef(viewKey);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewChanged = viewKeyRef.current !== viewKey;
    viewKeyRef.current = viewKey;

    if (chartRef.current && !viewChanged) {
      chartRef.current.data = config.data;
      chartRef.current.update('none');
      return;
    }

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    chartRef.current = new Chart(canvas, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, viewKey, ...deps]);

  return chartRef;
}
