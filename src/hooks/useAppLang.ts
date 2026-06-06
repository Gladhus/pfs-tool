import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui.store';
import i18n from '@/i18n';

export function useAppLang() {
  const lang = useUIStore((s) => s.lang);
  const setLang = useUIStore((s) => s.setLang);

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  return { lang, setLang };
}
