'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { OCCASIONS, MUSIC_STYLES, OCCASION_STYLE_MAP } from '@/lib/constants';
import AudioPlayer from '@/components/AudioPlayer';

export default function CreatePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const handleOccasionSelect = (occasionId: string) => {
    setSelectedOccasion(occasionId);
    // Auto-advance to step 2
    setTimeout(() => setStep(2), 300);
  };

  const handleSurpriseMe = () => {
    if (!selectedOccasion) return;
    const suggestions = OCCASION_STYLE_MAP[selectedOccasion] || ['bachata'];
    const randomStyle = suggestions[Math.floor(Math.random() * suggestions.length)];
    setSelectedStyle(randomStyle);
    navigateToDetails(randomStyle);
  };

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
    navigateToDetails(styleId);
  };

  const navigateToDetails = (style: string) => {
    const params = new URLSearchParams({
      occasion: selectedOccasion || '',
      style: style,
    });
    setTimeout(() => {
      router.push(`/create/details?${params.toString()}`);
    }, 400);
  };

  return (
    <div className="section">
      <div className="container container-narrow">
        {/* Step Indicator */}
        <div className="steps">
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
          <div className="step-dot" />
          <div className="step-dot" />
        </div>

        {/* Step 1: Occasion Selection */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-xl">
              <h1 className="heading-lg mb-md">{t('occasions.title')}</h1>
              <p className="body-lg">{t('occasions.subtitle')}</p>
            </div>

            <div className="selection-grid stagger-children">
              {OCCASIONS.map((occasion) => (
                <div
                  key={occasion.id}
                  className={`selection-card ${selectedOccasion === occasion.id ? 'selected' : ''}`}
                  onClick={() => handleOccasionSelect(occasion.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleOccasionSelect(occasion.id)}
                >
                  <span className="selection-card-icon">{occasion.icon}</span>
                  <span className="selection-card-name">{t(occasion.nameKey)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Style Selection */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-xl">
              <h1 className="heading-lg mb-md">{t('styles.title')}</h1>
              <p className="body-lg">{t('styles.subtitle')}</p>
            </div>

            {/* Surprise Me Card */}
            <div
              className="card mb-lg"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--gradient-card)',
                cursor: 'pointer',
                padding: 'var(--space-lg) var(--space-xl)',
              }}
              onClick={handleSurpriseMe}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSurpriseMe()}
            >
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>✨ {t('styles.surpriseMe')}</div>
                <p className="body-sm">{t('styles.surpriseDesc')}</p>
              </div>
              <span style={{ fontSize: '2rem' }}>🎲</span>
            </div>

            <div className="selection-grid stagger-children">
              {MUSIC_STYLES.map((style) => (
                <div
                  key={style.id}
                  className={`selection-card ${selectedStyle === style.id ? 'selected' : ''}`}
                  onClick={() => handleStyleSelect(style.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleStyleSelect(style.id)}
                >
                  <span className="selection-card-icon">{style.icon}</span>
                  <span className="selection-card-name">{t(style.nameKey)}</span>
                  <div className="selection-card-mini-player">
                    <AudioPlayer variant="mini" showVisualizer />
                  </div>
                </div>
              ))}
            </div>

            {/* Back Button */}
            <div className="text-center mt-xl">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← {t('common.back')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
