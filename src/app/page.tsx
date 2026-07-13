'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { OCCASIONS, MUSIC_STYLES, OCCASION_STYLE_MAP, CREDITS, GALLERY_SAMPLES } from '@/lib/constants';
import AudioPlayer from '@/components/AudioPlayer';
import { TEMPLATES } from '@/lib/templates';

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
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const router = useRouter();

  // Wizard Steps: 1 = Occasion, 2 = Style, 3 = Details, 4 = Lyrics, 5 = Preview & Pricing
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

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

  // Editable lyrics step (generated before the music is composed)
  const [lyrics, setLyrics] = useState('');
  const [lyricsTitle, setLyricsTitle] = useState('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  // Landing hero free-text seed
  const [heroText, setHeroText] = useState('');

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

  const handleSuggestMemory = () => {
    const occasion = selectedOccasion || 'otro';
    const langKey = form.songLanguage === 'mix' ? 'mix' : (form.songLanguage === 'en' ? 'en' : 'es');
    const category = TEMPLATES[occasion] || TEMPLATES['otro'];
    const options = category[langKey] || category['es'];
    const list = options.memories;
    const random = list[Math.floor(Math.random() * list.length)];
    const name = form.recipientName.trim() || (langKey === 'en' ? 'my dear' : 'mi amor');
    const text = random.replace(/{name}/g, name);
    updateField('anecdote1', text);
  };

  const handleSuggestMessage = () => {
    const occasion = selectedOccasion || 'otro';
    const langKey = form.songLanguage === 'mix' ? 'mix' : (form.songLanguage === 'en' ? 'en' : 'es');
    const category = TEMPLATES[occasion] || TEMPLATES['otro'];
    const options = category[langKey] || category['es'];
    const list = options.messages;
    const random = list[Math.floor(Math.random() * list.length)];
    const name = form.recipientName.trim() || (langKey === 'en' ? 'my dear' : 'mi amor');
    const text = random.replace(/{name}/g, name);
    updateField('message', text);
  };

  const scrollToStudio = () => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' });

  // Hero "describe the person" input -> seed the story + jump to the wizard.
  const handleHeroCreate = () => {
    if (heroText.trim()) updateField('anecdote1', heroText.trim());
    scrollToStudio();
  };

  const briefBody = () => ({ ...form, occasion: selectedOccasion, style: selectedStyle });

  // Generate (or regenerate) the editable lyrics for the current brief.
  const requestLyrics = async () => {
    setLyricsError(null);
    setIsGeneratingLyrics(true);
    try {
      const res = await fetch('/api/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefBody()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setLyrics(data.lyrics || '');
      setLyricsTitle(data.title || '');
    } catch (err) {
      setLyricsError(err instanceof Error ? err.message : (t('hero.stats') === 'songs created' ? 'Could not write the lyrics' : 'No se pudieron escribir las letras'));
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName || !form.relation || !form.anecdote1 || !form.message) return;

    setGenerateError(null);
    setGeneratedAudioUrl(null);
    setLyrics('');
    setStep(4);
    await requestLyrics();
  };

  // Compose the music from the (possibly user-edited) lyrics.
  const handleCompose = async () => {
    setGenerateError(null);
    setGeneratedAudioUrl(null);
    setIsGenerating(true);
    setGeneratingStep(0);
    setStep(5);

    try {
      const res = await fetch('/api/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...briefBody(), lyrics, title: lyricsTitle }),
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

  // Save the brief and continue to sign-in, then the credit step.
  const handleGetSong = () => {
    const orderDetails = {
      ...form,
      occasion: selectedOccasion,
      style: selectedStyle,
      tier: 'credit',
      price: 2,
      audioUrl: generatedAudioUrl,
      lyrics,
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
        {/* Floating occasion badges */}
        <div className="hero-floats">
          <div className="float-badge fb-1">
            <span className="dot" />
            {isEn ? 'Birthday 🎂' : 'Cumpleaños 🎂'}
          </div>
          <div className="float-badge fb-2">
            <span className="dot" />
            {isEn ? 'Serenade 🌙' : 'Serenata 🌙'}
          </div>
          <div className="float-badge fb-3">
            <span className="dot" />
            {isEn ? 'Wedding 💍' : 'Boda 💍'}
          </div>
          <div className="float-badge fb-4">
            <span className="dot" />
            {isEn ? 'Baptism 👶' : 'Bautizo 👶'}
          </div>
        </div>

        <div className="hero-inner">
          <div className="hero-pill">
            <span className="dot" />
            {t('landing.eyebrow')}
          </div>

          <div className="hero-supertitle">
            {t('landing.supertitle')}
          </div>

          <h1 className="hero-title">
            {t('landing.titleLine1')} <span className="accent">{t('landing.titleAccent')}</span> {t('landing.titleLine2')}
          </h1>
          <p className="hero-subtitle">{t('landing.subtitle')}</p>

          <button className="btn btn-primary btn-lg hero-cta" style={{ marginBottom: 'var(--space-lg)' }} onClick={scrollToStudio}>
            {t('landing.cta')}
          </button>

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
      </section>

      {/* ===== SAMPLES: real songs ===== */}
      <section className="section landing-samples">
        <div className="container">
          <div className="flex items-center justify-between mb-lg" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div className="section-eyebrow">{t('landing.samplesEyebrow')}</div>
              <h2 className="heading-md">{t('landing.samplesTitle')}</h2>
            </div>
            <Link href="/gallery" className="link-btn">{t('landing.seeAll')} →</Link>
          </div>
          <div className="samples-grid">
            {GALLERY_SAMPLES.slice(0, 3).map((g) => {
              const gs = MUSIC_STYLES.find((s) => s.id === g.style);
              const go = OCCASIONS.find((o) => o.id === g.occasion);
              return (
                <div className="card sample-card" key={g.id}>
                  <div className="sample-head">
                    <span className="chip chip-primary">{go ? t(go.nameKey) : g.occasion}</span>
                    <span className="chip">{gs ? t(gs.nameKey) : g.style}</span>
                  </div>
                  <div className="sample-title">{g.recipientName}</div>
                  <div className="body-sm mb-md">{g.description}</div>
                  <AudioPlayer src={g.audioUrl} variant="mini" title={g.recipientName} />
                </div>
              );
            })}
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

        {/* Progress bar */}
        <div className="wizard-progress">
          <div className="wizard-progress-track">
            <div className="wizard-progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
          <span className="wizard-progress-label">{t('wizard.step', { n: String(step), total: '5' })}</span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label className="input-label" style={{ margin: 0 }}>{t('form.anecdote1')} *</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                      onClick={handleSuggestMemory}
                    >
                      ✨ {isEn ? 'Suggest memory' : 'Sugerir recuerdo'}
                    </button>
                  </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label className="input-label" style={{ margin: 0 }}>{t('form.message')} *</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                      onClick={handleSuggestMessage}
                    >
                      ✨ {isEn ? 'Suggest message' : 'Sugerir mensaje'}
                    </button>
                  </div>
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

        {/* STEP 4: Lyrics Generation & Review */}
        {step === 4 && (
          <div className="animate-fade-in-up">
            {isGeneratingLyrics ? (
              /* Writing lyrics */
              <div className="text-center" style={{ padding: 'var(--space-2xl) 0' }}>
                <div className="spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
                <h3 className="heading-md">✍️ {t('lyrics.writing')}</h3>
              </div>
            ) : lyricsError ? (
              /* Lyrics error */
              <div className="card text-center" style={{ maxWidth: 540, margin: '0 auto' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>⚠️</div>
                <h3 className="heading-md mb-md">{t('lyrics.failed')}</h3>
                <p className="body-sm mb-lg" style={{ color: 'var(--accent-primary)' }}>{lyricsError}</p>
                <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={requestLyrics}>🔄 {t('lyrics.regenerate')}</button>
                  <button className="btn btn-primary" onClick={() => setStep(3)}>← {t('common.back')}</button>
                </div>
              </div>
            ) : (
              /* Editable lyrics — review, edit, then compose */
              <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
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
                  <button className="btn btn-outline" onClick={requestLyrics}>🔄 {t('lyrics.regenerate')}</button>
                  <button className="btn btn-primary" style={{ flex: 1, minWidth: 180 }} onClick={handleCompose} disabled={!lyrics.trim()}>
                    🎶 {t('form.generatePreview')}
                  </button>
                </div>
                <div className="text-center mt-md">
                  <button className="btn btn-ghost btn-sm" onClick={() => setStep(3)}>← {t('common.back')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Compose Music & Preview & Pricing */}
        {step === 5 && (
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
                <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleCompose}>🔄 {t('lyrics.compose')}</button>
                  <button className="btn btn-outline" onClick={() => { setStep(4); setGenerateError(null); }}>← {t('lyrics.backToLyrics')}</button>
                </div>
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

                {/* Credit-based unlock */}
                <div className="credit-cta card">
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

                <div className="text-center mt-xl">
                  <button className="btn btn-ghost" onClick={() => setStep(4)}>
                    ← {t('lyrics.backToLyrics')}
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
