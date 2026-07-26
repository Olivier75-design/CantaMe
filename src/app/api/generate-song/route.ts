import { NextRequest, NextResponse } from 'next/server';
import { generateSongFile, type GenerateInput } from '@/lib/generateSong';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getUserFromRequest } from '@/lib/admin';
import { spendCredits, addCredits } from '@/lib/credits';
import { CREDITS } from '@/lib/constants';

// Writes files + uses Node APIs -> Node.js runtime. Generation takes a couple of minutes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// There is no preview anymore: this route composes the REAL, full-length song.
//   • Guest (not signed in) -> may generate and LISTEN for free. Downloading is
//                              what requires an account (/api/songs/download).
//   • Signed in             -> costs CREDITS.perSong (new accounts are granted
//                              one song's worth on signup).
// Generation is never blocked behind a sign-in wall; only the IP rate limit
// applies to guests.
export async function POST(request: NextRequest) {
  let charged: string | null = null; // user id we spent credits for (for refunds)
  try {
    // Generation calls the paid MiniMax API -> always rate-limit by IP.
    if (!(await rateLimit(`gensong:${clientIp(request)}`, 5, 60))) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = (await request.json()) as GenerateInput;
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName et style sont requis.' }, { status: 400 });
    }

    const user = await getUserFromRequest(request);

    if (user) {
      // Signed in: spend credits up front so a crash can't hand out free songs.
      const spend = await spendCredits(user.id, CREDITS.perSong);
      if (!spend.ok) {
        return NextResponse.json(
          { error: 'no_credits', credits: spend.credits },
          { status: 402 },
        );
      }
      charged = user.id;
    }
    // Guests are not charged and are not blocked — they can hear the result,
    // but they have to sign in to download it.

    const result = await generateSongFile({ ...body });
    return NextResponse.json(result);
  } catch (error: unknown) {
    // Never keep the credit if we failed to deliver a song.
    if (charged) await addCredits(charged, CREDITS.perSong).catch(() => {});
    // Log the real cause server-side; return a generic message to the client
    // so internal details (provider errors, URLs, keys) aren't leaked.
    const message = error instanceof Error ? error.message : 'Generation failed';
    console.error('generate-song error:', message);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
