import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { spendCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';

export const runtime = 'nodejs';

// Finalize an order by spending 1 credit. The song was already generated during
// the preview step, so once a credit is spent it is immediately READY in the
// user's dashboard. Returns 402 when the user has no credits left.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, userId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const spend = await spendCredits(userId, CREDITS.perSong);
    if (!spend.ok) {
      return NextResponse.json(
        { error: 'no_credits', credits: spend.credits },
        { status: 402 },
      );
    }

    const order = await db.updateOrder(orderId, {
      status: 'READY',
      stripeSessionId: `credit_${Date.now()}`,
    });

    if (!order) {
      // Refund the credit if the order could not be finalized.
      const { addCredits } = await import('@/lib/credits');
      await addCredits(userId, CREDITS.perSong);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order, credits: spend.credits });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
