import { NextRequest, NextResponse } from 'next/server';
import { getCredits } from '@/lib/credits';

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

// NOTE: there is intentionally NO POST handler. Credits are ONLY granted by
// creditForPayment() after a Moneroo payment is verified. A public "add
// credits" endpoint would let anyone mint unlimited credits for free.
