'use client';

import { useState, useEffect, use } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import AudioPlayer from '@/components/AudioPlayer';

interface OrderData {
  id: string;
  recipientName: string;
  relation: string;
  style: string;
  audioUrl?: string;
  instrumentalUrl?: string;
}

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto' }} />
      </div>
    );
  }

  if (!order) return null;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleWhatsAppShare = () => {
    const text = `🎵 ${order.recipientName}, ${t('share.subtitle')} ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div className="section">
      <div className="container container-narrow text-center">
        <div className="animate-fade-in-up">
          {/* Decorative Header */}
          <div
            style={{
              fontSize: '5rem',
              marginBottom: 'var(--space-lg)',
            }}
            className="animate-float"
          >
            🎵
          </div>

          <h1 className="heading-lg mb-md">
            {t('share.title', { name: order.recipientName })}
          </h1>
          <p className="body-lg mb-xl" style={{ maxWidth: 500, margin: '0 auto var(--space-xl)' }}>
            {t('share.subtitle')}
          </p>

          {/* Audio Player */}
          <div
            className="card"
            style={{
              maxWidth: 500,
              margin: '0 auto var(--space-xl)',
              padding: 'var(--space-2xl)',
              background: 'var(--gradient-card)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'var(--gradient-warm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                margin: '0 auto var(--space-lg)',
                boxShadow: 'var(--shadow-glow-strong)',
              }}
            >
              🎶
            </div>

            <h3 className="heading-md mb-sm" style={{ textTransform: 'capitalize' }}>
              {order.style} — {order.recipientName}
            </h3>
            <p className="body-sm mb-lg">CantaMe</p>

            <AudioPlayer
              src={order.audioUrl || undefined}
              title={`${order.recipientName}'s Song`}
              variant="large"
              showVisualizer
            />
          </div>

          {/* Share Actions */}
          <div className="flex items-center justify-center gap-md" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleWhatsAppShare}>
              📱 WhatsApp
            </button>
            <button className="btn btn-secondary" onClick={handleCopyLink}>
              🔗 {t('hero.stats') === 'songs created' ? 'Copy Link' : 'Copiar Link'}
            </button>
            {order.audioUrl && (
              <a href={`/api/orders/${order.id}/download`} className="btn btn-outline">
                📥 {t('order.downloadMp3')}
              </a>
            )}
          </div>

          {/* Branding */}
          <p className="body-sm mt-2xl" style={{ opacity: 0.5 }}>
            {t('share.madeWith')} 💛
          </p>
        </div>
      </div>
    </div>
  );
}
