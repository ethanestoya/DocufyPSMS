// PREVIEW ONLY — Customer-facing warning for the FIRST confirmed-unclaimed
// order. Reads the same in-memory `pickupReview` incident state the staff/admin
// review workflow writes to, so it stays consistent with the preview — it never
// creates its own state and never invents order, balance, or deadline details.
//
// Shown ONLY for an incident an admin has CONFIRMED as unclaimed (never for
// pending review, never for excused). It is a soft amber notice, not a red
// restriction banner: a first confirmed incident is a warning only.
//
// Drop-in for any customer surface (Dashboard / My Orders / Print Request): it
// self-seeds the demo incidents for demo accounts and resolves the affected
// order from live stores, so callers only pass the signed-in customer key.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { pickupReview } from "../../utils/pickupReview";
import { dataStore, type Order } from "../../utils/dataStore";
import { ordersStore } from "../../utils/ordersStore";
import {
  isDemoCustomerEmail,
  seedDemoIncidentsOnce,
} from "../../utils/pickupReviewDemoSeed";

interface UnclaimedOrderWarningProps {
  /** Signed-in customer key (email preferred) used to match incidents. */
  customerKey?: string;
}

const money = (n: number): string =>
  `₱${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Outstanding balance still owed on an order when it can be derived from
 * verified payment state. Returns null when the amount cannot be determined
 * (so the warning never shows an invented figure).
 */
function outstandingBalanceOf(order: Order): number | null {
  if (order.paymentVerified || order.fullPaymentVerified) return 0;
  const total = order.costBreakdown?.total ?? order.manualTotal ?? null;
  if (total == null) return null;
  let paid = 0;
  if (order.downPaymentVerified && typeof order.downPaymentAmount === "number") {
    paid += order.downPaymentAmount;
  }
  if (typeof order.paymentAmountPaid === "number") paid += order.paymentAmountPaid;
  return Math.max(0, total - paid);
}

export function UnclaimedOrderWarning({ customerKey }: UnclaimedOrderWarningProps) {
  const navigate = useNavigate();
  const [, forceRender] = useState(0);
  const [orders, setOrders] = useState<Order[]>(() =>
    customerKey ? dataStore.getOrdersByCustomer(customerKey) : [],
  );

  // Re-render whenever an incident is written (staff/admin decision).
  useEffect(() => pickupReview.subscribe(() => forceRender((n) => n + 1)), []);

  // Seed the demo incidents (demo accounts only) so the preview is visible
  // without the staff/admin pages, and keep this customer's orders fresh.
  useEffect(() => {
    if (!customerKey) return;
    const sync = () => {
      if (isDemoCustomerEmail(customerKey)) {
        seedDemoIncidentsOnce(ordersStore.getOrders());
      }
      setOrders(dataStore.getOrdersByCustomer(customerKey));
    };
    sync();
    return dataStore.subscribe(sync);
  }, [customerKey]);

  const email = (customerKey ?? "").toLowerCase();
  if (!email) return null;

  // First confirmed-unclaimed incident (earliest decision) that still resolves
  // to one of THIS customer's real orders — so "View Order" always has a route.
  const match = pickupReview
    .getAllIncidents()
    .filter(
      (inc) =>
        inc.status === "confirmed_unclaimed" &&
        (inc.customerKey ?? "").toLowerCase() === email,
    )
    .sort((a, b) => (a.reviewedAt ?? "").localeCompare(b.reviewedAt ?? ""))
    .map((inc) => ({ inc, order: orders.find((o) => o.id === inc.orderId) }))
    .find((x) => !!x.order);

  if (!match || !match.order) return null;

  const balance = outstandingBalanceOf(match.order);

  return (
    <section
      aria-label="Unclaimed order warning"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 sm:text-base">
              Unclaimed Order Warning
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
              You have an order that was recorded as unclaimed. Please review the
              order details and settle any outstanding balance, if applicable.
            </p>
            {balance != null && balance > 0 && (
              <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-800">
                <span className="text-amber-700/80">Outstanding balance:</span>
                <span className="font-semibold">{money(balance)}</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/customer/track/${match.order!.id}`)}
          className="inline-flex h-10 w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1D73EC] px-4 text-sm font-semibold text-white transition-all hover:bg-[#10316B] active:scale-[0.97] sm:w-auto"
        >
          View Order
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
