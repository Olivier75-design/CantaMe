// Canonical public origin used to build auth redirect URLs.
//
// Why this exists: `window.location.origin` returns the literal string "null"
// in opaque-origin contexts (in-app browsers such as Gmail/WhatsApp webviews,
// sandboxed iframes). Feeding that into an OAuth `redirectTo` produces
// "null/dashboard" → the phone then tries to reach the host "null" and shows
// "null is unreachable". We therefore prefer an explicit env var (set in Vercel
// to the production URL) and only fall back to a *valid* browser origin.
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && /^https?:\/\//.test(origin)) {
      return origin;
    }
  }

  // Last resort: relative path. Supabase then uses its configured Site URL,
  // which must be the production domain (never blank / localhost for prod).
  return '';
}
