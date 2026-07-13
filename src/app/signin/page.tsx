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
  const { user, signUp, signIn, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recipient, setRecipient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
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

  // Once logged in, always go to the dashboard. If a song order is pending,
  // the dashboard finalizes it automatically (creates the song + spends credits).
  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result && result.error) {
      setError(result.error);
      setIsGoogleSubmitting(false);
    }
  };

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

    // Dashboard finalizes any pending order automatically.
    router.push('/dashboard');
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

          {/* Google Auth Button */}
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isGoogleSubmitting}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              marginBottom: '0.5rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>
              {isGoogleSubmitting
                ? (isEn ? 'Connecting...' : 'Conectando...')
                : isSignup
                  ? (isEn ? 'Continue with Google' : 'Continuar con Google')
                  : (isEn ? 'Sign in with Google' : 'Iniciar sesión con Google')}
            </span>
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span style={{ padding: '0 0.85rem', fontSize: '0.85rem', fontWeight: 500 }}>
              {isEn ? 'or' : 'o'}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

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
                  disabled={isSubmitting || isGoogleSubmitting}
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
                disabled={isSubmitting || isGoogleSubmitting}
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
                  disabled={isSubmitting || isGoogleSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isSubmitting || isGoogleSubmitting}
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
              disabled={isSubmitting || isGoogleSubmitting}
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
