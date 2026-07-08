import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const order = await db.createOrder({
      userId: body.userId || null,
      clientEmail: body.clientEmail || '',
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

    const orders = await db.getOrders({ status, email });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
