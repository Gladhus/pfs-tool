import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import type { BucketData } from '../hooks/useOverviewStats';

interface SeriesToggleProps {
  netColor: string;
  buckets: BucketData[];
  catsWithData: Set<string>;
  view: 'category' | 'group';
  catColor: (id?: string) => string;
}

export function SeriesToggle({ netColor, buckets, catsWithData, view, catColor }: SeriesToggleProps) {
  const { t } = useTranslation();
  const seriesVisible = useUIStore(s => s.ovSeriesVisible);
  const setOvSeriesVisible = useUIStore(s => s.setOvSeriesVisible);

  const isVis = (key: string) => seriesVisible[key] !== false;
  const toggle = (key: string) =>
    setOvSeriesVisible({ ...seriesVisible, [key]: !isVis(key) });

  const hasBuckets = buckets.length > 0;

  const chips: { key: string; label: string; color: string }[] = [];

  if (hasBuckets || view === 'group') {
    chips.push({ key: 'net', label: t('net_worth_chart'), color: netColor });
  } else if (catsWithData.size > 0) {
    chips.push({ key: 'net', label: t('net_worth_chart'), color: netColor });
  }

  for (const b of buckets) {
    if (view === 'category' && !b.catId?.startsWith('equity') && !catsWithData.has(b.key)) continue;
    const color = b.color ?? catColor(b.catId);
    chips.push({ key: b.key, label: b.catId === 'equity' ? t('equity_label') : b.label, color });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('allocation_title')}>
      {chips.map(({ key, label, color }) => (
        <label
          key={key}
          className="flex items-center gap-1.5 cursor-pointer text-xs text-muted select-none"
        >
          <input
            type="checkbox"
            checked={isVis(key)}
            onChange={() => toggle(key)}
            className="sr-only"
          />
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
            style={{ background: color, opacity: isVis(key) ? 1 : 0.3 }}
          />
          <span className={isVis(key) ? 'text-fg' : 'text-muted'}>{label}</span>
        </label>
      ))}
    </div>
  );
}
