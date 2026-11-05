// Escape text before interpolating it into an HTML string (client-safe, no
// server imports). Needed wherever a page builds HTML by hand, e.g. the
// printable card and the receipt opened with window.open() + document.write():
// that blank window shares the site's origin, so an unescaped recipient name or
// lyric like `<img src=x onerror=…>` runs as the site and can read the
// visitor's Supabase session from localStorage.
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
