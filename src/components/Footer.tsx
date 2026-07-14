'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3 className="text-gradient">🎵 CantaMe</h3>
            <p className="body-md" style={{ marginTop: '0.5rem' }}>
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h4 className="footer-heading">{t('footer.navigation')}</h4>
            <ul className="footer-links">
              <li><Link href="/">{t('nav.home')}</Link></li>
              <li><Link href="/gallery">{t('nav.gallery')}</Link></li>
              <li><Link href="/how-it-works">{t('nav.howItWorks')}</Link></li>
              <li><Link href="/create">{t('nav.createSong')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading">{t('footer.legal')}</h4>
            <ul className="footer-links">
              <li><Link href="/privacy">{t('footer.privacy')}</Link></li>
              <li><Link href="/terms">{t('footer.terms')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-heading">{t('footer.contact')}</h4>
            <ul className="footer-links">
              <li><a href="mailto:hello@cantame.app">hello@cantame.app</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {year} CantaMe. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
