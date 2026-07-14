import { NextRequest, NextResponse } from 'next/server';
import { getCredits } from '@/lib/credits';
import { getUserFromRequest } from '@/lib/admin';

export const runtime = 'nodejs';

// GET /api/credits -> the AUTHENTICATED user's balance. The user id comes from
// the session token, not the query, so nobody can read another user's balance.
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const credits = await getCredits(user.id);
    return NextResponse.json({ credits });
  } catch (error) {
    console.error('Credits GET error:', error);
    return NextResponse.json({ error: 'Failed to read credits' }, { status: 500 });
  }
}

// NOTE: there is intentionally NO POST handler. Credits are ONLY granted by
// creditForPayment() after a Moneroo payment is verified. A public "add
// credits" endpoint would let anyone mint unlimited credits for free.
