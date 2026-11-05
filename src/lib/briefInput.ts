// Server-side bounds on the song brief a client sends to the generation routes.
//
// Every one of these strings ends up in a paid prompt (OpenAI / MiniMax) and
// most are stored on the order, so an unbounded field is a cost lever and a DB
// bloat lever for anyone with an account. The limits sit at or above what the
// wizards' inputs already allow (name 50, stories/message/notes 500), so no
// real customer ever hits them.
import type { GenerateInput } from './generateSong';

const LIMITS = {
  recipientName: 80,
  relation: 80,
  occasion: 40,
  style: 40,
  tone: 40,
  voiceGender: 20,
  anecdote1: 600,
  anecdote2: 600,
  message: 600,
  songLanguage: 8,
  // generateSong cuts lyrics to its 1500-char window anyway; this only stops
  // megabytes from reaching the order row.
  lyrics: 4000,
  title: 120,
} as const;

export const REVISION_NOTES_MAX = 600;

function clip(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined;
}

// Keeps only the known fields, as strings, within their limits.
export function clampBrief(body: unknown): GenerateInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Record<string, string | undefined> = {};
  for (const [key, max] of Object.entries(LIMITS)) out[key] = clip(b[key], max);
  return out as GenerateInput;
}
