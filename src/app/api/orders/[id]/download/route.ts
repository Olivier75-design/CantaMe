import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Streams the order's song back with a `Content-Disposition: attachment` header
// so the browser downloads the file directly (with a friendly, person-named
// filename) instead of opening the cross-origin Supabase URL in a new tab.
export const runtime = 'nodejs';

function sanitize(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const url = order.audio_url || order.audioUrl;
    if (!url) {
      return NextResponse.json({ error: 'Song not ready yet' }, { status: 404 });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio' }, { status: 502 });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());

    const person = sanitize(order.recipient_name || order.recipientName || '');
    const pretty = `CantaMe - ${person || 'Cancion'}.mp3`;
    // ASCII fallback for the legacy filename= param; UTF-8 name in filename*.
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
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
