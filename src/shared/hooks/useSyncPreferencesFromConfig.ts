import { useEffect } from 'react';
import { useConfigQuery } from '@/shared/io/queries/sheetQueries';
import { useUIStore } from '@/shared/stores/ui.store';

/**
 * Treats the sheet `config` tab as the source of truth for language and theme.
 * When config loads (or changes after a write), apply it to the UI store so the
 * preference follows the user across devices. localStorage remains a fast cache
 * for first paint / offline. No-op when config doesn't specify a value.
 */
export function useSyncPreferencesFromConfig() {
  const { data } = useConfigQuery();

  useEffect(() => {
    if (!data) return;
    const store = useUIStore.getState();
    if ((data.language === 'en' || data.language === 'fr') && store.lang !== data.language) {
      store.setLang(data.language);
    }
    if (
      (data.theme === 'system' || data.theme === 'light' || data.theme === 'dark') &&
      store.theme !== data.theme
    ) {
      store.setTheme(data.theme);
    }
  }, [data]);
}
