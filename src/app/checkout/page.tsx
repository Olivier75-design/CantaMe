'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TIERS } from '@/lib/constants';

interface OrderData {
  recipientName: string;
  relation: string;
  anecdote1: string;
  anecdote2: string;
  message: string;
  tone: string;
  songLanguage: string;
  occasion: string;
  style: string;
  tier: string;
}

export default function CheckoutPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('ct-order');
    if (stored) {
      setOrderData(JSON.parse(stored));
    }
    // Prefill the email from Supabase Auth
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const tierKey = (orderData?.tier || 'basica') as keyof typeof TIERS;
  const tierInfo = TIERS[tierKey];

  const tierNames: Record<string, string> = {
    basica: t('preview.basicaTitle'),
    especial: t('preview.especialTitle'),
    premium: t('preview.premiumTitle'),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !cardNumber || !expiry || !cvc) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderData,
          clientEmail: email,
          userId: user?.id || null,
          price: tierInfo.price,
        }),
      });

      const data = await response.json();

      if (data.id) {
        // Simulate checkout processing
        await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.id }),
        });

        sessionStorage.removeItem('ct-order');
        // Send the buyer straight into their dashboard, which now groups
        // everything (new song, downloads, past orders, settings).
        router.push('/dashboard?paid=1');
      }
    } catch {
      setIsProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 16);
    return v.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) return `${v.slice(0, 2)}/${v.slice(2)}`;
    return v;
  };

  return (
    <div className="section">
      <div className="container container-narrow">
        <div className="animate-fade-in-up">
          <div className="text-center mb-xl">
            <h1 className="heading-lg mb-md">{t('checkout.title')}</h1>
            <p className="body-lg">{t('checkout.subtitle')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', maxWidth: 800, margin: '0 auto' }}>
            {/* Order Summary */}
            <div className="card" style={{ background: 'var(--gradient-card)' }}>
              <h3 className="heading-sm mb-lg">{t('checkout.orderSummary')}</h3>

              <div className="flex flex-col gap-md">
                <div className="flex justify-between">
                  <span className="body-sm">{t('hero.stats') === 'songs created' ? 'Plan' : 'Plan'}</span>
                  <span style={{ fontWeight: 600 }}>{tierNames[tierKey]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="body-sm">{t('hero.stats') === 'songs created' ? 'Recipient' : 'Destinatario'}</span>
                  <span style={{ fontWeight: 600 }}>{orderData?.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="body-sm">{t('hero.stats') === 'songs created' ? 'Style' : 'Estilo'}</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{orderData?.style}</span>
                </div>
                <div className="flex justify-between">
                  <span className="body-sm">{t('hero.stats') === 'songs created' ? 'Delivery' : 'Entrega'}</span>
                  <span style={{ fontWeight: 600 }}>{tierInfo.delivery}</span>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: 'var(--space-md)',
                    marginTop: 'var(--space-sm)',
                  }}
                  className="flex justify-between"
                >
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total</span>
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: '1.5rem',
                      fontFamily: 'var(--font-display)',
                    }}
                    className="text-gradient"
                  >
                    ${tierInfo.price}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleSubmit} className="card">
              <div className="flex flex-col gap-lg">
                <div className="input-group">
                  <label className="input-label">{t('checkout.email')}</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder={t('checkout.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <span className="input-help">{t('checkout.emailHelp')}</span>
                </div>

                <div className="input-group">
                  <label className="input-label">{t('checkout.cardNumber')}</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    required
                    maxLength={19}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="input-group">
                    <label className="input-label">{t('checkout.expiry')}</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      required
                      maxLength={5}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">{t('checkout.cvc')}</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="123"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      required
                      maxLength={4}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-sm">
                      <span className="spinner" /> {t('checkout.processing')}
                    </span>
                  ) : (
                    `${t('checkout.payNow')} · $${tierInfo.price}`
                  )}
                </button>

                <p className="body-sm text-center" style={{ opacity: 0.6 }}>
                  🔒 {t('checkout.secure')}
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
