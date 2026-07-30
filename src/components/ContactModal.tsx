'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { CONTACT_SUBJECTS } from '@/lib/constants';

// Contact form modal. Mounted once by <Footer>, which lives in the root layout,
// so it is available on every page. Anything can open it by calling
// openContactModal() — that keeps /privacy and /terms from having to duplicate
// the form or thread a prop through the tree for one button.
const OPEN_EVENT = 'cantame:contact';

export function openContactModal() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const MESSAGE_MAX = 2000;

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string; // honeypot — must stay empty
}

const EMPTY: FormState = { name: '', email: '', subject: 'general', message: '', website: '' };

export default function ContactModal() {
  const { t, lang } = useLanguage();
  const { user, session } = useAuth();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError('');
    // Reset only after a successful send: if the send failed, keep what the
    // visitor typed so reopening doesn't cost them their message.
    if (sent) {
      setSent(false);
      setForm(EMPTY);
    }
  }, [sent]);

  // Latest user kept in a ref so opening the modal can prefill from it without
  // an effect that re-runs on every auth state change.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const onOpen = () => {
      // Prefill from the signed-in account — one less thing to type, and the
      // reply address is then one we already know is real.
      const u = userRef.current;
      if (u) {
        const name = (u.user_metadata?.full_name || u.user_metadata?.name || '') as string;
        setForm((f) => ({ ...f, name: f.name || name, email: f.email || u.email || '' }));
      }
      setError('');
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Escape to close + lock background scroll while the modal is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  if (!open) return null;

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side checks mirror the server's; the server is the one that counts.
    if (!form.name.trim()) return setError(t('contact.errors.name'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setError(t('contact.errors.email'));
    if (form.message.trim().length < 10) return setError(t('contact.errors.message'));

    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional: lets the server attach the sender's user id to the message.
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ ...form, locale: lang }),
      });

      if (res.ok) {
        setSent(true);
      } else if (res.status === 429) {
        setError(t('contact.errors.rateLimited'));
      } else {
        setError(t('contact.errors.generic'));
      }
    } catch {
      setError(t('contact.errors.generic'));
    }
    setSending(false);
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: 6,
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: 'var(--space-lg)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('contact.title')}
        className="card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card, #fff)',
        }}
      >
        <div className="flex justify-between items-center mb-md" style={{ gap: 'var(--space-md)' }}>
          <h3 className="heading-sm" style={{ margin: 0, minWidth: 0 }}>
            ✉️ {t('contact.title')}
          </h3>
          <button
            type="button"
            onClick={close}
            aria-label={t('common.close')}
            className="btn btn-sm btn-ghost"
            style={{ flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div className="text-center" style={{ padding: 'var(--space-lg) 0' }}>
            <div style={{ fontSize: '3rem', lineHeight: 1 }}>✅</div>
            <h4 className="heading-sm" style={{ marginTop: 'var(--space-md)' }}>
              {t('contact.successTitle')}
            </h4>
            <p className="body-md" style={{ marginTop: 'var(--space-sm)' }}>
              {t('contact.successBody', { name: form.name.trim(), email: form.email.trim() })}
            </p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }} onClick={close}>
              {t('contact.done')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
              {t('contact.subtitle')}
            </p>

            <div className="mb-md">
              <label htmlFor="ct-name" style={labelStyle}>{t('contact.name')}</label>
              <input
                id="ct-name"
                ref={firstFieldRef}
                className="input-field"
                value={form.name}
                onChange={set('name')}
                maxLength={80}
                placeholder={t('contact.namePlaceholder')}
                autoComplete="name"
                required
              />
            </div>

            <div className="mb-md">
              <label htmlFor="ct-email" style={labelStyle}>{t('contact.email')}</label>
              <input
                id="ct-email"
                type="email"
                className="input-field"
                value={form.email}
                onChange={set('email')}
                maxLength={160}
                placeholder={t('contact.emailPlaceholder')}
                autoComplete="email"
                required
              />
            </div>

            <div className="mb-md">
              <label htmlFor="ct-subject" style={labelStyle}>{t('contact.subject')}</label>
              <select id="ct-subject" className="input-field" value={form.subject} onChange={set('subject')}>
                {CONTACT_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{t(`contact.subjects.${s}`)}</option>
                ))}
              </select>
            </div>

            <div className="mb-md">
              <label htmlFor="ct-message" style={labelStyle}>{t('contact.message')}</label>
              <textarea
                id="ct-message"
                className="input-field"
                value={form.message}
                onChange={set('message')}
                maxLength={MESSAGE_MAX}
                rows={5}
                placeholder={t('contact.messagePlaceholder')}
                required
              />
              <div className="body-sm" style={{ textAlign: 'right', color: 'var(--text-muted)', marginTop: 4 }}>
                {form.message.length}/{MESSAGE_MAX}
              </div>
            </div>

            {/* Honeypot: hidden from humans, irresistible to bots. */}
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={set('website')}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            {error && (
              <p className="body-sm mb-md" style={{ color: '#DC2626' }} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={sending}>
              {sending ? t('contact.sending') : t('contact.send')}
            </button>

            <p className="body-sm" style={{ marginTop: 'var(--space-md)', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('contact.reply')}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
