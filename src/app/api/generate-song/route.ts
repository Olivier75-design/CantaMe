import { NextRequest, NextResponse } from 'next/server';
import { generateSongFile, type GenerateInput } from '@/lib/generateSong';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getUserFromRequest } from '@/lib/admin';
import { db } from '@/lib/db';

// Writes files + uses Node APIs -> Node.js runtime. Generation takes a couple of minutes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Composes the REAL, full-length song. Nothing here is free any more:
//   • Not signed in -> 401. Creating a song requires an account (Google works).
//   • Signed in     -> generates, but the song comes back LOCKED. No credits are
//                      spent here; credits are spent to UNLOCK it afterwards
//                      (POST /api/orders/[id]/unlock).
//
// ⚠️ The response deliberately does NOT contain audioUrl. The songs bucket is
// public, so handing the client that URL would hand it the song and the paywall
// would be decorative. Locked audio is only ever served through
// GET /api/orders/[id]/stream, which checks ownership and unlock state.
export async function POST(request: NextRequest) {
  try {
    // Generation calls the paid MiniMax API -> rate-limit by IP...
    if (!(await rateLimit(`gensong:${clientIp(request)}`, 5, 60))) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    }

    // ...and per account too. Generation is uncharged, so without this one
    // account could run up an unbounded MiniMax bill without ever paying.
    if (!(await rateLimit(`gensong:user:${user.id}`, 10, 3600))) {
      return NextResponse.json({ error: 'too_many_songs' }, { status: 429 });
    }

    const body = (await request.json()) as GenerateInput;
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName et style sont requis.' }, { status: 400 });
    }

    const result = await generateSongFile({ ...body });

    // Persist immediately, server-side: the client can no longer create the
    // order itself because it never sees the audio URL. `unlocked` is left to
    // the column default (false) — a new song always starts locked.
    const order = await db.createOrder({
      userId: user.id,
      clientEmail: user.email || '',
      recipientName: body.recipientName,
      relation: body.relation || '',
      occasion: body.occasion || '',
      style: body.style,
      anecdotes: [body.anecdote1, body.anecdote2].filter(Boolean) as string[],
      message: body.message || '',
      tone: body.tone || 'emotional',
      voiceGender: body.voiceGender || 'female',
      language: body.songLanguage || 'es',
      status: 'PENDING_PAYMENT',
      audioUrl: result.audioUrl,
      lyrics: result.lyrics,
    });

    return NextResponse.json({
      orderId: order.id,
      title: result.title,
      lyrics: result.lyrics,
      locked: true,
    });
  } catch (error: unknown) {
    // Log the real cause server-side; return a generic message to the client
    // so internal details (provider errors, URLs, keys) aren't leaked.
    const message = error instanceof Error ? error.message : 'Generation failed';
    console.error('generate-song error:', message);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
