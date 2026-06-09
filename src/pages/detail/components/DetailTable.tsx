import { privDelta, privPct } from '@/utils/privacy';
import { Amount } from '@/ui/Amount';
import { Icon } from '@/ui/Icon';
import { categoryIcon } from '@/utils/icons';

export type DetailRowKind = 'category-header' | 'account' | 'category-total' | 'net';

export interface DetailRow {
  kind: DetailRowKind;
  label: string;
  categoryId?: string;
  values: (number | null)[];
}

export interface DetailModel {
  years: string[];
  rows: DetailRow[];
}

interface Props {
  model: DetailModel;
  accountHeader: string;
  locale: string;
  currency: string;
  isPrivate: boolean;
}

function ValueCell({
  curr,
  prev,
  locale,
  currency,
  isPrivate,
  className = '',
}: {
  curr: number | null;
  prev: number | null;
  locale: string;
  currency: string;
  isPrivate: boolean;
  className?: string;
}) {
  const delta = curr !== null && prev !== null ? curr - prev : null;
  const pct = delta !== null ? privPct(delta, Math.abs(prev as number)) : null;
  const deltaColor = delta !== null ? (delta >= 0 ? 'text-ok' : 'text-red') : '';
  return (
    <td className={`px-3 py-2 text-right align-top ${curr === null ? 'text-muted' : curr < 0 ? 'text-red' : 'text-fg'} ${className}`}>
      <div className="font-mono-compact tabular-nums">
        {curr === null ? '—' : <Amount value={curr} compact />}
      </div>
      <div className={`h-4 text-xs font-mono-compact tabular-nums ${deltaColor}`}>
        {delta !== null ? privDelta(delta, isPrivate, locale, currency) : null}
      </div>
      <div className={`h-4 text-xs font-mono-compact tabular-nums ${deltaColor}`}>
        {pct ?? null}
      </div>
    </td>
  );
}

export function DetailTable({ model, accountHeader, locale, currency, isPrivate }: Props) {
  const { years, rows } = model;

  return (
    <div className="overflow-x-auto rounded-xl bg-surface-1 shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left font-medium text-fg-2 min-w-[10rem]">
              {accountHeader}
            </th>
            {years.map(y => (
              <th key={y} className="px-3 py-2 text-right font-medium text-fg-2 min-w-[7rem]">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.kind === 'category-header') {
              return (
                <tr key={ri} className="bg-surface-2">
                  <td className="sticky left-0 z-10 bg-surface-2 px-3 py-2 font-medium text-fg">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name={categoryIcon(row.categoryId)} size={13} />
                      {row.label}
                    </span>
                  </td>
                  {years.map((_, yi) => (
                    <td key={yi} className="px-3 py-2" />
                  ))}
                </tr>
              );
            }

            const rowClass =
              row.kind === 'net'
                ? 'border-t-2 border-border font-semibold'
                : row.kind === 'category-total'
                  ? 'border-t border-border/60 font-medium'
                  : 'border-b border-border/40';
            const nameClass =
              row.kind === 'account' ? 'pl-6 text-fg-2' : 'text-fg';

            return (
              <tr key={ri} className={rowClass}>
                <td className={`sticky left-0 z-10 bg-surface-1 px-3 py-2 ${nameClass}`}>
                  {row.label}
                </td>
                {years.map((_, yi) => (
                  <ValueCell
                    key={yi}
                    curr={row.values[yi]}
                    prev={yi > 0 ? row.values[yi - 1] : null}
                    locale={locale}
                    currency={currency}
                    isPrivate={isPrivate}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
