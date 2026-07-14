import { NextRequest, NextResponse } from 'next/server';
import { writeLyrics, LYRICS_PROVIDER } from '@/lib/lyrics';
import type { SongBrief } from '@/lib/musicPrompts';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Generate (or regenerate) editable lyrics for the current brief. Public (used
// by the guest preview wizard) so it is rate-limited by IP to prevent abuse of
// the paid OpenAI/MiniMax API.
export async function POST(request: NextRequest) {
  try {
    if (!(await rateLimit(`lyrics:${clientIp(request)}`, 12, 60))) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }
    const body = await request.json();
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName et style sont requis.' }, { status: 400 });
    }

    const brief: SongBrief = {
      recipientName: body.recipientName,
      relation: body.relation,
      occasion: body.occasion,
      style: body.style,
      anecdote1: body.anecdote1,
      anecdote2: body.anecdote2,
      message: body.message,
      tone: body.tone,
      voiceGender: body.voiceGender,
    };

    const { title, lyrics } = await writeLyrics(brief, body.songLanguage || 'es', body.revisionNotes);
    return NextResponse.json({ title, lyrics, provider: LYRICS_PROVIDER });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lyrics generation failed';
    console.error('generate-lyrics error:', message);
    return NextResponse.json({ error: 'Could not write the lyrics. Please try again.' }, { status: 500 });
  }
}
