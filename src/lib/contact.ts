// Contact form messages — persistence + input validation.
//
// SERVER ONLY: this imports getSupabaseServer() (service_role, bypasses RLS).
// Never import it from client code. The shared subject list lives in
// lib/constants.ts so the modal can render it without pulling this in.
//
// contact_messages has RLS enabled with NO policies, so the service_role key is
// the only way in — visitor emails are not readable from the browser.

import { getSupabaseServer } from './supabase';
import { CONTACT_SUBJECTS } from './constants';

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';

export const CONTACT_STATUSES: ContactStatus[] = ['new', 'read', 'replied', 'archived'];

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  admin_note: string | null;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  locale: string | null;
  created_at: string;
  updated_at: string | null;
  // camelCase aliases, matching the convention in db.ts
  adminNote?: string | null;
  userId?: string | null;
  userAgent?: string | null;
  createdAt?: string;
}

function mapMessage(row: ContactMessage): ContactMessage {
  return {
    ...row,
    adminNote: row.admin_note,
    userId: row.user_id,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export const CONTACT_LIMITS = {
  name: 80,
  email: 160,
  messageMin: 10,
  messageMax: 2000,
};

export interface ValidatedContact {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Deliberately permissive but structural: catches typos like "a@b" and
// "no-at-sign.com" without rejecting valid-but-unusual real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Pure validation — no DB access, so the route can reject bad input before
// touching Supabase. Returns either the normalized values or a field error.
export function validateContactInput(body: unknown):
  | { ok: true; value: ValidatedContact }
  | { ok: false; field: string; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const name = str(b.name);
  if (!name) return { ok: false, field: 'name', error: 'Name is required' };
  if (name.length > CONTACT_LIMITS.name) {
    return { ok: false, field: 'name', error: 'Name is too long' };
  }

  const email = str(b.email).toLowerCase();
  if (!email) return { ok: false, field: 'email', error: 'Email is required' };
  if (email.length > CONTACT_LIMITS.email || !EMAIL_RE.test(email)) {
    return { ok: false, field: 'email', error: 'Email is invalid' };
  }

  const message = str(b.message);
  if (message.length < CONTACT_LIMITS.messageMin) {
    return { ok: false, field: 'message', error: 'Message is too short' };
  }
  if (message.length > CONTACT_LIMITS.messageMax) {
    return { ok: false, field: 'message', error: 'Message is too long' };
  }

  // Unknown subjects fall back to 'general' rather than failing — the subject is
  // a convenience for triage, not worth blocking a real message over.
  const raw = str(b.subject);
  const subject = (CONTACT_SUBJECTS as readonly string[]).includes(raw) ? raw : 'general';

  return { ok: true, value: { name, email, subject, message } };
}

export interface CreateContactInput extends ValidatedContact {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  locale?: string | null;
}

export async function createContactMessage(input: CreateContactInput): Promise<ContactMessage | null> {
  const { data, error } = await getSupabaseServer()
    .from('contact_messages')
    .insert({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      status: 'new',
      user_id: input.userId || null,
      ip: input.ip || null,
      user_agent: input.userAgent || null,
      locale: input.locale || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating contact message:', error.message);
    return null;
  }
  return mapMessage(data as ContactMessage);
}

export async function listContactMessages(status?: string, limit = 200): Promise<ContactMessage[]> {
  let query = getSupabaseServer()
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('Error listing contact messages:', error.message);
    return [];
  }
  return (data || []).map((r) => mapMessage(r as ContactMessage));
}

export async function countNewMessages(): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('contact_messages')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) return 0;
  return count || 0;
}

export async function updateContactMessage(
  id: string,
  patch: { status?: string; adminNote?: string },
): Promise<ContactMessage | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.status !== undefined) {
    if (!CONTACT_STATUSES.includes(patch.status as ContactStatus)) return null;
    update.status = patch.status;
  }
  if (patch.adminNote !== undefined) {
    update.admin_note = patch.adminNote.slice(0, 2000);
  }

  const { data, error } = await getSupabaseServer()
    .from('contact_messages')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating contact message:', error.message);
    return null;
  }
  return mapMessage(data as ContactMessage);
}
