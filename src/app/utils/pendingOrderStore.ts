// Down-payment plan helper for the customer checkout flow. The order row is
// created in Supabase at checkout (`dataStore.addOrder`) for EVERY customer
// flow, so the customer's down/full choice and payment method are applied via
// the server-authoritative `set_payment_plan` RPC. There is no local "held"
// copy any more (the old sessionStorage pending order + `order_<id>` blob were
// redundant duplicates of flags that now live on the order row).
import { setPaymentPlanRpc } from "../../lib/db/ordersRepo";

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
// down/full flags, method and hold reason. The RPC owns the amounts, flags,
// hold reason and deadline semantics.
export async function applyDownPaymentPlan(
  orderId: string,
  total: number,
  plan: DownPaymentPlan,
): Promise<DownPaymentDecision> {
  const down = Math.round(total * 0.5);
  const isFull = plan.amountChoice === "full";
  const method = plan.venue === "shop" ? "Cash" : plan.wallet;

  await setPaymentPlanRpc(orderId, plan.venue, plan.amountChoice);

  return {
    method,
    isFull,
    downDue: down,
    total: Math.round(total),
  };
}
