// Moneroo payment integration (hosted checkout + verify).
// Docs: POST /v1/payments/initialize -> { data: { id, checkout_url } }
//       GET  /v1/payments/{id}/verify -> { data: { status, ... } }
// Crediting is idempotent via a local `payments` table (we never trust the
// client redirect alone; the webhook and the callback both call creditForPayment).
import { getSupabaseServer } from './supabase';
import { addCredits } from './credits';

const BASE = process.env.MONEROO_API_BASE || 'https://api.moneroo.io/v1';
const KEY = process.env.MONEROO_SECRET_KEY;
export const MONEROO_CURRENCY = process.env.MONEROO_CURRENCY || 'USD';

export interface InitInput {
  amount: number;
  currency: string;
  description: string;
  customer: { email: string; first_name: string; last_name: string };
  return_url: string;
  metadata?: Record<string, unknown>;
}

export async function initializePayment(input: InitInput): Promise<{ id: string; checkoutUrl: string }> {
  if (!KEY) throw new Error('MONEROO_SECRET_KEY manquant côté serveur.');
  const res = await fetch(`${BASE}/payments/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.checkout_url) {
    throw new Error(`Moneroo initialize failed: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { id: String(data.data.id), checkoutUrl: String(data.data.checkout_url) };
}

export async function verifyPayment(id: string): Promise<{ status: string; raw: unknown }> {
  if (!KEY) throw new Error('MONEROO_SECRET_KEY manquant côté serveur.');
  const res = await fetch(`${BASE}/payments/${id}/verify`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  const d = (data?.data || {}) as { status?: string };
  return { status: d.status || 'unknown', raw: d };
}

// Verify a payment with Moneroo and, if successful and not already credited,
// grant the credits recorded in our local `payments` row. Idempotent.
export async function creditForPayment(paymentId: string): Promise<{ status: string; credited?: number }> {
  const v = await verifyPayment(paymentId);
  if (v.status !== 'success') return { status: v.status };

  const supabase = getSupabaseServer();
  // Atomically claim the row: only the first caller flips pending -> completed.
  const { data: claimed } = await supabase
    .from('payments')
    .update({ status: 'completed' })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select()
    .single();

  if (!claimed) return { status: 'success' }; // already credited (or unknown id)

  await addCredits(claimed.user_id, claimed.credits);
  return { status: 'success', credited: claimed.credits };
}
