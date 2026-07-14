// Canonical public ORIGIN used to build auth redirect URLs (e.g. "https://cantame.app").
//
// Two problems this guards against:
//  1. `window.location.origin` returns the literal string "null" in opaque-origin
//     contexts (in-app browsers such as Gmail/WhatsApp webviews). Feeding that into
//     an OAuth `redirectTo` produces "null/dashboard" → "null is unreachable".
//  2. A misconfigured NEXT_PUBLIC_SITE_URL (missing scheme like "cantame.app", or an
//     accidental path like "https://cantame.app/dashboard") would otherwise be used
//     verbatim, turning the redirect into e.g. "https://cantame.app/dashboard/dashboard"
//     → a 404. We normalize to the ORIGIN only, so any reasonable value works.
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    const normalized = normalizeOrigin(raw);
    if (normalized) return normalized;
  }

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

// Extract just the scheme + host (drops any path, query, hash, trailing slash).
// Prepends https:// when the scheme is missing. Returns '' if unparseable.
function normalizeOrigin(value: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withScheme).origin;
  } catch {
    return '';
  }
}
