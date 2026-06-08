import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import StatusBar from '@/components/StatusBar';
import BottomTabBar from '@/components/BottomTabBar';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncPreferencesFromConfig } from '@/hooks/useSyncPreferencesFromConfig';
import { useFxAutoFill } from '@/hooks/useFxAutoFill';
import { useDatasourceStore } from '@/stores/datasource.store';
import { XlsxDatasource } from '@/datasource/xlsx';
import { Icon } from '@/ui/Icon';
import { Dialog } from '@/ui/Dialog';

function XlsxBanner() {
  const { t } = useTranslation();
  const datasource = useDatasourceStore(s => s.datasource);
  const setDatasource = useDatasourceStore(s => s.setDatasource);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (datasource?.kind !== 'xlsx') return null;
  const ds = datasource as XlsxDatasource;

  function handleConfirmClose() {
    setConfirmOpen(false);
    setDatasource(null);
    navigate('/', { replace: true });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-accent/10 border-b border-accent/20 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-accent font-medium min-w-0">
          <Icon name="upload" size={14} />
          <span className="truncate">{t('xlsx_mode_banner', { filename: ds.filename })}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => ds.downloadXlsx()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
          >
            <Icon name="download" size={12} />
            {t('download_xlsx')}
          </button>
          <button
            data-testid="close-file-trigger"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-2 text-fg-2 text-xs hover:bg-surface-3 transition-colors"
          >
            {t('close_file')}
          </button>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('close_file')}
      >
        <p className="text-sm text-fg-2 mb-5">{t('close_file_confirm_body')}</p>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => ds.downloadXlsx()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Icon name="download" size={14} />
            {t('download_xlsx')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-3 py-1.5 rounded-md bg-surface-2 text-fg-2 text-sm hover:bg-surface-3 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              data-testid="close-file-confirm"
              onClick={handleConfirmClose}
              className="px-3 py-1.5 rounded-md bg-error/10 text-error text-sm font-medium hover:bg-error/20 transition-colors"
            >
              {t('close_file')}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export default function AppShell() {
  const isDesktop = useBreakpoint('md');
  useKeyboardShortcuts();
  useSyncPreferencesFromConfig();
  useFxAutoFill();

  return (
    <div className="min-h-dvh bg-bg text-fg flex flex-col">
      <Header />
      <XlsxBanner />
      <StatusBar />
      <main className={`flex-1 max-w-5xl mx-auto w-full px-4 py-6 ${isDesktop ? '' : 'pb-[calc(60px+env(safe-area-inset-bottom)+1.5rem)]'}`}>
        <Outlet />
      </main>
      {!isDesktop && <BottomTabBar />}
    </div>
  );
}
