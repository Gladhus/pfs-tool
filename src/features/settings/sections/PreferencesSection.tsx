import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/shared/stores/ui.store';
import { useAppLang } from '@/shared/hooks/useAppLang';
import { useAuth } from '@/auth/AuthProvider';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useDatasourceStore } from '@/shared/stores/datasource.store';
import { useConfigQuery } from '@/shared/io/queries/sheetQueries';
import { useWriteConfigMutation } from '@/shared/io/queries/sheetMutations';
import { SegmentControl } from '@/shared/ui/SegmentControl';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Checkbox } from '@/shared/ui/Checkbox';
import SheetPickerDialog from '@/shared/components/SheetPickerDialog';
import { XlsxDatasource } from '@/shared/io/datasource/xlsx';
import type { Theme, Lang } from '@/shared/stores/ui.store';
import type { Currency } from '@/types/sheets';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/40 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-fg-2">{label}</span>
      {children}
    </div>
  );
}

export function PreferencesSection() {
  const { t } = useTranslation();
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const { lang, setLang } = useAppLang();
  const { signOut } = useAuth();
  const sheetId = useAuthStore(s => s.sheetId);
  const userEmail = useAuthStore(s => s.userEmail);
  const datasource = useDatasourceStore(s => s.datasource);
  const setDatasource = useDatasourceStore(s => s.setDatasource);
  const navigate = useNavigate();

  const configQ = useConfigQuery();
  const writeConfig = useWriteConfigMutation();

  const [pickerOpen, setPickerOpen] = useState(false);

  const isXlsx = datasource?.kind === 'xlsx';
  const xlsxDs = isXlsx ? (datasource as XlsxDatasource) : null;

  const stockOptionsEnabled = configQ.data?.stock_options_enabled === true;
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';

  const onToggleStockOptions = (checked: boolean) =>
    writeConfig.mutate({ key: 'stock_options_enabled', value: checked ? '1' : '0' });

  const onCurrencyChange = (next: Currency) =>
    writeConfig.mutate({ key: 'currency', value: next });

  const onThemeChange = (next: Theme) => {
    setTheme(next);
    writeConfig.mutate({ key: 'theme', value: next });
  };
  const onLangChange = (next: Lang) => {
    setLang(next);
    writeConfig.mutate({ key: 'language', value: next });
  };

  const onCloseFile = () => {
    setDatasource(null);
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-fg">{t('app_settings')}</h3>

        <Row label={t('theme_label')}>
          <SegmentControl<Theme>
            options={[
              { value: 'light', label: t('theme_light') },
              { value: 'dark', label: t('theme_dark') },
              { value: 'system', label: t('theme_system') },
            ]}
            value={theme}
            onChange={onThemeChange}
            aria-label={t('theme_label')}
          />
        </Row>

        <Row label={t('language_label')}>
          <SegmentControl<Lang>
            options={[
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
            ]}
            value={lang}
            onChange={onLangChange}
            aria-label={t('language_label')}
          />
        </Row>

        <Row label={t('currency_label')}>
          <SegmentControl<Currency>
            options={CURRENCIES.map(c => ({ value: c, label: c }))}
            value={mainCurrency}
            onChange={onCurrencyChange}
            aria-label={t('currency_label')}
          />
        </Row>

        <Row label={t('enable_stock_options')}>
          <Checkbox
            checked={stockOptionsEnabled}
            disabled={writeConfig.isPending}
            onCheckedChange={onToggleStockOptions}
          />
        </Row>
      </section>

      <section className="rounded-xl bg-surface-1 p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-fg">{t('data_settings')}</h3>

        {isXlsx ? (
          <>
            <Row label={t('download_xlsx')}>
              <Button variant="default" size="sm" onClick={() => xlsxDs?.downloadXlsx()}>
                <Icon name="download" size={14} />
                {t('download_xlsx')}
              </Button>
            </Row>

            <Row label={t('account_label')}>
              <Button variant="default" size="sm" onClick={onCloseFile}>
                {t('close_file')}
              </Button>
            </Row>
          </>
        ) : (
          <>
            <Row label={t('data_sheet')}>
              <div className="flex flex-wrap items-center gap-2">
                {sheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                  >
                    <Icon name="externalLink" size={14} />
                    {t('open_in_sheets')}
                  </a>
                )}
                <Button variant="default" size="sm" onClick={() => setPickerOpen(true)}>
                  {t('choose_different_sheet')}
                </Button>
              </div>
            </Row>

            <Row label={t('account_label')}>
              <div className="flex flex-wrap items-center gap-3">
                {userEmail && <span className="text-xs text-muted">{userEmail}</span>}
                <Button variant="default" size="sm" onClick={signOut}>{t('sign_out')}</Button>
              </div>
            </Row>
          </>
        )}
      </section>

      <SheetPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
