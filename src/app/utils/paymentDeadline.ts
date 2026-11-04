// Same-working-day payment deadline.
//
// Every customer order must satisfy its required payment on the day it was
// placed. The deadline is therefore the EARLIER of
//   • the admin-configured window (pricingStore, in seconds), and
//   • the shop's closing time on the day the order was placed.
// A window can only make the deadline sooner, never later — the closing time is
// the hard edge. The shop's closing time is a single admin value
// (`landingContentStore.shopClosingTime`, "HH:mm") and is empty by default;
// while it is empty the window is used alone and the caller warns the admin.
//
// Edge behaviour, as approved:
//   • placed NEAR closing (≤ 30 min before it) → the deadline gets a 30-minute
//     grace past closing, capped to the end of the same day;
//   • placed AT or AFTER closing → ordering is blocked for the day;
//   • window = 0 → the closing time itself is the deadline (it no longer means
//     "never expires");
//   • closed time unset → window only, with a warning.
//
// Pausing is handled by the expiry sweep (deadlines restart when the shop
// reopens), not here.

/** Grace granted to an order placed shortly before closing. */
export const NEAR_CLOSING_GRACE_MS = 30 * 60 * 1000;

/** How close to closing an order must be to earn the grace. */
export const NEAR_CLOSING_WINDOW_MS = 30 * 60 * 1000;

export type PaymentDeadlineKind = "window" | "closing" | "grace" | "none";

export interface PaymentRequirement {
  /** Absolute deadline (ISO), or undefined when no deadline applies. */
  deadline?: string;
  /**
   * Which rule produced the deadline: the admin window, the closing time, the
   * near-closing grace, or nothing at all.
   */
  kind: PaymentDeadlineKind;
  /** The shop has already closed for the day — the order must not be placed. */
  blocked: boolean;
  /** No closing time is configured; the caller should warn the admin. */
  unsetClosing: boolean;
  /** The order is being placed at/after the closing time. */
  placedAfterClosing: boolean;
  /** Closing time on the placed day, when one is configured. */
  closingAt?: Date;
}

export interface ResolvePaymentRequirementInput {
  placedAt?: Date;
  /** Admin window in seconds. 0 = the closing time is the deadline. */
  windowSeconds: number;
  /** "HH:mm", 24h. Empty/invalid = not configured. */
  closingTime: string;
}

/** Parse a 24h "HH:mm" closing time into hours/minutes, or null. */
export function parseClosingTime(
  closingTime: string,
): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((closingTime ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** The closing moment on the local day of `day`, or null when unconfigured. */
export function closingTimeOn(day: Date, closingTime: string): Date | null {
  const parsed = parseClosingTime(closingTime);
  if (!parsed) return null;
  const closing = new Date(day);
  closing.setHours(parsed.hours, parsed.minutes, 0, 0);
  return closing;
}

/** Last representable instant of the local day containing `day`. */
function endOfDay(day: Date): Date {
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Resolve the payment deadline for an order placed at `placedAt`.
 *
 * Reads only the two inputs the shop actually configures, so the same function
 * can be used at checkout (to mint the deadline) and in admin previews.
 */
export function resolvePaymentRequirement({
  placedAt = new Date(),
  windowSeconds,
  closingTime,
}: ResolvePaymentRequirementInput): PaymentRequirement {
  const windowMs =
    Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds * 1000 : 0;
  const windowDeadline = windowMs > 0 ? new Date(placedAt.getTime() + windowMs) : null;
  const closingAt = closingTimeOn(placedAt, closingTime);

  // No closing time configured — fall back to the window alone and flag it so
  // the admin sees "Shop closing time isn't set".
  if (!closingAt) {
    return {
      deadline: windowDeadline?.toISOString(),
      kind: windowDeadline ? "window" : "none",
      blocked: false,
      unsetClosing: true,
      placedAfterClosing: false,
    };
  }

  // At/after closing: new orders wait for the next working day. This helper
  // does not invent a next-day deadline; the caller blocks the order instead.
  if (placedAt.getTime() >= closingAt.getTime()) {
    return {
      blocked: true,
      kind: "none",
      unsetClosing: false,
      placedAfterClosing: true,
      closingAt,
    };
  }

  // Window = 0 → the closing time IS the deadline.
  if (!windowDeadline) {
    return {
      deadline: closingAt.toISOString(),
      kind: "closing",
      blocked: false,
      unsetClosing: false,
      placedAfterClosing: false,
      closingAt,
    };
  }

  // The window ends before closing — it binds, and the order is unaffected.
  if (windowDeadline.getTime() < closingAt.getTime()) {
    return {
      deadline: windowDeadline.toISOString(),
      kind: "window",
      blocked: false,
      unsetClosing: false,
      placedAfterClosing: false,
      closingAt,
    };
  }

  // The closing time binds. Placed shortly before it → grant grace so a
  // customer who orders at 4:52 PM isn't handed an 8-minute deadline.
  const nearClosing =
    closingAt.getTime() - placedAt.getTime() <= NEAR_CLOSING_WINDOW_MS;
  if (nearClosing) {
    const graced = new Date(closingAt.getTime() + NEAR_CLOSING_GRACE_MS);
    const end = endOfDay(closingAt);
    return {
      deadline: (graced.getTime() > end.getTime() ? end : graced).toISOString(),
      kind: "grace",
      blocked: false,
      unsetClosing: false,
      placedAfterClosing: false,
      closingAt,
    };
  }

  return {
    deadline: closingAt.toISOString(),
    kind: "closing",
    blocked: false,
    unsetClosing: false,
    placedAfterClosing: false,
    closingAt,
  };
}

/**
 * The shop's opening time, read from the free-text hours rows the admin edits
 * ("9:00 AM - 5:00 PM"). Returns null when it cannot be read, so callers say
 * "when the shop reopens" instead of inventing a time.
 */
export function openingTimeLabel(
  shopHours: Array<{ label?: string; hours?: string }> | null | undefined,
): string | null {
  for (const row of shopHours ?? []) {
    const hours = (row?.hours ?? "").trim();
    if (!hours || /closed/i.test(hours)) continue;
    const [start] = hours.split(/\s*[-–—]\s*/);
    const label = (start ?? "").trim();
    if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(label)) return label;
  }
  return null;
}
