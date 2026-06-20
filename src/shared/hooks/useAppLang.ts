import { useEffect } from 'react';
import { useUIStore } from '@/shared/stores/ui.store';
import i18n from '@/shared/i18n';

export function useAppLang() {
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  return { lang, setLang };
}
