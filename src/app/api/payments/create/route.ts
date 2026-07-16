import { NextRequest, NextResponse } from 'next/server';
import { initializePayment, MONEROO_CURRENCY } from '@/lib/moneroo';
import { getSupabaseServer } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/admin';
import { CREDITS } from '@/lib/constants';
import { applyPromo } from '@/lib/promo';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Start a Moneroo hosted-checkout to buy a credit pack. Identity is taken from
// the session; the pack (price + credits) is resolved server-side from packId.
// An optional promo code discounts the PRICE only (credits granted are unchanged).
// Body: { packId, name, promoCode? } -> { checkoutUrl }
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await rateLimit(`pay:${user.id}`, 10, 60))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const userId = user.id;
    const email = user.email || '';
    const { packId, name, promoCode } = await request.json();

    // Price + credits are resolved server-side from the pack id (never trust the client).
    const pack = CREDITS.packs.find((p) => p.id === packId) || CREDITS.packs[0];
    // Recompute the discount server-side — the client value is display-only.
    const promo = applyPromo(pack.price, promoCode);

    const parts = String(name || '').trim().split(/\s+/);
    const firstName = parts[0] || 'CantaMe';
    const lastName = parts.slice(1).join(' ') || 'Cliente';
    const origin = new URL(request.url).origin;

    // NOTE: `amount` is sent in the currency's main unit (e.g. 5 = $5). If the
    // Moneroo sandbox shows the wrong amount, switch to minor units (× 100).
    const { id, checkoutUrl } = await initializePayment({
      amount: promo.finalPrice,
      currency: MONEROO_CURRENCY,
      description: `CantaMe · ${pack.credits} credits${promo.code ? ` (${promo.code})` : ''}`,
      customer: { email, first_name: firstName, last_name: lastName },
      return_url: `${origin}/payments/callback`,
      metadata: {
        userId,
        credits: pack.credits,
        packId: pack.id,
        basePrice: pack.price,
        amount: promo.finalPrice,
        promoCode: promo.code,
        influencer: promo.influencer,
      },
    });

    // Record a pending payment so crediting is reliable + idempotent. The promo/
    // amount columns are optional: if the migration hasn't been applied we fall
    // back to a core insert so crediting still works.
    const supabase = getSupabaseServer();
    const core = { id, user_id: userId, credits: pack.credits, status: 'pending' };
    const { error } = await supabase.from('payments').insert({
      ...core,
      amount: promo.finalPrice,
      promo_code: promo.code,
      influencer: promo.influencer,
    });
    if (error) {
      const retry = await supabase.from('payments').insert(core);
      if (retry.error) console.error('payments insert failed:', retry.error.message);
      else console.warn('payments: promo/amount columns missing — apply the migration to track them.');
    }

    return NextResponse.json({ checkoutUrl, paymentId: id });
  } catch (e) {
    // Log the real cause server-side; return a generic message to the client.
    const msg = e instanceof Error ? e.message : 'Payment init failed';
    console.error('payments/create error:', msg);
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 500 });
  }
}
