'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { STYLE_PROMPTS } from '@/lib/musicPrompts';
import { CREDITS } from '@/lib/constants';
import AudioPlayer from '@/components/AudioPlayer';

interface Revision {
  id: string;
  notes: string;
  status: string;
  createdAt: string;
}

interface Order {
  id: string;
  clientEmail: string;
  recipientName: string;
  relation: string;
  occasion: string;
  style: string;
  anecdotes: string;
  message: string;
  tone: string;
  tier: string;
  price: number;
  status: string;
  audioUrl?: string;
  instrumentalUrl?: string;
  createdAt: string;
  revisions: Revision[];
}

interface MusicStyle {
  id: string;
  nameEs: string;
  nameEn: string;
  icon: string;
  color: string;
  audioUrl: string;
}

interface AdminUser {
  id: string;
  email: string;
  credits: number;
  songs: number;
  createdAt: string;
  lastSignInAt: string | null;
}

interface StudioResult {
  audioUrl: string;
  title: string;
  lyrics: string;
}

interface Breakdown {
  name: string;
  up: number;
  down: number;
  total: number;
  score: number;
}

interface LovedSong {
  id: string;
  audioUrl: string | null;
  style: string | null;
  occasion: string | null;
  featured: boolean;
  createdAt: string;
}

interface RatingStats {
  loved?: LovedSong[];
  total: number;
  up: number;
  down: number;
  score: number;
  byStyle: Breakdown[];
  byVoice: Breakdown[];
  byTone: Breakdown[];
  byOccasion: Breakdown[];
  error?: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  adminNote: string | null;
  userId: string | null;
  locale: string | null;
  createdAt: string;
}

const CONTACT_STATUS_COLORS: Record<string, string> = {
  new: '#F25F4C',
  read: '#FF8906',
  replied: '#2CB67D',
  archived: '#888',
};

// Mirrors `contact.subjects.*` in the locale files. Duplicated here because the
// admin renders in whichever language the admin is browsing in, independently of
// the language the visitor wrote in.
const CONTACT_SUBJECT_LABELS: Record<string, { en: string; es: string }> = {
  general: { en: 'General question', es: 'Pregunta general' },
  order: { en: 'My order', es: 'Mi pedido' },
  payment: { en: 'Payment', es: 'Pago' },
  other: { en: 'Something else', es: 'Otro tema' },
};

const STUDIO_OCCASIONS = ['cumpleanos', 'boda', 'quinceanera', 'serenata', 'diaMadres', 'graduacion', 'declaracion', 'sanValentin', 'bautizo', 'otro'];
const STUDIO_TONES = ['emotional', 'festive', 'romantic', 'funny'];

interface Analytics {
  total: number;
  today: number;
  week: number;
  month: number;
  topPaths: { name: string; count: number }[];
  topCountries: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  series: { date: string; count: number }[];
  error?: string;
}

const ALL_STATUSES = ['PAID', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'REVISION_REQUESTED'];

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#888',
  PAID: '#FF8906',
  IN_PRODUCTION: '#7F5AF0',
  READY: '#2CB67D',
  DELIVERED: '#2CB67D',
  REVISION_REQUESTED: '#F25F4C',
};

