import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { verifyAdminRequest } from '@/lib/admin';
import { db } from '@/lib/db';
import { resendConfigured } from '@/lib/email';
import { getSiteUrl } from '@/lib/site';
import { sendSupportEmail } from '@/lib/supportEmail';

// Admin: write to the customer behind an order (e.g. someone whose payment
// failed and who never got in touch), sent from the support address via
// Resend. The recipient is the order's own email, read server-side — the admin
// never types an address. Body: { subject, message } -> { ok, to }.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBJECT_MAX = 150;
const MESSAGE_MAX = 5000;

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

  let subject: string;
  let message: string;
  try {
    const body = await request.json();
    subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    message = typeof body?.message === 'string' ? body.message.trim() : '';
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!subject || !message) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (subject.length > SUBJECT_MAX || message.length > MESSAGE_MAX) {
    return NextResponse.json({ error: 'too_long' }, { status: 400 });
  }

  const order = await db.getOrderById(id).catch(() => null);
  const to = order?.client_email || order?.clientEmail;
  if (!order || !to) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    await sendSupportEmail(
      {
        to,
        // The song's language is the best signal of the customer's own.
        lang: order.language === 'en' ? 'en' : 'es',
        subject,
        body: message,
        siteUrl: getSiteUrl() || 'https://www.cantame.app',
      },
      // A double click or retry of the same message is dropped by Resend.
      `order-msg-${id}-${crypto.createHash('sha256').update(`${subject}\n${message}`).digest('hex').slice(0, 32)}`,
    );
  } catch (e) {
    console.error('order message failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to });
}
