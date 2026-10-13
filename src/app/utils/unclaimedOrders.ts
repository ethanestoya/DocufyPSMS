// Unclaimed-order DERIVATION — pure functions that turn real order records +
// their status-history timeline into unclaimed-order records and per-customer
// summaries. Nothing here is persisted; every value is recomputed from source
// data so counts can never drift, double-count, or be erased by a later status.
//
// Rules (finalized):
//   • Only Cash-on-Pickup orders are eligible (walk-in sales are exempt).
//   • An order qualifies once it reached `Completed` and the pickup deadline
//     (the shop's configured closing time on the day it became ready) has
//     passed while it was NOT collected (`Released`) on or before that deadline.
//   • Collected-before-deadline orders never count. A later `Released` does NOT
//     erase an order that was once overdue — the timeline keeps the record.
//   • Advance-paid orders never count (they are never Cash-on-Pickup).
//   • Unique by order id — the same order can never be counted twice.
//
// The timeline comes from `order_status_history`; if that read failed (permissions
// / RLS), the affected orders carry `statusHistoryUnavailable` and callers should
// surface an "information unavailable" notice rather than implying "no offenses".

import { paymentPolicyForCount, type PaymentPolicy } from "./unclaimedPolicy";

export type UnclaimedHistoryEntry = { status: string; at: string | Date };

// Minimal shape both the dataStore `Order` and the ordersStore `OrderType`
// satisfy (see the adapters at the bottom of this file).
export interface UnclaimedOrderLike {
  id: string;
  orderSource?: string | null;
  paymentMethod?: string | null;
  customerId?: string | null;
  customerName?: string;
  customerEmail?: string;
  total?: number;
  statusHistory?: UnclaimedHistoryEntry[];
  statusHistoryUnavailable?: boolean;
}

export interface UnclaimedRecord {
  orderId: string;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  paymentMethod?: string;
  orderTotal?: number;
  /** When the order became ready for pickup (earliest `Completed`). */
  readyAt: Date;
  /** Pickup deadline — closing time on the ready date. */
  deadlineAt: Date;
  /** When the offense became recordable (the deadline). Stable / deterministic. */
  recordedAt: Date;
  /** When the customer collected it, if they ever did. */
  releasedAt?: Date;
}

export interface CustomerUnclaimedSummary {
  customerKey: string;
  name: string;
  email: string;
  count: number;
  policy: PaymentPolicy;
  records: UnclaimedRecord[];
}

// ── helpers ─────────────────────────────────────────────────────────────────

function toDate(v: string | Date | undefined | null): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Earliest time the timeline shows the order entering `status`. */
function earliestStatusAt(
  history: UnclaimedHistoryEntry[] | undefined,
  status: string,
): Date | null {
  if (!history?.length) return null;
  let best: Date | null = null;
  for (const entry of history) {
    if (entry.status !== status) continue;
    const d = toDate(entry.at);
    if (!d) continue;
    if (!best || d.getTime() < best.getTime()) best = d;
  }
  return best;
}

/** The per-customer grouping key (lowercased email, else id, else name). */
export function customerKeyOf(order: UnclaimedOrderLike): string {
  const email = (order.customerEmail ?? "").trim().toLowerCase();
  if (email) return email;
  const id = (order.customerId ?? "").trim().toLowerCase();
  if (id) return id;
  return (order.customerName ?? "").trim().toLowerCase();
}

/** Eligible for an offense: a real Cash-on-Pickup order (walk-ins exempt). */
export function isCashOnPickupOrder(order: UnclaimedOrderLike): boolean {
  if ((order.orderSource ?? "").toLowerCase() === "walkin") return false;
  return (order.paymentMethod ?? "").trim().toLowerCase() === "cash";
}

/**
 * The pickup deadline for an order that became ready at `readyAt`: the shop's
 * configured closing time on that same local day. Returns null when no closing
 * time is configured (offenses cannot be computed without one).
 */
