// Shared gate for everything that hands a customer their audio.
//
// SERVER ONLY. Every route that can return song bytes must go through this:
// the songs bucket is public, so an order id alone must never be enough to
// reach the file — that was how /api/orders/[id]/download used to behave, and
// with a paywall in front of the audio it would have been a revenue hole, not
// just a privacy one.

import { db } from './db';
import { getUserFromRequest } from './admin';
import type { Order } from './db';

export type AccessFailure = { ok: false; status: 401 | 403 | 404 | 402; error: string };
export type AccessSuccess = { ok: true; order: Order; userId: string };

// Authenticated + owns the order. Does NOT check the paywall — use when the
// caller only needs to act on the order (e.g. unlocking it).
export async function requireOwnedOrder(
  request: Request,
  orderId: string,
): Promise<AccessSuccess | AccessFailure> {
  const user = await getUserFromRequest(request);
  if (!user) return { ok: false, status: 401, error: 'auth_required' };

  const order = await db.getOrderById(orderId);
  if (!order) return { ok: false, status: 404, error: 'not_found' };

  // Derive identity from the verified token, never from the request body.
  if ((order.user_id || order.userId) !== user.id) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, order, userId: user.id };
}

// Authenticated + owns it + has paid to unlock it. Required before returning
// any audio.
export async function requireUnlockedOrder(
  request: Request,
  orderId: string,
): Promise<AccessSuccess | AccessFailure> {
  const res = await requireOwnedOrder(request, orderId);
  if (!res.ok) return res;
  if (!res.order.unlocked) return { ok: false, status: 402, error: 'locked' };
  return res;
}
