import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getUserFromRequest } from '@/lib/admin';
import { validateContactInput, createContactMessage } from '@/lib/contact';

// Public contact form (footer "Contact us" modal). No auth required — but if the
// sender happens to be signed in we record their user id, which makes it much
// easier to find their orders when replying.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // 3 messages per 10 minutes per IP. Generous for a human with a follow-up
  // question, useless for a spam script.
  if (!(await rateLimit(`contact:${clientIp(request)}`, 3, 600))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot: a hidden field no human ever sees. If it's filled in, a bot did
  // it — return success so the script marks it delivered and moves on, but
  // write nothing.
  const website = (body as Record<string, unknown>)?.website;
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const parsed = validateContactInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_input', field: parsed.field }, { status: 400 });
  }

  const user = await getUserFromRequest(request);
  const locale = (body as Record<string, unknown>)?.locale;

  const saved = await createContactMessage({
    ...parsed.value,
    userId: user?.id ?? null,
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    locale: typeof locale === 'string' ? locale.slice(0, 8) : null,
  });

  if (!saved) {
    // Most likely the contact_messages table hasn't been created yet (see
    // supabase-setup.sql). Details are in the server log, not in the response.
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
