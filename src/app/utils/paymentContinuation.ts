import type { Order } from "./dataStore";
import { pricingStore } from "./pricingStore";

// Order totals are stored as display strings ("₱1,234.00"), so compare on the
// numeric part only.
function orderTotalValue(order: Order): number {
  const parsed = parseFloat(String(order.total ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Where "Continue with payment verification" leads for a customer's order, or
 * null when the order isn't waiting on the customer.
 *
 * Down-payment-tier orders pick their down/full plan on the dedicated Payment
 * Method page; everything else opens payment verification directly. An order
 * that already carries a submitted reference skips the plan step so the
 * customer lands on its verification status instead of re-choosing.
 */
export function paymentContinuationPath(
  order: Order | null | undefined,
): string | null {
  if (!order || order.status !== "Awaiting Payment") return null;
  if (order.paymentReferenceNumber) return `/customer/payment/${order.id}`;

  const { downPaymentThreshold, fullPaymentThreshold } =
    pricingStore.getPricing();
  const total = orderTotalValue(order);
  const explicitDown =
    !!order.downPaymentRequired || !!order.downPaymentVerified;
  const explicitFull =
    !!order.fullPaymentRequired || !!order.fullPaymentVerified;
  const isDownTier =
    !explicitFull &&
    (explicitDown ||
      (total >= downPaymentThreshold && total < fullPaymentThreshold));

  return isDownTier
    ? `/customer/payment-method/${order.id}`
    : `/customer/payment/${order.id}`;
}
