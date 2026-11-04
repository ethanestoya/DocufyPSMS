// Automatic payment-deadline expiry for the new order lifecycle.
// Every awaited-payment order carries a `paymentDeadline` (computed from the
// admin-editable cash-on-pickup / online verification windows in pricingStore;
// set when the order is placed). While an order sits in 'Awaiting Payment'
// WITHOUT its required payment being verified and the deadline passes, this
// module auto-cancels it as expired:
//   status -> 'Canceled', cancellationReason -> 'Payment Deadline Expired'
// and notifies staff/admin and the customer. Expired orders leave the active
// queue but remain in order history with the reason displayed.
//
// Configurable (never hardcoded): each order's deadline is the earlier of the
// admin-set payment window and the shop's closing time on the day it was
// placed (see paymentDeadline.ts), stamped onto the order at checkout. A
// window of 0 means the closing time IS the deadline, so a deadline is only
// absent when the shop has configured neither.
//
// Where the sweep runs: primarily on the SERVER via the `expire_overdue_orders`
// SECURITY DEFINER function (also scheduled by pg_cron every minute), so
// deadlines expire — and notifications go out — even while no browser is open.
// The local loop below stays as an idempotent FALLBACK for when that SQL
// function hasn't been installed yet or isn't reachable.
import { dataStore, type Order } from './dataStore';
import { notificationStore } from './notificationStore';
import { formatPHDateTime } from './pht';
import { shopStatusStore } from './shopStatusStore';
import { runServerExpiry } from '../../lib/db/paymentExpiryRepo';

export const PAYMENT_DEADLINE_EXPIRED_REASON = 'Payment Deadline Expired';

// True when an order is still waiting on the customer to pay: it is awaiting
// payment, nothing has been submitted, and nothing has been verified.
function isAwaitingPaymentOrder(order: Order): boolean {
  if (order.status !== 'Awaiting Payment') return false;
  // Once the customer has submitted their payment reference, the order is
  // waiting on staff verification — never auto-cancel it for deadline expiry
  // (defense-in-depth even if a stored order still carries a deadline).
  if (order.paymentReferenceNumber) return false;
  const verified =
    order.paymentVerified ||
    order.downPaymentVerified ||
    order.fullPaymentVerified;
  return !verified;
}

// True when an awaiting-payment order is actively pending (nothing verified)
// and its deadline has passed.
export function isOrderExpired(order: Order, now: Date = new Date()): boolean {
  if (!isAwaitingPaymentOrder(order)) return false;
  if (!order.paymentDeadline) return false;
  return new Date(order.paymentDeadline).getTime() <= now.getTime();
}

// Cancel every expired awaiting-payment order. Dedup via clearing the deadline.
async function expireOverdueOrdersLocally(): Promise<void> {
  const now = new Date();

  for (const order of dataStore.getOrders()) {
    if (!isOrderExpired(order, now)) continue;

    try {
      await dataStore.updateOrder(order.id, {
        status: 'Canceled',
        cancellationReason: PAYMENT_DEADLINE_EXPIRED_REASON,
        holdReason: undefined,
        paymentDeadline: undefined,
      });
    } catch (err) {
      console.warn('[paymentExpiry] failed to cancel expired order', order.id, err);
      continue;
    }

    const deadlineLabel = formatPHDateTime(order.paymentDeadline);
    // `order.id` is the DB uuid; notifications must show the human ORD-XXXX label.
    const orderLabel = order.displayId ?? order.id;
    notificationStore.addNotification('order', 'Order Cancelled — Payment Deadline Expired', `${order.customerName}'s order ${orderLabel} (${order.total}) was auto-cancelled because payment was not confirmed before ${deadlineLabel} (deadline expired).`, {
      clickable: true,
      priority: 'important',
      relatedOrderId: order.id,
      relatedRoute: '/staff/queue',
      recipientRole: 'staff_admin',
    });
    notificationStore.addNotification('order', 'Order Cancelled — Payment Deadline Expired', `Your order ${orderLabel} was auto-cancelled because payment was not confirmed before ${deadlineLabel}. If you still need this order, please place it again.`, {
      clickable: true,
      relatedOrderId: order.id,
      relatedRoute: '/customer/orders',
      recipientEmail: order.customerEmail,
    });
  }
}

