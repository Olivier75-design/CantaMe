import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase';
import { CREDITS } from '@/lib/constants';

export const runtime = 'nodejs';

// Server-side sign-up that creates the account already email-confirmed.
// This removes the "Email not confirmed" wall (no SMTP is configured) so a
// buyer can sign in and reach their dashboard immediately after paying.
export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || '' },
      app_metadata: { credits: CREDITS.freeOnSignup },
    });

    if (error) {
      // Account already exists (e.g. an older unconfirmed sign-up). Recover it:
      // confirm the email and reset the password to what was just entered so
      // the user can sign in right away.
      if (/already|registered|exists/i.test(error.message)) {
        const existing = await findUserByEmail(supabase, email);
        if (existing) {
          const { error: upErr } = await supabase.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
            user_metadata: { full_name: name || existing.user_metadata?.full_name || '' },
          });
          if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
          return NextResponse.json({ success: true, recovered: true });
        }
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: data.user?.id });
  } catch (e) {
    console.error('Signup error:', e);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}

// listUsers is paginated; scan a few pages to find the account by email.
async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<User | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}
