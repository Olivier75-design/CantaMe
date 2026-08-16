import { NextResponse } from 'next/server';
import { listFeaturedSongs } from '@/lib/ratings';

// Public: the songs the admin picked out of the ones customers loved, shown on
// the landing page. These are the ONLY songs whose audio URL is served
// publicly — everything else stays behind the unlock paywall.
export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  // Returns everything featured; the landing page shows 3 and reveals the rest
  // behind "See more", so expanding costs no extra round trip.
  return NextResponse.json({ songs: await listFeaturedSongs(24) });
}
