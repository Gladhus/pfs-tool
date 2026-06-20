import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/Icon';

interface Props {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, totalPages, onPrev, onNext }: Props) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        type="button"
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-surface-2 text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3 transition-colors"
        disabled={page === 0}
        onClick={onPrev}
      >
        <Icon name="chevronRight" size={14} className="rotate-180" />
        {t('hist_newer')}
      </button>
      <span className="text-xs text-muted">{page + 1} / {totalPages}</span>
      <button
        type="button"
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-surface-2 text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3 transition-colors"
        disabled={page >= totalPages - 1}
        onClick={onNext}
      >
        {t('hist_older')}
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  );
}
