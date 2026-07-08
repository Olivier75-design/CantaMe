'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import LanguageSwitch from './LanguageSwitch';

export default function Header() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;

  return (
    <nav className="navbar" id="main-nav">
      <div className="navbar-inner">
        <Link href="/" className="navbar-logo">
          🎵 <span>CantaMe</span>
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <li><Link href="/" onClick={() => setMenuOpen(false)}>{t('nav.home')}</Link></li>
          <li><Link href="/gallery" onClick={() => setMenuOpen(false)}>{t('nav.gallery')}</Link></li>
          <li><Link href="/how-it-works" onClick={() => setMenuOpen(false)}>{t('nav.howItWorks')}</Link></li>
        </ul>

        <div className="navbar-actions">
          <LanguageSwitch />
          {user ? (
            <>
              <Link href="/dashboard" className="navbar-login-link" style={{ fontSize: '0.85rem' }}>
                👤 {displayName}
              </Link>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => signOut()}
                style={{ fontSize: '0.8rem' }}
              >
                {t('nav.login') === 'Log in' ? 'Sign Out' : 'Salir'}
              </button>
            </>
          ) : (
            <Link href="/signin?mode=signin" className="navbar-login-link">
              {t('nav.login')}
            </Link>
          )}
          <Link href="/create" className="btn btn-primary btn-sm">
            {t('nav.createSong')}
          </Link>
        </div>
      </div>
    </nav>
  );
}
