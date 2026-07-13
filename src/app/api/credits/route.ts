import { NextRequest, NextResponse } from 'next/server';
import { getCredits, addCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';

export const runtime = 'nodejs';

// GET /api/credits?userId=... -> current balance
export async function GET(request: NextRequest) {
  try {
    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const credits = await getCredits(userId);
    return NextResponse.json({ credits });
  } catch (error) {
    console.error('Credits GET error:', error);
    return NextResponse.json({ error: 'Failed to read credits' }, { status: 500 });
  }
}

// POST /api/credits { userId, quantity } -> simulate purchase, add credits
export async function POST(request: NextRequest) {
  try {
    const { userId, quantity } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const credits = await addCredits(userId, qty);
    const pack = CREDITS.packs.find((p) => p.credits === qty);
    const charged = pack ? pack.price : Math.ceil(qty * 0.05);
    return NextResponse.json({ success: true, credits, charged });
  } catch (error) {
    console.error('Credits POST error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}
