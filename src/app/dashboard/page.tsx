'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, CircleCheck, CircleHelp, Disc3, Download, House, Lightbulb, Lock,
  LogOut, Music, Pause, Pencil, Play, Plus, Receipt, Share2, SkipBack, SkipForward, Sparkles,
  Ticket, UserRound, X, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { authHeaders } from '@/lib/authClient';
import { validatePromo, discounted } from '@/lib/promoClient';
import { escapeHtml } from '@/lib/html';
import { MUSIC_STYLES, OCCASIONS, CREDITS } from '@/lib/constants';
import SongRating from '@/components/SongRating';
import { openContactModal } from '@/components/ContactModal';

interface Order {
  id: string;
  recipientName?: string;
  recipient_name?: string;
  style: string;
  occasion: string;
  unlocked?: boolean;
  tier: string;
  status: string;
  price: number;
  audioUrl?: string;
  audio_url?: string;
  lyrics?: string;
  createdAt?: string;
  created_at?: string;
}

// A completed pack purchase, from GET /api/payments.
interface Payment {
  id: string;
  createdAt: string | null;
  songs: number;
  amount: number | null;
  promoCode: string | null;
  currency: string;
}

type Tab = 'dashboard' | 'credits' | 'payments' | 'profile';
const PAGE_SIZE = 5;
const RECENT_COUNT = 8;

const STYLE_MAP = Object.fromEntries(MUSIC_STYLES.map((s) => [s.id, s]));
const OCC_MAP = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;
  return h >>> 0;
}

// Deterministic waveform bar heights (22–100%) seeded by a string.
function bars(seed: string, n = 34): number[] {
  let h = hash(seed) & 0x7fffffff;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(22 + (h % 78));
  }
  return out;
}

