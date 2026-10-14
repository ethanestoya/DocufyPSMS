// Shared customer-facing source of truth for derived unclaimed-order offenses.
// Every customer surface (Dashboard notice, My Orders notice + row highlight,
// Print Request notice, header indicator) reads this hook so they all agree on
// the same count, the same policy, and the same affected order.
//
// The count is DERIVED from the customer's own orders (scoped via
// `dataStore.getOrdersByCustomer`) + their status-history timeline. Nothing is
// stored, so the value is always consistent with the authoritative data. When
// the history read failed for the customer's orders, `unavailable` is true so
// surfaces can show an "information unavailable" notice instead of implying
// the customer has zero offenses.

import { useEffect, useMemo, useState } from "react";
import { dataStore, type Order } from "./dataStore";
import { ordersStore } from "./ordersStore";
import { landingContentStore } from "./landingContentStore";
import {
  deriveUnclaimedRecords,
  findCustomerSummary,
  getCustomerSummaries,
  isHistoryUnavailable,
  toUnclaimedOrderLikes,
  type CustomerUnclaimedSummary,
  type UnclaimedRecord,
} from "./unclaimedOrders";
import { paymentPolicyForCount, type PaymentPolicy } from "./unclaimedPolicy";

export interface UnclaimedOffenseState {
  count: number;
  policy: PaymentPolicy;
  summary: CustomerUnclaimedSummary | null;
  /** The most recent unclaimed order, for "View Order" links. */
  latestOrderId: string | null;
  /** True when the status-history read failed — show an unavailable notice. */
  unavailable: boolean;
}

const EMPTY: UnclaimedOffenseState = {
  count: 0,
  policy: paymentPolicyForCount(0),
  summary: null,
  latestOrderId: null,
  unavailable: false,
};

export function useUnclaimedOffenses(
  customerKey: string | null | undefined,
): UnclaimedOffenseState {
  const [orders, setOrders] = useState<Order[]>(() =>
    customerKey ? dataStore.getOrdersByCustomer(customerKey) : [],
  );
  const [closingTime, setClosingTime] = useState<string>(
    () => landingContentStore.getContent().shopClosingTime,
  );

  useEffect(() => {
    const sync = () =>
      setOrders(customerKey ? dataStore.getOrdersByCustomer(customerKey) : []);
    sync();
    return dataStore.subscribe(sync);
  }, [customerKey]);

  useEffect(() => {
    const sync = () => setClosingTime(landingContentStore.getContent().shopClosingTime);
    sync();
    return landingContentStore.subscribe(sync);
  }, []);

  const key = (customerKey ?? "").trim();
  if (!key) return EMPTY;

  const likes = toUnclaimedOrderLikes(orders);
  const summary = findCustomerSummary(likes, key, closingTime);
  const count = summary?.count ?? 0;

  return {
    count,
    policy: summary?.policy ?? paymentPolicyForCount(0),
    summary,
    latestOrderId:
      summary && summary.records.length
        ? summary.records[summary.records.length - 1].orderId
        : null,
    unavailable: isHistoryUnavailable(likes),
  };
}

/** Shared "closing time not configured" helper for the admin pages. */
export function useShopClosingTime(): string {
  const [closingTime, setClosingTime] = useState<string>(
    () => landingContentStore.getContent().shopClosingTime,
  );
  useEffect(() => {
    const sync = () => setClosingTime(landingContentStore.getContent().shopClosingTime);
    sync();
    return landingContentStore.subscribe(sync);
  }, []);
  return closingTime;
}

/** A single order row as returned by `ordersStore`. */
export type UnclaimedAdminOrder = ReturnType<typeof ordersStore.getOrders>[number];

export interface UnclaimedAdminData {
  orders: UnclaimedAdminOrder[];
  records: UnclaimedRecord[];
  summaries: CustomerUnclaimedSummary[];
  ordersById: Map<string, UnclaimedAdminOrder>;
  /** Records still not collected (no `releasedAt`) — the current offenses. */
  uncollectedRecords: UnclaimedRecord[];
  /** Records collected AFTER their deadline — the late-pickup history. */
  latePickups: UnclaimedRecord[];
  uncollectedCount: number;
  restrictedSummaries: CustomerUnclaimedSummary[];
  closingTime: string;
  historyUnavailable: boolean;
}

/**
 * Shared derivation for the admin/staff Unclaimed Orders pages. Derives the
 * unclaimed records, per-customer summaries, restricted customers, and the
 * closing time from the live orders store + landing content, so the hub and
 * its detail pages always agree. Nothing is stored.
 */
export function useUnclaimedAdminData(): UnclaimedAdminData {
  const closingTime = useShopClosingTime();
  const [orders, setOrders] = useState<UnclaimedAdminOrder[]>(() =>
    ordersStore.getOrders(),
  );

  useEffect(() => {
    const sync = () => setOrders(ordersStore.getOrders());
    sync();
    return ordersStore.subscribe(sync);
  }, []);

  const likes = useMemo(() => toUnclaimedOrderLikes(orders), [orders]);
  const records = useMemo(
    () => deriveUnclaimedRecords(likes, closingTime),
    [likes, closingTime],
  );
  const summaries = useMemo(
    () => getCustomerSummaries(likes, closingTime),
    [likes, closingTime],
  );

  const ordersById = useMemo(() => {
    const map = new Map<string, UnclaimedAdminOrder>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const restrictedSummaries = useMemo(
    () => summaries.filter((s) => s.policy.cashOnPickupDisabled),
    [summaries],
  );

  const uncollectedRecords = useMemo(
    () => records.filter((r) => !r.releasedAt),
    [records],
  );

  const latePickups = useMemo(
    () => records.filter((r) => !!r.releasedAt),
    [records],
  );

  const uncollectedCount = uncollectedRecords.length;

  const historyUnavailable = orders.some((o) => o.statusHistoryUnavailable);

  return {
    orders,
    records,
    summaries,
    ordersById,
    uncollectedRecords,
    latePickups,
    uncollectedCount,
    restrictedSummaries,
    closingTime,
    historyUnavailable,
  };
}
