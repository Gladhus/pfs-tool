import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/Icon';
import type { Account, Snapshot } from '@/types/sheets';
import { snapshotsToCsv } from '@/utils/csv';

interface Props {
  snapshots: Snapshot[];
  accounts: Account[];
}

export function ExportCsvButton({ snapshots, accounts }: Props) {
  const { t } = useTranslation();

  const handleExport = () => {
    const csv = snapshotsToCsv(snapshots, accounts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snapshots.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-sm text-foreground hover:bg-surface-3 transition-colors"
      onClick={handleExport}
    >
      <Icon name="download" size={14} />
      {t('export_csv')}
    </button>
  );
}
