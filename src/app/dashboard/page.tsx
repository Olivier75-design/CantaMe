'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { authHeaders } from '@/lib/authClient';
import { validatePromo, discounted } from '@/lib/promoClient';
import { MUSIC_STYLES, OCCASIONS, CREDITS } from '@/lib/constants';

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
  lyrics?: string;
  createdAt?: string;
  created_at?: string;
}

type Tab = 'dashboard' | 'payments' | 'profile';
const PAGE_SIZE = 5;

const STYLE_MAP = Object.fromEntries(MUSIC_STYLES.map((s) => [s.id, s]));
const OCC_MAP = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

// Deterministic waveform bar heights (20–100%) seeded by a string.
function bars(seed: string, n = 34): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(22 + (h % 78));
  }
  return out;
}

function fmt(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [justPaid, setJustPaid] = useState(false);

  // Credits
  const [credits, setCredits] = useState<number | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [buyQty, setBuyQty] = useState<number>(CREDITS.packs[0].credits);
  const [buying, setBuying] = useState(false);
  // Promo code in the "buy more songs" panel — display only; enforced server-side.
  const [buyPromoInput, setBuyPromoInput] = useState('');
  const [buyPromoCode, setBuyPromoCode] = useState('');
  const [buyPromoPct, setBuyPromoPct] = useState(0);
  const [buyPromoMsg, setBuyPromoMsg] = useState<string | null>(null);
  const [checkingBuyPromo, setCheckingBuyPromo] = useState(false);

  // Auto-finalize a pending song order right after login (incl. Google OAuth).
  const [finalizing, setFinalizing] = useState(false);
  const finalizedRef = useRef(false);

  // Library controls
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Profile
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  // Now-playing shared player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [nowPlaying, setNowPlaying] = useState<Order | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);

  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';

  // Tracks orders whose background generation is already in flight (this tab).
  const genRef = useRef<Set<string>>(new Set());

  const refetchOrders = useCallback(async () => {
    if (!user?.email) return;
    const o = await fetch(`/api/orders?email=${encodeURIComponent(user.email)}`, {
      headers: await authHeaders(),
    })
      .then((r) => r.json())
      .catch(() => []);
    setOrders(Array.isArray(o) ? o : []);
  }, [user]);

  // Kick off (or resume) the background full-length generation for one order.
  // The credit was already spent at checkout; this composes the complete song
  // and flips the order to READY when done.
  const triggerGenerate = useCallback(async (orderId: string) => {
    if (genRef.current.has(orderId)) return;
    genRef.current.add(orderId);
    try {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'generate_full' }),
      });
      if (r.ok) {
        const updated = await r.json();
        if (updated?.id) setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      }
    } catch {
      /* left IN_PRODUCTION; resumes on the next dashboard load */
    } finally {
      genRef.current.delete(orderId);
    }
  }, []);

  // ── Auth guard + query + data ──
  useEffect(() => {
    if (!loading && !user) router.push('/signin?mode=signin');
  }, [loading, user, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('paid') === '1') {
      setJustPaid(true);
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    refetchOrders().finally(() => setLoadingOrders(false));
  }, [user, refetchOrders]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const d = await fetch('/api/credits', { headers: await authHeaders() })
        .then((r) => r.json())
        .catch(() => ({}));
      setCredits(typeof d.credits === 'number' ? d.credits : 0);
    })();
  }, [user]);

  // Show the "creating your song" screen immediately if an order is pending.
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('ct-order')) setFinalizing(true);
  }, []);

  // Finalize the pending order once user + credit balance are known.
  useEffect(() => {
    if (!user?.id || credits === null || finalizedRef.current) return;
    const stored = sessionStorage.getItem('ct-order');
    if (!stored) return;
    finalizedRef.current = true;

    (async () => {
      // Not enough credits -> go buy them (no duplicate order gets created).
      if (credits < CREDITS.perSong) {
        router.push('/checkout');
        return;
      }
      setFinalizing(true);
      try {
        // Don't carry the short preview clip onto the order — the full song is
        // generated fresh in the background right after purchase.
        const brief = JSON.parse(stored);
        delete brief.audioUrl;
        const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...brief, tier: 'credit', price: 0 }),
        });
        const order = await res.json();
        if (!order?.id) throw new Error('order');

        const fin = await fetch('/api/checkout', {
          method: 'POST',
          headers,
          body: JSON.stringify({ orderId: order.id }),
        });
        if (fin.status === 402) { router.push('/checkout'); return; }

        sessionStorage.removeItem('ct-order');
        setJustPaid(true);
        // Show the dashboard now: the order appears as "in progress" and the
        // background-generation manager below composes the full song.
        await Promise.all([
          refetchOrders(),
          fetch('/api/credits', { headers: await authHeaders() })
            .then((r) => r.json())
            .then((c) => { if (typeof c.credits === 'number') setCredits(c.credits); }),
        ]);
      } catch {
        router.push('/checkout');
      } finally {
        setFinalizing(false);
      }
    })();
  }, [user, credits, router, refetchOrders]);

  // Drive any in-progress order to completion: start its background generation
  // (or resume it after a reload) and poll until the full song is READY.
  useEffect(() => {
    if (!user) return;
    const pending = orders.filter((o) => o.status === 'IN_PRODUCTION' && !(o.audioUrl || o.audio_url));
    pending.forEach((o) => triggerGenerate(o.id));
    if (pending.length === 0) return;
    const poll = setInterval(refetchOrders, 15000);
    return () => clearInterval(poll);
  }, [orders, user, triggerGenerate, refetchOrders]);

  // ── Audio element wiring ──
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurTime(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onPause);
    };
  }, []);

  // ── Field helpers ──
  const audioOf = (o: Order) => o.audioUrl || o.audio_url;
  const nameOf = (o: Order) => o.recipientName || o.recipient_name || '—';
  const dateRaw = (o: Order) => o.createdAt || o.created_at || '';
  const dateOf = (o: Order) =>
    new Date(dateRaw(o) || Date.now()).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const styleInfo = (o: Order) => STYLE_MAP[o.style];
  const styleLabel = (o: Order) => { const s = styleInfo(o); return s ? t(s.nameKey) : (o.style || '—'); };
  const occLabel = (o: Order) => { const oc = OCC_MAP[o.occasion]; return oc ? t(oc.nameKey) : (o.occasion || '—'); };

  // ── Now-playing controls ──
  const playSong = useCallback((o: Order) => {
    const a = audioRef.current;
    const src = audioOf(o);
    if (!a || !src) return;
    if (nowPlaying?.id === o.id) {
      if (a.paused) a.play().catch(() => {}); else a.pause();
      return;
    }
    setNowPlaying(o);
    a.src = src;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [nowPlaying]);

  // ── Derived ──
  const genres = useMemo(() => {
    const set = new Set(orders.map((o) => o.style).filter(Boolean));
    return Array.from(set);
  }, [orders]);

  const filtered = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.style === filter)),
    [orders, filter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paged = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const paid = orders.filter((o) => o.status !== 'PENDING_PAYMENT');
  const readyCount = orders.filter((o) => audioOf(o)).length;
  const totalSpent = paid.reduce((s, o) => s + (o.price || 0), 0);

  const applyBuyPromo = async () => {
    setCheckingBuyPromo(true);
    const r = await validatePromo(buyPromoInput);
    setCheckingBuyPromo(false);
    if (r.valid) {
      setBuyPromoPct(r.percentOff);
      setBuyPromoCode(r.code || buyPromoInput.trim().toUpperCase());
      setBuyPromoMsg(t('credits.promoApplied', { pct: String(r.percentOff) }));
    } else {
      setBuyPromoPct(0);
      setBuyPromoCode('');
      setBuyPromoMsg(t('credits.promoInvalid'));
    }
  };

  const buyCredits = async () => {
    if (!user?.id) return;
    setBuying(true);
    try {
      const pack = CREDITS.packs.find((p) => p.credits === buyQty) || CREDITS.packs[0];
      const r = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          packId: pack.id,
          name: user.user_metadata?.full_name || '',
          promoCode: buyPromoCode || undefined,
        }),
      });
      const d = await r.json();
      if (d.checkoutUrl) { window.location.href = d.checkoutUrl; return; }
      setBuying(false);
    } catch {
      setBuying(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setPwMsg(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPwMsg('⚠️ ' + error.message);
    else { setPwMsg('✅ ' + t('dashboard.passwordUpdated')); setNewPassword(''); }
  };

  const openReceipt = (o: Order) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo · CantaMe</title>
      <style>body{font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#0f172a;padding:0 20px}
      h1{color:#2563EB;font-size:1.5rem}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
      .total{font-weight:800;font-size:1.2rem;border-top:2px solid #0f172a;margin-top:8px}
      .muted{color:#64748b;font-size:.85rem}button{margin-top:24px;background:#2563EB;color:#fff;border:0;padding:12px 20px;border-radius:8px;font-size:1rem;cursor:pointer}</style>
      </head><body>
      <h1>🎵 CantaMe</h1>
      <p class="muted">${isEn ? 'Payment receipt' : 'Recibo de pago'} · ${dateOf(o)}</p>
      <div class="row"><span>${isEn ? 'Order' : 'Pedido'}</span><span>#${o.id.slice(0, 8)}</span></div>
      <div class="row"><span>${isEn ? 'Song for' : 'Canción para'}</span><span>${nameOf(o)}</span></div>
      <div class="row"><span>${isEn ? 'Style' : 'Estilo'}</span><span>${styleLabel(o)}</span></div>
      <div class="row"><span>${isEn ? 'Item' : 'Concepto'}</span><span>${isEn ? '1 song credit' : '1 crédito de canción'}</span></div>
      <div class="row"><span>${isEn ? 'Billed to' : 'Facturado a'}</span><span>${user?.email}</span></div>
      <div class="row total"><span>Total</span><span>$${o.price}</span></div>
      <button onclick="window.print()">${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar PDF'}</button>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  if (loading || !user || finalizing) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto var(--space-lg)' }} />
        {finalizing && <h2 className="heading-md">🎶 {t('dashboard.creatingSong')}</h2>}
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
  const initials = displayName.trim().slice(0, 2).toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
    : '—';
  const progress = dur > 0 ? (curTime / dur) * 100 : 0;

  const navItems: { key: Tab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '🏠', label: t('dashboard.overview') },
    { key: 'payments', icon: '💳', label: t('dashboard.payments') },
    { key: 'profile', icon: '⚙️', label: t('dashboard.profile') },
  ];

  // ── Song row ──
  const SongRow = ({ o }: { o: Order }) => {
    const st = styleInfo(o);
    const audio = audioOf(o);
    const generating = o.status === 'IN_PRODUCTION' && !audio;
    const active = nowPlaying?.id === o.id;
    const playingThis = active && isPlaying;
    return (
      <div className={`song-item ${active ? 'active' : ''} ${generating ? 'is-generating' : ''}`}>
        <button className="song-play" onClick={() => playSong(o)} disabled={!audio} aria-label="Play">
          {generating ? <span className="spinner spinner-sm" /> : playingThis ? '❚❚' : '▶'}
        </button>
        <div className="song-info">
          <div className="song-title-row">
            <span className="song-title">{o.lyrics ? o.lyrics.split('\n')[0].replace(/\[.*?\]/g, '').trim().slice(0, 40) || nameOf(o) : `${t('dashboard.for')} ${nameOf(o)}`}</span>
            {generating && <span className="generating-badge">🎶 {t('dashboard.generating')}</span>}
            {playingThis && <span className="playing-badge">{t('dashboard.playing')}</span>}
          </div>
          <div className="song-meta">
            {generating ? t('dashboard.generatingHint') : `${t('dashboard.for')} ${nameOf(o)} · ${occLabel(o)} · ${dateOf(o)}`}
          </div>
        </div>
        <span className="genre-chip" style={{ color: st?.color || 'var(--accent-primary)', borderColor: (st?.color || '#2563EB') + '55' }}>
          {styleLabel(o)}
        </span>
        {generating ? (
          <div className="gen-wave" aria-hidden><span /><span /><span /><span /><span /></div>
        ) : (
          <div className={`waveform ${playingThis ? 'is-playing' : ''}`} aria-hidden>
            {bars(o.id, 26).map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
          </div>
        )}
        <div className="song-actions">
          {generating ? (
            <span className="ico" style={{ opacity: 0.5, cursor: 'default' }} title={t('dashboard.generating')}>⏳</span>
          ) : (
            <>
              <Link className="ico" href={`/order/${o.id}/share`} title={t('dashboard.share')}>🔗</Link>
              {audio && <a className="ico" href={`/api/orders/${o.id}/download`} title={t('dashboard.download')}>⬇</a>}
              <Link className="ico" href={`/order/${o.id}/review`} title={t('dashboard.revise')}>⋯</Link>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="section" style={{ paddingTop: 'var(--space-lg)' }}>
      <div className="container">
        <div className="dashboard">
          {/* ── Sidebar ── */}
          <aside className="dashboard-side">
            <nav className="dashboard-nav">
              {navItems.map((n) => (
                <button key={n.key} className={tab === n.key ? 'active' : ''} onClick={() => setTab(n.key)}>
                  <span>{n.icon}</span> {n.label}
                </button>
              ))}
              <Link href="/create" className="dashnav-link"><span>➕</span> {t('dashboard.newSong')}</Link>
              <Link href="/how-it-works" className="dashnav-link"><span>❔</span> {t('nav.howItWorks')}</Link>
            </nav>

            <div className="side-foot">
              <div className="side-user">
                <div className="dash-avatar sm">{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="side-user-name">{displayName}</div>
                  <div className="side-user-mail">{user.email}</div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm w-full mt-sm" onClick={() => signOut().then(() => router.push('/'))}>
                🚪 {t('dashboard.signOut')}
              </button>
            </div>
          </aside>

          {/* ── Main ── */}
          <main className="dashboard-main">
            {justPaid && (
              <div className="paid-banner animate-fade-in-up" role="status">
                <span className="paid-banner-icon">🎉</span>
                <div className="paid-banner-text">
                  <strong>{t('dashboard.paidTitle')}</strong>
                  <span className="body-sm">{t('order.receiptNote')}</span>
                </div>
                <button className="paid-banner-close" aria-label={t('common.close')} onClick={() => setJustPaid(false)}>✕</button>
              </div>
            )}

            {/* DASHBOARD */}
            {tab === 'dashboard' && (
              <div className="animate-fade-in-up">
                <div className="dash-topbar">
                  <div>
                    <h1 className="heading-lg">{t('dashboard.greeting', { name: displayName })}</h1>
                    <p className="body-md">{t('dashboard.subtitle')}</p>
                  </div>
                  <Link href="/create" className="btn btn-primary">✨ {t('dashboard.newSong')}</Link>
                </div>

                {/* Stats */}
                <div className="dash-stats">
                  <div className="card dash-stat">
                    <div className="dash-stat-icon primary">🎵</div>
                    <div><div className="dash-stat-num">{orders.length}</div><div className="dash-stat-label">{t('dashboard.statSongs')}</div></div>
                  </div>
                  <div className="card dash-stat">
                    <div className="dash-stat-icon">🎫</div>
                    <div><div className="dash-stat-num">{credits ?? '—'}</div><div className="dash-stat-label">{t('credits.credits')}</div></div>
                  </div>
                  <div className="card dash-stat">
                    <div className="dash-stat-icon">📥</div>
                    <div><div className="dash-stat-num">{readyCount}</div><div className="dash-stat-label">{t('dashboard.statReady')}</div></div>
                  </div>
                  <div className="card dash-stat">
                    <div className="dash-stat-icon">💿</div>
                    <div><div className="dash-stat-num">{genres.length}</div><div className="dash-stat-label">{t('dashboard.statGenres')}</div></div>
                  </div>
                </div>

                {/* Split: list + now playing */}
                <div className="dash-split">
                  <section className="dash-split-main">
                    <div className="flex items-center justify-between mb-md" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <h2 className="heading-md">{t('dashboard.mySongs')}</h2>
                      <div className="genre-filters">
                        <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(1); }}>{t('dashboard.filter_all')}</button>
                        {genres.slice(0, 4).map((g) => (
                          <button key={g} className={filter === g ? 'active' : ''} onClick={() => { setFilter(g); setPage(1); }}>
                            {STYLE_MAP[g] ? t(STYLE_MAP[g].nameKey) : g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {loadingOrders ? (
                      <div className="spinner" style={{ margin: '2rem auto' }} />
                    ) : filtered.length === 0 ? (
                      <div className="card text-center" style={{ padding: 'var(--space-2xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎶</div>
                        <p className="body-lg mb-lg">{t('dashboard.empty')}</p>
                        <Link href="/create" className="btn btn-primary">✨ {t('dashboard.emptyCta')}</Link>
                      </div>
                    ) : (
                      <>
                        <div className="songlist">
                          {paged.map((o) => <SongRow key={o.id} o={o} />)}
                        </div>
                        <div className="dash-pagination">
                          <span className="body-sm">{t('dashboard.showing', { n: String(paged.length), total: String(filtered.length) })}</span>
                          {totalPages > 1 && (
                            <div className="pager">
                              <button disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                              {Array.from({ length: totalPages }).map((_, i) => (
                                <button key={i} className={pageClamped === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>
                              ))}
                              <button disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>

                  {/* Right column */}
                  <aside className="dash-split-side">
                    <div className="card nowplaying">
                      <div className="np-label">{t('dashboard.nowPlaying')}</div>
                      {nowPlaying ? (
                        <>
                          <div className="np-title">{nameOf(nowPlaying)}</div>
                          <div className="np-meta">{t('dashboard.for')} {nameOf(nowPlaying)} · {styleLabel(nowPlaying)}</div>
                          <div className={`np-wave ${isPlaying ? 'is-playing' : ''}`}>
                            {bars(nowPlaying.id, 40).map((h, i) => (
                              <span key={i} style={{ height: `${h}%`, opacity: (i / 40) * 100 <= progress ? 1 : 0.35 }} />
                            ))}
                          </div>
                          <div className="np-time"><span>{fmt(curTime)}</span><span>{fmt(dur)}</span></div>
                          <div className="np-controls">
                            <button className="np-btn" onClick={() => { const i = filtered.findIndex((x) => x.id === nowPlaying.id); if (i > 0) playSong(filtered[i - 1]); }} aria-label="Prev">⏮</button>
                            <button className="np-btn np-main" onClick={() => playSong(nowPlaying)} aria-label="Play/Pause">{isPlaying ? '❚❚' : '▶'}</button>
                            <button className="np-btn" onClick={() => { const i = filtered.findIndex((x) => x.id === nowPlaying.id); if (i >= 0 && i < filtered.length - 1) playSong(filtered[i + 1]); }} aria-label="Next">⏭</button>
                          </div>
                          <div className="np-actions">
                            <Link href={`/order/${nowPlaying.id}/share`} className="btn btn-outline btn-sm">🔗 {t('dashboard.share')}</Link>
                            {audioOf(nowPlaying) && <a href={`/api/orders/${nowPlaying.id}/download`} className="btn btn-primary btn-sm">⬇ {t('dashboard.download')}</a>}
                          </div>
                        </>
                      ) : (
                        <div className="np-empty">🎧 {t('dashboard.pickASong')}</div>
                      )}
                    </div>

                    <div className="card letra-card">
                      <div className="np-label">{t('dashboard.lyrics')}</div>
                      {nowPlaying?.lyrics ? (
                        <>
                          <p className="letra-text">{nowPlaying.lyrics.replace(/\[.*?\]/g, '').trim().split('\n').filter(Boolean).slice(0, 4).join('\n')}</p>
                          <Link href={`/order/${nowPlaying.id}`} className="letra-more">{t('dashboard.fullLyrics')} →</Link>
                        </>
                      ) : (
                        <p className="letra-text muted">{nowPlaying ? t('dashboard.noLyrics') : t('dashboard.lyricsHint')}</p>
                      )}
                    </div>

                    <div className="card credits-card">
                      <div className="cc-title">{t('dashboard.moreSongs')}</div>
                      <p className="body-sm">{t('dashboard.moreSongsBody')}</p>
                      {showBuy ? (
                        <div className="buy-panel mt-sm">
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: 'var(--space-sm)' }}>
                            {CREDITS.packs.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`btn btn-sm ${buyQty === p.credits ? 'btn-primary' : 'btn-secondary'}`}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem 0.25rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '0.1rem',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setBuyQty(p.credits)}
                              >
                                <strong style={{ fontSize: '1.05rem' }}>{p.songs}</strong>
                                <span style={{ fontSize: '0.62rem', opacity: 0.85, textTransform: 'lowercase' }}>
                                  {p.songs === 1 ? t('credits.song') : t('credits.songs')}
                                </span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>${p.price}</span>
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: 'var(--space-sm)' }}>
                            <input
                              className="input-field"
                              placeholder={t('credits.promoPlaceholder')}
                              value={buyPromoInput}
                              onChange={(e) => { setBuyPromoInput(e.target.value); setBuyPromoMsg(null); }}
                              style={{ flex: 1, textTransform: 'uppercase', fontSize: '0.85rem', padding: '0.5rem 0.6rem' }}
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={applyBuyPromo} disabled={checkingBuyPromo || !buyPromoInput.trim()}>
                              {checkingBuyPromo ? '…' : t('credits.promoApply')}
                            </button>
                          </div>
                          {buyPromoMsg && (
                            <p className="body-sm" style={{ marginBottom: 'var(--space-sm)', color: buyPromoPct ? 'var(--accent-green)' : '#F25F4C' }}>
                              {buyPromoPct ? '✓ ' : '⚠️ '}{buyPromoMsg}
                            </p>
                          )}
                          <button className="btn btn-primary btn-sm w-full" onClick={buyCredits} disabled={buying}>
                            {buying ? '…' : (() => {
                              const bp = CREDITS.packs.find((p) => p.credits === buyQty) || CREDITS.packs[0];
                              const final = discounted(bp.price, buyPromoPct);
                              return `${t('credits.confirmBuy')} · $${final.toFixed(2)}`;
                            })()}
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-primary w-full mt-sm" onClick={() => setShowBuy(true)}>🎫 {t('credits.buyCredits')}</button>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {/* PAYMENTS */}
            {tab === 'payments' && (
              <div className="animate-fade-in-up">
                <div className="dash-topbar">
                  <div>
                    <h1 className="heading-lg">{t('dashboard.payments')}</h1>
                    <p className="body-md">{t('dashboard.paymentsSubtitle')}</p>
                  </div>
                  <span className="side-plan">🎫 {credits ?? '—'} {t('credits.credits')}</span>
                </div>
                {loadingOrders ? (
                  <div className="spinner" style={{ margin: '2rem auto' }} />
                ) : paid.length === 0 ? (
                  <div className="empty-inline card">🧾 {t('dashboard.noPayments')}</div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-scroll">
                      <table className="dash-table dash-table--receipts">
                        <thead><tr>
                          <th>{t('dashboard.colDate')}</th><th>{t('dashboard.colSong')}</th>
                          <th>{t('dashboard.colPlan')}</th><th>{t('dashboard.colAmount')}</th>
                          <th style={{ textAlign: 'right' }}>{t('dashboard.colReceipt')}</th>
                        </tr></thead>
                        <tbody>
                          {paid.map((o) => (
                            <tr key={o.id}>
                              <td><span className="cell-muted">{dateOf(o)}</span></td>
                              <td><span className="song-cell-title">{nameOf(o)}</span></td>
                              <td>{CREDITS.perSong} 🎵</td>
                              <td style={{ fontWeight: 700 }}>${o.price}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => openReceipt(o)}>🧾 {t('dashboard.downloadReceipt')}</button>
                              </td>
                            </tr>
                          ))}
                          <tr><td colSpan={3} style={{ fontWeight: 700 }}>{t('dashboard.statSpent')}</td><td colSpan={2} style={{ fontWeight: 800 }} className="text-gradient">${totalSpent}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PROFILE */}
            {tab === 'profile' && (
              <div className="animate-fade-in-up" style={{ maxWidth: 620 }}>
                <h1 className="heading-lg mb-xl">{t('dashboard.profileTitle')}</h1>
                <div className="card mb-lg">
                  <div className="flex items-center gap-lg mb-lg">
                    <div className="dash-avatar">{initials}</div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{displayName}</div>
                      <div className="body-sm">{user.email}</div>
                    </div>
                  </div>
                  <div className="profile-row"><span className="body-sm">{t('dashboard.memberSince')}</span><span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{memberSince}</span></div>
                  <div className="profile-row"><span className="body-sm">{t('credits.credits')}</span><span style={{ fontWeight: 600 }}>🎫 {credits ?? '—'}</span></div>
                  <div className="profile-row">
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
                      <input className="text-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={isEn ? 'Min. 6 characters' : 'Mín. 6 caracteres'} minLength={6} />
                    </div>
                    {pwMsg && <p className="body-sm mb-md" style={{ color: 'var(--accent-primary)' }}>{pwMsg}</p>}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={newPassword.length < 6}>{t('dashboard.updatePassword')}</button>
                  </form>
                </div>
                <button className="btn btn-secondary w-full" onClick={() => signOut().then(() => router.push('/'))}>🚪 {t('dashboard.signOut')}</button>
              </div>
            )}
          </main>
        </div>
      </div>
      {/* Shared audio element for the Now Playing card */}
      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}
