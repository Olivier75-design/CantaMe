import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';

// Server-side, ad-blocker-proof page-view counter. Runs on the edge for every
// real page navigation and records a row in Supabase `page_views`. Because the
// counting happens on the server (no client script), ad blockers cannot stop
// it. Recording is fire-and-forget via waitUntil so it never adds latency or
// breaks navigation.
export const config = {
  // Skip Next internals, API routes, and static files (anything with a dot).
  matcher: ['/((?!_next/|api/|favicon.ico|.*\\.).*)'],
};

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const res = NextResponse.next();

  try {
    // Only count real document loads (not prefetch/RSC fetches).
    if (req.headers.get('sec-fetch-dest') !== 'document') return res;

    const ua = req.headers.get('user-agent') || '';
    if (/bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|lighthouse|headless|curl|wget/i.test(ua)) {
      return res;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return res;

    const row = {
      path: req.nextUrl.pathname,
      referrer: req.headers.get('referer') || null,
      country: req.headers.get('x-vercel-ip-country') || null,
      device: /mobile|android|iphone|ipad|ipod/i.test(ua) ? 'mobile' : 'desktop',
    };

    ev.waitUntil(
      fetch(`${url}/rest/v1/page_views`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      }).catch(() => {})
    );
  } catch {
    /* analytics must never break navigation */
  }

  return res;
}
