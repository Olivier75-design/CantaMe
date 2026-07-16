import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin';
import { generateSongFile, type GenerateInput } from '@/lib/generateSong';

// Real generation (OpenAI lyrics + MiniMax music + Supabase upload) -> Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// POST /api/admin/generate — ADMIN-ONLY test generation.
// Runs the exact production pipeline so an admin can audition sound quality, but
// it does NOT spend credits and does NOT create an order. `preview:true` composes
// a fast ~30-40s teaser; otherwise it renders the full song.
export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as GenerateInput;
    if (!body.recipientName || !body.style) {
      return NextResponse.json({ error: 'recipientName and style are required.' }, { status: 400 });
    }
    const result = await generateSongFile(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    // Admin-only route: surface the real error to help debug quality/config.
    const message = error instanceof Error ? error.message : 'Generation failed';
    console.error('admin generate error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
