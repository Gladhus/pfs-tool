interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  'aria-label'?: string;
}

export function ProgressBar({ value, max = 100, className = '', 'aria-label': label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`h-1.5 rounded-full bg-border overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
