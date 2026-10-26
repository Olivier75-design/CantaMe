'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { authHeaders } from '@/lib/authClient';

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
    (async () => {
      try {
        const d = await fetch(`/api/payments/verify?paymentId=${encodeURIComponent(paymentId)}`).then((r) => r.json());
        if (d.status !== 'success') { setPhase('failed'); return; }
        // Bought to unlock a specific song: spend the new credits on it now, so
        // the customer lands on a song they can play. (This used to route back
        // to /checkout, whose "use a credit" path billed an empty duplicate.)
        const unlockId = sessionStorage.getItem('ct-unlock');
        if (unlockId) {
          await fetch(`/api/orders/${encodeURIComponent(unlockId)}/unlock`, {
            method: 'POST',
            headers: await authHeaders(),
          }).catch(() => null);
          sessionStorage.removeItem('ct-unlock');
        }
        sessionStorage.removeItem('ct-order');
        setPhase('success');
        setTimeout(() => router.push('/dashboard?paid=1'), 1400);
      } catch {
        setPhase('failed');
      }
    })();
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
