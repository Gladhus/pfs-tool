import { useMemo } from 'react';

interface SparklineProps {
  series: (number | null)[];
  className?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ series, className = '', width = 120, height = 28 }: SparklineProps) {
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
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`block text-accent ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={series
          .map((v, i) => {
            if (v == null) return null;
            const valid = series.filter((x): x is number => x != null);
            const min = Math.min(...valid);
            const max = Math.max(...valid);
            const span = max - min || 1;
            const pad = 2;
            const x = i * (width / (series.length - 1));
            const y = pad + (height - pad * 2) - ((v - min) / span) * (height - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .filter(Boolean)
          .join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={points.lx} cy={points.ly} r={2.2} fill="currentColor" />
    </svg>
  );
}
