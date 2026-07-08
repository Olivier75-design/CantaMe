'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { OCCASIONS, MUSIC_STYLES, OCCASION_STYLE_MAP } from '@/lib/constants';
import AudioPlayer from '@/components/AudioPlayer';

interface OrderForm {
  recipientName: string;
  relation: string;
  anecdote1: string;
  anecdote2: string;
  message: string;
  tone: string;
  songLanguage: string;
  voiceGender: string;
}

export default function HomeDashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // Wizard Steps: 1 = Occasion, 2 = Style, 3 = Details, 4 = Preview & Pricing
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Styles state with static fallback
  const [musicStyles, setMusicStyles] = useState<any[]>(MUSIC_STYLES);

  // Fetch dynamic styles from database
  useEffect(() => {
    fetch('/api/styles')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMusicStyles(data);
        }
      })
      .catch((err) => console.error('Failed to load styles', err));
  }, []);

  // Selection state
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<OrderForm>({
    recipientName: '',
    relation: '',
    anecdote1: '',
    anecdote2: '',
    message: '',
    tone: 'emotional',
    songLanguage: 'es',
    voiceGender: 'female',
  });

  // Loading animation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);

  // Real generation result
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadingSteps = [
    t('hero.stats') === 'songs created' ? '🎵 Analyzing your story...' : '🎵 Analizando tu historia...',
    t('hero.stats') === 'songs created' ? '✍️ Writing personalized lyrics...' : '✍️ Escribiendo letras personalizadas...',
    t('hero.stats') === 'songs created' ? '🎸 Composing the melody...' : '🎸 Componiendo la melodía...',
    t('hero.stats') === 'songs created' ? '🎤 Generating the vocals...' : '🎤 Generando las voces...',
    t('hero.stats') === 'songs created' ? '✨ Polishing the final mix...' : '✨ Puliendo la mezcla final...',
  ];

  const handleOccasionSelect = (id: string) => {
    setSelectedOccasion(id);
    setStep(2);
  };

  const handleStyleSelect = (id: string) => {
    setSelectedStyle(id);
    setStep(3);
  };

  const handleSurpriseMe = () => {
    if (!selectedOccasion) return;
    const suggestions = OCCASION_STYLE_MAP[selectedOccasion] || ['bachata'];
    const randomStyle = suggestions[Math.floor(Math.random() * suggestions.length)];
    setSelectedStyle(randomStyle);
    setStep(3);
  };

  const updateField = (field: keyof OrderForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName || !form.relation || !form.anecdote1 || !form.message) return;

    setGenerateError(null);
    setGeneratedAudioUrl(null);
    setIsGenerating(true);
    setGeneratingStep(0);
    setStep(4);

    try {
      const res = await fetch('/api/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          occasion: selectedOccasion,
          style: selectedStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setGeneratedAudioUrl(data.audioUrl);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : (t('hero.stats') === 'songs created' ? 'Generation failed' : 'La generación falló'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Advance the loading animation while the real generation runs (holds on the last step).
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setGeneratingStep((prev) => (prev >= loadingSteps.length - 1 ? prev : prev + 1));
    }, 1500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  // Handle plan purchase redirection
  const handleSelectPlan = (tier: string) => {
    const orderDetails = {
      ...form,
      occasion: selectedOccasion,
      style: selectedStyle,
      tier,
      audioUrl: generatedAudioUrl,
    };
    sessionStorage.setItem('ct-order', JSON.stringify(orderDetails));
    router.push('/signin');
  };

  const relations = t('form.relations') as Record<string, string>;
  const tones = t('form.tones') as Record<string, string>;
  const languages = t('form.languages') as Record<string, string>;
  const voices = t('form.voices') as Record<string, string>;
  const recipientName = form.recipientName || 'Someone Special';

  return (
    <>
      {/* ===== HERO (landing) ===== */}
      <section className="landing-hero">
        <div className="hero-floats" aria-hidden>
          <div className="float-badge fb-1"><span className="dot" /> {t('occasions.cumpleanos')} 🎂</div>
          <div className="float-badge fb-2"><span className="dot" /> {t('occasions.bautizo')} 👶</div>
          <div className="float-badge fb-3"><span className="dot" /> {t('occasions.boda')} 💍</div>
          <div className="float-badge fb-4"><span className="dot" /> {t('occasions.serenata')} 🌙</div>
        </div>

        <div className="hero-inner">
          <span className="hero-pill"><span className="dot" /> {t('landing.eyebrow')}</span>
          <p className="hero-supertitle">{t('landing.supertitle')}</p>
          <h1 className="hero-title">
            {t('landing.titleLine1')}
            <span className="accent">{t('landing.titleAccent')}</span>
          </h1>
          <p className="hero-subtitle">{t('landing.subtitle')}</p>

          <a href="#studio" className="btn btn-primary btn-lg hero-cta">
            {t('landing.cta')} <span aria-hidden>→</span>
          </a>

          <div className="social-proof">
            <div className="avatar-stack">
              <span className="avatar" style={{ background: '#2563EB' }}>A</span>
              <span className="avatar" style={{ background: '#06B6D4' }}>M</span>
              <span className="avatar" style={{ background: '#6366F1' }}>S</span>
              <span className="avatar" style={{ background: '#3B82F6' }}>D</span>
            </div>
            <div className="proof-text">
              <div className="proof-stars">★★★★★</div>
              <div className="proof-count">{t('landing.usersCount', { count: '12,847' })}</div>
            </div>
          </div>
        </div>

        <div className="hero-marquee">
          <div className="marquee-track">
            {[...OCCASIONS, ...OCCASIONS].map((o, i) => (
              <span className="marquee-item" key={i}>{t(o.nameKey)} <span className="spark">✦</span></span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STUDIO (create wizard) ===== */}
      <div id="studio" className="section">
      <div className="container container-narrow">
        
        {/* Unified Dashboard Header */}
        <div className="text-center mb-xl">
          <h1 className="heading-lg text-gradient">
            {t('hero.stats') === 'songs created' ? 'CantaMe Studio' : 'CantaMe Studio'}
          </h1>
          <p className="body-sm" style={{ opacity: 0.7 }}>
            {t('hero.stats') === 'songs created' 
              ? 'Configure and preview your custom Latin song instantly.' 
              : 'Configura y previsualiza tu canción latina personalizada al instante.'}
          </p>
        </div>

        {/* Dynamic Step indicator */}
        <div className="steps">
          <div className={`step-dot ${step >= 1 ? 'completed' : ''} ${step === 1 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 2 ? 'completed' : ''} ${step === 2 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 3 ? 'completed' : ''} ${step === 3 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 4 ? 'completed' : ''} ${step === 4 ? 'active' : ''}`} />
        </div>

        {/* STEP 1: Occasion Selection */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-lg">
              <h2 className="heading-md mb-xs">{t('occasions.title')}</h2>
              <p className="body-sm">{t('occasions.subtitle')}</p>
            </div>

            <div className="selection-grid stagger-children">
              {OCCASIONS.map((occ) => (
                <div
                  key={occ.id}
                  className={`selection-card ${selectedOccasion === occ.id ? 'selected' : ''}`}
                  onClick={() => handleOccasionSelect(occ.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleOccasionSelect(occ.id)}
                >
                  <span className="selection-card-icon">{occ.icon}</span>
                  <span className="selection-card-name">{t(occ.nameKey)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Style Selection */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-lg">
              <h2 className="heading-md mb-xs">{t('styles.title')}</h2>
              <p className="body-sm">{t('styles.subtitle')}</p>
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
                padding: 'var(--space-md) var(--space-xl)',
              }}
              onClick={handleSurpriseMe}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSurpriseMe()}
            >
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
                  ✨ {t('styles.surpriseMe')}
                </div>
                <p className="body-sm">{t('styles.surpriseDesc')}</p>
              </div>
              <span style={{ fontSize: '1.8rem' }}>🎲</span>
            </div>

            <div className="selection-grid stagger-children">
              {musicStyles.map((style) => (
                <div
                  key={style.id}
                  className={`selection-card ${selectedStyle === style.id ? 'selected' : ''}`}
                  onClick={() => handleStyleSelect(style.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleStyleSelect(style.id)}
                >
                  <span className="selection-card-icon">{style.icon}</span>
                  <span className="selection-card-name">
                    {t('hero.stats') === 'songs created' ? style.nameEn : style.nameEs}
                  </span>
                  <div className="selection-card-mini-player">
                    <AudioPlayer src={style.audioUrl} variant="mini" showVisualizer />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-xl">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← {t('common.back')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Details Form */}
        {step === 3 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-lg">
              <h2 className="heading-md mb-xs">{t('form.title')}</h2>
              <p className="body-sm">{t('form.subtitle')}</p>
            </div>

            <form onSubmit={handleFormSubmit} className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
              <div className="flex flex-col gap-lg">
                
                {/* Recipient Name */}
                <div className="input-group">
                  <label className="input-label">{t('form.recipientName')} *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={t('form.recipientNamePlaceholder')}
                    value={form.recipientName}
                    onChange={(e) => updateField('recipientName', e.target.value)}
                    required
                  />
                </div>

                {/* Relationship */}
                <div className="input-group">
                  <label className="input-label">{t('form.relation')} *</label>
                  <select
                    className="input-field"
                    value={form.relation}
                    onChange={(e) => updateField('relation', e.target.value)}
                    required
                  >
                    <option value="">{t('form.relationPlaceholder')}</option>
                    {relations && Object.entries(relations).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Anecdote 1 */}
                <div className="input-group">
                  <label className="input-label">{t('form.anecdote1')} *</label>
                  <textarea
                    className="input-field"
                    placeholder={t('form.anecdote1Placeholder')}
                    value={form.anecdote1}
                    onChange={(e) => updateField('anecdote1', e.target.value)}
                    required
                    maxLength={500}
                  />
                  <span className="input-help">{form.anecdote1.length}/500 {t('revision.charCount')}</span>
                </div>

                {/* Message */}
                <div className="input-group">
                  <label className="input-label">{t('form.message')} *</label>
                  <textarea
                    className="input-field"
                    placeholder={t('form.messagePlaceholder')}
                    value={form.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    required
                    maxLength={500}
                  />
                  <span className="input-help">{form.message.length}/500 {t('revision.charCount')}</span>
                </div>

                {/* Tone */}
                <div className="input-group">
                  <label className="input-label">{t('form.tone')}</label>
                  <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    {tones && Object.entries(tones).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`btn btn-sm ${form.tone === key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => updateField('tone', key)}
                      >
                        {key === 'emotional' && '🥹'}
                        {key === 'festive' && '🎉'}
                        {key === 'romantic' && '💕'}
                        {key === 'funny' && '😄'}
                        {' '}{label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div className="input-group">
                  <label className="input-label">{t('form.songLanguage')}</label>
                  <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    {languages && Object.entries(languages).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`btn btn-sm ${form.songLanguage === key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => updateField('songLanguage', key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice gender */}
                <div className="input-group">
                  <label className="input-label">{t('form.voiceGender')}</label>
                  <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    {voices && Object.entries(voices).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`btn btn-sm ${form.voiceGender === key ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => updateField('voiceGender', key)}
                      >
                        {key === 'male' ? '👨' : '👩'} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <button type="submit" className="btn btn-primary btn-lg w-full mt-md">
                  {t('form.generatePreview')} ✨
                </button>
              </div>
            </form>

            <div className="text-center mt-lg">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                ← {t('common.back')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Loading Preview or Displaying Player & Plans */}
        {step === 4 && (
          <div className="animate-fade-in-up">
            {isGenerating ? (
              /* Generating Animation Screen */
              <div className="text-center" style={{ padding: 'var(--space-2xl) 0' }}>
                <div className="spinner-lg" style={{ margin: '0 auto var(--space-xl)' }} />
                <h3 className="heading-md">{loadingSteps[generatingStep]}</h3>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    height: 6,
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-full)',
                    margin: 'var(--space-md) auto 0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${((generatingStep + 1) / loadingSteps.length) * 100}%`,
                      height: '100%',
                      background: 'var(--gradient-warm)',
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            ) : generateError ? (
              /* Generation Error Screen */
              <div className="card text-center" style={{ maxWidth: 540, margin: '0 auto' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>⚠️</div>
                <h3 className="heading-md mb-md">
                  {t('hero.stats') === 'songs created' ? 'Generation failed' : 'La generación falló'}
                </h3>
                <p className="body-sm mb-lg" style={{ color: 'var(--accent-primary)' }}>{generateError}</p>
                <button className="btn btn-primary" onClick={() => setStep(3)}>
                  ← {t('common.back')}
                </button>
              </div>
            ) : (
              /* Preview Player & Purchase Cards */
              <div>
                <div
                  className="card text-center mb-xl"
                  style={{ maxWidth: 540, margin: '0 auto var(--space-xl)', background: 'var(--gradient-card)' }}
                >
                  <div className="animate-float" style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>🎵</div>
                  <h3 className="heading-md mb-md">
                    {t('hero.stats') === 'songs created' ? 'Your preview for' : 'Tu vista previa para'} {recipientName}
                  </h3>
                  
                  <AudioPlayer
                    src={generatedAudioUrl || undefined}
                    variant="large"
                    title={`${(t('hero.stats') === 'songs created' ? musicStyles.find((s) => s.id === selectedStyle)?.nameEn : musicStyles.find((s) => s.id === selectedStyle)?.nameEs) || selectedStyle} · ${recipientName}`}
                    showVisualizer
                    maxDuration={30}
                  />

                  <p className="body-sm mt-lg" style={{ color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                    {t('preview.cta', { name: recipientName })}
                  </p>
                </div>

                {/* Plans Selection */}
                <div className="text-center mb-lg">
                  <h2 className="heading-md">{t('preview.choosePlan')}</h2>
                </div>

                <div className="pricing-grid">
                  {/* Básica */}
                  <div className="pricing-card">
                    <div className="pricing-name">{t('preview.basicaTitle')}</div>
                    <div className="pricing-price">{t('preview.basicaPrice')}</div>
                    <ul className="pricing-features">
                      {(t('preview.basicaFeatures') as string[]).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                    <button className="btn btn-outline w-full" onClick={() => handleSelectPlan('basica')}>
                      {t('preview.selectPlan')}
                    </button>
                  </div>

                  {/* Especial */}
                  <div className="pricing-card pricing-card-featured">
                    <div className="pricing-tag pricing-tag-popular">{t('preview.especialTag')}</div>
                    <div className="pricing-name">{t('preview.especialTitle')}</div>
                    <div className="pricing-price">{t('preview.especialPrice')}</div>
                    <ul className="pricing-features">
                      {(t('preview.especialFeatures') as string[]).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                    <button className="btn btn-primary w-full" onClick={() => handleSelectPlan('especial')}>
                      {t('preview.selectPlan')}
                    </button>
                  </div>

                  {/* Premium */}
                  <div className="pricing-card">
                    <div className="pricing-tag pricing-tag-value">{t('preview.premiumTag')}</div>
                    <div className="pricing-name">{t('preview.premiumTitle')}</div>
                    <div className="pricing-price">
                      <span className="pricing-original">{t('preview.premiumOriginal')}</span>
                      {t('preview.premiumPrice')}
                    </div>
                    <ul className="pricing-features">
                      {(t('preview.premiumFeatures') as string[]).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                    <button className="btn btn-outline w-full" onClick={() => handleSelectPlan('premium')}>
                      {t('preview.selectPlan')}
                    </button>
                  </div>
                </div>

                <div className="text-center mt-xl">
                  <button className="btn btn-ghost" onClick={() => setStep(3)}>
                    ← {t('common.back')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      </div>

      {/* ===== TESTIMONIALS ===== */}
      <section className="section">
        <div className="container">
          <div className="text-center testimonials-title">
            <h2 className="heading-lg mb-md">
              {t('landing.testimonialsTitle')} <span className="accent">{t('landing.testimonialsAccent')}</span>
            </h2>
            <p className="body-lg">{t('landing.testimonialsSubtitle')}</p>
          </div>
          <div className="testimonial-grid">
            {(t('landing.testimonials') as Array<{ quote: string; author: string; tag: string }>).map((item, i) => (
              <div className="testimonial-card" key={i}>
                <span className="testimonial-mark">&rdquo;</span>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">&ldquo;{item.quote}&rdquo;</p>
                <div className="testimonial-author">{item.author}</div>
                <div className="testimonial-tag">{item.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
