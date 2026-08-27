import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminRequest } from '@/lib/admin';
import { setFeatured, FEATURED_SONGS_PATH } from '@/lib/ratings';

// Admin: pick (or unpick) a loved song for the public landing-page showcase.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: { featured?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.featured !== 'boolean') {
    return NextResponse.json({ error: 'featured_required' }, { status: 400 });
  }

  const ok = await setFeatured(id, body.featured);
  if (!ok) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  // The landing page reads /api/featured-songs, which is cached for 5 minutes.
  // Without this, featuring a song changes the database but NOT the page: the
  // stale empty response keeps being served, the whole showcase section stays
  // hidden (it renders only when the list is non-empty), and it looks like the
  // section was deleted. Featuring is rare and reading is constant, so the fix
  // is to keep the cache and drop it here, at the one moment it goes stale.
  revalidatePath(FEATURED_SONGS_PATH);

  return NextResponse.json({ ok: true });
}
