import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';
import { useUIStore } from '@/shared/stores/ui.store';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: useUIStore.getState().lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

/** Resolve a bilingual name to a string using the current i18n language. */
export function tr(entity: { name_fr?: string; name_en?: string }, lang = i18n.language): string {
  return lang === 'fr'
    ? (entity.name_fr ?? entity.name_en ?? '')
    : (entity.name_en ?? entity.name_fr ?? '');
}

export default i18n;
