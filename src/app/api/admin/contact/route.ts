import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin';
import { listContactMessages, countNewMessages } from '@/lib/contact';

// Admin: list contact-form messages (Admin → Messages tab).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = new URL(request.url).searchParams.get('status') || 'all';
  const [messages, unread] = await Promise.all([
    listContactMessages(status),
    countNewMessages(),
  ]);

  return NextResponse.json({ messages, unread });
}
