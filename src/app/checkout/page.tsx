'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { authHeaders } from '@/lib/authClient';
import { CREDITS } from '@/lib/constants';

interface OrderData {
  recipientName: string;
  relation: string;
  anecdote1: string;
  anecdote2: string;
  message: string;
  tone: string;
  songLanguage: string;
  voiceGender: string;
  occasion: string;
  style: string;
  tier: string;
  audioUrl?: string;
}

export default function CheckoutPage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEn = t('nav.login') === 'Log in';

  // Require sign-in (the brief is created before this step).
  useEffect(() => {
    if (!loading && !user) router.push('/signin?mode=signin');
  }, [loading, user, router]);

  useEffect(() => {
    const stored = sessionStorage.getItem('ct-order');
    if (stored) setOrderData(JSON.parse(stored));
  }, []);

  // Load the current credit balance.
  const refreshCredits = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await fetch('/api/credits', { headers: await authHeaders() });
      const d = await r.json();
      setCredits(typeof d.credits === 'number' ? d.credits : 0);
    } catch {
      setCredits(0);
    }
  }, [user]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  // Create the order (once) and return its id.
  const createOrder = async (): Promise<string | null> => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        ...orderData,
        tier: 'credit',
        price: 2,
      }),
    });
    const data = await res.json();
    return data?.id || null;
  };

  // Spend 1 credit to finalize -> dashboard.
  const finalize = async (orderId: string): Promise<boolean> => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ orderId }),
    });
    if (res.status === 402) {
      const d = await res.json();
      setCredits(typeof d.credits === 'number' ? d.credits : 0);
      return false;
    }
    return res.ok;
  };

  // Path A: user has credits -> unlock immediately.
  const handleUseCredit = async () => {
    setError(null);
    setIsProcessing(true);
    try {
      const orderId = await createOrder();
      if (!orderId) throw new Error('order');
      const ok = await finalize(orderId);
      if (!ok) throw new Error('no_credits');
      sessionStorage.removeItem('ct-order');
      router.push('/dashboard?paid=1');
    } catch {
      setError(isEn ? 'Something went wrong. Please try again.' : 'Algo salió mal. Inténtalo de nuevo.');
      setIsProcessing(false);
    }
  };

  // Path B: user needs credits -> pay via Moneroo hosted checkout.
  // The pending order stays in sessionStorage; the callback returns here to finalize.
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    try {
      const pack = CREDITS.packs.find((p) => p.credits === quantity) || CREDITS.packs[0];
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          packId: pack.id,
          name: user?.user_metadata?.full_name || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'pay');
      window.location.href = data.checkoutUrl;
    } catch {
      setError(isEn ? 'Payment could not start. Please try again.' : 'No se pudo iniciar el pago. Inténtalo de nuevo.');
      setIsProcessing(false);
    }
  };

  if (loading || !user || credits === null) {
    return (
      <div className="section text-center">
        <div className="spinner-lg" style={{ margin: '4rem auto' }} />
      </div>
    );
  }

  const hasCredits = credits >= CREDITS.perSong;
  const selectedPack = CREDITS.packs.find((p) => p.credits === quantity) || CREDITS.packs[0];
  const total = selectedPack.price;

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="animate-fade-in-up">
          <div className="text-center mb-xl">
            <h1 className="heading-lg mb-md">{t('checkout.title')}</h1>
            <p className="body-lg">{t('checkout.subtitle')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', maxWidth: 800, margin: '0 auto' }} className="checkout-grid">
            {/* Order summary */}
            <div className="card" style={{ background: 'var(--gradient-card)' }}>
              <h3 className="heading-sm mb-lg">{t('checkout.orderSummary')}</h3>
              <div className="flex flex-col gap-md">
                <div className="flex justify-between">
                  <span className="body-sm">{isEn ? 'Recipient' : 'Destinatario'}</span>
                  <span style={{ fontWeight: 600 }}>{orderData?.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="body-sm">{isEn ? 'Style' : 'Estilo'}</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{orderData?.style}</span>
                </div>
                <div className="flex justify-between">
                  <span className="body-sm">{isEn ? 'Cost' : 'Costo'}</span>
                  <span style={{ fontWeight: 600 }}>{CREDITS.perSong} {t('credits.credits')}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-sm)' }} className="flex justify-between items-center">
                  <span style={{ fontWeight: 700 }}>{t('credits.yourBalance')}</span>
                  <span className="text-gradient" style={{ fontWeight: 900, fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>
                    {credits} 🎵
                  </span>
                </div>
              </div>
            </div>

            {/* Action: use a credit OR buy credits */}
            {hasCredits ? (
              <div className="card">
                <h3 className="heading-sm mb-md">✨ {t('credits.readyTitle')}</h3>
                <p className="body-md mb-lg">{t('credits.readyBody', { count: String(credits) })}</p>
                {error && <p className="body-sm mb-md" style={{ color: '#F25F4C' }}>⚠️ {error}</p>}
                <button className="btn btn-primary btn-lg w-full" onClick={handleUseCredit} disabled={isProcessing}>
                  {isProcessing
                    ? (isEn ? 'Unlocking...' : 'Desbloqueando...')
                    : `${t('credits.useOneCredit')} · ${CREDITS.perSong} 🎵`}
                </button>
              </div>
            ) : (
              <form className="card" onSubmit={handlePay}>
                <h3 className="heading-sm mb-sm">💳 {t('credits.buyTitle')}</h3>
                <p className="body-sm mb-lg" style={{ color: 'var(--text-muted)' }}>{t('credits.buySubtitle')}</p>

                <div className="input-group">
                  <label className="input-label" style={{ marginBottom: '0.5rem' }}>
                    {isEn ? 'Select a Credit Pack' : 'Selecciona un paquete de créditos'}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-md)' }}>
                    {CREDITS.packs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`btn ${quantity === p.credits ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          flex: 1,
                          padding: '0.75rem var(--space-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.25rem',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setQuantity(p.credits)}
                      >
                        <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{p.credits} 🎵</span>
                        <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>${p.price}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="body-sm mb-md" style={{ color: '#F25F4C' }}>⚠️ {error}</p>}
                <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isProcessing}>
                  {isProcessing ? t('checkout.processing') : `${t('credits.payAndUnlock')} · $${total}`}
                </button>
                <p className="body-sm text-center mt-md" style={{ opacity: 0.6 }}>🔒 {t('payment.redirectNote')}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
