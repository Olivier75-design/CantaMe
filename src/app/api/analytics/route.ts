import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifyAdminRequest } from '@/lib/admin';

// Aggregated, server-side traffic stats from the `page_views` table (populated
// by middleware.ts). Ad-blocker-proof: the data is collected on the server.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  path: string | null;
  country: string | null;
  device: string | null;
  created_at: string;
}

function topBy(rows: Row[], key: keyof Row, limit = 8) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = (r[key] as string | null) || '—';
    m.set(v, (m.get(v) || 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export async function GET(request: Request) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = getSupabaseServer();
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const d7 = new Date(now - 7 * 86400000).toISOString();
    const d30 = new Date(now - 30 * 86400000).toISOString();

    const [total, today, week, month] = await Promise.all([
      supabase.from('page_views').select('*', { count: 'exact', head: true }),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', startToday.toISOString()),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', d30),
    ]);

    if (total.error) throw total.error;

    const { data } = await supabase
      .from('page_views')
      .select('path, country, device, created_at')
      .gte('created_at', d30)
      .order('created_at', { ascending: false })
      .limit(10000);
    const rows: Row[] = data || [];

    // Last 7 days, one bucket per day (oldest first).
    const series: { date: string; count: number }[] = [];
    const dayMap = new Map<string, { date: string; count: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const bucket = { date: key, count: 0 };
      series.push(bucket);
      dayMap.set(key, bucket);
    }
    for (const r of rows) {
      const bucket = dayMap.get(r.created_at.slice(0, 10));
      if (bucket) bucket.count++;
    }

    return NextResponse.json({
      total: total.count || 0,
      today: today.count || 0,
      week: week.count || 0,
      month: month.count || 0,
      topPaths: topBy(rows, 'path'),
      topCountries: topBy(rows, 'country'),
      devices: topBy(rows, 'device'),
      series,
    });
  } catch {
    // Most likely the page_views table hasn't been created yet.
    return NextResponse.json({
      error: 'no_table',
      total: 0, today: 0, week: 0, month: 0,
      topPaths: [], topCountries: [], devices: [], series: [],
    });
  }
}
