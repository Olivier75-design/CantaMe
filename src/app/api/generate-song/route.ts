import { NextRequest, NextResponse } from 'next/server';
import { generateSongFile, type GenerateInput } from '@/lib/generateSong';

// Writes files + uses Node APIs -> Node.js runtime. Generation can take a couple of minutes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateInput;
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName et style sont requis.' }, { status: 400 });
    }

    // The wizard preview only plays ~30s, so compose a short teaser for speed.
    // The full-length song is generated later, in the background, after purchase.
    const result = await generateSongFile({ ...body, preview: true });
    return NextResponse.json(result);
  } catch (error: unknown) {
    // Log the real cause server-side; return a generic message to the client
    // so internal details (provider errors, URLs, keys) aren't leaked.
    const message = error instanceof Error ? error.message : 'Generation failed';
    console.error('generate-song error:', message);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
