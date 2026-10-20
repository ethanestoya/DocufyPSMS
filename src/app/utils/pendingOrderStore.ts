// Down-payment plan helper for the customer checkout flow. The order row is
// created in Supabase at checkout (`dataStore.addOrder`) for EVERY customer
// flow, so the customer's down/full choice and payment method are written
// straight onto the already-persisted order. There is no local "held" copy any
// more (the old sessionStorage pending order + `order_<id>` blob were redundant
// duplicates of flags that already live on the order row).
import { dataStore, type Order } from "./dataStore";

export type DownPaymentPlan = {
  venue: "shop" | "online";
  amountChoice: "down" | "full";
  wallet: string;
};

export type DownPaymentDecision = {
  method: string;
  isFull: boolean;
  downDue: number;
  total: number;
};

// Persist the Down Payment Method choice onto the order so the Payment
// Verification page (and staff/admin verification) sees the correct
// down/full flags, method, and hold reason.
export function applyDownPaymentPlan(
  orderId: string,
  total: number,
  plan: DownPaymentPlan,
): DownPaymentDecision {
  const down = total * 0.5;
  const isFull = plan.amountChoice === "full";
  const method = plan.venue === "shop" ? "Cash" : plan.wallet;

  const holdReason =
    plan.venue === "online"
      ? isFull
        ? `${method} full payment of ₱${Math.round(total)} is pending verification. Your order will be queued once the full payment is verified.`
        : `${method} down payment of ₱${Math.round(down)} (50% of total ₱${Math.round(total)}) is pending verification. Your order will be queued once the down payment is verified.`
      : isFull
        ? `Cash on Pickup: pay ₱${Math.round(total)} (full payment) at the shop before your payment deadline to confirm this order.`
        : `Cash on Pickup: pay ₱${Math.round(down)} (down payment of ₱${Math.round(down)} — 50% of the total) at the shop before your payment deadline to confirm this order.`;

  const updates: Record<string, unknown> = {
    paymentMethod: method,
    holdReason,
    downPaymentRequired: !isFull,
    downPaymentAmount: !isFull ? down : undefined,
    fullPaymentRequired: isFull,
    fullPaymentAmount: isFull ? total : undefined,
  };

  const existingOrder = dataStore.getOrderById(orderId);
  if (existingOrder) {
    dataStore.updateOrder(orderId, updates as Partial<Order>);
  } else {
    console.warn("[downPayment] order not found; nothing to update", orderId);
  }

  return {
    method,
    isFull,
    downDue: Math.round(down),
    total: Math.round(total),
  };
}
