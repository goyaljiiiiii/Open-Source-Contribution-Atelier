import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

interface I18nContextType {
  locale: string;
  translations: Record<string, string>;
  fallbackChain: string[];
  setLocale: (locale: string) => void;
  isLoading: boolean;
}

export const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  translations: {},
  fallbackChain: ['en'],
  setLocale: () => {},
  isLoading: true,
});

// Cache for loaded translations
const translationsCache: Record<string, Record<string, string>> = {};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<string>('en');
  const [fallbackChain, setFallbackChain] = useState<string[]>(['en']);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial detection
  useEffect(() => {
    const detectLocale = async () => {
      let targetLocale = 'en';
      
      // 1. URL param
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      
      // 2. localStorage
      const localLang = localStorage.getItem('preferred_locale');

      if (urlLang) {
        targetLocale = urlLang;
      } else if (localLang) {
        targetLocale = localLang;
      } else {
        // 3. API backend fallback
        try {
          const res = await fetch('/api/i18n/detect');
          if (res.ok) {
            const data = await res.json();
            targetLocale = data.locale;
            setFallbackChain(data.fallback_chain || [targetLocale, 'en']);
          }
        } catch (e) {
          // ignore
        }
      }
      
      setLocale(targetLocale);
    };
    
    detectLocale();
  }, []);

  const setLocale = async (newLocale: string) => {
    setIsLoading(true);
    setLocaleState(newLocale);
    localStorage.setItem('preferred_locale', newLocale);

    // Naive local fallback chain generation if not from API
    let currentChain = fallbackChain;
    if (currentChain[0] !== newLocale) {
      const prefix = newLocale.split('-')[0];
      const chain = [newLocale];
      if (prefix !== newLocale) chain.push(prefix);
      if (!chain.includes('en')) chain.push('en');
      currentChain = chain;
      setFallbackChain(currentChain);
    }

    const mergedTranslations: Record<string, string> = {};
    
    // Load fallbacks from lowest priority to highest (so higher overwrites lower)
    for (let i = currentChain.length - 1; i >= 0; i--) {
      const lang = currentChain[i];
      if (!translationsCache[lang]) {
        try {
          const mod = await import(`./locales/${lang}.json`);
          translationsCache[lang] = mod.default || mod;
        } catch (e) {
          console.warn(`Could not load translations for ${lang}`);
          translationsCache[lang] = {};
        }
      }
      Object.assign(mergedTranslations, translationsCache[lang]);
    }
    
    setTranslations(mergedTranslations);
    setIsLoading(false);
  };

  const value = useMemo(() => ({
    locale,
    translations,
    fallbackChain,
    setLocale,
    isLoading
  }), [locale, translations, fallbackChain, isLoading]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
