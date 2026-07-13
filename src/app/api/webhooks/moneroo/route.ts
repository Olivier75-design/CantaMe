import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { creditForPayment } from '@/lib/moneroo';

export const runtime = 'nodejs';

const WEBHOOK_SECRET = process.env.MONEROO_WEBHOOK_SECRET;

// Moneroo -> our server. The reliable path for crediting (fires even if the
// user closes the tab before the redirect). Signature: X-Moneroo-Signature =
// HMAC-SHA256(rawBody, WEBHOOK_SECRET). Metadata isn't in the payload, so we
// re-fetch via verify inside creditForPayment.
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();

    if (WEBHOOK_SECRET) {
      const sig = request.headers.get('x-moneroo-signature') || '';
      const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
      const ok = sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      if (!ok) {
        console.warn('Moneroo webhook: bad signature');
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(raw || '{}');
    if (body?.event === 'payment.success' && body?.data?.id) {
      await creditForPayment(String(body.data.id));
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('moneroo webhook error:', e);
    return NextResponse.json({ error: 'webhook error' }, { status: 500 });
  }
}
