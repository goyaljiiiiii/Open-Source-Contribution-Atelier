import { useContext } from 'react';
import { I18nContext } from './I18nProvider';
import { interpolateString } from './icu-formatter';

export function useTranslate() {
  const { locale, translations, setLocale, isLoading } = useContext(I18nContext);

  const t = (key: string, values?: Record<string, any>): string => {
    const template = translations[key];
    if (template === undefined) {
      console.warn(`Translation key missing: ${key}`);
      return key; // Fallback to key if not found in any locale chain
    }
    return interpolateString(template, values);
  };

  return { t, locale, setLocale, isLoading };
}
