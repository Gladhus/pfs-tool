import { Icon, type IconProps } from './Icon';
import { privMoney } from '@/utils/privacy';

interface StatCardHead {
  iconKey?: string;
  dot?: string | boolean;
  label?: string;
  html?: string;
}

interface StatCardProps {
  className?: string;
  head?: StatCardHead;
  value?: number;
  valueText?: string;
  valueNegative?: boolean;
  groupColor?: string;
  locale: string;
  currency: string;
  isPrivate?: boolean;
  spark?: React.ReactNode;
  delta?: React.ReactNode;
}

export function StatCard({
  className = '',
  head,
  value,
  valueText,
  valueNegative = false,
  groupColor,
  locale,
  currency,
  isPrivate = false,
  spark,
  delta,
}: StatCardProps) {
  const style = groupColor ? { '--group-color': groupColor } as React.CSSProperties : undefined;

  return (
    <div className={`rounded-lg bg-surface-1 shadow-sm p-3 ${className}`} style={style}>
      {head && (
        <div className="flex items-center gap-1.5 mb-1">
          {head.html ? (
            <span dangerouslySetInnerHTML={{ __html: head.html }} />
          ) : (
            <>
              {head.iconKey && (
                <span className="cat-icon">
                  <Icon name={head.iconKey as IconProps['name']} size={14} />
                </span>
              )}
              {head.dot && !head.iconKey && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={typeof head.dot === 'string' ? { background: head.dot } : undefined}
                />
              )}
              {head.label && (
                <div className="text-xs text-muted truncate">{head.label}</div>
              )}
            </>
          )}
        </div>
      )}
      <div className={`text-base font-semibold ${valueNegative ? 'text-red' : 'text-fg'}`}>
        {valueText ?? (value != null ? privMoney(value, isPrivate, locale, currency) : '—')}
      </div>
      {spark}
      {delta}
    </div>
  );
}
