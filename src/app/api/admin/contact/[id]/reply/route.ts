import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { verifyAdminRequest } from '@/lib/admin';
import { getContactMessage, updateContactMessage } from '@/lib/contact';
import { CONTACT_SUBJECT_LABELS } from '@/lib/constants';
import { resendConfigured } from '@/lib/email';
import { getSiteUrl } from '@/lib/site';
import { sendSupportEmail } from '@/lib/supportEmail';

// Admin: answer a contact message by email, sent from the support address via
// Resend (the admin's own address never shows). Marks the message replied only
// once Resend has accepted the email. Body: { message } -> the updated message.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPLY_MAX = 5000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!resendConfigured()) {
    return NextResponse.json({ error: 'email_not_configured' }, { status: 503 });
  }

  const { id } = await params;

  let reply: string;
  try {
    const body = await request.json();
    reply = typeof body?.message === 'string' ? body.message.trim() : '';
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!reply) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (reply.length > REPLY_MAX) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const m = await getContactMessage(id);
  if (!m) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const lang = m.locale === 'en' ? 'en' : 'es';
  try {
    await sendSupportEmail(
      {
        to: m.email,
        lang,
        subject: `Re: ${CONTACT_SUBJECT_LABELS[m.subject]?.[lang] || m.subject} — CantaMe`,
        body: reply,
        quote: { message: m.message, date: new Date(m.created_at) },
        siteUrl: getSiteUrl() || 'https://www.cantame.app',
      },
      // Same text to the same message is the same email: a double click or a
      // retry is dropped by Resend instead of reaching the customer twice.
      `support-${id}-${crypto.createHash('sha256').update(reply).digest('hex').slice(0, 32)}`,
    );
  } catch (e) {
    console.error('support reply failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  const updated = await updateContactMessage(id, { status: 'replied' });
  return NextResponse.json(updated ?? { ok: true });
}
