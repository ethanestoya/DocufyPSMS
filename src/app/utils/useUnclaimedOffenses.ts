// Shared source of truth for derived unclaimed-order offenses, layered with
// the admin's stored decisions.
//
// The BASE detection is still derived — every surface derives it from the
// customer's own orders + their status-history timeline, so the number is
// always consistent with the authoritative data. Nothing about "was this order
// unclaimed?" is invented here.
//
// What this hook adds on top is the human layer, held in
// `restrictionsStore` (Supabase-backed):
//   • per-offense — an admin can CONFIRM (it counts, as the derivation already
//     implies) or EXCUSE (it stops counting) a derived offense.
//   • per-customer — an ACTIVE restriction pins the accepted arrangement, and
//     an INACTIVE one is explicit early forgiveness: Cash on Pickup comes back
//     regardless of what the count says.
//
// `policy` is therefore always `effectivePolicy(effectiveCount, restriction)` —
// never the raw `paymentPolicyForCount` — so every surface (checkout guard,
// Print Request, header indicator, warnings, admin tables) agrees on one
// answer. When the history read failed, `unavailable` is true so surfaces can
// say "information unavailable" instead of implying zero offenses.

import { useEffect, useMemo, useRef, useState } from "react";
import { dataStore, type Order } from "./dataStore";
import { ordersStore } from "./ordersStore";
import { landingContentStore } from "./landingContentStore";
import { useAuth } from "../contexts/AuthContext";
import { sessionUserProfileId } from "../../lib/db/orderLocksRepo";
import {
  deriveUnclaimedRecords,
  findCustomerSummary,
  getCustomerSummaries,
  isHistoryUnavailable,
  toUnclaimedOrderLikes,
  type CustomerUnclaimedSummary,
  type UnclaimedRecord,
} from "./unclaimedOrders";
import {
  effectivePolicy,
  paymentPolicyForCount,
  type PaymentArrangement,
  type PaymentPolicy,
} from "./unclaimedPolicy";
import { restrictionsStore } from "./restrictionsStore";
import type {
  CustomerRestriction,
  OffenseDecision,
  OffenseOverride,
} from "../../lib/db/restrictionsRepo";

export interface UnclaimedOffenseState {
  /** The effective count — derived offenses minus the ones admin has excused. */
  count: number;
  /** What the raw timeline says, before any admin excusal. */
  derivedCount: number;
  policy: PaymentPolicy;
  summary: CustomerUnclaimedSummary | null;
  /** The most recent unclaimed order, for "View Order" links. */
  latestOrderId: string | null;
  /** True when the status-history read failed — show an unavailable notice. */
  unavailable: boolean;
  /** The stored restriction row, if the shop has recorded one. */
  restriction: CustomerRestriction | null;
}

