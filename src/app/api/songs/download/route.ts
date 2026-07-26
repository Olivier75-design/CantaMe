import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/admin';

// Download a generated song by its storage URL, for songs that don't have an
// order row yet (the wizard's "download" button).
//
// Listening is free and needs no account, but DOWNLOADING requires signing in —
// that's the trade for the free songs. The client therefore has to call this
// with the Supabase access token (a plain <a href> can't carry it).
//
// The `url` is NOT a free-form fetch target: it must point at our own public
// Supabase "songs" bucket, otherwise this would be an open proxy (SSRF).
export const runtime = 'nodejs';

function sanitize(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export async function GET(request: NextRequest) {
  try {
    // Downloads are for signed-in users only (playback stays free for guests).
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'signin_required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url') || '';
    const name = sanitize(searchParams.get('name') || '');

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }
    const allowedPrefix = `${base.replace(/\/$/, '')}/storage/v1/object/public/songs/`;
    if (!url.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: 'Invalid song URL' }, { status: 400 });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio' }, { status: 502 });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());

    const pretty = `CantaMe - ${name || 'Cancion'}.mp3`;
    const ascii = pretty.replace(/[^\x20-\x7E]/g, '_');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(pretty)}`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Song download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
