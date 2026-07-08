'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function HowItWorksPage() {
  const { t } = useLanguage();

  const steps = [
    {
      number: '01',
      icon: '🎯',
      titleKey: 'howItWorks.step1Title',
      descKey: 'howItWorks.step1Desc',
      color: '#FF8906',
    },
    {
      number: '02',
      icon: '🎸',
      titleKey: 'howItWorks.step2Title',
      descKey: 'howItWorks.step2Desc',
      color: '#F25F4C',
    },
    {
      number: '03',
      icon: '✍️',
      titleKey: 'howItWorks.step3Title',
      descKey: 'howItWorks.step3Desc',
      color: '#7F5AF0',
    },
    {
      number: '04',
      icon: '🎁',
      titleKey: 'howItWorks.step4Title',
      descKey: 'howItWorks.step4Desc',
      color: '#2CB67D',
    },
  ];

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="text-center mb-2xl animate-fade-in">
          <h1 className="heading-lg mb-md">{t('howItWorks.title')}</h1>
          <p className="body-lg">{t('howItWorks.subtitle')}</p>
        </div>

        <div className="stagger-children">
          {steps.map((step, index) => (
            <div
              key={index}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-xl)',
                marginBottom: 'var(--space-lg)',
                position: 'relative',
                overflow: 'visible',
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-lg)',
                  background: `${step.color}15`,
                  border: `2px solid ${step.color}40`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>{step.icon}</span>
              </div>

              <div>
                <div
                  className="body-sm"
                  style={{
                    color: step.color,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  {t('hero.stats') === 'songs created' ? 'Step' : 'Paso'} {step.number}
                </div>
                <h3 className="heading-md mb-sm">{t(step.titleKey)}</h3>
                <p className="body-md">{t(step.descKey)}</p>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 58,
                    bottom: -24,
                    width: 2,
                    height: 24,
                    background: `linear-gradient(to bottom, ${step.color}40, transparent)`,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-2xl">
          <Link href="/create" className="btn btn-primary btn-lg">
            {t('howItWorks.startNow')} 🎵
          </Link>
        </div>
      </div>
    </div>
  );
}
