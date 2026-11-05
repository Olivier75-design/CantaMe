import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, isAdminEmail } from '@/lib/admin';
import { hideLockedAudio } from '@/lib/orderAccess';

// There is intentionally NO POST. Orders are created server-side by
// /api/generate-song, together with the song. The old client-side POST was
// called by no flow any more, had no rate limit, and minted audio-less orders
// that /api/orders/[id] generate_full would then compose for free — an
// unbounded MiniMax bill around the per-account generation limit.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const email = searchParams.get('email') || undefined;

    const user = await getUserFromRequest(request);
    const admin = isAdminEmail(user?.email);

    if (!email) {
      // Listing ALL orders exposes every customer's data → admin only.
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else if (!admin) {
      // A user may only list their OWN orders. Non-admins can't query by an
      // arbitrary email, which previously leaked other customers' orders.
      if (!user || (user.email || '').toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const orders = await db.getOrders({ status, email });
    // The owner's own list still must not carry locked audio (devtools shows it).
    return NextResponse.json(admin ? orders : orders.map(hideLockedAudio));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
