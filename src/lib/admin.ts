import { getSupabaseServer } from './supabase';
import type { User } from '@supabase/supabase-js';

// Verify the request's Supabase access token (Authorization: Bearer <jwt>) and
// return the authenticated user, or null. getUser() validates the JWT against
// Supabase's servers, so identity is trustworthy — derive user ids from THIS,
// never from the request body.
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const { data, error } = await getSupabaseServer().auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Admin allowlist. Configured via NEXT_PUBLIC_ADMIN_EMAILS (comma-separated).
// It's NEXT_PUBLIC so the client can also hide the /admin UI, but every admin
// API route additionally verifies the caller's Supabase token server-side —
// the client check alone is not trusted.
export function getAdminEmails(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  return list.length > 0 && list.includes(email.toLowerCase());
}

// Server-side gate: verifies the request carries a valid Supabase access token
// (Authorization: Bearer <jwt>) belonging to an allowlisted admin.
export async function verifyAdminRequest(request: Request): Promise<boolean> {
  const user = await getUserFromRequest(request);
  return isAdminEmail(user?.email);
}
