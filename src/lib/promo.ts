// ─── Influencer / launch promo codes (SERVER-ONLY) ───
// Import this only from API routes — it must never reach the client bundle so
// the list of active codes isn't trivially enumerable. Discounts are applied to
// the pack *price* only; the number of credits granted never changes.
//
// To run an influencer campaign: duplicate a line below, pick a memorable CODE
// (uppercase), a percentOff, and an `influencer` label used for commission
// tracking (it's stored on the payment row + Moneroo metadata). Redeploy to apply.

export interface PromoCode {
  code: string; // matched case-insensitively
  percentOff: number; // 0..100
  influencer?: string; // tracking label (who drove the sale)
  active: boolean;
  expiresAt?: string; // optional ISO date; past = ignored
}

export const PROMO_CODES: PromoCode[] = [
  // Launch promo — 40% off (1 song $4.99 -> $2.99).
  { code: 'CANTA40', percentOff: 40, influencer: 'launch', active: true },
  // Example influencer code (copy & edit per creator):
  // { code: 'MARIA', percentOff: 25, influencer: 'maria_ig', active: true },
];

// Lowest price we let a discount reach (Moneroo needs a real charge).
const MIN_PRICE = 0.5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolvePromo(input?: string | null): PromoCode | null {
  if (!input) return null;
  const code = input.trim().toUpperCase();
  if (!code) return null;
  const p = PROMO_CODES.find((c) => c.active && c.code.toUpperCase() === code);
  if (!p) return null;
  if (p.expiresAt && Date.now() > Date.parse(p.expiresAt)) return null;
  return p;
}

export interface PromoResult {
  finalPrice: number;
  percentOff: number;
  code: string | null;
  influencer: string | null;
}

// Apply a code to a base price. Unknown/expired codes return the price unchanged.
export function applyPromo(price: number, input?: string | null): PromoResult {
  const p = resolvePromo(input);
  if (!p) return { finalPrice: round2(price), percentOff: 0, code: null, influencer: null };
  const discounted = Math.max(MIN_PRICE, price * (1 - p.percentOff / 100));
  return {
    finalPrice: round2(discounted),
    percentOff: p.percentOff,
    code: p.code.toUpperCase(),
    influencer: p.influencer ?? null,
  };
}
