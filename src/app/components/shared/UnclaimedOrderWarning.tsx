// Customer-facing notice for automatically-derived unclaimed orders.
//
// Reads the shared `useUnclaimedOffenses` hook (the same source the header
// indicator, My Orders, Dashboard, and Print Request use), so every surface
// agrees on the same count, the same policy, and the same latest order.
//
// The notice is level-based and DERIVED, never a manual flag:
//   • 1 unclaimed order  — soft amber warning (Cash on Pickup still allowed).
//   • 2 unclaimed orders — red notice; Cash on Pickup is disabled and an advance
//                          payment arrangement is required.
//   • 3+ unclaimed orders— red notice; full advance payment is required.
//
// `variant`:
//   • "card" (default) — the full notice used on the Dashboard / My Orders.
//   • "slim"           — a compact single-line bar for the Print Request form,
//                        where it must not block or clear the form.

import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useUnclaimedOffenses } from "../../utils/useUnclaimedOffenses";

interface UnclaimedOrderWarningProps {
  /** Signed-in customer key (email preferred) used to match orders. */
  customerKey?: string;
  /** Presentation variant. Defaults to the full "card". */
  variant?: "card" | "slim";
}

export function UnclaimedOrderWarning({
  customerKey,
  variant = "card",
}: UnclaimedOrderWarningProps) {
  const navigate = useNavigate();
  const { count, policy, latestOrderId } = useUnclaimedOffenses(customerKey);

  if (count <= 0) return null;

  const severe = policy.level >= 2;
  const title = severe
    ? policy.level >= 3
      ? "Unclaimed Orders — Full Advance Payment Required"
      : "Unclaimed Orders — Advance Payment Required"
    : "Unclaimed Order Notice";
  const body = severe
    ? `You have ${count} unclaimed ${
        count === 1 ? "order" : "orders"
      } on record. ${policy.summary}`
    : `You have ${count} unclaimed ${
        count === 1 ? "order" : "orders"
      } on record. Please make sure to collect your future orders within the required pickup period.`;

  const shell = severe
    ? "border-red-200 bg-red-50"
    : "border-amber-200 bg-amber-50";
  const textMain = severe ? "text-red-900" : "text-amber-900";
  const textBody = severe ? "text-red-900/90" : "text-amber-900/90";
  const iconChip = severe ? "bg-red-100" : "bg-amber-100";
  const iconColor = severe ? "text-red-600" : "text-amber-600";

  const viewOrder = () => {
    if (latestOrderId) navigate(`/customer/track/${latestOrderId}`);
  };

  if (variant === "slim") {
    return (
      <section
        aria-label="Unclaimed order notice"
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 ${shell}`}
      >
        <span
          className={`flex items-center gap-2 text-sm font-semibold ${textMain}`}
        >
          <AlertTriangle
            className={`h-4 w-4 flex-shrink-0 ${iconColor}`}
            aria-hidden="true"
          />
          {title}
        </span>
        <p className={`min-w-0 flex-1 text-sm leading-snug ${textBody}`}>
          {body}
        </p>
        {latestOrderId && (
          <button
            type="button"
            onClick={viewOrder}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#1D73EC] ring-1 ring-[#1D73EC]/20 transition-all hover:bg-[#1D73EC]/5 active:scale-[0.97]"
          >
            View Order
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Unclaimed order notice"
      className={`rounded-xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 ${shell}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconChip}`}
          >
            <AlertTriangle
              className={`h-5 w-5 ${iconColor}`}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 sm:text-base">
              {title}
            </h2>
            <p className={`mt-1 text-sm leading-relaxed ${textBody}`}>{body}</p>
          </div>
        </div>
        {latestOrderId && (
          <button
            type="button"
            onClick={viewOrder}
            className="inline-flex h-10 w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1D73EC] px-4 text-sm font-semibold text-white transition-all hover:bg-[#10316B] active:scale-[0.97] sm:w-auto"
          >
            View Order
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

export default UnclaimedOrderWarning;
