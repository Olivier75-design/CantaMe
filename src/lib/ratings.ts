// Song ratings — the 👍/👎 the customer leaves on a finished song.
//
// SERVER ONLY (imports the service_role client). song_ratings has RLS enabled
// with no policies, so this module is the only way in.
//
// Why it exists: prompt changes were being shipped with no way to tell whether
// they made songs better. Each row snapshots the settings that produced the
// song, so "which styles/voices actually land" becomes a query instead of a
// guess.

import { getSupabaseServer } from './supabase';

export const RATINGS = ['up', 'down'] as const;
export type Rating = (typeof RATINGS)[number];

export function isValidRating(v: unknown): v is Rating {
  return typeof v === 'string' && (RATINGS as readonly string[]).includes(v);
}

export interface CreateRatingInput {
  rating: Rating;
  audioUrl?: string | null;
  orderId?: string | null;
  style?: string | null;
  tone?: string | null;
  voiceGender?: string | null;
  occasion?: string | null;
  language?: string | null;
  userId?: string | null;
  ip?: string | null;
}

// Upserts on audio_url so changing your mind updates the row rather than
// stacking a second vote for the same song.
export async function saveRating(input: CreateRatingInput): Promise<boolean> {
  const row = {
    rating: input.rating,
    audio_url: input.audioUrl || null,
    order_id: input.orderId || null,
    style: input.style || null,
    tone: input.tone || null,
    voice_gender: input.voiceGender || null,
    occasion: input.occasion || null,
    language: input.language || null,
    user_id: input.userId || null,
    ip: input.ip || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.audioUrl
    ? await getSupabaseServer().from('song_ratings').upsert(row, { onConflict: 'audio_url' })
    : await getSupabaseServer().from('song_ratings').insert(row);

  if (error) {
    console.error('Error saving song rating:', error.message);
    return false;
  }
  return true;
}

interface Row {
  rating: string;
  style: string | null;
  tone: string | null;
  voice_gender: string | null;
  occasion: string | null;
  created_at: string;
}

export interface Breakdown {
  name: string;
  up: number;
  down: number;
  total: number;
  score: number; // percentage of thumbs up, 0-100
}

export interface RatingStats {
  total: number;
  up: number;
  down: number;
  score: number;
  byStyle: Breakdown[];
  byVoice: Breakdown[];
  byTone: Breakdown[];
  byOccasion: Breakdown[];
  recent: { rating: string; style: string | null; createdAt: string }[];
  error?: string;
}

const EMPTY: RatingStats = {
  total: 0, up: 0, down: 0, score: 0,
  byStyle: [], byVoice: [], byTone: [], byOccasion: [], recent: [],
};

function groupBy(rows: Row[], key: keyof Row): Breakdown[] {
  const m = new Map<string, { up: number; down: number }>();
  for (const r of rows) {
    const name = (r[key] as string | null) || '—';
    const b = m.get(name) || { up: 0, down: 0 };
    if (r.rating === 'up') b.up++;
    else b.down++;
    m.set(name, b);
  }
  return Array.from(m.entries())
    .map(([name, b]) => {
      const total = b.up + b.down;
      return { name, ...b, total, score: total ? Math.round((b.up / total) * 100) : 0 };
    })
    // Most-rated first: a 100% score off a single vote is noise, not a signal.
    .sort((a, b) => b.total - a.total);
}

export async function getRatingStats(): Promise<RatingStats> {
  const { data, error } = await getSupabaseServer()
    .from('song_ratings')
    .select('rating, style, tone, voice_gender, occasion, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  // Most likely the table hasn't been created yet — degrade to an empty view
  // rather than breaking the admin page (same approach as /api/analytics).
  if (error) return { ...EMPTY, error: 'no_table' };

  const rows: Row[] = data || [];
  const up = rows.filter((r) => r.rating === 'up').length;
  const down = rows.length - up;

  return {
    total: rows.length,
    up,
    down,
    score: rows.length ? Math.round((up / rows.length) * 100) : 0,
    byStyle: groupBy(rows, 'style'),
    byVoice: groupBy(rows, 'voice_gender'),
    byTone: groupBy(rows, 'tone'),
    byOccasion: groupBy(rows, 'occasion'),
    recent: rows.slice(0, 20).map((r) => ({ rating: r.rating, style: r.style, createdAt: r.created_at })),
  };
}
