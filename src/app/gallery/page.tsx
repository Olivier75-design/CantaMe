'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { OCCASIONS, MUSIC_STYLES, GALLERY_SAMPLES } from '@/lib/constants';
import AudioPlayer from '@/components/AudioPlayer';
import { useEffect } from 'react';

export default function GalleryPage() {
  const { t } = useLanguage();
  const [filterOccasion, setFilterOccasion] = useState<string>('all');
  const [filterStyle, setFilterStyle] = useState<string>('all');
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

  const filtered = GALLERY_SAMPLES.filter((sample) => {
    if (filterOccasion !== 'all' && sample.occasion !== filterOccasion) return false;
    if (filterStyle !== 'all' && sample.style !== filterStyle) return false;
    return true;
  });

  return (
    <div className="section">
      <div className="container">
        <div className="text-center mb-xl animate-fade-in">
          <h1 className="heading-lg mb-md">{t('gallery.title')}</h1>
          <p className="body-lg">{t('gallery.subtitle')}</p>
        </div>

        {/* Filters */}
        <div
          className="flex items-center justify-center gap-lg mb-xl"
          style={{ flexWrap: 'wrap' }}
        >
          {/* Occasion Filter */}
          <div className="input-group" style={{ minWidth: 200 }}>
            <label className="input-label">{t('gallery.filterOccasion')}</label>
            <select
              className="input-field"
              value={filterOccasion}
              onChange={(e) => setFilterOccasion(e.target.value)}
            >
              <option value="all">{t('gallery.all')}</option>
              {OCCASIONS.map((occ) => (
                <option key={occ.id} value={occ.id}>
                  {occ.icon} {t(occ.nameKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Style Filter */}
          <div className="input-group" style={{ minWidth: 200 }}>
            <label className="input-label">{t('gallery.filterStyle')}</label>
            <select
              className="input-field"
              value={filterStyle}
              onChange={(e) => setFilterStyle(e.target.value)}
            >
              <option value="all">{t('gallery.all')}</option>
              {musicStyles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.icon} {t('hero.stats') === 'songs created' ? style.nameEn : style.nameEs}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid-3 stagger-children">
          {filtered.map((sample) => {
            const styleData = musicStyles.find((s) => s.id === sample.style);
            const occasionData = OCCASIONS.find((o) => o.id === sample.occasion);
            const styleName = t('hero.stats') === 'songs created' ? styleData?.nameEn : styleData?.nameEs;

            return (
              <div key={sample.id} className="card">
                <div className="flex items-center gap-sm mb-md">
                  <span
                    className="badge"
                    style={{
                      background: `${styleData?.color || '#FF8906'}20`,
                      color: styleData?.color || '#FF8906',
                      borderColor: `${styleData?.color || '#FF8906'}40`,
                    }}
                  >
                    {styleData?.icon} {styleName || sample.style}
                  </span>
                  <span className="badge badge-primary">
                    {occasionData?.icon} {t(occasionData?.nameKey || '')}
                  </span>
                </div>

                <h3 className="heading-sm mb-sm">
                  {t('hero.stats') === 'songs created' ? 'Song for' : 'Canción para'} {sample.recipientName}
                </h3>
                <p className="body-sm mb-md">{sample.description}</p>

                <AudioPlayer
                  src={sample.audioUrl}
                  title={`${sample.recipientName} — ${styleName || sample.style}`}
                  showVisualizer
                />

                <Link
                  href={`/create?occasion=${sample.occasion}&style=${sample.style}`}
                  className="btn btn-outline btn-sm w-full mt-lg"
                >
                  {t('gallery.wantOne')} ✨
                </Link>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center" style={{ padding: 'var(--space-3xl)' }}>
            <p className="body-lg">{t('hero.stats') === 'songs created' ? 'No examples found with these filters.' : 'No se encontraron ejemplos con estos filtros.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
