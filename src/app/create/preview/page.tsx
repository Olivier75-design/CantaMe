'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { authHeaders } from '@/lib/authClient';
import AudioPlayer from '@/components/AudioPlayer';
import SongRating from '@/components/SongRating';

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
  voiceGender: string;
}

export default function PreviewPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const isEn = lang === 'en';

  const [orderData, setOrderData] = useState<OrderData | null>(null);

  // Step 1 — editable lyrics, written before any music (same as the home wizard).
  const [lyrics, setLyrics] = useState('');
  const [lyricsTitle, setLyricsTitle] = useState('');
  const [isWritingLyrics, setIsWritingLyrics] = useState(true);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  // Step 2 — the song, composed from those exact lyrics.
  const [composeStarted, setComposeStarted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const loadingSteps = [
    isEn ? '🎵 Analyzing your story...' : '🎵 Analizando tu historia...',
    isEn ? '✍️ Writing personalized lyrics...' : '✍️ Escribiendo letras personalizadas...',
    isEn ? '🎸 Composing the melody...' : '🎸 Componiendo la melodía...',
    isEn ? '🎤 Generating the vocals...' : '🎤 Generando las voces...',
    isEn ? '✨ Polishing the final mix...' : '✨ Puliendo la mezcla final...',
  ];

  // Write (or rewrite) the lyrics. Cheap and quick, unlike composing, so a
  // reload of this page only costs a new draft — not a second song.
  const requestLyrics = useCallback(async (brief: OrderData) => {
    setLyricsError(null);
    setIsWritingLyrics(true);
    try {
      const res = await fetch('/api/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(brief),
      });
      const data = await res.json();
      // Creating requires an account — the route 401s without one.
      if (res.status === 401) {
        router.push('/signin?mode=signup&next=/create');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Error');
      setLyrics(data.lyrics || '');
      setLyricsTitle(data.title || '');
    } catch (err) {
      setLyricsError(err instanceof Error ? err.message : t('lyrics.failed'));
    } finally {
      setIsWritingLyrics(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Compose the music from the (possibly edited) lyrics.
  const compose = async () => {
    if (!orderData || !lyrics.trim()) return;
    setError(null);
    setAudioUrl(null);
    setGeneratingStep(0);
    setComposeStarted(true);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ ...orderData, lyrics, title: lyricsTitle }),
      });
      const data = await res.json();

      if (res.status === 401) {
        router.push('/signin?mode=signup&next=/create');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Error');

      // Comes back LOCKED: an order id, never the audio URL.
      // Credits are spent to unlock it, not to generate it.
      setOrderId(data.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isEn ? 'Generation failed' : 'La generación falló'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Spend credits to unlock the finished song. The audio URL only comes back
  // here, after payment — before that the client never holds it.
  const handleUnlock = async () => {
    if (!orderId) return;
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/unlock`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (res.status === 402) {
        // Out of credits -> buy a pack; the callback then unlocks THIS song.
        sessionStorage.setItem('ct-unlock', orderId);
        router.push('/checkout');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Error');
      setAudioUrl(data.audioUrl);
    } catch {
      setError(isEn ? 'Could not unlock the song.' : 'No se pudo desbloquear la canción.');
    } finally {
      setUnlocking(false);
    }
  };

  // On mount: load the brief and write the lyrics (once). No brief -> restart.
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
    requestLyrics(brief);
  }, [router, requestLyrics]);

  // Advance the loading animation while the real generation runs (holds on last).
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setGeneratingStep((prev) => (prev >= loadingSteps.length - 1 ? prev : prev + 1));
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  // The song was saved to the library when it was generated, so there is
  // nothing to hand over — handing the brief to the dashboard made it create a
  // locked duplicate of this song.
  const handleGetSong = () => {
    sessionStorage.removeItem('ct-order');
    router.push(user ? '/dashboard' : '/signin');
  };

  const recipientName = orderData?.recipientName || 'Someone Special';
  // Back to the story form with the same occasion + style (it restores the rest).
  const detailsHref = `/create/details?${new URLSearchParams({ occasion: orderData?.occasion || '', style: orderData?.style || '' })}`;

  // Playback is free for everyone, but downloading requires an account. Guests
  // go through sign-in (which also saves the song to their new library).
  // Signed-in users need the token on the request, so a plain <a href> won't do.
  const handleDownload = async () => {
    if (!audioUrl) return;
    if (!user) {
      handleGetSong();
      return;
    }
    try {
      const res = await fetch(
        `/api/songs/download?url=${encodeURIComponent(audioUrl)}&name=${encodeURIComponent(recipientName)}`,
        { headers: await authHeaders() },
      );
      if (!res.ok) throw new Error('download');
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `CantaMe - ${recipientName}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setError(isEn ? 'Download failed. Please try again.' : 'La descarga falló. Inténtalo de nuevo.');
    }
  };

  // ── Step 1: lyrics ─────────────────────────────────────────
  if (!composeStarted) {
    if (isWritingLyrics) {
      return (
        <div className="section">
          <div className="container container-narrow">
            <div className="song-loader animate-fade-in">
              <div className="song-loader-eq" aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span />
              </div>
              <h3 className="heading-md song-loader-title">✍️ {t('lyrics.writing')}</h3>
              <div className="song-loader-track" aria-hidden="true" />
              <p className="song-loader-hint">
                {isEn
                  ? '⏳ Crafting personalized lyrics from your story…'
                  : '⏳ Creando letras personalizadas a partir de tu historia…'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (lyricsError) {
      return (
        <div className="section">
          <div className="container container-narrow">
            <div className="card text-center" style={{ maxWidth: 540, margin: '0 auto' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>⚠️</div>
              <h3 className="heading-md mb-md">{t('lyrics.failed')}</h3>
              <p className="body-sm mb-lg" style={{ color: 'var(--accent-primary)' }}>{lyricsError}</p>
              <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-outline" onClick={() => orderData && requestLyrics(orderData)}>
                  🔄 {t('lyrics.regenerate')}
                </button>
                <button className="btn btn-primary" onClick={() => router.push(detailsHref)}>
                  ← {t('common.back')}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="section">
        <div className="container container-narrow">
          <div className="steps">
            <div className="step-dot completed" />
            <div className="step-dot completed" />
            <div className="step-dot completed" />
            <div className="step-dot active" />
          </div>
          <div className="card animate-fade-in-up" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="text-center mb-lg">
              <div style={{ fontSize: '2.5rem' }}>📝</div>
              <h3 className="heading-md mb-sm">{t('lyrics.title')}</h3>
              <p className="body-sm" style={{ color: 'var(--text-muted)' }}>{t('lyrics.subtitle')}</p>
            </div>
            <div className="input-group">
              <label className="input-label">{t('lyrics.label')}</label>
              <textarea
                className="input-field lyrics-textarea"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                style={{ minHeight: 300, lineHeight: 1.7, fontFamily: 'inherit' }}
              />
            </div>
            <div className="flex gap-md mt-lg" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => orderData && requestLyrics(orderData)}>
                🔄 {t('lyrics.regenerate')}
              </button>
              <button className="btn btn-primary" style={{ flex: 1, minWidth: 180 }} onClick={compose} disabled={!lyrics.trim()}>
                🎶 {t('lyrics.compose')}
              </button>
            </div>
            <div className="text-center mt-md">
              <button className="btn btn-ghost btn-sm" onClick={() => router.push(detailsHref)}>
                ← {t('common.back')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: composing ──────────────────────────────────────
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
  if (error && !orderId) {
    return (
      <div className="section">
        <div className="container container-narrow">
          <div className="card text-center" style={{ maxWidth: 540, margin: '0 auto' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>⚠️</div>
            <h3 className="heading-md mb-md">{isEn ? 'Generation failed' : 'La generación falló'}</h3>
            <p className="body-sm mb-lg" style={{ color: 'var(--accent-primary)' }}>{error}</p>
            <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={compose}>
                🔄 {t('lyrics.compose')}
              </button>
              <button className="btn btn-outline" onClick={() => { setError(null); setComposeStarted(false); }}>
                ← {t('lyrics.backToLyrics')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── The song + lyrics + credit CTA ─────────────────────────
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

          {/* Player */}
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
            {/* No player until there is audio: an empty one reads 0:00 / 0:00
                and its ▶ does nothing, so customers took a locked song for a
                failed one and composed it again. */}
            {audioUrl && (
              <AudioPlayer
                src={audioUrl}
                variant="large"
                title={`${orderData?.style || 'Bachata'} · ${recipientName}`}
                showVisualizer
              />
            )}
            {orderId && !audioUrl && (
              <div className="card mt-lg" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem' }}>🔒</div>
                <h4 className="heading-sm" style={{ marginTop: 'var(--space-sm)' }}>
                  {isEn ? 'Your song is ready' : 'Tu canción está lista'}
                </h4>
                <p className="body-sm" style={{ color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                  {isEn
                    ? 'Unlock it to listen to it in full and download it.'
                    : 'Desbloquéala para escucharla completa y descargarla.'}
                </p>
                <button className="btn btn-primary mt-lg" onClick={handleUnlock} disabled={unlocking}>
                  {unlocking
                    ? (isEn ? 'Unlocking…' : 'Desbloqueando…')
                    : (isEn ? '🔓 Unlock my song' : '🔓 Desbloquear mi canción')}
                </button>
                {error && (
                  <p className="body-sm mt-md" style={{ color: 'var(--accent-primary)' }}>{error}</p>
                )}
              </div>
            )}

            {audioUrl && (
              <>
                <button className="btn btn-outline mt-lg" onClick={handleDownload}>
                  {user ? `⬇ ${t('preview.download')}` : `🔒 ${t('preview.downloadSignIn')}`}
                </button>
                {!user && (
                  <p className="body-sm mt-sm" style={{ color: 'var(--text-muted)' }}>
                    {t('preview.downloadHint')}
                  </p>
                )}
                {error && (
                  <p className="body-sm mt-sm" style={{ color: 'var(--accent-primary)' }}>{error}</p>
                )}
                <div className="mt-lg">
                  <SongRating
                    audioUrl={audioUrl}
                    style={orderData?.style}
                    tone={orderData?.tone}
                    voiceGender={orderData?.voiceGender}
                    occasion={orderData?.occasion}
                  />
                </div>
              </>
            )}
            <p className="body-md mt-lg" style={{ fontStyle: 'italic', color: 'var(--accent-primary)' }}>
              {t('preview.cta', { name: recipientName })}
            </p>
          </div>

          {/* The lyrics the song was composed from */}
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

          {/* Guests are invited to sign in (2nd song free); members just save it. */}
          <div className="credit-cta card" style={{ maxWidth: 600, margin: '0 auto' }}>
            {user ? (
              <>
                <h2 className="heading-md mb-sm">{t('preview.saveCta')}</h2>
                <ul className="credit-cta-features">
                  <li>✓ {t('credits.featFull')}</li>
                  <li>✓ {t('credits.featDownload')}</li>
                  <li>✓ {t('credits.featShare')}</li>
                </ul>
                <button className="btn btn-primary btn-lg w-full" onClick={handleGetSong}>
                  ✨ {t('preview.saveCta')}
                </button>
              </>
            ) : (
              <>
                <div className="credit-cta-badge">🎁 {t('preview.freeBadge')}</div>
                <h2 className="heading-md mb-sm">{t('preview.guestTitle')}</h2>
                <p className="body-md mb-lg">{t('preview.guestBody')}</p>
                <button className="btn btn-primary btn-lg w-full" onClick={handleGetSong}>
                  ✨ {t('preview.guestCta')}
                </button>
                <p className="body-sm mt-md" style={{ color: 'var(--text-muted)' }}>
                  {t('credits.firstFree')}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
