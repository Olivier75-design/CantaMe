'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

type Phase = 'checking' | 'success' | 'failed';

export default function PaymentCallbackPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('paymentId');
    const status = params.get('paymentStatus');

    if (!paymentId || status === 'failed' || status === 'cancelled') {
      setPhase('failed');
      return;
    }

    // Confirm server-side (idempotent) then send the user to their dashboard.
    fetch(`/api/payments/verify?paymentId=${encodeURIComponent(paymentId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'success') {
          setPhase('success');
          // If a song order is pending, return to checkout to finalize it with
          // the freshly-bought credits; otherwise it was a standalone top-up.
          const pending = sessionStorage.getItem('ct-order');
          setTimeout(() => router.push(pending ? '/checkout' : '/dashboard?paid=1'), 1400);
        } else {
          setPhase('failed');
        }
      })
      .catch(() => setPhase('failed'));
  }, [router]);

  return (
    <div className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="container container-narrow text-center">
        {phase === 'checking' && (
          <>
            <div className="spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
            <h1 className="heading-md">{t('payment.checking')}</h1>
          </>
        )}
        {phase === 'success' && (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-md)' }}>✅</div>
            <h1 className="heading-lg mb-md">{t('payment.success')}</h1>
            <p className="body-md">{t('payment.redirecting')}</p>
          </>
        )}
        {phase === 'failed' && (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-md)' }}>⚠️</div>
            <h1 className="heading-lg mb-md">{t('payment.failed')}</h1>
            <p className="body-md mb-lg">{t('payment.failedBody')}</p>
            <Link href="/dashboard" className="btn btn-primary">{t('payment.backDashboard')}</Link>
          </>
        )}
      </div>
    </div>
  );
}
