import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { spendCredits, addCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';
import { getUserFromRequest } from '@/lib/admin';

export const runtime = 'nodejs';

// Finalize an order by spending the song's credits. The full-length song is
// generated afterwards in the background (see the `generate_full` action in
// /api/orders/[id]), so the order is marked IN_PRODUCTION here and flips to
// READY once generation completes. Returns 402 when the user has no credits.
//
// The spender is derived from the authenticated session (never the body), and
// the order must belong to that user — otherwise anyone could spend another
// user's credits or finalize someone else's order.
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const existing = await db.getOrderById(orderId);
    if (!existing || (existing.user_id || existing.userId) !== user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const spend = await spendCredits(user.id, CREDITS.perSong);
    if (!spend.ok) {
      return NextResponse.json(
        { error: 'no_credits', credits: spend.credits },
        { status: 402 },
      );
    }

    const order = await db.updateOrder(orderId, {
      status: 'IN_PRODUCTION',
      stripeSessionId: `credit_${Date.now()}`,
    });

    if (!order) {
      // Refund the credit if the order could not be finalized.
      await addCredits(user.id, CREDITS.perSong);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order, credits: spend.credits });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