export default function AdminPage() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = isAdminEmail(user?.email);

  const [activeTab, setActiveTab] = useState<'orders' | 'styles' | 'traffic' | 'studio' | 'users' | 'messages' | 'quality'>('orders');

  // Traffic (server-side, ad-blocker-proof analytics)
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Access control: send logged-out users to sign in (returning to /admin
  // afterwards), and logged-in non-admins to their dashboard. Admin API routes
  // also verify server-side.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/signin?mode=signin&next=/admin'); return; }
    if (!isAdmin) router.replace('/dashboard');
  }, [authLoading, user, isAdmin, router]);

  // Attach the Supabase access token so admin API routes can verify the caller.
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await getSupabaseBrowser().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Styles State
  const [styles, setStyles] = useState<MusicStyle[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);
  const [editingStyle, setEditingStyle] = useState<MusicStyle | null>(null);
  const [styleForm, setStyleForm] = useState({
    id: '',
    nameEs: '',
    nameEn: '',
    icon: '🎵',
    color: '#FF8906',
    audioUrl: '',
  });

  // Studio (admin test generation) state
  const [studioForm, setStudioForm] = useState({
    recipientName: '',
    relation: '',
    occasion: 'cumpleanos',
    style: 'bachata',
    tone: 'emotional',
    voiceGender: 'female',
    songLanguage: 'es',
    anecdote1: '',
    message: '',
  });
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState('');
  const [studioResult, setStudioResult] = useState<StudioResult | null>(null);

  // Users / credits state
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearched, setUsersSearched] = useState(false);

  // Contact form messages (footer modal → this tab)
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageFilter, setMessageFilter] = useState('all');
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Song quality (thumbs up/down left by customers)
  const [ratings, setRatings] = useState<RatingStats | null>(null);
  const [loadingRatings, setLoadingRatings] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders', { headers: await authHeaders() });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    }
    setLoadingOrders(false);
  }, [authHeaders]);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/styles');
      const data = await res.json();
      setStyles(Array.isArray(data) ? data : []);
    } catch {
      setStyles([]);
    }
    setLoadingStyles(false);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics', { headers: await authHeaders() });
      const data = await res.json();
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    }
    setLoadingAnalytics(false);
  }, [authHeaders]);

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/contact?status=${messageFilter}`, { headers: await authHeaders() });
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setUnreadCount(data.unread || 0);
    } catch {
      setMessages([]);
    }
    setLoadingMessages(false);
  }, [authHeaders, messageFilter]);

  const fetchRatings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ratings', { headers: await authHeaders() });
      setRatings(await res.json());
    } catch {
      setRatings(null);
    }
    setLoadingRatings(false);
  }, [authHeaders]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchOrders();
    fetchStyles();
    fetchAnalytics();
    fetchRatings();
  }, [isAdmin, fetchOrders, fetchStyles, fetchAnalytics, fetchRatings]);

  // Separate effect: refetches when the status filter changes, and keeps the
  // unread badge current without re-running the other three fetches.
  useEffect(() => {
    if (!isAdmin) return;
    fetchMessages();
  }, [isAdmin, fetchMessages]);

  // Reply from the admin's own mailbox: a mailto: link pre-filled with the
  // original message quoted. This is why the app needs no SMTP/sending service.
  const replyHref = (m: ContactMessage) => {
    const label = CONTACT_SUBJECT_LABELS[m.subject]?.[isEn ? 'en' : 'es'] || m.subject;
    const greeting = isEn ? `Hi ${m.name},` : `Hola ${m.name},`;
    const wrote = isEn ? 'You wrote:' : 'Escribiste:';
    const quoted = m.message.split('\n').map((l) => `> ${l}`).join('\n');
    const body = `${greeting}\n\n\n\n---\n${wrote}\n${quoted}\n`;
    return `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${label} — CantaMe`)}&body=${encodeURIComponent(body)}`;
  };

  const updateMessage = async (id: string, patch: { status?: string; adminNote?: string }) => {
    await fetch(`/api/admin/contact/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(patch),
    });
    fetchMessages();
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  const updateOrderStatus = async (orderId: string, status: string, audioUrl?: string, instrumentalUrl?: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ status, audioUrl, instrumentalUrl }),
    });
    fetchOrders();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? { ...prev, status, audioUrl, instrumentalUrl } : null);
    }
  };

  // Music Style Form submission
  const handleStyleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleForm.id || !styleForm.nameEs || !styleForm.nameEn || !styleForm.audioUrl) return;

    try {
      if (editingStyle) {
        // Edit Style
        const res = await fetch(`/api/styles/${editingStyle.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify(styleForm),
        });
        if (res.ok) {
          setEditingStyle(null);
        }
      } else {
        // Add Style
        await fetch('/api/styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify(styleForm),
        });
      }

      // Reset Form
      setStyleForm({
        id: '',
        nameEs: '',
        nameEn: '',
        icon: '🎵',
        color: '#FF8906',
        audioUrl: '',
      });

      fetchStyles();
    } catch (error) {
      console.error('Failed to submit style form', error);
    }
  };

  const handleEditStyle = (style: MusicStyle) => {
    setEditingStyle(style);
    setStyleForm({
      id: style.id,
      nameEs: style.nameEs,
      nameEn: style.nameEn,
      icon: style.icon,
      color: style.color,
      audioUrl: style.audioUrl,
    });
  };

  const handleDeleteStyle = async (id: string) => {
    if (!confirm(t('hero.stats') === 'songs created' ? 'Delete this music style?' : '¿Eliminar este estilo de música?')) return;

    try {
      const res = await fetch(`/api/styles/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (res.ok) {
        fetchStyles();
      }
    } catch (error) {
      console.error('Failed to delete style', error);
    }
  };

  // ── Studio: run the real pipeline (no credits spent, no order created) ──
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioForm.recipientName || !studioForm.style) return;
    setStudioLoading(true);
    setStudioError('');
    setStudioResult(null);
    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(studioForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      setStudioResult(data);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : 'Generation failed');
    }
    setStudioLoading(false);
  };

  // ── Users: search by email + adjust credits ──
  const handleUserSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setUsersLoading(true);
    setUsersSearched(true);
    try {
      const res = await fetch(`/api/admin/users?email=${encodeURIComponent(userQuery.trim())}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      setUserResults(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setUserResults([]);
    }
    setUsersLoading(false);
  };

  const adjustCredits = async (userId: string, action: 'add' | 'set', amount: number) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ userId, action, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      setUserResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, credits: data.credits, songs: data.songs } : u)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  };

  // Metrics
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const paidOrders = orders.filter((o) => o.status !== 'PENDING_PAYMENT');
  const revenueToday = paidOrders
    .filter((o) => new Date(o.createdAt) >= todayStart)
    .reduce((sum, o) => sum + o.price, 0);
  const revenueWeek = paidOrders
    .filter((o) => new Date(o.createdAt) >= weekStart)
    .reduce((sum, o) => sum + o.price, 0);
  const revenueMonth = paidOrders
    .filter((o) => new Date(o.createdAt) >= monthStart)
    .reduce((sum, o) => sum + o.price, 0);

  const isEn = t('hero.stats') === 'songs created';

  // Access control: show a spinner while auth resolves, block non-admins.
  if (authLoading) {
    return <div className="section text-center"><div className="spinner-lg" style={{ margin: '4rem auto' }} /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="section text-center" style={{ minHeight: '50vh' }}>
        <h1 className="heading-lg mb-md">🔒 {isEn ? 'Admins only' : 'Solo administradores'}</h1>
        <p className="body-md">{isEn ? 'Redirecting…' : 'Redirigiendo…'}</p>
      </div>
    );
  }

  const BreakdownCard = ({ title, items }: { title: string; items: { name: string; count: number }[] }) => {
    const max = Math.max(1, ...items.map((i) => i.count));
    return (
      <div className="card">
        <h3 className="heading-sm mb-lg">{title}</h3>
        {items.length === 0 ? (
          <p className="body-sm" style={{ color: 'var(--text-muted)' }}>{isEn ? 'No data yet' : 'Sin datos aún'}</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {items.map((it) => (
              <div key={it.name}>
                <div className="flex justify-between" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{it.name}</span>
                  <span style={{ fontWeight: 700 }}>{it.count}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-glass)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${(it.count / max) * 100}%`, height: '100%', background: 'var(--gradient-warm)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="section">
      <div className="container">
        <div className="animate-fade-in">
          
          <div className="flex justify-between items-center mb-xl" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <h1 className="heading-lg">{t('admin.title')}</h1>
            
            {/* Tab Toggler */}
            <div className="lang-switch">
              <button
                className={activeTab === 'orders' ? 'active' : ''}
                onClick={() => setActiveTab('orders')}
              >
                📦 {t('hero.stats') === 'songs created' ? 'Orders' : 'Pedidos'}
              </button>
              <button
                className={activeTab === 'styles' ? 'active' : ''}
                onClick={() => setActiveTab('styles')}
              >
                🎸 {t('hero.stats') === 'songs created' ? 'Music Styles' : 'Estilos'}
              </button>
              <button
                className={activeTab === 'traffic' ? 'active' : ''}
                onClick={() => setActiveTab('traffic')}
              >
                📊 {t('hero.stats') === 'songs created' ? 'Traffic' : 'Tráfico'}
              </button>
              <button
                className={activeTab === 'studio' ? 'active' : ''}
                onClick={() => setActiveTab('studio')}
              >
                🎤 {isEn ? 'Studio' : 'Estudio'}
              </button>
              <button
                className={activeTab === 'users' ? 'active' : ''}
                onClick={() => setActiveTab('users')}
              >
                👤 {isEn ? 'Users' : 'Usuarios'}
              </button>
              <button
                className={activeTab === 'quality' ? 'active' : ''}
                onClick={() => setActiveTab('quality')}
              >
                ⭐ {isEn ? 'Quality' : 'Calidad'}
                {ratings && ratings.total > 0 && (
                  <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.7 }}>{ratings.score}%</span>
                )}
              </button>
              <button
                className={activeTab === 'messages' ? 'active' : ''}
                onClick={() => setActiveTab('messages')}
              >
                ✉️ {isEn ? 'Messages' : 'Mensajes'}
                {unreadCount > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: '#F25F4C',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '0 6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: ORDERS DASHBOARD */}
          {activeTab === 'orders' && (
            <div>
              {/* Metrics Cards */}
              <div className="grid-3 mb-xl">
                <div className="card" style={{ background: 'var(--gradient-card)' }}>
                  <div className="body-sm mb-sm">{t('admin.revenue')}</div>
                  <div className="flex flex-col gap-sm">
                    <div className="flex justify-between items-center">
                      <span className="body-sm">{t('admin.today')}</span>
                      <span className="heading-md text-gradient">${revenueToday}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="body-sm">{t('admin.week')}</span>
                      <span className="heading-sm">${revenueWeek}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="body-sm">{t('admin.month')}</span>
                      <span className="heading-sm">${revenueMonth}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="body-sm mb-sm">{t('admin.orders')}</div>
                  <div className="heading-xl text-gradient">{paidOrders.length}</div>
                  <div className="body-sm mt-sm">
                    {orders.filter((o) => o.status === 'PAID').length} {t('hero.stats') === 'songs created' ? 'pending' : 'pendientes'}
                  </div>
                </div>

                <div className="card">
                  <div className="body-sm mb-sm">{t('admin.conversion')}</div>
                  <div className="heading-xl text-gradient">{orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0}%</div>
                  <div className="body-sm mt-sm">
                    {t('hero.stats') === 'songs created' ? 'preview → purchase' : 'preview → compra'}
                  </div>
                </div>
              </div>

              {/* Filter */}
              <div className="flex items-center justify-between mb-lg" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <h2 className="heading-md">{t('admin.orderList')}</h2>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  <button
                    className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setFilterStatus('all')}
                  >
                    {t('admin.allStatuses')} ({paidOrders.length})
                  </button>
                  {ALL_STATUSES.map((status) => (
                    <button
                      key={status}
                      className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setFilterStatus(status)}
                      style={{ color: filterStatus !== status ? STATUS_COLORS[status] : undefined }}
                    >
                      {t(`order.statuses.${status}`) || status} ({orders.filter((o) => o.status === status).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders Table */}
              {loadingOrders ? (
                <div className="text-center"><div className="spinner-lg" style={{ margin: '2rem auto' }} /></div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                        {['Date', 'Client', 'Recipient', 'Occasion', 'Style', 'Tier', 'Status', 'Actions'].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: 'var(--space-md)',
                              textAlign: 'left',
                              fontSize: '0.8rem',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => {
                        const matchedStyle = styles.find((s) => s.id === order.style);
                        return (
                          <tr
                            key={order.id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              transition: 'background var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            onClick={() => setSelectedOrder(order)}
                          >
                            <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem' }}>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                            <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem' }}>
                              {order.clientEmail}
                            </td>
                            <td style={{ padding: 'var(--space-md)', fontWeight: 600 }}>
                              {order.recipientName}
                            </td>
                            <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                              {order.occasion}
                            </td>
                            <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem' }}>
                              {matchedStyle?.icon} {matchedStyle?.nameEs || order.style}
                            </td>
                            <td style={{ padding: 'var(--space-md)' }}>
                              <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                                {order.tier}
                              </span>
                            </td>
                            <td style={{ padding: 'var(--space-md)' }}>
                              <span
                                className="badge"
                                style={{
                                  background: `${STATUS_COLORS[order.status]}20`,
                                  color: STATUS_COLORS[order.status],
                                  borderColor: `${STATUS_COLORS[order.status]}40`,
                                }}
                              >
                                {t(`order.statuses.${order.status}`) || order.status}
                              </span>
                            </td>
                            <td style={{ padding: 'var(--space-md)' }}>
                              <div className="flex gap-sm">
                                {order.status === 'PAID' && (
                                  <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateOrderStatus(order.id, 'IN_PRODUCTION');
                                    }}
                                  >
                                    🔨 {t('admin.markProduction')}
                                  </button>
                                )}
                                {(order.status === 'IN_PRODUCTION' || order.status === 'REVISION_REQUESTED') && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const dummyAudio = matchedStyle?.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                                      const dummyInst = order.tier === 'premium' ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' : undefined;
                                      updateOrderStatus(order.id, 'READY', dummyAudio, dummyInst);
                                    }}
                                  >
                                    ✅ {t('admin.deliver')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredOrders.length === 0 && (
                    <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
                      <p className="body-md">{t('hero.stats') === 'songs created' ? 'No orders found.' : 'No se encontraron pedidos.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MUSIC STYLES MANAGER */}
          {activeTab === 'styles' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>
              
              {/* List of Styles */}
              <div className="card">
                <h3 className="heading-md mb-lg">
                  🎸 {t('hero.stats') === 'songs created' ? 'Manage Custom Genres' : 'Gestionar Estilos'}
                </h3>
                
                {loadingStyles ? (
                  <div className="text-center"><div className="spinner" style={{ margin: '1rem auto' }} /></div>
                ) : (
                  <div className="flex flex-col gap-md">
                    {styles.map((style) => (
                      <div
                        key={style.id}
                        className="card card-flat"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-md)',
                          border: `1px solid ${style.color}40`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '1.8rem' }}>{style.icon}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {style.nameEs} <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>({style.nameEn})</span>
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <AudioPlayer variant="mini" src={style.audioUrl} showVisualizer />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-sm">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleEditStyle(style)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleDeleteStyle(style.id)}
                            style={{ color: 'var(--accent-secondary)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add/Edit Form Card */}
              <div className="card" style={{ background: 'var(--gradient-card)' }}>
                <h3 className="heading-sm mb-lg">
                  {editingStyle 
                    ? (t('hero.stats') === 'songs created' ? '✏️ Edit Reference Audio' : '✏️ Editar Audio de Referencia')
                    : (t('hero.stats') === 'songs created' ? '✨ Add Reference Audio' : '✨ Agregar Audio de Referencia')
                  }
                </h3>

                <form onSubmit={handleStyleSubmit} className="flex flex-col gap-md">
                  
                  {/* Style ID */}
                  <div className="input-group">
                    <label className="input-label">ID (slug)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. bachata-urbana"
                      value={styleForm.id}
                      onChange={(e) => setStyleForm((p) => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      required
                      disabled={!!editingStyle}
                    />
                  </div>

                  {/* Name ES */}
                  <div className="input-group">
                    <label className="input-label">Nombre (ES)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="ej. Bachata Dominicana"
                      value={styleForm.nameEs}
                      onChange={(e) => setStyleForm((p) => ({ ...p, nameEs: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Name EN */}
                  <div className="input-group">
                    <label className="input-label">Name (EN)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Dominican Bachata"
                      value={styleForm.nameEn}
                      onChange={(e) => setStyleForm((p) => ({ ...p, nameEn: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Icon & Color */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                      <label className="input-label">Emoji Icon</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="🎸"
                        value={styleForm.icon}
                        onChange={(e) => setStyleForm((p) => ({ ...p, icon: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Color Hex</label>
                      <input
                        type="color"
                        className="input-field"
                        style={{ height: '42px', padding: '3px' }}
                        value={styleForm.color}
                        onChange={(e) => setStyleForm((p) => ({ ...p, color: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Audio URL */}
                  <div className="input-group">
                    <label className="input-label">Reference Audio Link (MP3 URL)</label>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://example.com/song.mp3"
                      value={styleForm.audioUrl}
                      onChange={(e) => setStyleForm((p) => ({ ...p, audioUrl: e.target.value }))}
                      required
                    />
                    <span className="input-help">
                      {t('hero.stats') === 'songs created' 
                        ? 'Paste the direct MP3 link of the reference style you want to mimic.'
                        : 'Pega el enlace directo MP3 del audio de referencia que deseas imitar.'}
                    </span>
                  </div>

                  <div className="flex gap-sm mt-md">
                    <button type="submit" className="btn btn-primary flex-1">
                      {editingStyle ? t('common.save') : t('hero.stats') === 'songs created' ? 'Add Genre' : 'Agregar'}
                    </button>
                    {editingStyle && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingStyle(null);
                          setStyleForm({ id: '', nameEs: '', nameEn: '', icon: '🎵', color: '#FF8906', audioUrl: '' });
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                    )}
                  </div>
                </form>
              </div>

            </div>
          )}

          {/* TAB 3: TRAFFIC (server-side, ad-blocker-proof) */}
          {activeTab === 'traffic' && (
            <div className="animate-fade-in">
              {loadingAnalytics ? (
                <div className="text-center"><div className="spinner-lg" style={{ margin: '2rem auto' }} /></div>
              ) : analytics?.error === 'no_table' ? (
                <div className="card text-center" style={{ padding: 'var(--space-2xl)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📊</div>
                  <h3 className="heading-md mb-sm">{isEn ? 'Traffic tracking not set up yet' : 'Rastreo de tráfico aún no configurado'}</h3>
                  <p className="body-md">{isEn ? 'Run the page_views migration in Supabase (supabase-setup.sql → section 1d), then reload this page.' : 'Ejecuta la migración page_views en Supabase (supabase-setup.sql → sección 1d) y recarga esta página.'}</p>
                </div>
              ) : analytics ? (
                <>
                  <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
                    🛡️ {isEn ? 'Server-side counting — not affected by ad blockers.' : 'Conteo del lado del servidor — no afectado por bloqueadores.'}
                  </p>

                  {/* Metric cards */}
                  <div className="mb-xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
                    {[
                      { label: isEn ? 'Today' : 'Hoy', value: analytics.today, hi: true },
                      { label: isEn ? 'Last 7 days' : 'Últimos 7 días', value: analytics.week },
                      { label: isEn ? 'Last 30 days' : 'Últimos 30 días', value: analytics.month },
                      { label: isEn ? 'All time' : 'Total', value: analytics.total },
                    ].map((m, i) => (
                      <div key={i} className="card" style={{ background: m.hi ? 'var(--gradient-card)' : undefined }}>
                        <div className="body-sm mb-sm">{m.label}</div>
                        <div className="heading-xl text-gradient">{m.value}</div>
                        <div className="body-sm">{isEn ? 'visits' : 'visitas'}</div>
                      </div>
                    ))}
                  </div>

                  {/* 7-day bar chart */}
                  <div className="card mb-xl">
                    <h3 className="heading-sm mb-lg">{isEn ? 'Visits — last 7 days' : 'Visitas — últimos 7 días'}</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                      {analytics.series.map((d) => {
                        const max = Math.max(1, ...analytics.series.map((s) => s.count));
                        return (
                          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{d.count}</div>
                            <div style={{ width: '100%', height: `${(d.count / max) * 100}%`, minHeight: 4, background: 'var(--gradient-warm)', borderRadius: '6px 6px 0 0' }} />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Breakdowns */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)' }}>
                    <BreakdownCard title={isEn ? 'Top pages' : 'Páginas más vistas'} items={analytics.topPaths} />
                    <BreakdownCard title={isEn ? 'Countries' : 'Países'} items={analytics.topCountries} />
                    <BreakdownCard title={isEn ? 'Devices' : 'Dispositivos'} items={analytics.devices} />
                  </div>
                </>
              ) : (
                <div className="card text-center" style={{ padding: 'var(--space-2xl)' }}>{isEn ? 'Failed to load traffic.' : 'No se pudo cargar el tráfico.'}</div>
              )}
            </div>
          )}

          {/* TAB 4: TEST STUDIO (admin-only generation, no credits/order) */}
          {activeTab === 'studio' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-xl)', alignItems: 'start' }}>
              {/* Form */}
              <div className="card" style={{ background: 'var(--gradient-card)' }}>
                <h3 className="heading-md mb-sm">🎤 {isEn ? 'Test Studio' : 'Estudio de Pruebas'}</h3>
                <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
                  {isEn
                    ? 'Generate a real song (OpenAI lyrics + MiniMax) to audition quality. No credits spent, no order created.'
                    : 'Genera una canción real (letra OpenAI + MiniMax) para probar la calidad. No gasta créditos ni crea pedido.'}
                </p>
                <form onSubmit={handleGenerate} className="flex flex-col gap-md">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Recipient name' : 'Nombre del destinatario'}</label>
                      <input className="input-field" value={studioForm.recipientName} onChange={(e) => setStudioForm((p) => ({ ...p, recipientName: e.target.value }))} placeholder="María" required />
                    </div>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Relationship' : 'Relación'}</label>
                      <input className="input-field" value={studioForm.relation} onChange={(e) => setStudioForm((p) => ({ ...p, relation: e.target.value }))} placeholder={isEn ? 'her husband' : 'su esposo'} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Occasion' : 'Ocasión'}</label>
                      <select className="input-field" value={studioForm.occasion} onChange={(e) => setStudioForm((p) => ({ ...p, occasion: e.target.value }))}>
                        {STUDIO_OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Genre / style' : 'Género / estilo'}</label>
                      <select className="input-field" value={studioForm.style} onChange={(e) => setStudioForm((p) => ({ ...p, style: e.target.value }))}>
                        {Object.keys(STYLE_PROMPTS).map((sName) => <option key={sName} value={sName}>{sName}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Tone' : 'Tono'}</label>
                      <select className="input-field" value={studioForm.tone} onChange={(e) => setStudioForm((p) => ({ ...p, tone: e.target.value }))}>
                        {STUDIO_TONES.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Voice' : 'Voz'}</label>
                      <select className="input-field" value={studioForm.voiceGender} onChange={(e) => setStudioForm((p) => ({ ...p, voiceGender: e.target.value }))}>
                        <option value="female">{isEn ? 'Female' : 'Femenina'}</option>
                        <option value="male">{isEn ? 'Male' : 'Masculina'}</option>
                        <option value="duo">{isEn ? 'Female + Male' : 'Femenina + Masculina'}</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">{isEn ? 'Language' : 'Idioma'}</label>
                      <select className="input-field" value={studioForm.songLanguage} onChange={(e) => setStudioForm((p) => ({ ...p, songLanguage: e.target.value }))}>
                        <option value="es">ES</option>
                        <option value="en">EN</option>
                      </select>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">{isEn ? 'Anecdote / details' : 'Anécdota / detalles'}</label>
                    <textarea className="input-field" rows={2} value={studioForm.anecdote1} onChange={(e) => setStudioForm((p) => ({ ...p, anecdote1: e.target.value }))} placeholder={isEn ? 'They met in the rain in Cartagena…' : 'Se conocieron bajo la lluvia en Cartagena…'} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">{isEn ? 'Personal message' : 'Mensaje personal'}</label>
                    <textarea className="input-field" rows={2} value={studioForm.message} onChange={(e) => setStudioForm((p) => ({ ...p, message: e.target.value }))} />
                  </div>

                  <p className="body-sm" style={{ opacity: 0.7 }}>
                    {isEn
                      ? 'Renders the full song (about 2 min) — same pipeline as customers.'
                      : 'Genera la canción completa (unos 2 min) — el mismo proceso que los clientes.'}
                  </p>

                  <button type="submit" className="btn btn-primary" disabled={studioLoading}>
                    {studioLoading ? (isEn ? 'Generating…' : 'Generando…') : (isEn ? '🎶 Generate' : '🎶 Generar')}
                  </button>
                </form>
              </div>

              {/* Result */}
              <div className="card">
                <h3 className="heading-sm mb-lg">{isEn ? 'Result' : 'Resultado'}</h3>
                {studioLoading ? (
                  <div className="text-center" style={{ padding: 'var(--space-xl)' }}>
                    <div className="spinner-lg" style={{ margin: '0 auto var(--space-md)' }} />
                    <p className="body-sm" style={{ color: 'var(--text-muted)' }}>
                      {isEn ? 'Generating… full songs can take 1-2 minutes.' : 'Generando… una canción completa puede tardar 1-2 minutos.'}
                    </p>
                  </div>
                ) : studioError ? (
                  <div className="card card-flat" style={{ padding: 'var(--space-md)', color: 'var(--accent-secondary)' }}>
                    ⚠️ {studioError}
                  </div>
                ) : studioResult ? (
                  <div className="flex flex-col gap-md">
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{studioResult.title}</div>
                    <AudioPlayer src={studioResult.audioUrl} showVisualizer />
                    <a className="btn btn-ghost btn-sm" href={studioResult.audioUrl} download target="_blank" rel="noopener noreferrer">
                      ⬇️ {isEn ? 'Download MP3' : 'Descargar MP3'}
                    </a>
                    <div>
                      <div className="input-label mb-sm">{isEn ? 'Lyrics' : 'Letra'}</div>
                      <div className="card card-flat" style={{ padding: 'var(--space-md)', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', fontSize: '0.9rem' }}>
                        {studioResult.lyrics}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="body-sm" style={{ color: 'var(--text-muted)' }}>
                    {isEn ? 'Fill the form and generate to preview a song here.' : 'Completa el formulario y genera para escuchar una canción aquí.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: USERS & CREDITS */}
          {activeTab === 'users' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-lg" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <h2 className="heading-md">👤 {isEn ? 'Users & Credits' : 'Usuarios y Créditos'}</h2>
                <form onSubmit={handleUserSearch} className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  <input className="input-field" style={{ maxWidth: 300 }} placeholder={isEn ? 'Search by email…' : 'Buscar por email…'} value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                  <button type="submit" className="btn btn-primary" disabled={usersLoading}>
                    {usersLoading ? (isEn ? 'Searching…' : 'Buscando…') : (isEn ? 'Search' : 'Buscar')}
                  </button>
                </form>
              </div>

              <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
                {isEn
                  ? `Balances are in credits — 1 song = ${CREDITS.perSong} credits. Leave the search empty to list recent accounts.`
                  : `Los saldos están en créditos — 1 canción = ${CREDITS.perSong} créditos. Deja la búsqueda vacía para listar cuentas recientes.`}
              </p>

              {usersLoading ? (
                <div className="text-center"><div className="spinner-lg" style={{ margin: '2rem auto' }} /></div>
              ) : userResults.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                        {['Email', isEn ? 'Songs' : 'Canciones', isEn ? 'Credits' : 'Créditos', isEn ? 'Grant credits' : 'Otorgar créditos'].map((h) => (
                          <th key={h} style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {userResults.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem' }}>{u.email}</td>
                          <td style={{ padding: 'var(--space-md)', fontWeight: 700 }}>{u.songs} 🎵</td>
                          <td style={{ padding: 'var(--space-md)' }}>{u.credits}</td>
                          <td style={{ padding: 'var(--space-md)' }}>
                            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => adjustCredits(u.id, 'add', CREDITS.perSong)}>+1 🎵</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => adjustCredits(u.id, 'add', 3 * CREDITS.perSong)}>+3</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => adjustCredits(u.id, 'add', 10 * CREDITS.perSong)}>+10</button>
                              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--accent-secondary)' }} onClick={() => adjustCredits(u.id, 'add', -CREDITS.perSong)}>−1</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => {
                                const v = window.prompt(isEn ? 'Set exact credit balance:' : 'Establecer saldo exacto de créditos:', String(u.credits));
                                if (v != null && v.trim() !== '' && Number.isFinite(Number(v))) adjustCredits(u.id, 'set', Number(v));
                              }}>{isEn ? 'Set…' : 'Fijar…'}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : usersSearched ? (
                <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
                  <p className="body-md">{isEn ? 'No users found.' : 'No se encontraron usuarios.'}</p>
                </div>
              ) : (
                <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
                  <p className="body-md" style={{ color: 'var(--text-muted)' }}>{isEn ? 'Search for a customer to manage their credits.' : 'Busca un cliente para gestionar sus créditos.'}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SONG QUALITY (customer thumbs up/down) */}
          {activeTab === 'quality' && (
            <div className="animate-fade-in">
              <h2 className="heading-md mb-lg">⭐ {isEn ? 'Song quality' : 'Calidad de las canciones'}</h2>

              {/* Curate the public landing-page showcase. A customer liking
                  their song is NOT permission to publish it — these contain
                  real names and memories — so featuring is an explicit choice. */}
              {ratings?.loved && ratings.loved.length > 0 && (
                <div className="card mb-xl">
                  <h3 className="heading-sm mb-sm">
                    👍 {isEn ? 'Loved songs — pick what shows on the landing page' : 'Canciones que gustaron — elige cuales salen en la portada'}
                  </h3>
                  <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
                    {isEn
                      ? 'Featured songs are the only ones served publicly; everything else stays behind the paywall. The showcase shows style and occasion only — never the recipient name or the lyrics.'
                      : 'Las destacadas son las unicas que se sirven publicamente; el resto queda tras el muro de pago. La portada muestra solo estilo y ocasion — nunca el nombre ni la letra.'}
                  </p>
                  <div className="flex flex-col gap-sm">
                    {ratings.loved.map((s) => (
                      <div key={s.id} className="flex items-center justify-between" style={{ gap: 'var(--space-md)', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <span className="body-sm">{s.occasion || '—'} · {s.style || '—'}</span>{' '}
                          <span className="body-sm" style={{ color: 'var(--text-muted)' }}>
                            {new Date(s.createdAt).toLocaleDateString(isEn ? 'en-US' : 'es-ES')}
                          </span>
                        </div>
                        <div className="flex items-center gap-sm">
                          {s.audioUrl && <audio controls preload="none" src={s.audioUrl} style={{ height: 32, maxWidth: 220 }} />}
                          <button
                            className={`btn btn-sm ${s.featured ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={async () => {
                              await fetch(`/api/admin/ratings/${s.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                                body: JSON.stringify({ featured: !s.featured }),
                              });
                              fetchRatings();
                            }}
                          >
                            {s.featured ? (isEn ? '★ Featured' : '★ Destacada') : (isEn ? '☆ Feature' : '☆ Destacar')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadingRatings ? (
                <div className="text-center"><div className="spinner-lg" style={{ margin: '2rem auto' }} /></div>
              ) : !ratings || ratings.total === 0 ? (
                <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
                  <p className="body-md" style={{ color: 'var(--text-muted)' }}>
                    {ratings?.error === 'no_table'
                      ? (isEn ? 'Run the song_ratings section of supabase-setup.sql to start collecting.' : 'Ejecuta la seccion song_ratings de supabase-setup.sql para empezar a recoger datos.')
                      : (isEn ? 'No ratings yet. They appear as soon as customers rate a song.' : 'Aun no hay valoraciones. Apareceran en cuanto los clientes valoren una cancion.')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid-3 mb-xl">
                    <div className="card" style={{ background: 'var(--gradient-card)' }}>
                      <div className="body-sm mb-sm">{isEn ? 'Satisfaction' : 'Satisfaccion'}</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: ratings.score >= 70 ? '#2CB67D' : ratings.score >= 50 ? '#FF8906' : '#F25F4C' }}>
                        {ratings.score}%
                      </div>
                    </div>
                    <div className="card">
                      <div className="body-sm mb-sm">👍 {isEn ? 'Loved it' : 'Les encanto'}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 700 }}>{ratings.up}</div>
                    </div>
                    <div className="card">
                      <div className="body-sm mb-sm">👎 {isEn ? 'Not great' : 'No les convencio'}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 700 }}>{ratings.down}</div>
                    </div>
                  </div>

                  {ratings.total < 20 && (
                    <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
                      ⚠️ {isEn
                        ? `Only ${ratings.total} rating(s) so far — too few to draw conclusions from. Treat the breakdowns below as hints, not verdicts, until you pass ~20.`
                        : `Solo ${ratings.total} valoracion(es) por ahora — muy pocas para sacar conclusiones. Toma los desgloses de abajo como pistas, no como veredictos, hasta pasar de ~20.`}
                    </p>
                  )}

                  <div className="grid-2" style={{ gap: 'var(--space-lg)' }}>
                    {([
                      [isEn ? 'By style' : 'Por estilo', ratings.byStyle],
                      [isEn ? 'By voice' : 'Por voz', ratings.byVoice],
                      [isEn ? 'By tone' : 'Por tono', ratings.byTone],
                      [isEn ? 'By occasion' : 'Por ocasion', ratings.byOccasion],
                    ] as [string, Breakdown[]][]).map(([label, rows]) => (
                      <div key={label} className="card">
                        <h3 className="heading-sm mb-md">{label}</h3>
                        {rows.length === 0 ? (
                          <p className="body-sm" style={{ color: 'var(--text-muted)' }}>—</p>
                        ) : (
                          <div className="flex flex-col gap-sm">
                            {rows.map((r) => (
                              <div key={r.name}>
                                <div className="flex justify-between" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{r.name}</span>
                                  <span style={{ fontWeight: 700 }}>
                                    {r.score}% <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({r.total})</span>
                                  </span>
                                </div>
                                <div style={{ height: 6, background: 'var(--bg-glass)', borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${r.score}%`,
                                    height: '100%',
                                    background: r.score >= 70 ? '#2CB67D' : r.score >= 50 ? '#FF8906' : '#F25F4C',
                                  }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 7: CONTACT MESSAGES */}
          {activeTab === 'messages' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-lg" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <h2 className="heading-md">✉️ {isEn ? 'Contact messages' : 'Mensajes de contacto'}</h2>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {['all', 'new', 'read', 'replied', 'archived'].map((s) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${messageFilter === s ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setMessageFilter(s)}
                    >
                      {isEn
                        ? s[0].toUpperCase() + s.slice(1)
                        : { all: 'Todos', new: 'Nuevos', read: 'Leídos', replied: 'Respondidos', archived: 'Archivados' }[s]}
                    </button>
                  ))}
                </div>
              </div>

              <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>
                {isEn
                  ? 'Sent from the "Contact us" form in the footer. Reply opens your own mail app with the message quoted.'
                  : 'Enviados desde el formulario "Contáctanos" del pie de página. Responder abre tu app de correo con el mensaje citado.'}
              </p>

              {loadingMessages ? (
                <div className="text-center"><div className="spinner-lg" style={{ margin: '2rem auto' }} /></div>
              ) : messages.length === 0 ? (
                <div className="text-center" style={{ padding: 'var(--space-2xl)' }}>
                  <p className="body-md" style={{ color: 'var(--text-muted)' }}>
                    {isEn ? 'No messages yet.' : 'Aún no hay mensajes.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-md">
                  {messages.map((m) => (
                    <div key={m.id} className="card">
                      <div className="flex justify-between items-center mb-sm" style={{ flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                        <div style={{ minWidth: 0 }}>
                          <strong>{m.name}</strong>{' '}
                          <a href={`mailto:${m.email}`} className="body-sm">{m.email}</a>
                        </div>
                        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: CONTACT_STATUS_COLORS[m.status] || '#888',
                              color: '#fff',
                              borderRadius: 999,
                              padding: '2px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {m.status}
                          </span>
                          <span className="body-sm" style={{ color: 'var(--text-muted)' }}>
                            {new Date(m.createdAt).toLocaleString(isEn ? 'en-US' : 'es-ES')}
                          </span>
                        </div>
                      </div>

                      <div className="body-sm mb-sm" style={{ color: 'var(--text-muted)' }}>
                        {CONTACT_SUBJECT_LABELS[m.subject]?.[isEn ? 'en' : 'es'] || m.subject}
                        {m.userId && ` · ${isEn ? 'registered customer' : 'cliente registrado'}`}
                        {m.locale && ` · ${m.locale.toUpperCase()}`}
                      </div>

                      <p className="body-md" style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--space-md)' }}>
                        {m.message}
                      </p>

                      <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                        <a
                          className="btn btn-sm btn-primary"
                          href={replyHref(m)}
                          onClick={() => updateMessage(m.id, { status: 'replied' })}
                        >
                          ↩️ {isEn ? 'Reply' : 'Responder'}
                        </a>
                        {m.status === 'new' && (
                          <button className="btn btn-sm btn-ghost" onClick={() => updateMessage(m.id, { status: 'read' })}>
                            {isEn ? 'Mark read' : 'Marcar leído'}
                          </button>
                        )}
                        {m.status !== 'archived' && (
                          <button className="btn btn-sm btn-ghost" onClick={() => updateMessage(m.id, { status: 'archived' })}>
                            {isEn ? 'Archive' : 'Archivar'}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            const v = window.prompt(isEn ? 'Private note:' : 'Nota privada:', m.adminNote || '');
                            if (v != null) updateMessage(m.id, { adminNote: v });
                          }}
                        >
                          📝 {isEn ? 'Note' : 'Nota'}
                        </button>
                      </div>

                      {m.adminNote && (
                        <p className="body-sm" style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          📝 {m.adminNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Order Detail Modal */}
          {selectedOrder && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                padding: 'var(--space-lg)',
              }}
              onClick={() => setSelectedOrder(null)}
            >
              <div
                className="card"
                style={{
                  maxWidth: 600,
                  width: '100%',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  background: 'var(--bg-secondary)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-lg">
                  <h3 className="heading-md">
                    {t('admin.viewDetails')} — {selectedOrder.recipientName}
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-md mb-xl">
                  {[
                    { label: 'Email', value: selectedOrder.clientEmail },
                    { label: 'Recipient', value: selectedOrder.recipientName },
                    { label: 'Relation', value: selectedOrder.relation },
                    { label: 'Occasion', value: selectedOrder.occasion },
                    { label: 'Style', value: selectedOrder.style },
                    { label: 'Tier', value: selectedOrder.tier },
                    { label: 'Price', value: `$${selectedOrder.price}` },
                    { label: 'Tone', value: selectedOrder.tone },
                    { label: 'Status', value: selectedOrder.status },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                      <span className="body-sm">{item.label}</span>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Anecdotes & Message */}
                <div className="mb-lg">
                  <h4 className="heading-sm mb-sm">{t('hero.stats') === 'songs created' ? 'Anecdotes' : 'Anécdotas'}</h4>
                  <div className="card card-flat" style={{ padding: 'var(--space-md)', whiteSpace: 'pre-wrap' }}>
                    {(() => {
                      try {
                        return JSON.parse(selectedOrder.anecdotes).join('\n\n');
                      } catch {
                        return selectedOrder.anecdotes;
                      }
                    })()}
                  </div>
                </div>

                <div className="mb-lg">
                  <h4 className="heading-sm mb-sm">{t('hero.stats') === 'songs created' ? 'Special Message' : 'Mensaje Especial'}</h4>
                  <div className="card card-flat" style={{ padding: 'var(--space-md)' }}>
                    {selectedOrder.message}
                  </div>
                </div>

                {/* Revisions */}
                {selectedOrder.revisions.length > 0 && (
                  <div className="mb-lg">
                    <h4 className="heading-sm mb-sm">{t('hero.stats') === 'songs created' ? 'Revision Requests' : 'Solicitudes de Revisión'}</h4>
                    {selectedOrder.revisions.map((rev) => (
                      <div key={rev.id} className="card card-flat mb-sm" style={{ padding: 'var(--space-md)' }}>
                        <p className="body-sm" style={{ color: 'var(--text-muted)' }}>
                          {new Date(rev.createdAt).toLocaleString()}
                        </p>
                        <p className="body-md mt-sm">{rev.notes}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                  {selectedOrder.status === 'PAID' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => updateOrderStatus(selectedOrder.id, 'IN_PRODUCTION')}
                    >
                      🔨 {t('admin.markProduction')}
                    </button>
                  )}
                  {(selectedOrder.status === 'IN_PRODUCTION' || selectedOrder.status === 'REVISION_REQUESTED') && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const dummyAudio = styles.find((s) => s.id === selectedOrder.style)?.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                        const dummyInst = selectedOrder.tier === 'premium' ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' : undefined;
                        updateOrderStatus(selectedOrder.id, 'READY', dummyAudio, dummyInst);
                      }}
                    >
                      ✅ {t('admin.deliver')}
                    </button>
                  )}
                  {selectedOrder.status === 'READY' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => updateOrderStatus(selectedOrder.id, 'DELIVERED')}
                    >
                      📦 {t('hero.stats') === 'songs created' ? 'Mark Delivered' : 'Marcar Entregado'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
