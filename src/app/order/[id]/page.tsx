'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import AudioPlayer from '@/components/AudioPlayer';

interface OrderData {
  id: string;
  recipientName: string;
  relation: string;
  occasion: string;
  style: string;
  tier: string;
  status: string;
  price: number;
  audioUrl?: string;
  instrumentalUrl?: string;
  createdAt: string;
}

const STATUS_STEPS = ['PAID', 'IN_PRODUCTION', 'READY', 'DELIVERED'];

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!order) {
    return (
      <div className="section text-center">
        <h1 className="heading-lg">{t('common.error')}</h1>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const isReady = order.status === 'READY' || order.status === 'DELIVERED';
  const canRevise = order.tier !== 'basica';

  const tierDelivery: Record<string, string> = {
    basica: '48h',
    especial: '48h',
    premium: '24h',
  };

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="animate-fade-in-up text-center">
          <h1 className="heading-lg mb-md">
            {t('order.title')}
          </h1>
          <p className="body-lg mb-xl">
            {t('order.subtitle', { name: order.recipientName })}
          </p>

          {/* Timeline */}
          <div className="timeline mb-xl">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  className={`timeline-step ${
                    i < currentStepIndex
                      ? 'completed'
                      : i === currentStepIndex
                      ? 'active'
                      : ''
                  }`}
                >
                  <div className="timeline-dot">
                    {i < currentStepIndex ? '✓' : i + 1}
                  </div>
                  <span className="timeline-label">
                    {t(`order.statuses.${step}`)}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    className={`timeline-connector ${
                      i < currentStepIndex ? 'completed' : ''
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Order Details Card */}
          <div className="card" style={{ maxWidth: 500, margin: '0 auto var(--space-xl)', textAlign: 'left' }}>
            <h3 className="heading-sm mb-lg">{t('order.details')}</h3>
            <div className="flex flex-col gap-sm">
              {[
                { label: 'Recipient', value: order.recipientName },
                { label: 'Occasion', value: order.occasion },
                { label: 'Style', value: order.style },
                { label: 'Tier', value: order.tier },
                { label: t('order.estimatedDelivery'), value: tierDelivery[order.tier] || '48h' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span className="body-sm">{item.label}</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Player (when ready) */}
          {isReady && (
            <div className="card mb-xl" style={{ maxWidth: 500, margin: '0 auto var(--space-xl)' }}>
              <p className="body-sm mb-lg" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                {t('order.receiptNote')}
              </p>
              <h3 className="heading-sm mb-lg">{t('order.listenSong')}</h3>
              <AudioPlayer
                src={order.audioUrl || undefined}
                title={`🎵 ${order.recipientName} — ${order.style}`}
                showVisualizer
              />
              <div className="flex gap-md mt-lg" style={{ flexWrap: 'wrap' }}>
                {order.audioUrl && (
                  <a href={order.audioUrl} download className="btn btn-primary btn-sm">
                    {t('order.downloadMp3')} 📥
                  </a>
                )}
                {order.instrumentalUrl && (
                  <a href={order.instrumentalUrl} download className="btn btn-secondary btn-sm">
                    {t('order.downloadInstrumental')} 🎸
                  </a>
                )}
                <Link href={`/order/${order.id}/share`} className="btn btn-outline btn-sm">
                  {t('order.shareSong')} 📤
                </Link>
                {canRevise && (
                  <Link href={`/order/${order.id}/review`} className="btn btn-ghost btn-sm">
                    {t('order.requestRevision')} ✏️
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Share Button (even when not ready, for tracking) */}
          {!isReady && (
            <div className="body-md" style={{ color: 'var(--accent-primary)' }}>
              <span className="animate-pulse">
                {t('hero.stats') === 'songs created'
                  ? '🎵 We\'re finalizing your song. It will appear right here in your dashboard.'
                  : '🎵 Estamos finalizando tu canción. Aparecerá aquí mismo en tu panel.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
