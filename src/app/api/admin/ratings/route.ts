import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin';
import { getRatingStats } from '@/lib/ratings';

// Admin: aggregated song satisfaction (Admin → Quality tab).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await getRatingStats());
}
