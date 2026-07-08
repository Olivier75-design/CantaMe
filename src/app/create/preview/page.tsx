'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
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
  const { t } = useLanguage();
  const router = useRouter();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSteps = [
    t('hero.stats') === 'songs created' ? '🎵 Analyzing your story...' : '🎵 Analizando tu historia...',
    t('hero.stats') === 'songs created' ? '✍️ Writing personalized lyrics...' : '✍️ Escribiendo letras personalizadas...',
    t('hero.stats') === 'songs created' ? '🎸 Composing the melody...' : '🎸 Componiendo la melodía...',
    t('hero.stats') === 'songs created' ? '🎤 Generating the vocals...' : '🎤 Generando las voces...',
    t('hero.stats') === 'songs created' ? '✨ Polishing the final mix...' : '✨ Puliendo la mezcla final...',
  ];

  useEffect(() => {
    const stored = sessionStorage.getItem('ct-order');
    if (stored) {
      setOrderData(JSON.parse(stored));
    }

    // Simulated loading animation
    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= loadingSteps.length - 1) {
          clearInterval(interval);
          setIsLoading(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPlan = (tier: string) => {
    if (!orderData) return;
    sessionStorage.setItem(
      'ct-order',
      JSON.stringify({ ...orderData, tier })
    );
    router.push('/signin');
  };

  if (isLoading) {
    return (
      <div className="section">
        <div className="container container-narrow text-center">
          <div className="animate-fade-in" style={{ paddingTop: 'var(--space-4xl)' }}>
            <div className="spinner-lg" style={{ margin: '0 auto var(--space-xl)' }} />
            <h2 className="heading-md mb-lg">
              {loadingSteps[loadingStep]}
            </h2>
            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                maxWidth: 400,
                height: 6,
                background: 'var(--bg-glass)',
                borderRadius: 'var(--radius-full)',
                margin: '0 auto',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${((loadingStep + 1) / loadingSteps.length) * 100}%`,
                  height: '100%',
                  background: 'var(--gradient-warm)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recipientName = orderData?.recipientName || 'Someone Special';

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
          {/* Preview Player */}
          <div className="text-center mb-xl">
            <h1 className="heading-lg mb-md">{t('preview.title')}</h1>
            <p className="body-lg">
              {t('preview.subtitle', { name: recipientName })}
            </p>
          </div>

          <div
            className="card"
            style={{
              maxWidth: 600,
              margin: '0 auto var(--space-2xl)',
              textAlign: 'center',
              padding: 'var(--space-2xl)',
              background: 'var(--gradient-card)',
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                marginBottom: 'var(--space-md)',
              }}
              className="animate-float"
            >
              🎵
            </div>
            <h3 className="heading-md mb-lg">
              {t('hero.stats') === 'songs created' ? 'Song for' : 'Canción para'} {recipientName}
            </h3>
            <AudioPlayer
              variant="large"
              title={`${orderData?.style || 'Bachata'} · ${recipientName}`}
              showVisualizer
              maxDuration={30}
            />
            <p
              className="body-md mt-lg"
              style={{
                fontStyle: 'italic',
                color: 'var(--accent-primary)',
              }}
            >
              {t('preview.cta', { name: recipientName })}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="text-center mb-xl">
            <h2 className="heading-lg mb-md">{t('preview.choosePlan')}</h2>
          </div>

          <div className="pricing-grid">
            {/* Básica */}
            <div className="pricing-card">
              <div className="pricing-name">{t('preview.basicaTitle')}</div>
              <div className="pricing-price">{t('preview.basicaPrice')}</div>
              <ul className="pricing-features">
                {(t('preview.basicaFeatures') as string[]).map((feature: string, i: number) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
              <button
                className="btn btn-outline w-full"
                onClick={() => handleSelectPlan('basica')}
              >
                {t('preview.selectPlan')}
              </button>
            </div>

            {/* Especial (Featured) */}
            <div className="pricing-card pricing-card-featured">
              <div className="pricing-tag pricing-tag-popular">
                {t('preview.especialTag')}
              </div>
              <div className="pricing-name">{t('preview.especialTitle')}</div>
              <div className="pricing-price">{t('preview.especialPrice')}</div>
              <ul className="pricing-features">
                {(t('preview.especialFeatures') as string[]).map((feature: string, i: number) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
              <button
                className="btn btn-primary w-full"
                onClick={() => handleSelectPlan('especial')}
              >
                {t('preview.selectPlan')}
              </button>
            </div>

            {/* Premium */}
            <div className="pricing-card">
              <div className="pricing-tag pricing-tag-value">
                {t('preview.premiumTag')}
              </div>
              <div className="pricing-name">{t('preview.premiumTitle')}</div>
              <div className="pricing-price">
                <span className="pricing-original">{t('preview.premiumOriginal')}</span>
                {t('preview.premiumPrice')}
              </div>
              <ul className="pricing-features">
                {(t('preview.premiumFeatures') as string[]).map((feature: string, i: number) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
              <button
                className="btn btn-outline w-full"
                onClick={() => handleSelectPlan('premium')}
              >
                {t('preview.selectPlan')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
