'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
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
  const [activeTab, setActiveTab] = useState<'orders' | 'styles'>('orders');

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

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    }
    setLoadingOrders(false);
  }, []);

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

  useEffect(() => {
    fetchOrders();
    fetchStyles();
  }, [fetchOrders, fetchStyles]);

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  const updateOrderStatus = async (orderId: string, status: string, audioUrl?: string, instrumentalUrl?: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(styleForm),
        });
        if (res.ok) {
          setEditingStyle(null);
        }
      } else {
        // Add Style
        await fetch('/api/styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      });
      if (res.ok) {
        fetchStyles();
      }
    } catch (error) {
      console.error('Failed to delete style', error);
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
