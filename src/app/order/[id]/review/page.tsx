'use client';

import { useState, useEffect, use } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import AudioPlayer from '@/components/AudioPlayer';

interface OrderData {
  id: string;
  recipientName: string;
  style: string;
  audioUrl?: string;
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRevising, setIsRevising] = useState(false);
  const [newAudioUrl, setNewAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    setError(null);
    setIsRevising(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_revision', notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setNewAudioUrl(data.audioUrl || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La revisión falló');
    } finally {
      setIsRevising(false);
    }
  };

  if (loading) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto' }} />
      </div>
    );
  }

  // New version is ready — play + download it right away.
  if (newAudioUrl) {
    return (
      <div className="section">
        <div className="container container-narrow text-center animate-fade-in-up">
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>✅</div>
          <h1 className="heading-lg mb-md">{t('revision.success')}</h1>
          <div className="card" style={{ maxWidth: 520, margin: '0 auto var(--space-lg)' }}>
            <h3 className="heading-sm mb-lg">{t('revision.newVersion')}</h3>
            <AudioPlayer
              src={newAudioUrl}
              title={`🎵 ${order?.recipientName} — ${order?.style}`}
              showVisualizer
            />
            <div className="flex gap-md mt-lg justify-center" style={{ flexWrap: 'wrap' }}>
              <a href={newAudioUrl} download className="btn btn-primary btn-sm">
                {t('order.downloadMp3')} 📥
              </a>
              <a href={`/order/${id}`} className="btn btn-outline btn-sm">
                ← {t('common.back')}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="animate-fade-in-up">
          <div className="text-center mb-xl">
            <h1 className="heading-lg mb-md">{t('revision.title')}</h1>
            <p className="body-lg">{t('revision.subtitle')}</p>
          </div>

          <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
            {isRevising ? (
              <div className="text-center" style={{ padding: 'var(--space-2xl) 0' }}>
                <div className="spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
                <h3 className="heading-sm">{t('revision.regenerating')}</h3>
              </div>
            ) : (
              <>
                {/* Current Version */}
                <h3 className="heading-sm mb-lg">{t('revision.currentVersion')}</h3>
                <AudioPlayer
                  src={order?.audioUrl || undefined}
                  title={`${order?.recipientName} — ${order?.style}`}
                  showVisualizer
                />

                {/* Revision Form */}
                <form onSubmit={handleSubmit} className="mt-xl">
                  <div className="input-group">
                    <label className="input-label">{t('revision.whatToChange')}</label>
                    <textarea
                      className="input-field"
                      placeholder={t('revision.placeholder')}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      required
                      style={{ minHeight: 150 }}
                    />
                    <span className="input-help">
                      {notes.length}/500 {t('revision.charCount')}
                    </span>
                  </div>

                  {error && (
                    <p className="body-sm mt-md" style={{ color: 'var(--accent-primary)' }}>⚠️ {error}</p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary w-full mt-lg"
                    disabled={!notes.trim()}
                  >
                    {t('revision.submit')} 🎧
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="text-center mt-lg">
            <a href={`/order/${id}`} className="btn btn-ghost">
              ← {t('common.back')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
