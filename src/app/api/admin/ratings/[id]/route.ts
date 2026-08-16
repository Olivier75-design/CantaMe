import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin';
import { setFeatured } from '@/lib/ratings';

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
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'update_failed' }, { status: 500 });
}
