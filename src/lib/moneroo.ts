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

// The live site ran on a sandbox key: real cards are declined on a sandbox
// checkout, and Moneroo's always-approved test cards would have minted real
// credits. Sandbox is for local/preview only.
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';

export interface InitInput {
  amount: number;
  currency: string;
  description: string;
  customer: { email: string; first_name: string; last_name: string };
  return_url: string;
  metadata?: Record<string, unknown>;
}

// Moneroo rejects the whole initialize call (422) unless every metadata value is
// a string, boolean or integer: a `null` (no promo code) or a decimal (a promo
// price like 2.4) blocked every purchase. Drop empty values, stringify the rest.
function monerooMetadata(meta: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'boolean' || (typeof v === 'number' && Number.isInteger(v)) ? v : String(v);
  }
  return out;
}

export async function initializePayment(input: InitInput): Promise<{ id: string; checkoutUrl: string }> {
  if (!KEY) throw new Error('MONEROO_SECRET_KEY manquant côté serveur.');
  if (IS_PRODUCTION && KEY.startsWith('pvk_sandbox_')) {
    throw new Error('MONEROO_SECRET_KEY is a sandbox key in production — set the live key in Vercel.');
  }
  const res = await fetch(`${BASE}/payments/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...input, metadata: monerooMetadata(input.metadata) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.checkout_url) {
    throw new Error(`Moneroo initialize failed: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { id: String(data.data.id), checkoutUrl: String(data.data.checkout_url) };
}

export async function verifyPayment(id: string): Promise<{ status: string; environment?: string; raw: unknown }> {
  if (!KEY) throw new Error('MONEROO_SECRET_KEY manquant côté serveur.');
  const res = await fetch(`${BASE}/payments/${id}/verify`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  const d = (data?.data || {}) as { status?: string; environment?: string };
  return { status: d.status || 'unknown', environment: d.environment, raw: d };
}

// Verify a payment with Moneroo and, if successful and not already credited,
// grant the credits recorded in our local `payments` row. Idempotent.
export async function creditForPayment(paymentId: string): Promise<{ status: string; credited?: number }> {
  const v = await verifyPayment(paymentId);
  if (v.status !== 'success') return { status: v.status };
  if (IS_PRODUCTION && v.environment === 'sandbox') {
    console.error(`Moneroo: sandbox payment ${paymentId} refused in production`);
    return { status: 'sandbox_refused' };
  }

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
