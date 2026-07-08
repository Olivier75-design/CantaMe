'use client';

import { useLanguage } from '@/context/LanguageContext';

export default function LanguageSwitch() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="lang-switch">
      <button
        className={lang === 'es' ? 'active' : ''}
        onClick={() => setLang('es')}
        aria-label="Español"
      >
        ES
      </button>
      <button
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
