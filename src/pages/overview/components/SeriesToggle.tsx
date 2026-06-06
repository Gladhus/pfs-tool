import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { ChipToggle } from '@/ui/ChipToggle';
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
    <div className="no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1" role="group" aria-label={t('allocation_title')}>
      {chips.map(({ key, label, color }) => (
        <ChipToggle
          key={key}
          label={label}
          color={color}
          active={isVis(key)}
          onToggle={() => toggle(key)}
        />
      ))}
    </div>
  );
}