export function closingDeadline(readyAt: Date, closingTime: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((closingTime ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const deadline = new Date(readyAt);
  deadline.setHours(hours, minutes, 0, 0);
  return deadline;
}

/** True when the closing time is a usable "HH:mm" value. */
export function isClosingTimeConfigured(closingTime: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test((closingTime ?? "").trim());
}

/**
 * Derive every unclaimed-order record for the given orders. `now` is injectable
 * for deterministic testing; it defaults to the current time.
 */
export function deriveUnclaimedRecords(
  orders: UnclaimedOrderLike[],
  closingTime: string,
  now: Date = new Date(),
): UnclaimedRecord[] {
  const records = new Map<string, UnclaimedRecord>();

  for (const order of orders) {
    if (!order?.id) continue;
    if (!isCashOnPickupOrder(order)) continue;

    const readyAt = earliestStatusAt(order.statusHistory, "Completed");
    if (!readyAt) continue; // never became ready — cannot be unclaimed

    const deadlineAt = closingDeadline(readyAt, closingTime);
    if (!deadlineAt) continue; // closing time not configured — cannot compute

    if (now.getTime() <= deadlineAt.getTime()) continue; // deadline not passed yet

    const releasedAt = earliestStatusAt(order.statusHistory, "Released") ?? undefined;
    if (releasedAt && releasedAt.getTime() <= deadlineAt.getTime()) continue; // collected in time

    records.set(order.id, {
      orderId: order.id,
      customerKey: customerKeyOf(order),
      customerName: order.customerName ?? order.customerEmail ?? "Customer",
      customerEmail: order.customerEmail ?? "",
      paymentMethod: order.paymentMethod ?? undefined,
      orderTotal: typeof order.total === "number" ? order.total : undefined,
      readyAt,
      deadlineAt,
      recordedAt: deadlineAt,
      releasedAt,
    });
  }

  return Array.from(records.values()).sort(
    (a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime(),
  );
}

/** Per-customer summaries for every customer with at least one record. */
export function getCustomerSummaries(
  orders: UnclaimedOrderLike[],
  closingTime: string,
  now: Date = new Date(),
): CustomerUnclaimedSummary[] {
  const records = deriveUnclaimedRecords(orders, closingTime, now);
  const byKey = new Map<string, UnclaimedRecord[]>();

  for (const record of records) {
    const list = byKey.get(record.customerKey) ?? [];
    list.push(record);
    byKey.set(record.customerKey, list);
  }

  const summaries: CustomerUnclaimedSummary[] = [];
  byKey.forEach((customerRecords, customerKey) => {
    const count = customerRecords.length;
    summaries.push({
      customerKey,
      name: customerRecords[0].customerName,
      email: customerRecords[0].customerEmail,
      count,
      policy: paymentPolicyForCount(count),
      records: customerRecords,
    });
  });

  return summaries.sort((a, b) => b.count - a.count);
}

/** The unclaimed policy for one customer (count 0 when clean/unknown). */
export function getCustomerPolicy(
  orders: UnclaimedOrderLike[],
  customerKey: string | null | undefined,
  closingTime: string,
  now: Date = new Date(),
): PaymentPolicy {
  const summary = findCustomerSummary(orders, customerKey, closingTime, now);
  return summary?.policy ?? paymentPolicyForCount(0);
}

/** The full summary for one customer, or null when they have no records. */
export function findCustomerSummary(
  orders: UnclaimedOrderLike[],
  customerKey: string | null | undefined,
  closingTime: string,
  now: Date = new Date(),
): CustomerUnclaimedSummary | null {
  const key = (customerKey ?? "").trim().toLowerCase();
  if (!key) return null;
  return (
    getCustomerSummaries(orders, closingTime, now).find(
      (s) => s.customerKey === key,
    ) ?? null
  );
}

/** True when any order's history read failed — surface an "unavailable" notice. */
export function isHistoryUnavailable(orders: UnclaimedOrderLike[]): boolean {
  return orders.some((o) => o.statusHistoryUnavailable === true);
}

// ── adapters ────────────────────────────────────────────────────────────────
// Keep the derivation decoupled from either store's concrete Order shape.

interface OrderishLike {
  id: string;
  orderSource?: string | null;
  paymentMethod?: string | null;
  customerId?: string | null;
  customerName?: string;
  customer?: string;
  customerEmail?: string;
  total?: unknown;
  manualTotal?: number;
  costBreakdown?: { total?: number } | null;
  statusHistory?: UnclaimedHistoryEntry[];
  statusHistoryUnavailable?: boolean;
}

function numericTotal(o: OrderishLike): number | undefined {
  if (typeof o.manualTotal === "number") return o.manualTotal;
  if (o.costBreakdown && typeof o.costBreakdown.total === "number") {
    return o.costBreakdown.total;
  }
  return typeof o.total === "number" ? o.total : undefined;
}

/** Adapt any app order (dataStore `Order` or ordersStore `OrderType`). */
export function toUnclaimedOrderLike(o: OrderishLike): UnclaimedOrderLike {
  return {
    id: o.id,
    orderSource: o.orderSource ?? null,
    paymentMethod: o.paymentMethod ?? null,
    customerId: o.customerId ?? null,
    customerName: o.customerName ?? o.customer,
    customerEmail: o.customerEmail,
    total: numericTotal(o),
    statusHistory: o.statusHistory,
    statusHistoryUnavailable: o.statusHistoryUnavailable,
  };
}

export function toUnclaimedOrderLikes(orders: OrderishLike[]): UnclaimedOrderLike[] {
  return orders.map(toUnclaimedOrderLike);
}
