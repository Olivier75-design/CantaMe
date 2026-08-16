import { NextRequest, NextResponse } from 'next/server';
import { requireOwnedOrder } from '@/lib/orderAccess';
import { spendCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';
import { getSupabaseServer } from '@/lib/supabase';

// Spend credits to unlock a finished song for listening + downloading.
// This is where money now changes hands — generation itself is uncharged.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireOwnedOrder(request, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Already paid for — unlocking is idempotent, and a double click must never
  // charge twice.
  if (access.order.unlocked) {
    return NextResponse.json({ ok: true, alreadyUnlocked: true });
  }

  const spend = await spendCredits(access.userId, CREDITS.perSong);
  if (!spend.ok) {
    // The client turns this into "buy a pack" rather than an error.
    return NextResponse.json(
      { error: 'no_credits', credits: spend.credits, needed: CREDITS.perSong },
      { status: 402 },
    );
  }

  const { error } = await getSupabaseServer()
    .from('orders')
    .update({ unlocked: true, status: 'READY', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    // Never keep the credit if we failed to grant access.
    const { addCredits } = await import('@/lib/credits');
    await addCredits(access.userId, CREDITS.perSong).catch(() => {});
    console.error('unlock error:', error.message);
    return NextResponse.json({ error: 'unlock_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credits: spend.credits });
}
