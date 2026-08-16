import { NextRequest, NextResponse } from 'next/server';
import { requireUnlockedOrder } from '@/lib/orderAccess';

// The ONLY way a customer's browser gets song bytes. The public Supabase URL is
// never sent to the client, so this route is the paywall.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireUnlockedOrder(request, id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = access.order.audio_url || access.order.audioUrl;
  if (!url) return NextResponse.json({ error: 'not_ready' }, { status: 404 });

  const upstream = await fetch(url);
  if (!upstream.ok) return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });

  const buffer = Buffer.from(await upstream.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
