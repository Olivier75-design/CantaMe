import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/admin';

export async function GET() {
  try {
    const styles = await db.getStyles();
    return NextResponse.json(styles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    return NextResponse.json({ error: 'Failed to fetch styles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await verifyAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const newStyle = await db.createStyle(body);
    return NextResponse.json(newStyle);
  } catch (error) {
    console.error('Error creating style:', error);
    return NextResponse.json({ error: 'Failed to create style' }, { status: 500 });
  }
}
