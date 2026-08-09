import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getUserFromRequest } from '@/lib/admin';
import { saveRating, isValidRating } from '@/lib/ratings';

// Public: the customer rates the song they just heard. Guests rate too — they
// generate songs, so excluding them would throw away most of the signal.
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
  if (audioUrl && !audioUrl.startsWith(`${base.replace(/\/$/, '')}/storage/v1/object/public/songs/`)) {
    return NextResponse.json({ error: 'invalid_audio_url' }, { status: 400 });
  }

  const str = (v: unknown, max = 40) => (typeof v === 'string' ? v.slice(0, max) : null);
  const user = await getUserFromRequest(request);

  const ok = await saveRating({
    rating: body.rating,
    audioUrl: audioUrl || null,
    orderId: str(body.orderId, 64),
    style: str(body.style),
    tone: str(body.tone),
    voiceGender: str(body.voiceGender),
    occasion: str(body.occasion),
    language: str(body.language, 8),
    userId: user?.id ?? null,
    ip: clientIp(request),
  });

  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