// Run the sweep on the server when possible (single writer, notifies even with
// no browser open); otherwise fall back to the local loop. Both paths are
// idempotent — clearing the deadline stops any second pass from re-firing.
let sweeping = false;
export async function expireOverdueOrders(): Promise<void> {
  // While the shop is paused, deadlines are frozen — no auto-cancellations.
  if (!shopStatusStore.isOperational()) return;
  if (sweeping) return;
  sweeping = true;
  try {
    const cancelledOnServer = await runServerExpiry();
    if (cancelledOnServer !== null) return;
    await expireOverdueOrdersLocally();
  } finally {
    sweeping = false;
  }
}

// ── Pause restart ───────────────────────────────────────────────────────────
// Freezing the sweep during a pause protects an order from being cancelled
// mid-outage, but it would also cost the customer the paused hours: they come
// back to a deadline one outage shorter than the one they were given. So the
// clock stops at the pause and resumes at the reopen — every still-awaiting
// deadline is pushed forward by the paused duration.
const RESTART_MARKER_KEY = 'docufy_deadline_restart_v1';

async function pushDeadlinesPastPause(pausedMs: number): Promise<void> {
  for (const order of dataStore.getOrders()) {
    if (!isAwaitingPaymentOrder(order) || !order.paymentDeadline) continue;
    const deadline = new Date(order.paymentDeadline).getTime();
    if (isNaN(deadline)) continue;
    try {
      await dataStore.updateOrder(order.id, {
        paymentDeadline: new Date(deadline + pausedMs).toISOString(),
      });
    } catch (err) {
      console.warn(
        '[paymentExpiry] failed to restart the deadline of',
        order.id,
        err,
      );
    }
  }
}

let lastShopStatus = shopStatusStore.getStatus();
// The moment the current non-operational stretch began; `setStatus` stamps
// `updatedAt` on every flip, so while paused this IS the pause start.
let pausedSince = shopStatusStore.getState().updatedAt;

shopStatusStore.subscribe(() => {
  const next = shopStatusStore.getState();
  const previousStatus = lastShopStatus;
  lastShopStatus = next.status;

  if (next.status !== 'open') {
    // Entering an outage from an open shop starts the measured stretch; a
    // pause that turns into a scheduled close keeps the original start.
    if (previousStatus === 'open') pausedSince = next.updatedAt;
    return;
  }
  if (previousStatus === 'open') return;

  const reopenedAt = next.updatedAt ? new Date(next.updatedAt).getTime() : Date.now();
  const pausedFrom = pausedSince ? new Date(pausedSince).getTime() : NaN;
  pausedSince = next.updatedAt;
  if (!Number.isFinite(pausedFrom)) return;
  const pausedMs = reopenedAt - pausedFrom;
  if (pausedMs <= 0) return;

  // One reopen reaches this browser more than once — the local write, the
  // cross-tab storage echo and the realtime hydrate — so remember which reopen
  // has already been applied instead of extending the same orders again.
  try {
    if (localStorage.getItem(RESTART_MARKER_KEY) === next.updatedAt) return;
    localStorage.setItem(RESTART_MARKER_KEY, next.updatedAt ?? '');
  } catch {
    // storage unavailable — apply once for this session
  }

  void pushDeadlinesPastPause(pausedMs);
});

// Evaluate once on load and then on a lightweight interval so deadlines expire
// even while the page is sitting open.
void expireOverdueOrders();
const EXPIRY_CHECK_INTERVAL_MS = 30_000;
setInterval(() => {
  void expireOverdueOrders();
}, EXPIRY_CHECK_INTERVAL_MS);
