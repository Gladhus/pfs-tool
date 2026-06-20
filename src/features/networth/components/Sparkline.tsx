import { useMemo } from 'react';

interface SparklineProps {
  series: (number | null)[];
  className?: string;
  width?: number;
  height?: number;
  /** Stroke color; defaults to the accent token when omitted. */
  color?: string;
}

export function Sparkline({ series, className = '', width = 120, height = 28, color }: SparklineProps) {
  const points = useMemo(() => {
    const valid = series.filter((v): v is number => v != null);
    if (valid.length < 2) return null;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const span = max - min || 1;
    const pad = 2;
    const usableH = height - pad * 2;
    const stepX = width / (series.length - 1);

    const coords: [number, number][] = [];
    for (let i = 0; i < series.length; i++) {
      const v = series[i];
      if (v == null) continue;
      const x = i * stepX;
      const y = pad + usableH - ((v - min) / span) * usableH;
      coords.push([x, y]);
    }
    if (coords.length < 2) return null;

    const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const [lx, ly] = coords[coords.length - 1];
    return { d, lx, ly };
  }, [series, width, height]);

  if (!points) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${color ? '' : 'text-accent'} ${className}`}
      style={{ height, ...(color ? { color } : {}) }}
      aria-hidden="true"
    >
      <path
        d={points.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={points.lx} cy={points.ly} r={2.5} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
