import { NextRequest, NextResponse } from 'next/server';
import { creditForPayment } from '@/lib/moneroo';

export const runtime = 'nodejs';

// Called by the callback page after the Moneroo redirect.
// Verifies with Moneroo and credits (idempotent) if the payment succeeded.
export async function GET(request: NextRequest) {
  try {
    const paymentId = new URL(request.url).searchParams.get('paymentId');
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });

    const result = await creditForPayment(paymentId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Verify failed';
    console.error('payments/verify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
