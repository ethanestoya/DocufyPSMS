import React, { useState, useEffect } from "react";
import { WifiOff, CalendarClock, Info } from "lucide-react";
import { shopStatusStore, type ShopStatusState } from "../../utils/shopStatusStore";

const BANNER_STYLES = {
  paused: {
    bar: "bg-amber-50 border-amber-300",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-amber-800",
    text: "text-amber-700/90",
  },
  "closed-scheduled": {
    bar: "bg-gray-50 border-gray-300",
    iconWrap: "bg-gray-200 text-gray-600",
    title: "text-gray-700",
    text: "text-gray-600",
  },
} as const;

export default function ShopStatusBanner({ className = "" }: { className?: string }) {
  const [state, setState] = useState<ShopStatusState>(() => shopStatusStore.getState());

  useEffect(() => {
    const unsub = shopStatusStore.subscribe(() => setState(shopStatusStore.getState()));
    return unsub;
  }, []);

  if (state.status === "open") return null;

  const style = BANNER_STYLES[state.status];
  const Icon = state.status === "paused" ? WifiOff : CalendarClock;
  const title =
    state.status === "paused"
      ? "Docufy is currently paused"
      : "Docufy is on scheduled close";
  const body =
    state.status === "paused"
      ? [
          state.reason ? `Reason: ${state.reason}` : null,
          state.eta ? `Estimated return: around ${state.eta}` : null,
          "New orders are temporarily on hold — existing orders are safe and will resume once we reopen.",
        ]
          .filter(Boolean)
          .join(" · ")
      : "The shop is currently closed (weekend / holiday schedule). New orders will be accepted again once we reopen.";

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${style.bar} ${className}`}>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.iconWrap}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold flex items-center gap-1.5 ${style.title}`}>
          <Info className="w-3.5 h-3.5" />
          {title}
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${style.text}`}>{body}</p>
      </div>
    </div>
  );
}
