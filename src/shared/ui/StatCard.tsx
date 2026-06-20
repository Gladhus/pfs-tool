import { Amount } from '@/shared/ui/Amount';

interface StatCardHead {
  dot?: boolean;
  label?: string;
}

interface StatCardProps {
  className?: string;
  head?: StatCardHead;
  value?: number;
  valueText?: string;
  valueNegative?: boolean;
  /** Series color — drives the left accent border and the header dot. */
  accentColor?: string;
  spark?: React.ReactNode;
  delta?: React.ReactNode;
}

export function StatCard({
  className = '',
  head,
  value,
  valueText,
  valueNegative = false,
  accentColor,
  spark,
  delta,
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl bg-surface-1 shadow-sm p-4 ${className}`}
    >
      {head?.label && (
        <div className="mb-1 flex items-center gap-2">
          {head.dot && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <div className="truncate text-xs font-medium text-muted">
            {head.label}
          </div>
        </div>
      )}
      <div className={`text-2xl font-bold tabular-nums ${valueNegative ? 'text-red' : 'text-fg'}`}>
        {valueText ?? (value != null ? <Amount value={value} /> : '—')}
      </div>
      {spark}
      {delta}
    </div>
  );
}
