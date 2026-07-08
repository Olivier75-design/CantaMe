'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

type Lang = 'en' | 'es';

/* eslint-disable @typescript-eslint/no-explicit-any */
const dictionaries: Record<Lang, any> = { en, es };

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, replacements?: Record<string, string>) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    // Detect browser language
    const stored = localStorage.getItem('ct-lang') as Lang | null;
    if (stored && (stored === 'en' || stored === 'es')) {
      setLangState(stored);
    } else {
      const browserLang = navigator.language.toLowerCase();
      setLangState(browserLang.startsWith('es') ? 'es' : 'en');
    }
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('ct-lang', newLang);
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string>) => {
      const keys = key.split('.');
      let value: any = dictionaries[lang];
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key; // fallback to key if not found
        }
      }
      if (typeof value === 'string' && replacements) {
        return Object.entries(replacements).reduce(
          (str, [rKey, rVal]) => str.replace(new RegExp(`\\{${rKey}\\}`, 'g'), rVal),
          value
        );
      }
      return value;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
