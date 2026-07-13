'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { MUSIC_STYLES, OCCASIONS, GALLERY_SAMPLES } from '@/lib/constants';
import AudioPlayer from '@/components/AudioPlayer';

interface OrderData {
  id: string;
  recipientName?: string;
  recipient_name?: string;
  relation: string;
  occasion: string;
  style: string;
  tier: string;
  status: string;
  price: number;
  audioUrl?: string;
  audio_url?: string;
  lyrics?: string;
  createdAt?: string;
  created_at?: string;
}

const STYLE_MAP = Object.fromEntries(MUSIC_STYLES.map((s) => [s.id, s]));
const OCC_MAP = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useLanguage();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const isEn = lang === 'en';

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => { setOrder(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="section text-center"><div className="spinner-lg" style={{ margin: '4rem auto' }} /></div>;
  }
  if (!order || !order.id) {
    return <div className="section text-center"><h1 className="heading-lg">{t('common.error')}</h1></div>;
  }

  const name = order.recipientName || order.recipient_name || '—';
  const audio = order.audioUrl || order.audio_url;
  const st = STYLE_MAP[order.style];
  const oc = OCC_MAP[order.occasion];
  const styleLabel = st ? t(st.nameKey) : order.style;
  const occLabel = oc ? t(oc.nameKey) : order.occasion;
  const isReady = !!audio;
  const cleanLyrics = order.lyrics ? order.lyrics.replace(/\[.*?\]/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n') : '';

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/order/${id}/share` : '';
  const shareText = isEn ? `Listen to this song I made for ${name} on CantaMe 🎵` : `Escucha esta canción que hice para ${name} en CantaMe 🎵`;

  const share = (network: string) => {
    const u = encodeURIComponent(shareUrl);
    const txt = encodeURIComponent(shareText);
    const links: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${txt}%20${u}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      email: `mailto:?subject=${txt}&body=${txt}%20${u}`,
      instagram: shareUrl, // no web share intent; open the song link
    };
    window.open(links[network] || shareUrl, '_blank');
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  // Print the song as a giftable card (title, recipient, lyrics) -> Save as PDF.
  const printCard = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${name} — CantaMe</title>
      <style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;color:#0f172a;padding:0 24px;text-align:center}
      .badge{display:inline-block;background:#2563EB;color:#fff;font-family:system-ui;font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:5px 12px;border-radius:99px}
      h1{font-size:2rem;margin:16px 0 4px}.sub{color:#64748b;font-family:system-ui}
      pre{white-space:pre-wrap;font-family:Georgia,serif;font-style:italic;line-height:2;text-align:left;background:#0f172a;color:#e2e8f0;padding:28px;border-radius:16px;margin:28px 0}
      .foot{color:#94a3b8;font-family:system-ui;font-size:.8rem}
      button{margin-top:20px;background:#2563EB;color:#fff;border:0;padding:12px 22px;border-radius:10px;font-size:1rem;cursor:pointer;font-family:system-ui}</style>
      </head><body>
      <span class="badge">${occLabel} · ${styleLabel}</span>
      <h1>${isEn ? 'For' : 'Para'} ${name}</h1>
      <p class="sub">${isEn ? 'A song made with love on CantaMe' : 'Una canción hecha con amor en CantaMe'}</p>
      <pre>${cleanLyrics || (isEn ? 'Play the song to hear it 🎵' : 'Reproduce la canción para escucharla 🎵')}</pre>
      <p class="foot">${shareUrl}</p>
      <button onclick="window.print()">${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar PDF'}</button>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const related = GALLERY_SAMPLES.filter((g) => g.occasion === order.occasion).slice(0, 3);
  const relatedFill = related.length < 3 ? [...related, ...GALLERY_SAMPLES.filter((g) => g.occasion !== order.occasion)].slice(0, 3) : related;

  return (
    <>
      {isReady && <div className="result-banner">✅ {t('result.success')}</div>}

      <div className="section">
        <div className="container container-narrow">
          <div className="animate-fade-in-up">
            <div className="text-center mb-xl">
              <h1 className="heading-lg mb-md">{isReady ? t('result.ready') : t('order.title')}</h1>
              <p className="body-lg">{t('result.subtitle', { style: styleLabel, name })}</p>
            </div>

            {/* Song hero card */}
            <div className="card song-hero-card">
              <div className="sh-chips">
                <span className="chip chip-primary">{occLabel}</span>
                <span className="chip">{styleLabel}</span>
              </div>
              <h2 className="sh-title">{isEn ? 'For' : 'Para'} {name}</h2>
              {order.relation && <p className="sh-sub">{isEn ? 'from their' : 'de su'} {order.relation}</p>}

              {isReady ? (
                <>
                  <div className="mt-lg"><AudioPlayer src={audio} variant="large" title={`${name} · ${styleLabel}`} showVisualizer /></div>

                  {cleanLyrics && (
                    <div className="lyrics-box">
                      <pre>{cleanLyrics}</pre>
                      <span className="lyrics-sign">— CantaMe {isEn ? 'AI' : 'IA'}</span>
                    </div>
                  )}

                  <div className="sh-actions">
                    <a href={audio} download className="btn btn-primary"><span>⬇</span> {t('order.downloadMp3')}</a>
                    <Link href={`/order/${id}/share`} className="btn btn-outline"><span>🔗</span> {t('result.shareBtn')}</Link>
                    <Link href="/dashboard" className="btn btn-outline"><span>♥</span> {t('result.saveSong')}</Link>
                  </div>
                  <p className="sh-foot">{t('result.freeToUse')}</p>
                </>
              ) : (
                <p className="body-md mt-lg" style={{ color: 'var(--accent-primary)' }}>
                  <span className="animate-pulse">🎵 {t('result.processing')}</span>
                </p>
              )}
            </div>

            {isReady && (
              <>
                {/* Share grid */}
                <div className="card mt-xl">
                  <h3 className="heading-sm mb-lg text-center">{t('result.shareSurprise')}</h3>
                  <div className="share-grid">
                    <button className="share-tile" onClick={() => share('whatsapp')}><span>💬</span> WhatsApp</button>
                    <button className="share-tile" onClick={() => share('instagram')}><span>📷</span> Instagram</button>
                    <button className="share-tile" onClick={() => share('facebook')}><span>👍</span> Facebook</button>
                    <button className="share-tile" onClick={() => share('email')}><span>✉️</span> Email</button>
                  </div>
                  <p className="body-sm text-center mt-lg mb-sm" style={{ color: 'var(--text-muted)' }}>{t('result.copyLink')}</p>
                  <div className="copy-row">
                    <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                    <button className="btn btn-primary btn-sm" onClick={copyLink}>{copied ? '✓ ' + t('result.copied') : t('result.copy')}</button>
                  </div>
                </div>

                {/* Print + Save */}
                <div className="result-cards mt-xl">
                  <div className="card text-center">
                    <div style={{ fontSize: '2rem' }}>🖨️</div>
                    <h4 className="heading-sm mb-sm">{t('result.printCard')}</h4>
                    <p className="body-sm mb-lg">{t('result.printCardBody')}</p>
                    <button className="btn btn-primary btn-sm" onClick={printCard}>{t('result.downloadPdf')}</button>
                  </div>
                  <div className="card text-center">
                    <div style={{ fontSize: '2rem' }}>♥</div>
                    <h4 className="heading-sm mb-sm">{t('result.saveProfile')}</h4>
                    <p className="body-sm mb-lg">{t('result.saveProfileBody')}</p>
                    <Link href="/dashboard" className="btn btn-primary btn-sm">{t('result.saveSong')}</Link>
                  </div>
                </div>

                {/* Related */}
                <h3 className="heading-md mt-2xl mb-lg">{t('result.otherSongs', { occasion: occLabel })}</h3>
                <div className="related-grid">
                  {relatedFill.map((g) => (
                    <div className="card related-card" key={g.id}>
                      <div style={{ fontWeight: 700 }}>{g.recipientName}</div>
                      <div className="body-sm mb-md">{g.description}</div>
                      <AudioPlayer src={g.audioUrl} variant="mini" title={g.recipientName} />
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="otra-cta mt-2xl">
                  <h3 className="heading-md" style={{ color: '#fff' }}>{t('result.anotherTitle')}</h3>
                  <p className="body-md" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('result.anotherBody')}</p>
                  <Link href="/create" className="btn btn-primary mt-md">✨ {t('result.createAnother')}</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
