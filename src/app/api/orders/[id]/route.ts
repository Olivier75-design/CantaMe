import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSongFile } from '@/lib/generateSong';

// Revisions regenerate the song on the spot -> Node runtime, allow a few minutes.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Live revision: regenerate the song NOW from the saved order data + the notes.
    if (body.action === 'request_revision') {
      const order = await db.getOrderById(id);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const notes: string = body.notes || '';

      // Recover the anecdotes captured at creation time.
      let anecdote1 = '';
      let anecdote2 = '';
      try {
        const anecdotes = order.anecdotes;
        const arr = Array.isArray(anecdotes) ? anecdotes : JSON.parse(String(anecdotes) || '[]');
        anecdote1 = arr[0] || '';
        anecdote2 = arr[1] || '';
      } catch {
        /* ignore */
      }

      const result = await generateSongFile(
        {
          recipientName: order.recipient_name || order.recipientName || '',
          relation: order.relation,
          occasion: order.occasion,
          style: order.style,
          tone: order.tone,
          voiceGender: order.voice_gender || order.voiceGender || 'female',
          message: order.message,
          anecdote1,
          anecdote2,
          songLanguage: order.language,
        },
        notes
      );

      // Log the revision, then attach the new song and mark it ready again.
      await db.createRevision(id, notes);
      const updated = await db.updateOrder(id, { audioUrl: result.audioUrl, status: 'READY' });

      return NextResponse.json(updated);
    }

    // Handle status update (admin)
    if (body.status) {
      const updateData: Record<string, string> = { status: body.status };
      if (body.audioUrl) updateData.audioUrl = body.audioUrl;
      if (body.instrumentalUrl) updateData.instrumentalUrl = body.instrumentalUrl;

      const order = await db.updateOrder(id, updateData);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      return NextResponse.json(order);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update order';
    console.error('Error updating order:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
