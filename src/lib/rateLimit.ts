import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Rate limiting. Uses Upstash Redis when configured (UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN) — the correct choice on serverless because the
// counter is shared across all instances and survives deploys. Falls back to a
// best-effort in-memory limiter (per-instance) when Upstash isn't configured.

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = upstashConfigured ? Redis.fromEnv() : null;
const limiters = new Map<string, Ratelimit>();

function upstashLimiter(max: number, windowSec: number): Ratelimit {
  const key = `${max}:${windowSec}`;
  let l = limiters.get(key);
  if (!l) {
    l = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: 'cantame_rl',
    });
    limiters.set(key, l);
  }
  return l;
}

// In-memory fallback store (resets per instance/deploy — not shared).
const mem = new Map<string, { count: number; reset: number }>();

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

// Returns true if the request is allowed, false if it should be rejected (429).
export async function rateLimit(
  id: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  if (redis) {
    const { success } = await upstashLimiter(max, windowSec).limit(id);
    return success;
  }
  const now = Date.now();
  const entry = mem.get(id);
  if (!entry || entry.reset < now) {
    mem.set(id, { count: 1, reset: now + windowSec * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
