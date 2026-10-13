// PREVIEW ONLY — Unpaid & Unclaimed Order Penalty workflow (UI phase).
//
// This module holds the *design-preview* state for the proposed pickup incident
// review workflow. It is deliberately IN-MEMORY (never localStorage, never the
// database) so nothing here can ever be mistaken for a real penalty record or
// survive as a persisted customer restriction.
//
// The real policy is still awaiting client confirmation:
//   - how long a customer has to collect a completed order,
//   - what counts as a valid excuse,
//   - whether a second confirmed incident requires 50% / full advance payment,
//   - how long restrictions last and who may remove them,
//   - whether outstanding balances block new orders.
//
// Until those are decided, every write here is a presentational preview. See
// OrderPickupReview.tsx (staff/admin review controls),
// OrderViolationsSection.tsx (customer account preview) and
// PaymentRestrictionNotice.tsx (reusable customer-facing notice).

export type IncidentReviewStatus =
  | "not_reviewed"
  | "pending_review"
  | "confirmed_unclaimed"
  | "excused";

/** Proposed advance-payment arrangement for a 2nd+ confirmed incident. */
export type PaymentArrangement = "deposit_50" | "full_advance";

export interface PickupIncident {
  orderId: string;
  /** Stable per-customer key (email preferred) used to group incidents. */
  customerKey?: string;
  status: IncidentReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Decision reason (admin-owned) or the staff note routed to admin. */
  reason?: string;
  /** Free-text explanation supplied by the customer (recorded as text only). */
  customerExplanation?: string;
  /** Staff note submitted to Admin for review (never shown to the customer). */
  staffNote?: string;
  /** Staff-only flag: mark the order for Admin review. */
  flaggedForReview?: boolean;
  flaggedBy?: string;
}

export interface RestrictionPreview {
  /** Which advance-payment arrangement Admin selected (null = none yet). */
  arrangement: PaymentArrangement | null;
  active: boolean;
  reason?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const INCIDENT_STATUS_LABELS: Record<IncidentReviewStatus, string> = {
  not_reviewed: "Not Reviewed",
  pending_review: "Pending Review",
  confirmed_unclaimed: "Confirmed Unclaimed",
  excused: "Excused",
};

export const PAYMENT_ARRANGEMENT_LABELS: Record<PaymentArrangement, string> = {
  deposit_50: "50% deposit on future orders",
  full_advance: "Full payment in advance for future orders",
};

/**
 * FINALIZED RULE (customer checkout): once a customer has this many CONFIRMED
 * unclaimed-order offenses, Cash on Pickup is no longer selectable for their
 * future orders — they must pay with an available advance (online) method.
 * Only `confirmed_unclaimed` incidents count; pending_review, excused, and
 * untouched orders never do.
 */
export const CASH_ON_PICKUP_MIN_CONFIRMED_OFFENSES = 2;

/** Shared customer-facing explanation for the disabled Cash on Pickup option. */
export const CASH_ON_PICKUP_BLOCKED_MESSAGE =
  "Cash on Pickup is unavailable because your account has a second confirmed unclaimed-order offense. Please choose an available advance payment method.";

// In-memory preview maps. Reset on every full page reload — intentional.
const incidents = new Map<string, PickupIncident>();
const restrictions = new Map<string, RestrictionPreview>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // A listener throwing must never break the store.
    }
  });
}

export const pickupReview = {
  getIncident(orderId: string): PickupIncident | undefined {
    return incidents.get(orderId);
  },

  /** Every touched incident in this session (used by the Unclaimed Orders page). */
  getAllIncidents(): PickupIncident[] {
    return Array.from(incidents.values());
  },

  /** Effective status — anything never touched reads as "Not Reviewed". */
  getStatus(orderId: string): IncidentReviewStatus {
    return incidents.get(orderId)?.status ?? "not_reviewed";
  },

  setIncident(
    orderId: string,
    patch: Partial<Omit<PickupIncident, "orderId">>,
  ): PickupIncident {
    const next: PickupIncident = {
      orderId,
      status: "not_reviewed",
      ...incidents.get(orderId),
      ...patch,
    };
    incidents.set(orderId, next);
    notify();
    return next;
  },

  /** Record the customer's free-text explanation for a pickup issue. */
  setCustomerExplanation(orderId: string, explanation: string) {
    return pickupReview.setIncident(orderId, {
      customerExplanation: explanation,
    });
  },

  resetIncident(orderId: string) {
    if (incidents.delete(orderId)) notify();
  },

  isConfirmedUnclaimed(orderId: string): boolean {
    return incidents.get(orderId)?.status === "confirmed_unclaimed";
  },

  getConfirmedIncidents(customerKey: string): PickupIncident[] {
    const out: PickupIncident[] = [];
    incidents.forEach((inc) => {
      if (inc.status === "confirmed_unclaimed" && inc.customerKey === customerKey) {
        out.push(inc);
      }
    });
    return out;
  },

  /**
   * Confirmed unclaimed count for a customer. Excused incidents are excluded by
   * definition, so excusing an incident never increases this number.
   */
  getConfirmedCount(customerKey: string): number {
    return pickupReview.getConfirmedIncidents(customerKey).length;
  },

  /**
   * Confirmed unclaimed count matched case-insensitively (emails may differ in
   * casing between the login session and the stored incident key).
   */
  getConfirmedCountFor(customerKey: string | null | undefined): number {
    const key = (customerKey ?? "").trim().toLowerCase();
    if (!key) return 0;
    let count = 0;
    incidents.forEach((inc) => {
      if (
        inc.status === "confirmed_unclaimed" &&
        (inc.customerKey ?? "").trim().toLowerCase() === key
      ) {
        count += 1;
      }
    });
    return count;
  },

  /**
   * True when the finalized rule blocks Cash on Pickup for this customer
   * (>= CASH_ON_PICKUP_MIN_CONFIRMED_OFFENSES confirmed unclaimed offenses).
   */
  isCashOnPickupRestricted(customerKey: string | null | undefined): boolean {
    return (
      pickupReview.getConfirmedCountFor(customerKey) >=
      CASH_ON_PICKUP_MIN_CONFIRMED_OFFENSES
    );
  },

  getRestriction(customerKey: string): RestrictionPreview {
    return (
      restrictions.get(customerKey) ?? {
        arrangement: null,
        active: false,
      }
    );
  },

  setRestriction(
    customerKey: string,
    patch: Partial<Omit<RestrictionPreview, "updatedAt">>,
  ): RestrictionPreview {
    const next: RestrictionPreview = {
      arrangement: null,
      active: false,
      ...restrictions.get(customerKey),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    restrictions.set(customerKey, next);
    notify();
    return next;
  },

  clearRestriction(customerKey: string) {
    if (restrictions.delete(customerKey)) notify();
  },

  /** Every customer restriction set in this session (keyed by customerKey). */
  getAllRestrictions(): { customerKey: string; restriction: RestrictionPreview }[] {
    return Array.from(restrictions.entries()).map(([customerKey, restriction]) => ({
      customerKey,
      restriction,
    }));
  },

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
