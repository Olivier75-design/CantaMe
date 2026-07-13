'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { TEMPLATES } from '@/lib/templates';

function DetailsForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const occasion = searchParams.get('occasion') || 'otro';
  const style = searchParams.get('style') || '';

  const isEn = t('nav.login') === 'Log in';

  const [form, setForm] = useState({
    recipientName: '',
    relation: '',
    anecdote1: '',
    anecdote2: '',
    message: '',
    tone: 'emotional',
    songLanguage: 'es',
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSuggestMemory = () => {
    const occKey = occasion || 'otro';
    const langKey = form.songLanguage === 'mix' ? 'mix' : (form.songLanguage === 'en' ? 'en' : 'es');
    const category = TEMPLATES[occKey] || TEMPLATES['otro'];
    const options = category[langKey] || category['es'];
    const list = options.memories;
    const random = list[Math.floor(Math.random() * list.length)];
    const name = form.recipientName.trim() || (langKey === 'en' ? 'my dear' : 'mi amor');
    const text = random.replace(/{name}/g, name);
    updateField('anecdote1', text);
  };

  const handleSuggestMessage = () => {
    const occKey = occasion || 'otro';
    const langKey = form.songLanguage === 'mix' ? 'mix' : (form.songLanguage === 'en' ? 'en' : 'es');
    const category = TEMPLATES[occKey] || TEMPLATES['otro'];
    const options = category[langKey] || category['es'];
    const list = options.messages;
    const random = list[Math.floor(Math.random() * list.length)];
    const name = form.recipientName.trim() || (langKey === 'en' ? 'my dear' : 'mi amor');
    const text = random.replace(/{name}/g, name);
    updateField('message', text);
  };

  const relations = t('form.relations') as Record<string, string>;
  const tones = t('form.tones') as Record<string, string>;
  const languages = t('form.languages') as Record<string, string>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName || !form.relation || !form.anecdote1 || !form.message) return;

    setIsGenerating(true);

    // Store form data in sessionStorage for the preview page
    sessionStorage.setItem(
      'ct-order',
      JSON.stringify({
        ...form,
        occasion,
        style,
      })
    );

    // Simulate generation delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    router.push('/create/preview');
  };

  return (
    <div className="section">
      <div className="container container-narrow">
        {/* Step Indicator */}
        <div className="steps">
          <div className="step-dot completed" />
          <div className="step-dot completed" />
          <div className="step-dot active" />
          <div className="step-dot" />
        </div>

        <div className="animate-fade-in-up">
          <div className="text-center mb-xl">
            <h1 className="heading-lg mb-md">{t('form.title')}</h1>
            <p className="body-lg">{t('form.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
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
                  maxLength={50}
                />
              </div>

              {/* Relation */}
              <div className="input-group">
                <label className="input-label">{t('form.relation')} *</label>
                <select
                  className="input-field"
                  value={form.relation}
                  onChange={(e) => updateField('relation', e.target.value)}
                  required
                >
                  <option value="">{t('form.relationPlaceholder')}</option>
                  {typeof relations === 'object' &&
                    Object.entries(relations).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
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
                <span className="input-help">
                  {form.anecdote1.length}/500 {t('revision.charCount')}
                </span>
              </div>

              {/* Anecdote 2 */}
              <div className="input-group">
                <label className="input-label">{t('form.anecdote2')}</label>
                <textarea
                  className="input-field"
                  placeholder={t('form.anecdote2Placeholder')}
                  value={form.anecdote2}
                  onChange={(e) => updateField('anecdote2', e.target.value)}
                  maxLength={500}
                />
                <span className="input-help">
                  {form.anecdote2.length}/500 {t('revision.charCount')}
                </span>
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
                <span className="input-help">
                  {form.message.length}/500 {t('revision.charCount')}
                </span>
              </div>

              {/* Tone */}
              <div className="input-group">
                <label className="input-label">{t('form.tone')}</label>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {typeof tones === 'object' &&
                    Object.entries(tones).map(([key, label]) => (
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

              {/* Song Language */}
              <div className="input-group">
                <label className="input-label">{t('form.songLanguage')}</label>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {typeof languages === 'object' &&
                    Object.entries(languages).map(([key, label]) => (
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

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={isGenerating || !form.recipientName || !form.relation || !form.anecdote1 || !form.message}
                style={{ marginTop: 'var(--space-md)' }}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-sm">
                    <span className="spinner" /> {t('form.generating')}
                  </span>
                ) : (
                  t('form.generatePreview')
                )}
              </button>
            </div>
          </form>

          {/* Back button */}
          <div className="text-center mt-lg">
            <button className="btn btn-ghost" onClick={() => router.back()}>
              ← {t('common.back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={<div className="section text-center"><div className="spinner-lg" style={{ margin: '0 auto' }} /></div>}>
      <DetailsForm />
    </Suspense>
  );
}
