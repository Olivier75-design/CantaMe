import { NextRequest, NextResponse } from 'next/server';
import { initializePayment, MONEROO_CURRENCY } from '@/lib/moneroo';
import { getSupabaseServer } from '@/lib/supabase';
import { CREDITS } from '@/lib/constants';

export const runtime = 'nodejs';

// Start a Moneroo hosted-checkout to buy a credit pack.
// Body: { userId, packId, email, name } -> { checkoutUrl }
export async function POST(request: NextRequest) {
  try {
    const { userId, packId, email, name } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 });
    }

    // Price + credits are resolved server-side from the pack id (never trust the client).
    const pack = CREDITS.packs.find((p) => p.id === packId) || CREDITS.packs[0];

    const parts = String(name || '').trim().split(/\s+/);
    const firstName = parts[0] || 'CantaMe';
    const lastName = parts.slice(1).join(' ') || 'Cliente';
    const origin = new URL(request.url).origin;

    // NOTE: `amount` is sent in the currency's main unit (e.g. 5 = $5). If the
    // Moneroo sandbox shows the wrong amount, switch to minor units (× 100).
    const { id, checkoutUrl } = await initializePayment({
      amount: pack.price,
      currency: MONEROO_CURRENCY,
      description: `CantaMe · ${pack.credits} credits`,
      customer: { email, first_name: firstName, last_name: lastName },
      return_url: `${origin}/payments/callback`,
      metadata: { userId, credits: pack.credits, packId: pack.id },
    });

    // Record a pending payment so crediting is reliable + idempotent.
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('payments').insert({
      id,
      user_id: userId,
      credits: pack.credits,
      status: 'pending',
    });
    if (error) console.error('payments insert error (run the migration?):', error.message);

    return NextResponse.json({ checkoutUrl, paymentId: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Payment init failed';
    console.error('payments/create error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
