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
