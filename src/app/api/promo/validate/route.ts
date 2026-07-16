import { NextRequest, NextResponse } from 'next/server';
import { resolvePromo } from '@/lib/promo';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Validate a promo code for display (so the checkout can show the discounted
// price before redirecting to payment). The authoritative discount is always
// recomputed server-side in /api/payments/create — this is display only.
// Body: { code } -> { valid, percentOff }
export async function POST(request: NextRequest) {
  try {
    // Throttle to stop brute-force enumeration of codes.
    if (!(await rateLimit(`promo:${clientIp(request)}`, 20, 60))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again shortly.' }, { status: 429 });
    }

    const { code } = await request.json();
    const promo = resolvePromo(code);
    if (!promo) return NextResponse.json({ valid: false });

    return NextResponse.json({ valid: true, percentOff: promo.percentOff, code: promo.code.toUpperCase() });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
