import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin';
import { updateContactMessage } from '@/lib/contact';

// Admin: mark a contact message read/replied/archived, or attach a private note.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const updated = await updateContactMessage(id, body);
  if (!updated) {
    // Either an unknown status, a bad id, or the table is missing.
    return NextResponse.json({ error: 'update_failed' }, { status: 400 });
  }

  return NextResponse.json(updated);
}
