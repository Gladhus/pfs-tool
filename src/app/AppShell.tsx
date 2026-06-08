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

function XlsxBanner() {
  const { t } = useTranslation();
  const datasource = useDatasourceStore(s => s.datasource);
  const setDatasource = useDatasourceStore(s => s.setDatasource);
  const navigate = useNavigate();

  if (datasource?.kind !== 'xlsx') return null;
  const ds = datasource as XlsxDatasource;

  return (
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
          onClick={() => { setDatasource(null); navigate('/', { replace: true }); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-2 text-fg-2 text-xs hover:bg-surface-3 transition-colors"
        >
          {t('close_file')}
        </button>
      </div>
    </div>
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
