'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import AudioPlayer from '@/components/AudioPlayer';

interface Order {
  id: string;
  recipientName?: string;
  recipient_name?: string;
  style: string;
  occasion: string;
  tier: string;
  status: string;
  price: number;
  audioUrl?: string;
  audio_url?: string;
  createdAt?: string;
  created_at?: string;
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const router = useRouter();

  const [tab, setTab] = useState<'overview' | 'songs' | 'profile'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/signin?mode=signin');
  }, [loading, user, router]);

  // Detect arrival right after a successful payment (?paid=1) and clean the URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === '1') {
      setJustPaid(true);
      setTab('overview');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // Load the user's songs (orders are linked by email)
  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/orders?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto' }} />
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
  const initials = displayName.trim().slice(0, 2).toUpperCase();
  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';

  const audioOf = (o: Order) => o.audioUrl || o.audio_url;
  const nameOf = (o: Order) => o.recipientName || o.recipient_name || '—';
  const dateOf = (o: Order) =>
    new Date(o.createdAt || o.created_at || Date.now()).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const paid = orders.filter((o) => o.status !== 'PENDING_PAYMENT');
  const readyCount = orders.filter((o) => audioOf(o)).length;
  const totalSpent = paid.reduce((s, o) => s + (o.price || 0), 0);
  const currentTier = paid[0]?.tier;
  const planLabel = currentTier ? t(`preview.${currentTier}Title`) : '—';
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
    : '—';

  const statusLabel = (status: string) => {
    const l = t(`order.statuses.${status}`);
    return l.startsWith('order.') ? status.replace(/_/g, ' ').toLowerCase() : l;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setPwMsg(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwMsg('⚠️ ' + error.message);
    } else {
      setPwMsg('✅ ' + t('dashboard.passwordUpdated'));
      setNewPassword('');
    }
  };

  const SongCard = ({ o }: { o: Order }) => {
    const audio = audioOf(o);
    const canRevise = o.tier !== 'basica';
    return (
      <div className="card song-card">
        <div className="flex items-center justify-between mb-md" style={{ gap: 8 }}>
          <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{o.style}</span>
          <span className="badge">{statusLabel(o.status)}</span>
        </div>
        <h4 className="heading-sm" style={{ marginBottom: 2 }}>
          {t('dashboard.for')} {nameOf(o)}
        </h4>
        <p className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>{dateOf(o)}</p>

        {audio ? (
          <AudioPlayer src={audio} title={`🎵 ${nameOf(o)} — ${o.style}`} showVisualizer />
        ) : (
          <p className="body-sm" style={{ fontStyle: 'italic' }}>⏳ {t('dashboard.processing')}</p>
        )}

        <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
          {audio && (
            <a href={audio} download className="btn btn-primary btn-sm">📥 {t('dashboard.download')}</a>
          )}
          {canRevise && (
            <Link href={`/order/${o.id}/review`} className="btn btn-ghost btn-sm">✏️ {t('dashboard.revise')}</Link>
          )}
          <Link href={`/order/${o.id}/share`} className="btn btn-outline btn-sm">📤 {t('dashboard.share')}</Link>
        </div>
      </div>
    );
  };

  return (
    <div className="section">
      <div className="container">
        <div className="dashboard">
          {/* ── Sidebar ── */}
          <aside className="dashboard-side">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="dash-avatar">{initials}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginTop: 'var(--space-sm)' }}>
                {displayName}
              </div>
              <div className="body-sm" style={{ wordBreak: 'break-all' }}>{user.email}</div>
            </div>

            <nav className="dashboard-nav mt-lg">
              <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>📊 {t('dashboard.overview')}</button>
              <button className={tab === 'songs' ? 'active' : ''} onClick={() => setTab('songs')}>🎵 {t('dashboard.songs')}</button>
              <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>⚙️ {t('dashboard.profile')}</button>
            </nav>

            <button className="btn btn-secondary btn-sm w-full mt-lg" onClick={() => signOut().then(() => router.push('/'))}>
              🚪 {t('dashboard.signOut')}
            </button>
          </aside>

          {/* ── Main ── */}
          <main className="dashboard-main">
            {/* Post-payment confirmation banner */}
            {justPaid && (
              <div className="paid-banner animate-fade-in-up" role="status">
                <span className="paid-banner-icon">🎉</span>
                <div className="paid-banner-text">
                  <strong>{t('dashboard.paidTitle')}</strong>
                  <span className="body-sm">{t('order.receiptNote')}</span>
                </div>
                <button
                  className="paid-banner-close"
                  aria-label={t('common.close')}
                  onClick={() => setJustPaid(false)}
                >
                  ✕
                </button>
              </div>
            )}

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="animate-fade-in-up">
                <div className="flex items-center justify-between mb-xl" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                  <div>
                    <h1 className="heading-lg">{t('dashboard.greeting', { name: displayName })}</h1>
                    <p className="body-md">{t('dashboard.subtitle')}</p>
                  </div>
                  <Link href="/#studio" className="btn btn-primary">✨ {t('dashboard.newSong')}</Link>
                </div>

                <div className="stat-grid mb-2xl">
                  <div className="card stat-card">
                    <div className="stat-value text-gradient">{orders.length}</div>
                    <div className="stat-label">🎼 {t('dashboard.statSongs')}</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-value text-gradient">{readyCount}</div>
                    <div className="stat-label">📥 {t('dashboard.statReady')}</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-value" style={{ textTransform: 'capitalize' }}>{planLabel}</div>
                    <div className="stat-label">⭐ {t('dashboard.statPlan')}</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-value text-gradient">${totalSpent}</div>
                    <div className="stat-label">💳 {t('dashboard.statSpent')}</div>
                  </div>
                </div>

                <h2 className="heading-md mb-lg">{t('dashboard.recent')}</h2>
                {loadingOrders ? (
                  <div className="spinner" style={{ margin: '2rem auto' }} />
                ) : orders.length === 0 ? (
                  <EmptyState t={t} />
                ) : (
                  <div className="song-grid">
                    {orders.slice(0, 3).map((o) => <SongCard key={o.id} o={o} />)}
                  </div>
                )}
              </div>
            )}

            {/* MY SONGS */}
            {tab === 'songs' && (
              <div className="animate-fade-in-up">
                <h1 className="heading-lg mb-xl">{t('dashboard.allSongs')}</h1>
                {loadingOrders ? (
                  <div className="spinner" style={{ margin: '2rem auto' }} />
                ) : orders.length === 0 ? (
                  <EmptyState t={t} />
                ) : (
                  <div className="song-grid">
                    {orders.map((o) => <SongCard key={o.id} o={o} />)}
                  </div>
                )}
              </div>
            )}

            {/* PROFILE */}
            {tab === 'profile' && (
              <div className="animate-fade-in-up" style={{ maxWidth: 560 }}>
                <h1 className="heading-lg mb-xl">{t('dashboard.profileTitle')}</h1>

                <div className="card mb-lg">
                  <div className="flex items-center gap-lg mb-lg">
                    <div className="dash-avatar">{initials}</div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{displayName}</div>
                      <div className="body-sm">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex justify-between" style={{ padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                    <span className="body-sm">{t('dashboard.memberSince')}</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{memberSince}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                    <span className="body-sm">{t('dashboard.language')}</span>
                    <div className="lang-switch">
                      <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
                      <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                    </div>
                  </div>
                </div>

                <div className="card mb-lg">
                  <h3 className="heading-sm mb-lg">🔒 {t('dashboard.changePassword')}</h3>
                  <form onSubmit={handleChangePassword} className="auth-form">
                    <div className="input-group">
                      <label className="input-label">{t('dashboard.newPassword')}</label>
                      <input
                        className="text-input"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={isEn ? 'Min. 6 characters' : 'Mín. 6 caracteres'}
                        minLength={6}
                      />
                    </div>
                    {pwMsg && <p className="body-sm mb-md" style={{ color: 'var(--accent-primary)' }}>{pwMsg}</p>}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={newPassword.length < 6}>
                      {t('dashboard.updatePassword')}
                    </button>
                  </form>
                </div>

                <button className="btn btn-secondary w-full" onClick={() => signOut().then(() => router.push('/'))}>
                  🚪 {t('dashboard.signOut')}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="card text-center" style={{ padding: 'var(--space-2xl)' }}>
      <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎶</div>
      <p className="body-lg mb-lg">{t('dashboard.empty')}</p>
      <Link href="/#studio" className="btn btn-primary">✨ {t('dashboard.emptyCta')}</Link>
    </div>
  );
}
