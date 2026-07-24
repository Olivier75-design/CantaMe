import { NextRequest, NextResponse } from 'next/server';
import { generateSongFile, type GenerateInput } from '@/lib/generateSong';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// Writes files + uses Node APIs -> Node.js runtime. Generation can take a couple of minutes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // Public (guest preview) + calls the paid MiniMax music API -> rate-limit by IP.
    if (!(await rateLimit(`gensong:${clientIp(request)}`, 5, 60))) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }
    const body = (await request.json()) as GenerateInput;
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName et style sont requis.' }, { status: 400 });
    }

    // Compose the concise (~1 min) song once. The player clips the pre-purchase
    // preview to the first 30s, and this exact same file is reused as the final
    // track after purchase — so the preview and the download always match.
    // (A separate later generation would produce a different melody/voice: the bug.)
    const result = await generateSongFile({ ...body });
    return NextResponse.json(result);
  } catch (error: unknown) {
    // Log the real cause server-side; return a generic message to the client
    // so internal details (provider errors, URLs, keys) aren't leaked.
    const message = error instanceof Error ? error.message : 'Generation failed';
    console.error('generate-song error:', message);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
