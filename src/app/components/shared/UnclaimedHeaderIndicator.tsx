// Compact persistent header indicator for derived unclaimed orders.
//
// Reads the shared `useUnclaimedOffenses` hook (the same source the Dashboard /
// My Orders / Print Request notices use), so the header opens the same latest
// order everywhere. Amber when a single unclaimed order exists; red once an
// advance-payment arrangement applies (2+). Closing the popover does NOT dismiss
// it — it stays until the derived count clears.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useUnclaimedOffenses } from "../../utils/useUnclaimedOffenses";
import { usePresence } from "../ui/use-presence";

interface UnclaimedHeaderIndicatorProps {
  /** Signed-in customer key (email preferred) used to match orders. */
  customerKey?: string;
}

export function UnclaimedHeaderIndicator({
  customerKey,
}: UnclaimedHeaderIndicatorProps) {
  const navigate = useNavigate();
  const { count, policy, latestOrderId } = useUnclaimedOffenses(customerKey);
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, 200);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (count <= 0) return null;

  const severe = policy.level >= 2;
  const title = severe
    ? policy.level >= 3
      ? "Full Advance Payment Required"
      : "Advance Payment Required"
    : "Unclaimed Order Notice";
  const body = severe
    ? `You have ${count} unclaimed ${
        count === 1 ? "order" : "orders"
      } on record. ${policy.summary}`
    : `You have ${count} unclaimed ${
        count === 1 ? "order" : "orders"
      } on record. Please collect future orders within the pickup period.`;

  const chipTone = severe
    ? {
        button: "text-red-700",
        open: "border-red-300 bg-red-50",
        hover: "hover:bg-red-50",
        dot: "bg-red-500",
        panel: "border-red-200",
        iconChip: "bg-red-100",
        icon: "text-red-600",
      }
    : {
        button: "text-amber-700",
        open: "border-amber-300 bg-amber-50",
        hover: "hover:bg-amber-50",
        dot: "bg-amber-500",
        panel: "border-amber-200",
        iconChip: "bg-amber-100",
        icon: "text-amber-600",
      };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Unclaimed order notice"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative flex items-center gap-1.5 rounded-xl border p-2.5 transition-all ${chipTone.button} ${
          open ? chipTone.open : `border-transparent ${chipTone.hover}`
        }`}
      >
        <AlertTriangle className="h-[22px] w-[22px]" aria-hidden="true" />
        <span
          className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${chipTone.dot}`}
        />
      </button>

      {presence && (
        <>
          <div
            className={`fixed inset-0 z-10 ${
              presence.isClosing
                ? "animate-out fade-out-0 duration-200"
                : "animate-in fade-in-0 duration-200"
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Unclaimed order"
            className={`absolute right-0 mt-2 z-20 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border bg-white p-4 shadow-2xl ${chipTone.panel} ${
              presence.isClosing
                ? "animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-200 pointer-events-none"
                : "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${chipTone.iconChip}`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${chipTone.icon}`}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  {body}
                </p>
              </div>
            </div>
            {latestOrderId && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(`/customer/track/${latestOrderId}`);
                }}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1668D9] px-3 text-sm font-semibold text-white transition-all hover:bg-[#10316B] active:scale-[0.97]"
              >
                View Order
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default UnclaimedHeaderIndicator;
