import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin';
import { getSupabaseServer } from '@/lib/supabase';
import { getCredits, setCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';

export const runtime = 'nodejs';

const MAX_RESULTS = 25;

interface AdminUserRow {
  id: string;
  email: string;
  credits: number;
  songs: number;
  createdAt: string;
  lastSignInAt: string | null;
}

// GET /api/admin/users?email=<query> — ADMIN-ONLY. Case-insensitive substring
// search over accounts, returning each one's credit balance. Read-only: it does
// NOT auto-initialize balances (so listing never mutates anyone).
export async function GET(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const q = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
  const supabase = getSupabaseServer();
  const results: AdminUserRow[] = [];
  try {
    for (let page = 1; page <= 20 && results.length < MAX_RESULTS; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        const email = u.email || '';
        if (q && !email.toLowerCase().includes(q)) continue;
        const raw = (u.app_metadata as { credits?: number } | undefined)?.credits;
        const credits = raw === undefined || raw === null ? CREDITS.freeOnSignup : Number(raw) || 0;
        results.push({
          id: u.id,
          email,
          credits,
          songs: Math.floor(credits / CREDITS.perSong),
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at ?? null,
        });
        if (results.length >= MAX_RESULTS) break;
      }
      if (data.users.length < 200) break;
    }
    return NextResponse.json({ users: results });
  } catch (e) {
    console.error('admin users GET error:', e);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}

// POST /api/admin/users — ADMIN-ONLY credit adjustment.
// body: { userId: string, action: 'add' | 'set', amount: number } (amount in CREDITS).
// `add` supports negatives to deduct; `set` writes an exact balance. setCredits clamps to >= 0.
export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { userId, action, amount } = await request.json();
    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (action !== 'add' && action !== 'set') {
      return NextResponse.json({ error: "action must be 'add' or 'set'" }, { status: 400 });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt)) {
      return NextResponse.json({ error: 'amount must be a number' }, { status: 400 });
    }
    // Bound to sane limits to avoid fat-finger accidents.
    const bounded = Math.max(-1_000_000, Math.min(1_000_000, Math.round(amt)));
    const current = await getCredits(userId);
    const next = action === 'set' ? bounded : current + bounded;
    const credits = await setCredits(userId, next);
    return NextResponse.json({ credits, songs: Math.floor(credits / CREDITS.perSong) });
  } catch (e) {
    console.error('admin users POST error:', e);
    return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
  }
}
