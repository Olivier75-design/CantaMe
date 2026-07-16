// Server-only credit balance helpers.
// Credits live in Supabase Auth `app_metadata` (server-controlled — a user
// cannot edit their own app_metadata, only the service_role key can), so no
// extra table/migration is needed.
import { getSupabaseServer } from './supabase';
import { CREDITS } from './constants';

// Read the balance, auto-initializing brand-new/legacy accounts with the free
// signup credit the first time they're seen.
export async function getCredits(userId: string): Promise<number> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) throw new Error(error?.message || 'User not found');

  const raw = data.user.app_metadata?.credits;
  if (raw === undefined || raw === null) {
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { credits: CREDITS.freeOnSignup },
    });
    return CREDITS.freeOnSignup;
  }
  return Number(raw) || 0;
}

// Spend `n` credits if the balance allows. Returns the resulting balance and
// whether the spend succeeded (false = not enough credits).
export async function spendCredits(
  userId: string,
  n = 1,
): Promise<{ ok: boolean; credits: number }> {
  const current = await getCredits(userId);
  if (current < n) return { ok: false, credits: current };

  const next = current - n;
  const supabase = getSupabaseServer();
  await supabase.auth.admin.updateUserById(userId, { app_metadata: { credits: next } });
  return { ok: true, credits: next };
}

// Add `n` credits (e.g. after a purchase). Returns the new balance.
export async function addCredits(userId: string, n: number): Promise<number> {
  const current = await getCredits(userId);
  const next = current + Math.max(0, n);
  const supabase = getSupabaseServer();
  await supabase.auth.admin.updateUserById(userId, { app_metadata: { credits: next } });
  return next;
}

// Set the balance to an exact value (admin grant/adjust only — never call this
// from a user-facing flow). Clamps to >= 0. Returns the new balance.
export async function setCredits(userId: string, n: number): Promise<number> {
  const next = Math.max(0, Math.floor(Number(n) || 0));
  const supabase = getSupabaseServer();
  await supabase.auth.admin.updateUserById(userId, { app_metadata: { credits: next } });
  return next;
}
