'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, CircleHelp, House, Images, LogOut, Menu, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import LanguageSwitch from './LanguageSwitch';

export default function Header() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  // Escape closes the phone menu, like any other overlay.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;
  const initial = (displayName || '?').trim().charAt(0).toUpperCase();

  const links = [
    { href: '/', label: t('nav.home'), Icon: House },
    { href: '/gallery', label: t('nav.gallery'), Icon: Images },
    { href: '/how-it-works', label: t('nav.howItWorks'), Icon: CircleHelp },
  ];

  return (
    <nav className="navbar" id="main-nav">
      <div className="navbar-inner">
        <Link href="/" className="navbar-logo" onClick={close}>
          🎵 <span>CantaMe</span>
        </Link>

        <ul className="navbar-links">
          {links.map((l) => (
            <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
          ))}
        </ul>

        <div className="navbar-actions">
          <LanguageSwitch />
          {/* Desktop only: on a phone, the account links live in the menu. */}
          {user ? (
            <>
              <Link href="/dashboard" className="navbar-user desktop-only">
                <span className="navbar-avatar" aria-hidden>{initial}</span>
                <span className="navbar-user-name">{displayName}</span>
              </Link>
              <button className="btn btn-secondary btn-sm desktop-only" onClick={() => signOut()}>
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <Link href="/signin?mode=signin" className="navbar-login-link desktop-only">
              {t('nav.login')}
            </Link>
          )}
          <Link href="/create" className="btn btn-primary btn-sm desktop-only">
            {t('nav.createSong')}
          </Link>
          <button
            className="navbar-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Phone menu. Always rendered so it can animate; `visibility: hidden`
          while closed keeps it out of the tab order and the accessibility tree. */}
      <div className={`mobile-menu-backdrop ${menuOpen ? 'open' : ''}`} onClick={close} aria-hidden />
      <div id="mobile-menu" className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <ul className="mm-list">
          {links.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className="mm-item" onClick={close}>
                <Icon size={20} strokeWidth={1.8} aria-hidden />
                <span>{label}</span>
                <ChevronRight size={18} className="mm-chevron" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mm-account">
          {user ? (
            <>
              <Link href="/dashboard" className="mm-user" onClick={close}>
                <span className="navbar-avatar" aria-hidden>{initial}</span>
                <span className="mm-user-text">
                  <strong>{displayName}</strong>
                  <small>{t('nav.dashboard')}</small>
                </span>
                <ChevronRight size={18} className="mm-chevron" aria-hidden />
              </Link>
              <button className="mm-item mm-signout" onClick={() => { close(); signOut(); }}>
                <LogOut size={20} strokeWidth={1.8} aria-hidden />
                <span>{t('nav.signOut')}</span>
              </button>
            </>
          ) : (
            <div className="mm-auth">
              <Link href="/signin?mode=signin" className="btn btn-outline" onClick={close}>
                {t('nav.login')}
              </Link>
              <Link href="/signin?mode=signup" className="btn btn-secondary" onClick={close}>
                {t('nav.signUp')}
              </Link>
            </div>
          )}
          <Link href="/create" className="btn btn-primary mm-cta" onClick={close}>
            {t('nav.createSong')}
          </Link>
        </div>
      </div>
    </nav>
  );
}
