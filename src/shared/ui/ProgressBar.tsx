import * as Progress from '@radix-ui/react-progress';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  'aria-label'?: string;
}

export function ProgressBar({ value, max = 100, className = '', 'aria-label': label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <Progress.Root
      value={value}
      max={max}
      aria-label={label}
      className={`h-1.5 rounded-full bg-border overflow-hidden ${className}`}
    >
      <Progress.Indicator
        className="h-full rounded-full bg-accent transition-all"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </Progress.Root>
  );
}
