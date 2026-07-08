'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { MUSIC_STYLES, OCCASIONS, TIERS } from '@/lib/constants';
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

type Tab = 'overview' | 'songs' | 'payments' | 'profile';
type Filter = 'all' | 'ready' | 'production' | 'revision';
type SortKey = 'newest' | 'oldest' | 'name';

const STYLE_MAP = Object.fromEntries(MUSIC_STYLES.map((s) => [s.id, s]));
const OCC_MAP = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  // Library controls
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'es-ES';

  // ── Field helpers (handle both camelCase and snake_case) ──
  const audioOf = (o: Order) => o.audioUrl || o.audio_url;
  const nameOf = (o: Order) => o.recipientName || o.recipient_name || '—';
  const dateRaw = (o: Order) => o.createdAt || o.created_at || '';
  const dateOf = (o: Order) =>
    new Date(dateRaw(o) || Date.now()).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const styleInfo = (o: Order) => STYLE_MAP[o.style];
  const styleLabel = (o: Order) => {
    const s = styleInfo(o);
    return s ? t(s.nameKey) : (o.style || '—');
  };
  const occInfo = (o: Order) => OCC_MAP[o.occasion];
  const occLabel = (o: Order) => {
    const oc = occInfo(o);
    return oc ? t(oc.nameKey) : (o.occasion || '—');
  };

  const bucketOf = (o: Order): Exclude<Filter, 'all'> => {
    if (audioOf(o)) return 'ready';
    if (o.status === 'REVISION_REQUESTED') return 'revision';
    return 'production';
  };

  const statusPill = (o: Order) => {
    const b = bucketOf(o);
    if (b === 'ready') return { cls: 'pill-green', label: t('dashboard.statusReady') };
    if (b === 'revision') return { cls: 'pill-blue', label: t('dashboard.statusRevision') };
    return { cls: 'pill-amber', label: t('dashboard.statusProduction') };
  };

  // ── Derived data ──
  const paid = orders.filter((o) => o.status !== 'PENDING_PAYMENT');
  const readyCount = orders.filter((o) => audioOf(o)).length;
  const totalSpent = paid.reduce((s, o) => s + (o.price || 0), 0);
  const currentTier = paid[0]?.tier;
  const planLabel = currentTier ? t(`preview.${currentTier}Title`) : '—';

  const counts = useMemo(
    () => ({
      all: orders.length,
      ready: orders.filter((o) => bucketOf(o) === 'ready').length,
      production: orders.filter((o) => bucketOf(o) === 'production').length,
      revision: orders.filter((o) => bucketOf(o) === 'revision').length,
    }),
    [orders],
  );

  const filteredSongs = useMemo(() => {
    let list = [...orders];
    if (filter !== 'all') list = list.filter((o) => bucketOf(o) === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        [nameOf(o), styleLabel(o), occLabel(o)].join(' ').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sort === 'name') return nameOf(a).localeCompare(nameOf(b));
      const da = new Date(dateRaw(a)).getTime();
      const db = new Date(dateRaw(b)).getTime();
      return sort === 'oldest' ? da - db : db - da;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, filter, query, sort, lang]);

  if (loading || !user) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto' }} />
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
  const initials = displayName.trim().slice(0, 2).toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
    : '—';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setPwMsg(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPwMsg('⚠️ ' + error.message);
    else {
      setPwMsg('✅ ' + t('dashboard.passwordUpdated'));
      setNewPassword('');
    }
  };

  // Generate a simple printable receipt in a new tab (no backend needed).
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
      <div class="row"><span>${isEn ? 'Plan' : 'Plan'}</span><span>${t(`preview.${o.tier}Title`)}</span></div>
      <div class="row"><span>${isEn ? 'Billed to' : 'Facturado a'}</span><span>${user.email}</span></div>
      <div class="row total"><span>Total</span><span>$${o.price}</span></div>
      <button onclick="window.print()">${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar PDF'}</button>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const canRevise = (o: Order) => o.tier !== 'basica';

  // ── Reusable songs table (used by Overview + Library) ──
  const SongsTable = ({ rows }: { rows: Order[] }) => (
    <div className="table-scroll">
      <table className="dash-table dash-table--songs">
        <thead>
          <tr>
            <th>{t('dashboard.colSong')}</th>
            <th>{t('dashboard.colOccasion')}</th>
            <th>{t('dashboard.colStyle')}</th>
            <th>{t('dashboard.colStatus')}</th>
            <th>{t('dashboard.colDate')}</th>
            <th style={{ textAlign: 'right' }}>{t('dashboard.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const audio = audioOf(o);
            const st = styleInfo(o);
            const oc = occInfo(o);
            const pill = statusPill(o);
            const open = expandedId === o.id;
            return (
              <Fragment key={o.id}>
                <tr
                  className={`song-row ${open ? 'is-open' : ''}`}
                  onClick={() => setExpandedId(open ? null : o.id)}
                >
                  <td>
                    <div className="song-cell">
                      <span
                        className="song-thumb"
                        style={{ background: (st?.color || '#2563EB') + '22', color: st?.color || '#2563EB' }}
                      >
                        {st?.icon || '🎵'}
                      </span>
                      <div>
                        <div className="song-cell-title">{nameOf(o)}</div>
                        <div className="song-cell-sub">{t('dashboard.for')} · {styleLabel(o)}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="cell-muted">{oc?.icon} {occLabel(o)}</span></td>
                  <td>
                    <span
                      className="style-chip"
                      style={{ borderColor: (st?.color || '#2563EB') + '55', color: st?.color || '#2563EB' }}
                    >
                      {styleLabel(o)}
                    </span>
                  </td>
                  <td><span className={`status-pill ${pill.cls}`}>{pill.label}</span></td>
                  <td><span className="cell-muted">{dateOf(o)}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title={t('dashboard.play')}
                        onClick={() => setExpandedId(open ? null : o.id)}
                      >
                        {open ? '▾' : '▶'}
                      </button>
                      {audio && (
                        <a className="icon-btn" href={audio} download title={t('dashboard.download')}>📥</a>
                      )}
                      {canRevise(o) && (
                        <Link className="icon-btn" href={`/order/${o.id}/review`} title={t('dashboard.revise')}>✏️</Link>
                      )}
                      <Link className="icon-btn" href={`/order/${o.id}/share`} title={t('dashboard.share')}>📤</Link>
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr className="song-detail-row">
                    <td colSpan={6}>
                      <div className="song-detail">
                        <p className="detail-meta">
                          {oc?.icon} {occLabel(o)} · {dateOf(o)}
                        </p>
                        {audio ? (
                          <AudioPlayer src={audio} title={`🎵 ${nameOf(o)} — ${styleLabel(o)}`} showVisualizer />
                        ) : (
                          <p className="body-sm" style={{ fontStyle: 'italic' }}>⏳ {t('dashboard.processing')}</p>
                        )}
                        <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
                          {audio && (
                            <a href={audio} download className="btn btn-primary btn-sm">📥 {t('dashboard.download')}</a>
                          )}
                          {canRevise(o) && (
                            <Link href={`/order/${o.id}/review`} className="btn btn-ghost btn-sm">✏️ {t('dashboard.revise')}</Link>
                          )}
                          <Link href={`/order/${o.id}/share`} className="btn btn-outline btn-sm">📤 {t('dashboard.share')}</Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const navItems: { key: Tab; icon: string; label: string }[] = [
    { key: 'overview', icon: '📊', label: t('dashboard.overview') },
    { key: 'songs', icon: '🎵', label: t('dashboard.songs') },
    { key: 'payments', icon: '💳', label: t('dashboard.payments') },
    { key: 'profile', icon: '⚙️', label: t('dashboard.profile') },
  ];

  return (
    <div className="section">
      <div className="container">
        <div className="dashboard">
          {/* ── Sidebar ── */}
          <aside className="dashboard-side">
            <div className="card side-profile">
              <div className="dash-avatar">{initials}</div>
              <div className="side-name">{displayName}</div>
              <div className="body-sm side-email">{user.email}</div>
              <span className="side-plan">⭐ {planLabel}</span>
            </div>

            <nav className="dashboard-nav mt-lg">
              {navItems.map((n) => (
                <button
                  key={n.key}
                  className={tab === n.key ? 'active' : ''}
                  onClick={() => setTab(n.key)}
                >
                  <span>{n.icon}</span> {n.label}
                </button>
              ))}
            </nav>

            <Link href="/create" className="btn btn-primary w-full mt-lg">
              ✨ {t('dashboard.newSong')}
            </Link>
            <button
              className="btn btn-secondary btn-sm w-full mt-sm"
              onClick={() => signOut().then(() => router.push('/'))}
            >
              🚪 {t('dashboard.signOut')}
            </button>
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

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="animate-fade-in-up">
                <div className="dash-topbar">
                  <div>
                    <h1 className="heading-lg">{t('dashboard.greeting', { name: displayName })}</h1>
                    <p className="body-md">{t('dashboard.subtitle')}</p>
                  </div>
                  <Link href="/create" className="btn btn-primary">✨ {t('dashboard.newSong')}</Link>
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

                <div className="flex items-center justify-between mb-lg" style={{ gap: 8 }}>
                  <h2 className="heading-md">{t('dashboard.recent')}</h2>
                  {orders.length > 3 && (
                    <button className="link-btn" onClick={() => setTab('songs')}>{t('dashboard.viewAll')} →</button>
                  )}
                </div>
                {loadingOrders ? (
                  <div className="spinner" style={{ margin: '2rem auto' }} />
                ) : orders.length === 0 ? (
                  <EmptyState t={t} />
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <SongsTable rows={orders.slice(0, 4)} />
                  </div>
                )}
              </div>
            )}

            {/* MY SONGS / LIBRARY */}
            {tab === 'songs' && (
              <div className="animate-fade-in-up">
                <div className="dash-topbar">
                  <h1 className="heading-lg">{t('dashboard.library')}</h1>
                  <Link href="/create" className="btn btn-primary">✨ {t('dashboard.newSong')}</Link>
                </div>

                {/* Filter tabs */}
                <div className="dash-filter-tabs">
                  {(['all', 'ready', 'production', 'revision'] as Filter[]).map((f) => (
                    <button
                      key={f}
                      className={filter === f ? 'active' : ''}
                      onClick={() => setFilter(f)}
                    >
                      {t(`dashboard.filter_${f}`)}
                      <span className="tab-count">{counts[f]}</span>
                    </button>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="dash-toolbar">
                  <div className="dash-search">
                    <span>🔍</span>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('dashboard.searchSongs')}
                    />
                  </div>
                  <select className="dash-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    <option value="newest">{t('dashboard.sortNewest')}</option>
                    <option value="oldest">{t('dashboard.sortOldest')}</option>
                    <option value="name">{t('dashboard.sortName')}</option>
                  </select>
                </div>

                {loadingOrders ? (
                  <div className="spinner" style={{ margin: '2rem auto' }} />
                ) : orders.length === 0 ? (
                  <EmptyState t={t} />
                ) : filteredSongs.length === 0 ? (
                  <div className="empty-inline card">🔎 {t('dashboard.noResults')}</div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <SongsTable rows={filteredSongs} />
                  </div>
                )}
              </div>
            )}

            {/* PAYMENTS / RECEIPTS */}
            {tab === 'payments' && (
              <div className="animate-fade-in-up">
                <div className="dash-topbar">
                  <div>
                    <h1 className="heading-lg">{t('dashboard.payments')}</h1>
                    <p className="body-md">{t('dashboard.paymentsSubtitle')}</p>
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="spinner" style={{ margin: '2rem auto' }} />
                ) : paid.length === 0 ? (
                  <div className="empty-inline card">🧾 {t('dashboard.noPayments')}</div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-scroll">
                      <table className="dash-table dash-table--receipts">
                        <thead>
                          <tr>
                            <th>{t('dashboard.colDate')}</th>
                            <th>{t('dashboard.colSong')}</th>
                            <th>{t('dashboard.colPlan')}</th>
                            <th>{t('dashboard.colAmount')}</th>
                            <th style={{ textAlign: 'right' }}>{t('dashboard.colReceipt')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paid.map((o) => (
                            <tr key={o.id}>
                              <td><span className="cell-muted">{dateOf(o)}</span></td>
                              <td><span className="song-cell-title">{nameOf(o)}</span></td>
                              <td style={{ textTransform: 'capitalize' }}>{t(`preview.${o.tier}Title`)}</td>
                              <td style={{ fontWeight: 700 }}>${o.price}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => openReceipt(o)}>
                                  🧾 {t('dashboard.downloadReceipt')}
                                </button>
                              </td>
                            </tr>
                          ))}
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
                  <div className="profile-row">
                    <span className="body-sm">{t('dashboard.memberSince')}</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{memberSince}</span>
                  </div>
                  <div className="profile-row">
                    <span className="body-sm">{t('dashboard.statPlan')}</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{planLabel}</span>
                  </div>
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
      <Link href="/create" className="btn btn-primary">✨ {t('dashboard.emptyCta')}</Link>
    </div>
  );
}
