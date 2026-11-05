import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getUserFromRequest } from '@/lib/admin';
import { saveRating, isValidRating } from '@/lib/ratings';
import { getSupabaseServer } from '@/lib/supabase';

// The customer rates a song of their own they just heard (signed in, owner only).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!(await rateLimit(`rating:${clientIp(request)}`, 20, 60))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!isValidRating(body.rating)) {
    return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
  }

  // Only accept URLs from our own songs bucket. Without this the table is a
  // free-text dumping ground and the stats stop meaning anything.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl : '';
  if (!audioUrl || !audioUrl.startsWith(`${base.replace(/\/$/, '')}/storage/v1/object/public/songs/`)) {
    return NextResponse.json({ error: 'invalid_audio_url' }, { status: 400 });
  }

  // Only the song's owner may rate it. Votes upsert on audio_url, and the
  // landing page shows featured songs only while their vote is 👍 — so when
  // anyone could post, any visitor could flip a featured song's public URL to
  // 👎 and pull it off the landing page (or skew Admin → Quality). Guests no
  // longer generate songs, so this costs no real signal.
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const { data: owned } = await getSupabaseServer()
    .from('orders')
    .select('id')
    .eq('audio_url', audioUrl)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const str = (v: unknown, max = 40) => (typeof v === 'string' ? v.slice(0, max) : null);

  const ok = await saveRating({
    rating: body.rating,
    audioUrl,
    orderId: owned.id as string,
    style: str(body.style),
    tone: str(body.tone),
    voiceGender: str(body.voiceGender),
    occasion: str(body.occasion),
    language: str(body.language, 8),
    userId: user.id,
    ip: clientIp(request),
  });

  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