const EMPTY: UnclaimedOffenseState = {
  count: 0,
  derivedCount: 0,
  policy: paymentPolicyForCount(0),
  summary: null,
  latestOrderId: null,
  unavailable: false,
  restriction: null,
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
  const [, forceRender] = useState(0);

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

  // Decisions made on another machine must re-render this one.
  useEffect(
    () => restrictionsStore.subscribe(() => forceRender((n) => n + 1)),
    [],
  );

  const key = (customerKey ?? "").trim().toLowerCase();
  if (!key) return EMPTY;

  const likes = toUnclaimedOrderLikes(orders);
  const summary = findCustomerSummary(likes, key, closingTime);
  const derivedCount = summary?.count ?? 0;

  const restriction = restrictionsStore.getRestriction(key);
  const effectiveRecords = (summary?.records ?? []).filter(
    (r) => restrictionsStore.getOverride(r.orderId)?.decision !== "excused",
  );
  const count = effectiveRecords.length;

  return {
    count,
    derivedCount,
    policy: effectivePolicy(count, restriction),
    summary:
      summary && effectiveRecords.length !== summary.records.length
        ? { ...summary, count, records: effectiveRecords }
        : summary,
    latestOrderId: effectiveRecords.length
      ? effectiveRecords[effectiveRecords.length - 1].orderId
      : null,
    unavailable: isHistoryUnavailable(likes),
    restriction,
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

  // ── the admin-controlled layer ───────────────────────────────────────────
  overrides: Map<string, OffenseOverride>;
  /** Every restriction row, active and removed, newest first. */
  restrictionRows: CustomerRestriction[];
  /** Record a decision about one derived offense. */
  setOffenseDecision: (input: {
    orderId: string;
    customerKey: string;
    customerName: string;
    customerEmail: string;
    decision: OffenseDecision;
    reason: string | null;
  }) => void;
  /** Apply or change a restriction by hand. */
  applyRestriction: (input: {
    customerKey: string;
    customerName: string;
    customerEmail: string;
    arrangement: PaymentArrangement;
    reason: string | null;
  }) => void;
  /** Forgive a restriction early — Cash on Pickup comes back. */
  removeRestriction: (customerKey: string, reason: string) => void;
  /** Reinstate a restriction an admin had removed. */
  reinstateRestriction: (customerKey: string, reason: string | null) => void;
}

/**
 * Shared derivation for the admin/staff Unclaimed Orders pages. Derives the
 * unclaimed records and per-customer summaries from the live orders store +
 * landing content, then layers the stored per-offense decisions and
 * customer-level restrictions on top, so the hub and its detail pages always
 * agree — and always match what checkout enforces.
 */
export function useUnclaimedAdminData(): UnclaimedAdminData {
  const closingTime = useShopClosingTime();
  const { user } = useAuth();
  const [orders, setOrders] = useState<UnclaimedAdminOrder[]>(() =>
    ordersStore.getOrders(),
  );
  const [, forceRender] = useState(0);

  useEffect(() => {
    const sync = () => setOrders(ordersStore.getOrders());
    sync();
    return ordersStore.subscribe(sync);
  }, []);

  useEffect(
    () => restrictionsStore.subscribe(() => forceRender((n) => n + 1)),
    [],
  );

  const likes = useMemo(() => toUnclaimedOrderLikes(orders), [orders]);
  const records = useMemo(
    () => deriveUnclaimedRecords(likes, closingTime),
    [likes, closingTime],
  );

  // A snapshot of both tables, re-read whenever the store notifies.
  const overrides = useMemo(() => restrictionsStore.getOverrides(), [orders, closingTime]);
  const restrictionRows = useMemo(
    () => restrictionsStore.getAllRestrictions(),
    [orders, closingTime],
  );

  const summaries = useMemo(() => {
    return getCustomerSummaries(likes, closingTime).map((s) => {
      const kept = s.records.filter(
        (r) => overrides.get(r.orderId)?.decision !== "excused",
      );
      const restriction = restrictionsStore.getRestriction(s.customerKey);
      const policy = effectivePolicy(kept.length, restriction);
      return { ...s, count: kept.length, records: kept, policy };
    });
  }, [likes, closingTime, overrides, restrictionRows]);

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

  // Materialize a restriction the first time a customer crosses the threshold,
  // so the admin has a row to manage (arrangement, forgiveness, history). The
  // store never overwrites an existing row, and customers cannot write here
  // (this hook is only mounted on staff/admin pages).
  const ensured = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const s of summaries) {
      if (s.count < 2 || ensured.current.has(s.customerKey)) continue;
      ensured.current.add(s.customerKey);
      restrictionsStore.ensureRestrictionFor({
        customerKey: s.customerKey,
        customerName: s.name,
        customerEmail: s.email,
        count: s.count,
      });
    }
  }, [summaries]);

  const actorId = useRef<string | null>(null);
  const actorName = useRef<string>(user?.name ?? "");
  useEffect(() => {
    actorName.current = user?.name ?? "";
    if (actorId.current) return;
    void sessionUserProfileId().then((id) => {
      actorId.current = id;
    });
  }, [user?.name]);

  const setOffenseDecision = (input: {
    orderId: string;
    customerKey: string;
    customerName: string;
    customerEmail: string;
    decision: OffenseDecision;
    reason: string | null;
  }) => {
    restrictionsStore.setOverride({
      orderId: input.orderId,
      customerKey: input.customerKey,
      decision: input.decision,
      reason: input.reason,
      decidedBy: actorId.current,
      decidedByName: actorName.current || input.customerName || "Staff",
    });
    // Crossing back below the threshold on an excusal should also drop the
    // auto-applied restriction, or the customer stays blocked forever.
    const key = input.customerKey.trim().toLowerCase();
    const remaining = summaries.find((s) => s.customerKey === key)?.count ?? 0;
    const row = restrictionsStore.getRestriction(key);
    if (input.decision === "excused" && row?.active && remaining < 2) {
      restrictionsStore.setRestriction({
        customerKey: key,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        active: false,
        arrangement: row.arrangement,
        reason: row.reason,
        removedReason:
          "Automatically lifted — the last remaining offense was excused.",
        setBy: actorId.current,
        setByName: actorName.current || "Staff",
      });
    }
  };

  const applyRestriction = (input: {
    customerKey: string;
    customerName: string;
    customerEmail: string;
    arrangement: PaymentArrangement;
    reason: string | null;
  }) => {
    restrictionsStore.setRestriction({
      customerKey: input.customerKey,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      active: true,
      arrangement: input.arrangement,
      reason: input.reason,
      removedReason: null,
      setBy: actorId.current,
      setByName: actorName.current || "Staff",
    });
  };

  const removeRestriction = (customerKey: string, reason: string) => {
    const key = customerKey.trim().toLowerCase();
    const row = restrictionsStore.getRestriction(key);
    restrictionsStore.setRestriction({
      customerKey: key,
      customerName: row?.customerName ?? null,
      customerEmail: row?.customerEmail ?? null,
      active: false,
      arrangement: row?.arrangement ?? "deposit_50",
      reason: row?.reason ?? null,
      removedReason: reason,
      setBy: actorId.current,
      setByName: actorName.current || "Staff",
    });
  };

  const reinstateRestriction = (customerKey: string, reason: string | null) => {
    const key = customerKey.trim().toLowerCase();
    const row = restrictionsStore.getRestriction(key);
    restrictionsStore.setRestriction({
      customerKey: key,
      customerName: row?.customerName ?? null,
      customerEmail: row?.customerEmail ?? null,
      active: true,
      arrangement: row?.arrangement ?? "deposit_50",
      reason: reason ?? row?.reason ?? null,
      removedReason: null,
      setBy: actorId.current,
      setByName: actorName.current || "Staff",
    });
  };

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
    overrides,
    restrictionRows,
    setOffenseDecision,
    applyRestriction,
    removeRestriction,
    reinstateRestriction,
  };
}
