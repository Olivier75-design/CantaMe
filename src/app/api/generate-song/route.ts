import { NextRequest, NextResponse, after } from 'next/server';
import { generateSongFile, type GenerateInput } from '@/lib/generateSong';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getUserFromRequest } from '@/lib/admin';
import { db } from '@/lib/db';
import { clampBrief } from '@/lib/briefInput';
import { getCredits, spendCredits, addCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';

// Writes files + uses Node APIs -> Node.js runtime. Generation takes a couple of minutes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Composes the REAL, full-length song. Nothing here is free:
//   • Not signed in -> 401. Creating a song requires an account (Google works).
//   • Signed in WITH credits -> one song is spent up front (refunded if the
//     generation fails) and the song is created UNLOCKED. The reply is a live
//     NDJSON stream: the MP3 arrives piece by piece while MiniMax composes it,
//     so the customer starts listening ~30 s in instead of waiting ~2 min.
//     Someone who already paid should not have to "unlock" every new song.
//   • Signed in WITHOUT credits -> generates, but the song comes back LOCKED,
//     as JSON with no audio. Credits are spent to unlock it afterwards
//     (POST /api/orders/[id]/unlock), usually after buying a pack.
//
// ⚠️ The locked reply deliberately does NOT contain audioUrl, and the stream
// only exists on the paid path. The songs bucket is public, so handing the
// client that URL (or the bytes) before payment would make the paywall
// decorative.
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

    // ...and per account too. Without credits generation is uncharged, so
    // without this one account could run up an unbounded MiniMax bill.
    if (!(await rateLimit(`gensong:user:${user.id}`, 10, 3600))) {
      return NextResponse.json({ error: 'too_many_songs' }, { status: 429 });
    }

    // Known fields only, each length-bounded: they all feed paid prompts.
    const body: GenerateInput = clampBrief(await request.json());
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName et style sont requis.' }, { status: 400 });
    }

    const orderFields = {
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
    };

    // ── Paid path: the customer has a song in their balance ──
    if ((await getCredits(user.id)) >= CREDITS.perSong) {
      const spend = await spendCredits(user.id, CREDITS.perSong);
      if (spend.ok) return streamPaidSong(user.id, body, orderFields, spend.credits);
      // Lost a race on the balance: fall through to the locked path.
    }

    // ── Locked path: no credits ──
    const result = await generateSongFile({ ...body });

    // Persist immediately, server-side: the client can no longer create the
    // order itself because it never sees the audio URL. `unlocked` is left to
    // the column default (false) — a new song always starts locked.
    const order = await db.createOrder({
      ...orderFields,
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

// The song is already paid for: compose it in streaming mode and relay every
// MP3 piece to the browser as one NDJSON line, then a final `done` line with
// the order. Lines:
//   {"type":"start","credits":n}            credits left after this song
//   {"type":"audio","data":"<base64>"}      the next piece of the MP3, in order
//   {"type":"done","orderId","audioUrl","title","lyrics"}
//   {"type":"error","error","refunded":true}
function streamPaidSong(
  userId: string,
  body: GenerateInput,
  orderFields: Parameters<typeof db.createOrder>[0],
  creditsLeft: number,
): Response {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let open = true;

  const send = (msg: Record<string, unknown>) => {
    if (!open) return;
    try {
      controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'));
    } catch {
      open = false; // the browser went away; keep composing regardless
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    // Closing the tab must NOT stop the song: it is paid for, and it still
    // lands in the customer's library (see after() below).
    cancel() { open = false; },
  });

  const work = (async () => {
    send({ type: 'start', credits: creditsLeft });
    try {
      const result = await generateSongFile({ ...body }, undefined, (chunk) =>
        send({ type: 'audio', data: chunk.toString('base64') }),
      );
      const order = await db.createOrder({
        ...orderFields,
        status: 'READY',
        unlocked: true,
        audioUrl: result.audioUrl,
        lyrics: result.lyrics,
      });
      send({
        type: 'done',
        orderId: order.id,
        audioUrl: result.audioUrl,
        title: result.title,
        lyrics: result.lyrics,
      });
    } catch (error) {
      // Never keep the credit for a song the customer did not get.
      await addCredits(userId, CREDITS.perSong).catch((e) =>
        console.error('generate-song refund failed:', userId, e instanceof Error ? e.message : e),
      );
      console.error('generate-song (paid) error:', error instanceof Error ? error.message : error);
      send({ type: 'error', error: 'generation_failed', refunded: true });
    } finally {
      if (open) {
        open = false;
        try { controller.close(); } catch { /* already closed */ }
      }
    }
  })();

  // Keeps the function alive until the song is saved, even if the response
  // was cut short by the customer leaving the page.
  after(work);

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
