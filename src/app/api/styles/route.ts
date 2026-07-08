import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const body = await request.json();
    const newStyle = await db.createStyle(body);
    return NextResponse.json(newStyle);
  } catch (error) {
    console.error('Error creating style:', error);
    return NextResponse.json({ error: 'Failed to create style' }, { status: 500 });
  }
}
