import { NextRequest, NextResponse } from 'next/server';
import { creditForPayment } from '@/lib/moneroo';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Called by the callback page after the Moneroo redirect.
// Verifies with Moneroo and credits (idempotent) if the payment succeeded.
// Public (the redirect carries no token), so it is IP-limited: every call is a
// round trip to Moneroo's API on our key.
export async function GET(request: NextRequest) {
  try {
    if (!(await rateLimit(`payverify:${clientIp(request)}`, 20, 60))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const paymentId = new URL(request.url).searchParams.get('paymentId');
    if (!paymentId || paymentId.length > 100) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });

    const result = await creditForPayment(paymentId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Verify failed';
    console.error('payments/verify error:', msg);
    return NextResponse.json({ error: 'Verify failed' }, { status: 500 });
  }
}
