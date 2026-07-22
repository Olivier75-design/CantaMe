'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import AudioPlayer from '@/components/AudioPlayer';

interface OrderData {
  recipientName: string;
  relation: string;
  anecdote1: string;
  anecdote2: string;
  message: string;
  tone: string;
  songLanguage: string;
  occasion: string;
  style: string;
}

export default function PreviewPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const isEn = lang === 'en';

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const loadingSteps = [
    isEn ? '🎵 Analyzing your story...' : '🎵 Analizando tu historia...',
    isEn ? '✍️ Writing personalized lyrics...' : '✍️ Escribiendo letras personalizadas...',
    isEn ? '🎸 Composing the melody...' : '🎸 Componiendo la melodía...',
    isEn ? '🎤 Generating the vocals...' : '🎤 Generando las voces...',
    isEn ? '✨ Polishing the final mix...' : '✨ Puliendo la mezcla final...',
  ];

  // Run the real preview generation (writes lyrics + composes a short teaser).
  const generate = useCallback(async (brief: OrderData) => {
    setError(null);
    setAudioUrl(null);
    setLyrics('');
    setGeneratingStep(0);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setAudioUrl(data.audioUrl);
      setLyrics(data.lyrics || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : (isEn ? 'Generation failed' : 'La generación falló'));
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEn]);

  // On mount: load the brief and kick off generation (once). No brief -> restart.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const stored = sessionStorage.getItem('ct-order');
    if (!stored) {
      router.replace('/create');
      return;
    }
    const brief = JSON.parse(stored) as OrderData;
    setOrderData(brief);
    generate(brief);
  }, [router, generate]);

  // Advance the loading animation while the real generation runs (holds on last).
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setGeneratingStep((prev) => (prev >= loadingSteps.length - 1 ? prev : prev + 1));
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  // Save the brief + generated preview, then continue to the credit step.
  const handleGetSong = () => {
    if (!orderData) return;
    sessionStorage.setItem(
      'ct-order',
      JSON.stringify({ ...orderData, tier: 'credit', price: 2, audioUrl, lyrics })
    );
    // Logged-in users go to the dashboard (finalizes with a credit); guests sign in first.
    router.push(user ? '/dashboard' : '/signin');
  };

  const recipientName = orderData?.recipientName || 'Someone Special';

  // ── Generating ─────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="section">
        <div className="container container-narrow">
          <div className="song-loader animate-fade-in">
            <div className="song-loader-eq" aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span />
            </div>
            <h3 className="heading-md song-loader-title">{loadingSteps[generatingStep]}</h3>
            <div className="song-loader-track" aria-hidden="true" />
            <ul className="song-loader-steps">
              {loadingSteps.map((s, i) => {
                const state = i < generatingStep ? 'done' : i === generatingStep ? 'active' : 'upcoming';
                return (
                  <li key={i} className={state}>
                    <span className="sls-badge">{state === 'done' ? '✓' : state === 'active' ? '' : i + 1}</span>
                    <span>{s}</span>
                  </li>
                );
              })}
            </ul>
            <p className="song-loader-hint">
              {isEn
                ? '⏳ This usually takes 30–60 seconds. Please keep this page open.'
                : '⏳ Esto suele tardar 30–60 segundos. No cierres esta página.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="section">
        <div className="container container-narrow">
          <div className="card text-center" style={{ maxWidth: 540, margin: '0 auto' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>⚠️</div>
            <h3 className="heading-md mb-md">{isEn ? 'Generation failed' : 'La generación falló'}</h3>
            <p className="body-sm mb-lg" style={{ color: 'var(--accent-primary)' }}>{error}</p>
            <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => orderData && generate(orderData)}>
                🔄 {isEn ? 'Try again' : 'Reintentar'}
              </button>
              <button className="btn btn-outline" onClick={() => router.push('/create')}>
                ← {t('common.back')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview + lyrics + credit CTA ──────────────────────────
  return (
    <div className="section">
      <div className="container">
        {/* Step Indicator */}
        <div className="steps">
          <div className="step-dot completed" />
          <div className="step-dot completed" />
          <div className="step-dot completed" />
          <div className="step-dot active" />
        </div>

        <div className="animate-fade-in-up">
          <div className="text-center mb-xl">
            <h1 className="heading-lg mb-md">{t('preview.title')}</h1>
            <p className="body-lg">{t('preview.subtitle', { name: recipientName })}</p>
          </div>

          {/* Preview player */}
          <div
            className="card"
            style={{
              maxWidth: 600,
              margin: '0 auto var(--space-xl)',
              textAlign: 'center',
              padding: 'var(--space-2xl)',
              background: 'var(--gradient-card)',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }} className="animate-float">🎵</div>
            <h3 className="heading-md mb-lg">
              {isEn ? 'Song for' : 'Canción para'} {recipientName}
            </h3>
            <AudioPlayer
              src={audioUrl || undefined}
              variant="large"
              title={`${orderData?.style || 'Bachata'} · ${recipientName}`}
              showVisualizer
              maxDuration={30}
            />
            <p className="body-md mt-lg" style={{ fontStyle: 'italic', color: 'var(--accent-primary)' }}>
              {t('preview.cta', { name: recipientName })}
            </p>
          </div>

          {/* Generated lyrics */}
          {lyrics && (
            <div className="card" style={{ maxWidth: 600, margin: '0 auto var(--space-2xl)' }}>
              <div className="text-center mb-md">
                <div style={{ fontSize: '2rem' }}>📝</div>
                <h3 className="heading-sm">{t('lyrics.title')}</h3>
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.8,
                  fontFamily: 'inherit',
                  color: 'var(--text-secondary)',
                  maxHeight: 320,
                  overflowY: 'auto',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {lyrics}
              </div>
            </div>
          )}

          {/* Credit-based unlock (replaces the old $10/$20/$35 plan cards) */}
          <div className="credit-cta card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="credit-cta-badge">🎵 {t('credits.oneSong')}</div>
            <h2 className="heading-md mb-sm">{t('credits.unlockTitle')}</h2>
            <p className="body-md mb-lg">{t('credits.unlockSubtitle')}</p>

            <ul className="credit-cta-features">
              <li>✓ {t('credits.featFull')}</li>
              <li>✓ {t('credits.featDownload')}</li>
              <li>✓ {t('credits.featShare')}</li>
            </ul>

            <button className="btn btn-primary btn-lg w-full" onClick={handleGetSong}>
              ✨ {t('credits.getMySong')}
            </button>
            <p className="body-sm mt-md" style={{ color: 'var(--text-muted)' }}>
              {t('credits.firstFree')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
