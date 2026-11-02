// Unclaimed-order payment policy — the single source of truth for what a
// customer's CONFIRMED unclaimed (cash-on-pickup, past the pickup deadline)
// order count means for their account.
//
// The count is always DERIVED from real order + status-history data (see
// utils/unclaimedOrders.ts); it is never stored or hardcoded. This module only
// maps a count to the resulting requirement, so every surface (checkout guard,
// customer notices, admin tables) agrees on the same rule.

export interface PaymentPolicy {
  /** The customer's derived unclaimed-order count. */
  count: number;
  /** 0 = clean, 1 = warning, 2 = advance required, 3 = full advance. */
  level: 0 | 1 | 2 | 3;
  /** Short label, e.g. "Second unclaimed order". */
  label: string;
  /** One-line summary of the requirement. */
  summary: string;
  /** Show the amber "unclaimed order" notice on customer surfaces. */
  showWarning: boolean;
  /** Cash on Pickup is no longer selectable for new orders. */
  cashOnPickupDisabled: boolean;
  /** A 50% down payment on future orders is an accepted arrangement. */
  deposit50Allowed: boolean;
  /** Full advance payment on future orders is REQUIRED. */
  fullAdvanceRequired: boolean;
  /** At least one advance arrangement (50% deposit or full) is required. */
  advanceRequired: boolean;
}

/**
 * FINALIZED THRESHOLDS (do not change without approval):
 *   • 1st unclaimed order — warning only; Cash on Pickup still allowed.
 *   • 2nd unclaimed order — Cash on Pickup disabled; the customer must either
 *     pay a 50% down payment or the full amount in advance.
 *   • 3rd+ unclaimed order — full advance payment required; both Cash on
 *     Pickup and the 50%-down option are disabled.
 * Outstanding-balance handling stays separate from these thresholds.
 */
export function paymentPolicyForCount(count: number): PaymentPolicy {
  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));

  if (n <= 0) {
    return {
      count: 0,
      level: 0,
      label: "No unclaimed orders",
      summary: "Good standing — no unclaimed orders on record.",
      showWarning: false,
      cashOnPickupDisabled: false,
      deposit50Allowed: true,
      fullAdvanceRequired: false,
      advanceRequired: false,
    };
  }

  if (n === 1) {
    return {
      count: 1,
      level: 1,
      label: "First unclaimed order",
      summary:
        "Warning only — please collect future orders within the pickup period.",
      showWarning: true,
      cashOnPickupDisabled: false,
      deposit50Allowed: true,
      fullAdvanceRequired: false,
      advanceRequired: false,
    };
  }

  if (n === 2) {
    return {
      count: 2,
      level: 2,
      label: "Second unclaimed order",
      summary:
        "Cash on Pickup is disabled — a 50% down payment or full advance payment is required for new orders.",
      showWarning: true,
      cashOnPickupDisabled: true,
      deposit50Allowed: true,
      fullAdvanceRequired: false,
      advanceRequired: true,
    };
  }

  return {
    count: n,
    level: 3,
    label: "Third or more unclaimed orders",
    summary:
      "Full advance payment is required — Cash on Pickup and the 50%-down option are disabled.",
    showWarning: true,
    cashOnPickupDisabled: true,
    deposit50Allowed: false,
    fullAdvanceRequired: true,
    advanceRequired: true,
  };
}

/** Advance arrangement wording used by customer notices. */
export const ADVANCE_REQUIRED_MESSAGE =
  "A full advance payment is required for your future orders.";

export const DEPOSIT_OR_ADVANCE_MESSAGE =
  "A 50% down payment or a full advance payment is required for your future orders.";

/** Shared customer-facing explanation for a disabled Cash on Pickup option. */
export const CASH_ON_PICKUP_BLOCKED_MESSAGE =
  "Cash on Pickup is unavailable because your account has unclaimed orders on record. Please choose an available advance payment method.";

/**
 * The minimum confirmed unclaimed-order count at which Cash on Pickup is
 * blocked (kept for callers that only need the threshold).
 */
export const CASH_ON_PICKUP_MIN_CONFIRMED_OFFENSES = 2;

// ── Restriction-aware policy ────────────────────────────────────────────────
// `paymentPolicyForCount` above is the pure derivation: it says what a COUNT
// alone implies. The admin can, however, forgive a restriction early or change
// the accepted arrangement, and those decisions live in the
// `customer_restrictions` row. `effectivePolicy` is therefore the policy every
// surface must actually use: it starts from the count and lets an ACTIVE
// stored restriction override the enforcement fields (so an admin's decision
// always wins over the arithmetic).

export type PaymentArrangement = 'deposit_50' | 'full_advance';

/** The subset of a stored restriction that changes enforcement. */
export interface RestrictionLike {
  active: boolean;
  arrangement: PaymentArrangement;
}

/** The arrangement a fresh restriction should default to for a given count. */
export function defaultArrangementForCount(count: number): PaymentArrangement {
  return count >= 3 ? 'full_advance' : 'deposit_50';
}

/**
 * The policy a customer is actually under: the derived count's wording, with
 * the enforcement flags overridden by the stored restriction when there is one.
 *
 * The derived count still does the work by default, so nothing changes for a
 * customer no admin has touched. What the row adds is the admin's ability to
 * DECIDE: an active row pins the arrangement, and an inactive row is explicit
 * forgiveness — Cash on Pickup stays allowed no matter what the count says.
 */
export function effectivePolicy(
  count: number,
  restriction: RestrictionLike | null | undefined,
): PaymentPolicy {
  const base = paymentPolicyForCount(count);

  if (restriction && restriction.active) {
    const fullAdvance = restriction.arrangement === 'full_advance';
    return {
      ...base,
      showWarning: true,
      cashOnPickupDisabled: true,
      deposit50Allowed: !fullAdvance,
      fullAdvanceRequired: fullAdvance,
      advanceRequired: true,
      label: fullAdvance
        ? 'Full advance payment required'
        : '50% deposit accepted',
      summary: fullAdvance
        ? 'Full advance payment is required — Cash on Pickup and the 50%-down option are disabled.'
        : 'Cash on Pickup is disabled — a 50% down payment or full advance payment is required for new orders.',
    };
  }

  if (restriction && !restriction.active) {
    // The admin removed this restriction — forgiveness wins over the count.
    return {
      ...base,
      label: 'Restriction removed',
      summary:
        'Restriction removed by the shop — Cash on Pickup is available again.',
      showWarning: base.count > 0,
      cashOnPickupDisabled: false,
      deposit50Allowed: true,
      fullAdvanceRequired: false,
      advanceRequired: false,
    };
  }

  // No stored decision — the derived count's own rule applies unchanged.
  return base;
}
