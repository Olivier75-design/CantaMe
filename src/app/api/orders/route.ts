import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminRequest, getUserFromRequest, isAdminEmail } from '@/lib/admin';

// Create an order. Identity (owner id + email) is taken from the authenticated
// session, never from the body — otherwise anyone could create orders in
// another user's name.
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const order = await db.createOrder({
      userId: user.id,
      clientEmail: user.email || '',
      recipientName: body.recipientName || '',
      relation: body.relation || '',
      occasion: body.occasion || '',
      style: body.style || '',
      anecdotes: JSON.stringify([body.anecdote1, body.anecdote2].filter(Boolean)),
      message: body.message || '',
      tone: body.tone || 'emotional',
      voiceGender: body.voiceGender || 'female',
      tier: body.tier || 'basica',
      price: body.price || 10,
      status: 'PENDING_PAYMENT',
      language: body.songLanguage || 'es',
      audioUrl: body.audioUrl,
      instrumentalUrl: body.instrumentalUrl,
      lyrics: body.lyrics,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

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
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
