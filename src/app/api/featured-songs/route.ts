import { NextResponse } from 'next/server';
import { listFeaturedSongs } from '@/lib/ratings';

// Public: the songs the admin picked out of the ones customers loved, shown on
// the landing page. These are the ONLY songs whose audio URL is served
// publicly — everything else stays behind the unlock paywall.
export const runtime = 'nodejs';
// Cached: this is read on every landing-page visit but only changes when the
// admin features a song. PATCH /api/admin/ratings/[id] calls revalidatePath()
// on this route, so the showcase updates immediately instead of waiting out
// the window (which used to make a freshly featured song invisible for
// minutes, and the whole section vanish as if it had been removed).
export const revalidate = 300;

export async function GET() {
  // Returns everything featured; the landing page shows 3 and reveals the rest
  // behind "See more", so expanding costs no extra round trip.
  return NextResponse.json({ songs: await listFeaturedSongs(24) });
}
