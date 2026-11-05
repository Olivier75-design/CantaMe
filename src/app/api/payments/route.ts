import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/admin';
import { getSupabaseServer } from '@/lib/supabase';
import { CREDITS } from '@/lib/constants';
import { MONEROO_CURRENCY } from '@/lib/moneroo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/payments -> the AUTHENTICATED user's completed pack purchases, for
// the dashboard's Payments tab. That tab used to list unlocked songs at
// `orders.price`, a column nothing sets any more (it defaults to 10), so a
// customer who paid $4 for 2 songs saw "$10" per song and "Total spent $20".
// Money changes hands per pack, so the `payments` table is the only truth.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getSupabaseServer()
    .from('payments')
    .select('id, created_at, credits, amount, promo_code')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('payments GET error:', error.message);
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 });
  }

  return NextResponse.json({
    payments: (data || []).map((p) => ({
      id: String(p.id),
      createdAt: p.created_at as string | null,
      songs: Math.round((Number(p.credits) || 0) / CREDITS.perSong),
      // Rows from before the amount column existed have none: shown as "—",
      // never guessed.
      amount: p.amount === null || p.amount === undefined ? null : Number(p.amount),
      promoCode: (p.promo_code as string | null) || null,
      currency: MONEROO_CURRENCY,
    })),
  });
}
