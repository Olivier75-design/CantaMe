// Client helper: check a promo code for display (discounted price preview).
// The real discount is always re-applied server-side in /api/payments/create.
export interface PromoCheck {
  valid: boolean;
  percentOff: number;
  code: string | null;
}

export async function validatePromo(code: string): Promise<PromoCheck> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, percentOff: 0, code: null };
  try {
    const res = await fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed }),
    });
    const d = await res.json();
    return {
      valid: !!d.valid,
      percentOff: typeof d.percentOff === 'number' ? d.percentOff : 0,
      code: d.code || null,
    };
  } catch {
    return { valid: false, percentOff: 0, code: null };
  }
}

// Price after a percentage discount, rounded to 2 decimals (matches the server).
export function discounted(price: number, percentOff: number): number {
  if (!percentOff) return Math.round(price * 100) / 100;
  return Math.round(Math.max(0.5, price * (1 - percentOff / 100)) * 100) / 100;
}
