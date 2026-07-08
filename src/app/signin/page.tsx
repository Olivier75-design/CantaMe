'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

// Sign in / create account step, shown after a plan is selected and before payment.
// Now uses Supabase Auth for real authentication.
export default function SignInPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, signUp, signIn } = useAuth();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recipient, setRecipient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === 'signup';

  useEffect(() => {
    // Open directly on the requested tab (e.g. header "Log in" -> ?mode=signin).
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    if (urlMode === 'signin' || urlMode === 'signup') setMode(urlMode);

    // If there is a pending order, show who the song is for (context).
    const stored = sessionStorage.getItem('ct-order');
    if (stored) {
      try {
        setRecipient(JSON.parse(stored)?.recipientName || null);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // If user is already logged in, redirect to checkout
  useEffect(() => {
    if (user) {
      const hasPendingOrder = sessionStorage.getItem('ct-order');
      if (hasPendingOrder) {
        router.push('/checkout');
      }
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignup && !name)) return;

    setIsSubmitting(true);
    setError(null);

    let result;
    if (isSignup) {
      result = await signUp(email, password, name);
    } else {
      result = await signIn(email, password);
    }

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    // Redirect to checkout if there's a pending order, otherwise home
    const hasPendingOrder = sessionStorage.getItem('ct-order');
    if (hasPendingOrder) {
      router.push('/checkout');
    } else {
      router.push('/');
    }
  };

  const isEn = t('nav.login') === 'Log in';

  return (
    <div className="section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
      <div
        className="container"
        style={{ maxWidth: 480, margin: '0 auto' }}
      >
        <div className="card card-elevated animate-fade-in" style={{ padding: '2.75rem' }}>
          {recipient && (
            <div
              className="text-center mb-lg"
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-glass)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <p className="body-md">
                🎵 {isEn
                  ? `Creating a song for ${recipient}`
                  : `Creando una canción para ${recipient}`}
              </p>
            </div>
          )}

          <h1 className="heading-lg text-center mb-lg">
            {isSignup
              ? (isEn ? 'Create your account' : 'Crea tu cuenta')
              : (isEn ? 'Welcome back' : 'Bienvenido de vuelta')}
          </h1>

          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(242, 95, 76, 0.1)',
                border: '1px solid rgba(242, 95, 76, 0.3)',
                borderRadius: '8px',
                color: '#F25F4C',
                marginBottom: '1rem',
                fontSize: '0.9rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignup && (
              <div className="input-group">
                <label className="input-label">
                  {isEn ? 'Full name' : 'Nombre completo'}
                </label>
                <input
                  className="text-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isEn ? 'John Doe' : 'Juan Pérez'}
                  required
                />
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                className="text-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                {isEn ? 'Password' : 'Contraseña'}
              </label>
              <div className="password-wrap">
                <input
                  className="text-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEn ? 'Min. 6 characters' : 'Mín. 6 caracteres'}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? (isEn ? 'Hide password' : 'Ocultar contraseña')
                      : (isEn ? 'Show password' : 'Mostrar contraseña')
                  }
                >
                  {showPassword ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (isEn ? 'Please wait...' : 'Por favor espera...')
                : isSignup
                  ? (isEn ? 'Create Account' : 'Crear cuenta')
                  : (isEn ? 'Sign In' : 'Iniciar sesión')}
            </button>
          </form>

          <p className="body-md text-center" style={{ marginTop: '1.5rem' }}>
            {isSignup
              ? (isEn ? 'Already have an account? ' : '¿Ya tienes cuenta? ')
              : (isEn ? "Don't have an account? " : '¿No tienes cuenta? ')}
            <button
              type="button"
              onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              {isSignup
                ? (isEn ? 'Sign in' : 'Inicia sesión')
                : (isEn ? 'Create one' : 'Crea una')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