// Song covers stay inside the CantaMe blues; each song keeps the same one.
const COVERS = [
  'linear-gradient(155deg, #1D4ED8 0%, #2563EB 45%, #06B6D4 100%)',
  'linear-gradient(155deg, #312E81 0%, #4F46E5 50%, #3B82F6 100%)',
  'linear-gradient(155deg, #0B1220 0%, #1E3A8A 55%, #2563EB 100%)',
  'linear-gradient(155deg, #075985 0%, #0284C7 50%, #38BDF8 100%)',
];
const coverOf = (id: string) => COVERS[hash(id) % COVERS.length];

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [justPaid, setJustPaid] = useState(false);

  // Credits
  const [credits, setCredits] = useState<number | null>(null);
  const [buyQty, setBuyQty] = useState<number>(CREDITS.packs[0].credits);
  const [buying, setBuying] = useState(false);
  // Promo code in the "buy more songs" panel — display only; enforced server-side.
  const [buyPromoInput, setBuyPromoInput] = useState('');
  const [buyPromoCode, setBuyPromoCode] = useState('');
  const [buyPromoPct, setBuyPromoPct] = useState(0);
  const [buyPromoMsg, setBuyPromoMsg] = useState<string | null>(null);
  const [buyError, setBuyError] = useState(false);
  const [checkingBuyPromo, setCheckingBuyPromo] = useState(false);

  // Library controls
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Profile
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  // Now-playing shared player
  const audioRef = useRef<HTMLAudioElement>(null);
  const playIntentRef = useRef(false); // does the user currently want playback?
  const [nowPlaying, setNowPlaying] = useState<Order | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);

  // "Recent songs" shelf
  const shelfRef = useRef<HTMLDivElement>(null);

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

  // Billing history = the packs actually paid for (not the songs unlocked).
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const d = await fetch('/api/payments', { headers: await authHeaders() })
        .then((r) => r.json())
        .catch(() => ({}));
      setPayments(Array.isArray(d.payments) ? d.payments : []);
      setLoadingPayments(false);
    })();
  }, [user]);

  // Generation saves the order server-side, so a brief still in sessionStorage
  // is only a wizard leftover. It used to be "finalized" here: turned into an
  // order (a locked duplicate of a song already in the library), or — right
  // after a payment — sent back to /create/preview, which composed and billed
  // a second song instead of unlocking the one the customer paid for.
  useEffect(() => {
    sessionStorage.removeItem('ct-order');
  }, []);

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

    // Generated MP3s often report duration = Infinity until the browser scans to
    // the end. When that happens, seek far past the end ONCE to force the real
    // duration, then snap back to 0. `probing` guards the transient events the
    // seek triggers (pause/ended), and we resume playback if the user wanted it.
    let probing = false;

    const onMeta = () => {
      const d = a.duration;
      if (Number.isFinite(d) && d > 0) { setDur(d); return; }
      if (probing) return;
      probing = true;
      try { a.currentTime = 1e101; } catch { /* ignore */ }
    };
    const onTime = () => {
      if (probing) {
        if (Number.isFinite(a.duration)) setDur(a.duration);
        probing = false;
        a.currentTime = 0;
        setCurTime(0);
        if (playIntentRef.current) a.play().catch(() => {});
        return;
      }
      setCurTime(a.currentTime);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => { if (!probing) setIsPlaying(false); };
    const onEnded = () => { if (!probing) { setIsPlaying(false); playIntentRef.current = false; } };

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  // ── Field helpers ──
  // A locked song has no playable audio for the customer: the API strips the
  // URL until credits have been spent on it.
  const audioOf = (o: Order) => (o.unlocked === false ? undefined : (o.audioUrl || o.audio_url));

  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const unlockOrder = async (id: string) => {
    setUnlockingId(id);
    try {
      const res = await fetch(`/api/orders/${id}/unlock`, { method: 'POST', headers: await authHeaders() });
      // Out of credits: remember which song to unlock once the pack is paid for.
      if (res.status === 402) { sessionStorage.setItem('ct-unlock', id); router.push('/checkout'); return; }
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.credits === 'number') setCredits(data.credits);
      // They just paid to hear it: swap in the unlocked song and play it.
      const o = orders.find((x) => x.id === id);
      if (o && data.audioUrl) {
        const opened = { ...o, unlocked: true, status: 'READY', audioUrl: data.audioUrl, audio_url: data.audioUrl };
        setOrders((prev) => prev.map((x) => (x.id === id ? opened : x)));
        playSong(opened);
      } else {
        refetchOrders();
      }
    } finally {
      setUnlockingId(null);
    }
  };
  const nameOf = (o: Order) => o.recipientName || o.recipient_name || '—';
  const titleOf = (o: Order) =>
    o.lyrics ? o.lyrics.split('\n')[0].replace(/\[.*?\]/g, '').trim().slice(0, 40) || nameOf(o) : `${t('dashboard.for')} ${nameOf(o)}`;
  const dateRaw = (o: Order) => o.createdAt || o.created_at || '';
  const dateOf = (o: Order) =>
    new Date(dateRaw(o) || Date.now()).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const styleInfo = (o: Order) => STYLE_MAP[o.style];
  const styleLabel = (o: Order) => { const s = styleInfo(o); return s ? t(s.nameKey) : (o.style || '—'); };
  const occLabel = (o: Order) => { const oc = OCC_MAP[o.occasion]; return oc ? t(oc.nameKey) : (o.occasion || '—'); };
  const isGenerating = (o: Order) => o.status === 'IN_PRODUCTION' && !audioOf(o);
  const isLocked = (o: Order) => o.unlocked === false && !isGenerating(o);

  // ── Now-playing controls ──
  const playSong = useCallback((o: Order) => {
    const a = audioRef.current;
    const src = audioOf(o);
    if (!a || !src) return;
    if (nowPlaying?.id === o.id && a.getAttribute('src') === src) {
      if (a.paused) { playIntentRef.current = true; a.play().catch(() => {}); }
      else { playIntentRef.current = false; a.pause(); }
      return;
    }
    setNowPlaying(o);
    a.src = src;
    a.currentTime = 0;
    playIntentRef.current = true;
    a.play().catch(() => {});
  }, [nowPlaying]);

  const scrollShelf = (dir: 1 | -1) => {
    const el = shelfRef.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: still ? 'auto' : 'smooth' });
  };

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
  const recent = orders.slice(0, RECENT_COUNT);

  const readyCount = orders.filter((o) => audioOf(o)).length;
  // Customers count in songs, never in credits (1 song = CREDITS.perSong).
  const songsLeft = credits === null ? null : Math.floor(credits / CREDITS.perSong);
  const availLabel = (n: number | null) =>
    n === null ? '—' : n === 1 ? t('dashboard.songAvailableOne') : t('dashboard.songsAvailable', { n: String(n) });
  // Only what is known: a legacy row without an amount adds nothing, and when
  // no row has one the total is "—" rather than a false "$0.00".
  const knownAmounts = payments.filter((p) => p.amount !== null);
  const totalSpent = knownAmounts.length ? knownAmounts.reduce((s, p) => s + (p.amount as number), 0) : null;
  const money = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
  const songsLabel = (n: number) => `${n} ${n === 1 ? t('credits.song') : t('credits.songs')}`;
  const paymentDate = (p: Payment) =>
    p.createdAt ? new Date(p.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
    setBuyError(false);
    try {
      const pack = CREDITS.packs.find((p) => p.credits === buyQty) || CREDITS.packs[0];
      const r = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          packId: pack.id,
          name: user.user_metadata?.full_name || '',
          promoCode: buyPromoCode || undefined,
          lang,
        }),
      });
      const d = await r.json();
      if (d.checkoutUrl) { window.location.href = d.checkoutUrl; return; }
      setBuying(false);
      setBuyError(true);
    } catch {
      setBuying(false);
      setBuyError(true);
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

  // One receipt per pack purchase — the real amount charged, promo included.
  const openReceipt = (p: Payment) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${isEn ? 'Receipt' : 'Recibo'} · CantaMe</title>
      <style>body{font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#0f172a;padding:0 20px}
      h1{color:#2563EB;font-size:1.5rem}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
      .total{font-weight:800;font-size:1.2rem;border-top:2px solid #0f172a;margin-top:8px}
      .muted{color:#64748b;font-size:.85rem}button{margin-top:24px;background:#2563EB;color:#fff;border:0;padding:12px 20px;border-radius:8px;font-size:1rem;cursor:pointer}</style>
      </head><body>
      <h1>🎵 CantaMe</h1>
      <p class="muted">${isEn ? 'Payment receipt' : 'Recibo de pago'} · ${escapeHtml(paymentDate(p))}</p>
      <div class="row"><span>${isEn ? 'Payment' : 'Pago'}</span><span>#${escapeHtml(p.id)}</span></div>
      <div class="row"><span>${isEn ? 'Item' : 'Concepto'}</span><span>${escapeHtml(isEn ? `Pack of ${songsLabel(p.songs)}` : `Pack de ${songsLabel(p.songs)}`)}</span></div>
      ${p.promoCode ? `<div class="row"><span>${isEn ? 'Promo code' : 'Código promocional'}</span><span>${escapeHtml(p.promoCode)}</span></div>` : ''}
      <div class="row"><span>${isEn ? 'Billed to' : 'Facturado a'}</span><span>${escapeHtml(user?.email)}</span></div>
      <div class="row total"><span>Total</span><span>${escapeHtml(money(p.amount))} ${p.amount === null ? '' : escapeHtml(p.currency)}</span></div>
      <button onclick="window.print()">${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar PDF'}</button>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  if (loading || !user) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto var(--space-lg)' }} />
      </div>
    );
  }

  const fullName = user.user_metadata?.full_name || '';
  const displayName = fullName || user.email?.split('@')[0] || 'there';
  const initial = displayName.trim().charAt(0).toUpperCase();
  // Capitalize the first letter only: CSS `capitalize` turned "julio de 2026"
  // into "Julio De 2026".
  const memberSinceRaw = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
    : '—';
  const memberSince = memberSinceRaw.charAt(0).toUpperCase() + memberSinceRaw.slice(1);
  const progress = dur > 0 ? (curTime / dur) * 100 : 0;

  const heads: Record<Tab, { title: string; sub: string }> = {
    dashboard: { title: t('dashboard.greeting', { name: displayName }), sub: t('dashboard.subtitle') },
    credits: { title: t('dashboard.creditsTab'), sub: t('dashboard.creditsSubtitle') },
    payments: { title: t('dashboard.payments'), sub: t('dashboard.paymentsSubtitle') },
    profile: { title: t('dashboard.account'), sub: t('dashboard.accountSubtitle') },
  };

  type NavItem = { Icon: LucideIcon; label: string } & ({ tab: Tab } | { href: string });
  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: t('dashboard.groupGeneral'),
      items: [
        { tab: 'dashboard', Icon: House, label: t('dashboard.overview') },
        { tab: 'profile', Icon: UserRound, label: t('dashboard.account') },
      ],
    },
    {
      label: t('dashboard.groupBilling'),
      items: [
        { tab: 'credits', Icon: Ticket, label: t('dashboard.creditsTab') },
        { tab: 'payments', Icon: Receipt, label: t('dashboard.payments') },
      ],
    },
    {
      label: t('dashboard.groupCreate'),
      items: [
        { href: '/create', Icon: Plus, label: t('dashboard.newSong') },
        { href: '/how-it-works', Icon: CircleHelp, label: t('nav.howItWorks') },
      ],
    },
  ];

  const stats: { Icon: LucideIcon; value: number | string; label: string }[] = [
    { Icon: Music, value: orders.length, label: t('dashboard.statSongs') },
    { Icon: Ticket, value: songsLeft ?? '—', label: t('dashboard.statAvailable') },
    { Icon: Download, value: readyCount, label: t('dashboard.statReady') },
    { Icon: Disc3, value: genres.length, label: t('dashboard.statGenres') },
  ];

  const selectedPack = CREDITS.packs.find((p) => p.credits === buyQty) || CREDITS.packs[0];

  // ── Song row (library list) ──
  const renderSongRow = (o: Order) => {
    const audio = audioOf(o);
    const generating = isGenerating(o);
    const locked = isLocked(o);
    const active = nowPlaying?.id === o.id;
    const playingThis = active && isPlaying;
    return (
      <div key={o.id} className={`song-item ${active ? 'active' : ''} ${generating ? 'is-generating' : ''}`}>
        <button
          className="song-play"
          onClick={() => playSong(o)}
          disabled={!audio}
          aria-label={locked ? t('dashboard.locked') : playingThis ? 'Pause' : t('dashboard.play')}
        >
          {generating ? <span className="spinner spinner-sm" />
            : locked ? <Lock size={17} aria-hidden />
            : playingThis ? <Pause size={17} fill="currentColor" aria-hidden />
            : <Play size={17} fill="currentColor" aria-hidden />}
        </button>
        <div className="song-info">
          <div className="song-title-row">
            <span className="song-title">{titleOf(o)}</span>
            {generating && <span className="generating-badge">{t('dashboard.generating')}</span>}
            {playingThis && <span className="playing-badge">{t('dashboard.playing')}</span>}
          </div>
          <div className="song-meta">
            {generating ? t('dashboard.generatingHint') : `${t('dashboard.for')} ${nameOf(o)} · ${occLabel(o)} · ${dateOf(o)}`}
          </div>
        </div>
        <span className="genre-chip">{styleLabel(o)}</span>
        {generating ? (
          <div className="gen-wave" aria-hidden><span /><span /><span /><span /><span /></div>
        ) : !locked && (
          <div className={`waveform ${playingThis ? 'is-playing' : ''}`} aria-hidden>
            {bars(o.id, 26).map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
          </div>
        )}
        <div className="song-actions">
          {!generating && (
            <>
              {/* The only way into a locked song: its play button is disabled
                  and the now-playing panel only ever shows playable songs. */}
              {locked && (
                <button className="btn btn-primary btn-sm" onClick={() => unlockOrder(o.id)} disabled={unlockingId === o.id}>
                  {unlockingId === o.id ? '…' : <><Lock size={14} aria-hidden /> {t('dashboard.unlock')}</>}
                </button>
              )}
              <Link className="ico" href={`/order/${o.id}/share`} title={t('dashboard.share')} aria-label={t('dashboard.share')}>
                <Share2 size={17} aria-hidden />
              </Link>
              {audio && (
                <a className="ico" href={`/api/orders/${o.id}/download`} title={t('dashboard.download')} aria-label={t('dashboard.download')}>
                  <Download size={17} aria-hidden />
                </a>
              )}
              <Link className="ico" href={`/order/${o.id}/review`} title={t('dashboard.revise')} aria-label={t('dashboard.revise')}>
                <Pencil size={16} aria-hidden />
              </Link>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Cover card (recent songs shelf) ──
  const renderCover = (o: Order) => {
    const generating = isGenerating(o);
    const locked = isLocked(o);
    const playingThis = nowPlaying?.id === o.id && isPlaying;
    return (
      <article key={o.id} className={`cover ${playingThis ? 'is-playing' : ''}`} style={{ background: coverOf(o.id) }}>
        <div className="cover-top">
          <span className="cover-chip">{styleLabel(o)}</span>
          {locked && <span className="cover-lock" title={t('dashboard.locked')}><Lock size={13} aria-hidden /></span>}
        </div>
        {generating ? (
          <div className="cover-wave is-generating" aria-hidden><span /><span /><span /><span /><span /><span /><span /></div>
        ) : (
          <div className={`cover-wave ${playingThis ? 'is-playing' : ''}`} aria-hidden>
            {bars(o.id, 24).map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
          </div>
        )}
        <div className="cover-foot">
          <div className="cover-text">
            <div className="cover-title">{titleOf(o)}</div>
            <div className="cover-meta">
              {generating ? t('dashboard.generating') : `${t('dashboard.for')} ${nameOf(o)} · ${occLabel(o)}`}
            </div>
          </div>
          {generating ? null : locked ? (
            <button className="cover-unlock" onClick={() => unlockOrder(o.id)} disabled={unlockingId === o.id}>
              {unlockingId === o.id ? '…' : t('dashboard.unlock')}
            </button>
          ) : (
            <button className="cover-play" onClick={() => playSong(o)} aria-label={playingThis ? 'Pause' : t('dashboard.play')}>
              {playingThis ? <Pause size={18} fill="currentColor" aria-hidden /> : <Play size={18} fill="currentColor" aria-hidden />}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="dash-page">
      <div className="container">
        {/* ── Page head ── */}
        <header className="dash-head">
          <div className="dash-head-text">
            <h1 className="dash-title">{heads[tab].title}</h1>
            <p className="dash-sub">{heads[tab].sub}</p>
          </div>
          <div className="dash-head-actions">
            <button className="balance-pill" onClick={() => setTab('credits')} title={t('credits.yourBalance')}>
              <Ticket size={16} aria-hidden />
              <span>{availLabel(songsLeft)}</span>
            </button>
            <Link href="/create" className="btn btn-primary btn-sm dash-new">
              <Sparkles size={15} aria-hidden /> {t('dashboard.newSong')}
            </Link>
          </div>
        </header>

        <div className="dashboard">
          {/* ── Sidebar ── */}
          <aside className="dashboard-side">
            <nav className="dash-nav" aria-label={t('nav.dashboard')}>
              {navGroups.map((g) => (
                <div className="dash-nav-group" key={g.label}>
                  <div className="dash-nav-label">{g.label}</div>
                  {g.items.map((item) =>
                    'tab' in item ? (
                      <button
                        key={item.label}
                        className={`dash-nav-item ${tab === item.tab ? 'active' : ''}`}
                        aria-current={tab === item.tab ? 'page' : undefined}
                        onClick={() => setTab(item.tab)}
                      >
                        <item.Icon size={18} strokeWidth={1.8} aria-hidden /> {item.label}
                      </button>
                    ) : (
                      <Link key={item.label} href={item.href} className="dash-nav-item">
                        <item.Icon size={18} strokeWidth={1.8} aria-hidden /> {item.label}
                      </Link>
                    ),
                  )}
                </div>
              ))}
            </nav>

            <div className="side-foot">
              <div className="side-user">
                <div className="dash-avatar sm">{initial}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="side-user-name">{displayName}</div>
                  <div className="side-user-mail">{user.email}</div>
                </div>
              </div>
              <button className="dash-nav-item side-signout" onClick={() => signOut().then(() => router.push('/'))}>
                <LogOut size={18} strokeWidth={1.8} aria-hidden /> {t('dashboard.signOut')}
              </button>
            </div>
          </aside>

          {/* ── Main ── */}
          <main className="dashboard-main">
            {justPaid && (
              <div className="paid-banner animate-fade-in-up" role="status">
                <CircleCheck size={28} className="paid-banner-icon" aria-hidden />
                <div className="paid-banner-text">
                  <strong>{t('dashboard.paidTitle')}</strong>
                  <span className="body-sm">{t('order.receiptNote')}</span>
                </div>
                <button className="paid-banner-close" aria-label={t('common.close')} onClick={() => setJustPaid(false)}>
                  <X size={18} aria-hidden />
                </button>
              </div>
            )}

            {/* OVERVIEW */}
            {tab === 'dashboard' && (
              <div className="dash-stack">
                <section className="dcard stat-strip" aria-label={t('dashboard.overview')}>
                  {stats.map(({ Icon, value, label }) => (
                    <div className="stat-cell" key={label}>
                      <span className="stat-ico"><Icon size={18} aria-hidden /></span>
                      <div>
                        <div className="stat-num">{value}</div>
                        <div className="stat-lbl">{label}</div>
                      </div>
                    </div>
                  ))}
                </section>

                {/* Recent songs: a swipeable shelf of covers */}
                {!loadingOrders && recent.length > 0 && (
                  <section className="shelf">
                    <div className="shelf-head">
                      <h2 className="dcard-title">{t('dashboard.recent')}</h2>
                      {recent.length > 2 && (
                        <div className="shelf-arrows">
                          <button className="shelf-arrow" onClick={() => scrollShelf(-1)} aria-label={t('dashboard.scrollPrev')}>
                            <ChevronLeft size={18} aria-hidden />
                          </button>
                          <button className="shelf-arrow" onClick={() => scrollShelf(1)} aria-label={t('dashboard.scrollNext')}>
                            <ChevronRight size={18} aria-hidden />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="shelf-track" ref={shelfRef}>
                      {recent.map(renderCover)}
                    </div>
                  </section>
                )}

                {/* Split: list + now playing */}
                <div className="dash-split">
                  <section className="dcard dash-split-main">
                    <div className="dcard-head">
                      <h2 className="dcard-title">{t('dashboard.mySongs')}</h2>
                      {genres.length > 1 && (
                        <div className="genre-filters">
                          <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(1); }}>{t('dashboard.filter_all')}</button>
                          {genres.slice(0, 4).map((g) => (
                            <button key={g} className={filter === g ? 'active' : ''} onClick={() => { setFilter(g); setPage(1); }}>
                              {STYLE_MAP[g] ? t(STYLE_MAP[g].nameKey) : g}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {loadingOrders ? (
                      <div className="spinner" style={{ margin: '2rem auto' }} />
                    ) : filtered.length === 0 ? (
                      <div className="dash-empty">
                        <span className="dash-empty-ico"><Music size={26} aria-hidden /></span>
                        <p className="body-lg">{t('dashboard.empty')}</p>
                        <Link href="/create" className="btn btn-primary">
                          <Sparkles size={16} aria-hidden /> {t('dashboard.emptyCta')}
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="songlist">
                          {paged.map(renderSongRow)}
                        </div>
                        <div className="dash-pagination">
                          <span className="body-sm">{t('dashboard.showing', { n: String(paged.length), total: String(filtered.length) })}</span>
                          {totalPages > 1 && (
                            <div className="pager">
                              <button disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label={t('common.back')}>
                                <ChevronLeft size={16} aria-hidden />
                              </button>
                              {Array.from({ length: totalPages }).map((_, i) => (
                                <button key={i} className={pageClamped === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>
                              ))}
                              <button disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label={t('common.next')}>
                                <ChevronRight size={16} aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>

                  {/* Right column */}
                  <aside className="dash-split-side">
                    <div className={`dcard nowplaying ${nowPlaying ? '' : 'is-empty'}`}>
                      <div className="np-label">{t('dashboard.nowPlaying')}</div>
                      {nowPlaying ? (
                        <>
                          <div className="np-title">{nameOf(nowPlaying)}</div>
                          <div className="np-meta">{t('dashboard.for')} {nameOf(nowPlaying)} · {styleLabel(nowPlaying)}</div>
                          <div className={`np-wave ${isPlaying ? 'is-playing' : ''}`}>
                            {bars(nowPlaying.id, 40).map((h, i) => (
                              <span key={i} style={{ height: `${h}%`, opacity: (i / 40) * 100 <= progress ? 1 : 0.3 }} />
                            ))}
                          </div>
                          <div className="np-time"><span>{fmt(curTime)}</span><span>{fmt(dur)}</span></div>
                          <div className="np-controls">
                            <button className="np-btn" onClick={() => { const i = filtered.findIndex((x) => x.id === nowPlaying.id); if (i > 0) playSong(filtered[i - 1]); }} aria-label="Prev">
                              <SkipBack size={20} fill="currentColor" aria-hidden />
                            </button>
                            <button className="np-btn np-main" onClick={() => playSong(nowPlaying)} aria-label="Play/Pause">
                              {isPlaying ? <Pause size={22} fill="currentColor" aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />}
                            </button>
                            <button className="np-btn" onClick={() => { const i = filtered.findIndex((x) => x.id === nowPlaying.id); if (i >= 0 && i < filtered.length - 1) playSong(filtered[i + 1]); }} aria-label="Next">
                              <SkipForward size={20} fill="currentColor" aria-hidden />
                            </button>
                          </div>
                          <div className="np-actions">
                            {nowPlaying.unlocked === false && (
                              <button className="btn btn-primary btn-sm" onClick={() => unlockOrder(nowPlaying.id)}>
                                <Lock size={14} aria-hidden /> {t('credits.useOneCredit')}
                              </button>
                            )}
                            <Link href={`/order/${nowPlaying.id}/share`} className="btn btn-outline btn-sm">
                              <Share2 size={15} aria-hidden /> {t('dashboard.share')}
                            </Link>
                            {audioOf(nowPlaying) && (
                              <a href={`/api/orders/${nowPlaying.id}/download`} className="btn btn-primary btn-sm">
                                <Download size={15} aria-hidden /> {t('dashboard.download')}
                              </a>
                            )}
                          </div>
                          {audioOf(nowPlaying) && (
                            <div style={{ marginTop: 'var(--space-md)' }}>
                              {/* keyed by song: switching tracks resets the widget
                                  instead of showing the previous song's thank-you */}
                              <SongRating
                                key={nowPlaying.id}
                                audioUrl={audioOf(nowPlaying)}
                                orderId={nowPlaying.id}
                                style={nowPlaying.style}
                                occasion={nowPlaying.occasion}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="np-empty">{t('dashboard.pickASong')}</div>
                      )}
                    </div>

                    <div className={`dcard letra-card ${nowPlaying ? '' : 'is-empty'}`}>
                      <div className="np-label">{t('dashboard.lyrics')}</div>
                      {nowPlaying?.lyrics ? (
                        <>
                          <p className="letra-text">{nowPlaying.lyrics.replace(/\[.*?\]/g, '').trim().split('\n').filter(Boolean).slice(0, 4).join('\n')}</p>
                          <Link href={`/order/${nowPlaying.id}`} className="letra-more">{t('dashboard.fullLyrics')}</Link>
                        </>
                      ) : (
                        <p className="letra-text muted">{nowPlaying ? t('dashboard.noLyrics') : t('dashboard.lyricsHint')}</p>
                      )}
                    </div>

                    <div className="dcard credits-card">
                      <div className="cc-balance"><Ticket size={18} aria-hidden /> {availLabel(songsLeft)}</div>
                      <p className="body-sm">{t('dashboard.moreSongsBody')}</p>
                      <button className="btn btn-primary btn-sm w-full mt-sm" onClick={() => setTab('credits')}>
                        {t('credits.buyCredits')}
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {/* CREDITS */}
            {tab === 'credits' && (
              <div className="dash-stack credits-layout">
                <section className="dcard balance-card">
                  <div className="balance-label">{t('credits.yourBalance')}</div>
                  <div className="balance-num">{songsLeft ?? '—'}</div>
                  <div className="balance-unit">{songsLeft === 1 ? t('credits.song') : t('credits.songs')}</div>
                  <p className="balance-note">{t('dashboard.unlockIncludes')}</p>
                </section>

                <section className="dcard">
                  <div className="dcard-head">
                    <h2 className="dcard-title">{t('dashboard.choosePack')}</h2>
                  </div>
                  <div className="pack-grid" role="radiogroup" aria-label={t('dashboard.choosePack')}>
                    {CREDITS.packs.map((p) => {
                      const selected = buyQty === p.credits;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`pack ${selected ? 'selected' : ''}`}
                          onClick={() => setBuyQty(p.credits)}
                        >
                          {'best' in p && p.best && <span className="pack-badge">{t('dashboard.bestValue')}</span>}
                          <span className="pack-songs">{p.songs}</span>
                          <span className="pack-unit">{t('credits.songs')}</span>
                          <span className="pack-price">${p.price}</span>
                          <span className="pack-per">{t('dashboard.perSong', { price: `$${(p.price / p.songs).toFixed(2)}` })}</span>
                          {'save' in p && <span className="pack-save">{t('dashboard.saveAmount', { amount: `$${p.save}` })}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="buy-row">
                    <input
                      className="input-field"
                      placeholder={t('credits.promoPlaceholder')}
                      aria-label={t('credits.promoPlaceholder')}
                      value={buyPromoInput}
                      onChange={(e) => { setBuyPromoInput(e.target.value); setBuyPromoMsg(null); }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={applyBuyPromo} disabled={checkingBuyPromo || !buyPromoInput.trim()}>
                      {checkingBuyPromo ? '…' : t('credits.promoApply')}
                    </button>
                  </div>
                  {buyPromoMsg && (
                    <p className="body-sm buy-msg" style={{ color: buyPromoPct ? 'var(--accent-green)' : '#DC2626' }}>
                      {buyPromoPct ? '✓ ' : '⚠️ '}{buyPromoMsg}
                    </p>
                  )}
                  <button className="btn btn-primary w-full" onClick={buyCredits} disabled={buying}>
                    {buying ? '…' : `${t('credits.confirmBuy')} · $${discounted(selectedPack.price, buyPromoPct).toFixed(2)}`}
                  </button>
                  {buyError && (
                    <p className="body-sm buy-msg" style={{ color: '#DC2626' }}>⚠️ {t('credits.payFailed')}</p>
                  )}
                  <p className="body-sm buy-msg">{t('payment.redirectNote')}</p>
                </section>
              </div>
            )}

            {/* PAYMENTS */}
            {tab === 'payments' && (
              <div className="dash-stack">
                <section className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
                  {loadingPayments ? (
                    <div className="spinner" style={{ margin: '2rem auto' }} />
                  ) : payments.length === 0 ? (
                    <div className="dash-empty">
                      <span className="dash-empty-ico"><Receipt size={24} aria-hidden /></span>
                      <p className="body-lg">{t('dashboard.noPayments')}</p>
                      <button className="btn btn-primary" onClick={() => setTab('credits')}>{t('credits.buyCredits')}</button>
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table className="dash-table dash-table--receipts">
                        <thead><tr>
                          <th>{t('dashboard.colDate')}</th>
                          <th>{t('dashboard.colPlan')}</th><th>{t('dashboard.colAmount')}</th>
                          <th style={{ textAlign: 'right' }}>{t('dashboard.colReceipt')}</th>
                        </tr></thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.id}>
                              <td><span className="cell-muted">{paymentDate(p)}</span></td>
                              <td>
                                {songsLabel(p.songs)}
                                {p.promoCode && <span className="cell-muted"> · {p.promoCode}</span>}
                              </td>
                              <td style={{ fontWeight: 700 }}>{money(p.amount)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => openReceipt(p)}>
                                  <Receipt size={14} aria-hidden /> {t('dashboard.downloadReceipt')}
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr><td colSpan={2} style={{ fontWeight: 700 }}>{t('dashboard.statSpent')}</td><td colSpan={2} style={{ fontWeight: 800 }} className="text-gradient">{money(totalSpent)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ACCOUNT */}
            {tab === 'profile' && (
              <div className="dash-stack account-layout">
                <section className="dcard">
                  <div className="dcard-head">
                    <h2 className="dcard-title">{t('dashboard.profileCard')}</h2>
                  </div>
                  <div className="acct-body">
                    <div className="acct-avatar" aria-hidden>{initial}</div>
                    <dl className="acct-fields">
                      <div><dt>{t('dashboard.name')}</dt><dd>{fullName || '—'}</dd></div>
                      <div><dt>{t('dashboard.email')}</dt><dd>{user.email}</dd></div>
                      <div><dt>{t('dashboard.memberSince')}</dt><dd>{memberSince}</dd></div>
                      <div>
                        <dt>{t('dashboard.language')}</dt>
                        <dd>
                          <div className="lang-switch" style={{ display: 'inline-flex' }}>
                            <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
                            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                          </div>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="dcard-note">
                    <Lightbulb size={18} aria-hidden />
                    <span>{t('dashboard.changeInfoHint')}</span>
                    <button className="btn btn-dark btn-sm" onClick={() => openContactModal()}>{t('dashboard.contactSupport')}</button>
                  </div>
                </section>

                <section className="dcard">
                  <div className="dcard-head">
                    <h2 className="dcard-title">{t('dashboard.changePassword')}</h2>
                  </div>
                  <form onSubmit={handleChangePassword} className="auth-form">
                    <div className="input-group">
                      <label className="input-label" htmlFor="new-password">{t('dashboard.newPassword')}</label>
                      <input id="new-password" className="text-input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={isEn ? 'Min. 6 characters' : 'Mín. 6 caracteres'} minLength={6} />
                    </div>
                    {pwMsg && <p className="body-sm mb-md" style={{ color: 'var(--accent-primary)' }}>{pwMsg}</p>}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={newPassword.length < 6}>{t('dashboard.updatePassword')}</button>
                  </form>
                </section>

                <button className="btn btn-secondary w-full" onClick={() => signOut().then(() => router.push('/'))}>
                  <LogOut size={16} aria-hidden /> {t('dashboard.signOut')}
                </button>
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
