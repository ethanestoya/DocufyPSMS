import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, CalendarClock, Check, Pause, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { shopStatusStore, type ShopStatus, type ShopStatusState } from "../../utils/shopStatusStore";
import { formatPHTime } from "../../utils/pht";
import { useAuth } from "../../contexts/AuthContext";

const STATUS_META: Record<ShopStatus, { label: string; icon: React.ElementType }> = {
  open: { label: "Open for Business", icon: Wifi },
  paused: { label: "Paused", icon: WifiOff },
  "closed-scheduled": { label: "Scheduled Close", icon: CalendarClock },
};

// The pill has one line to work with, so it says the state in a word.
const PILL_LABEL: Record<ShopStatus, string> = {
  open: "Open",
  paused: "Paused",
  "closed-scheduled": "Closed",
};

export default function ShopStatusControl() {
  const { user } = useAuth();
  const [state, setState] = useState<ShopStatusState>(() => shopStatusStore.getState());
  const [pauseOpen, setPauseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [eta, setEta] = useState("");

  useEffect(() => {
    const unsub = shopStatusStore.subscribe(() => setState(shopStatusStore.getState()));
    return unsub;
  }, []);

  const meta = STATUS_META[state.status];
  const Icon = state.status === "paused" ? WifiOff : state.status === "closed-scheduled" ? CalendarClock : Wifi;

  const applyStatus = (status: ShopStatus, opts?: { reason?: string; eta?: string }) => {
    shopStatusStore.setStatus({ status, reason: opts?.reason, eta: opts?.eta }, user?.name);
    const label = STATUS_META[status].label;
    toast.success(`Docufy marked as "${label}".`, {
      description: status === "paused" ? "Customers have been notified." : undefined,
    });
    setPauseOpen(false);
    setMenuOpen(false);
    setReason("");
    setEta("");
  };

  const openPause = () => {
    setReason("");
    setEta("");
    setPauseOpen(true);
  };

  const description =
    state.status === "open" ? (
      "Accepting new orders."
    ) : state.reason ? (
      <>
        <span className="font-medium text-slate-600">{state.reason}</span>
        {state.eta && <span> · back around {state.eta}</span>}
      </>
    ) : state.status === "paused" ? (
      "New orders are on hold."
    ) : (
      "Closed as scheduled. New orders are on hold."
    );

  const updatedLine = `${state.updatedBy ? `Updated by ${state.updatedBy}` : "Updated"} · ${formatPHTime(state.updatedAt)}`;

  const pauseDialog = (
    <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Pause Docufy</DialogTitle>
          <DialogDescription>
            Customers see this while the shop is paused.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason <span className="text-red-500">*</span></Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Brownout, no internet, staff unavailable"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">ETA (optional)</Label>
            <Input
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder='e.g. "2:00 PM" or "30 minutes"'
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => setPauseOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            data-primary-action
            disabled={!reason.trim()}
            onClick={() => applyStatus("paused", { reason: reason.trim(), eta: eta.trim() || undefined })}
            className="bg-[#E08A00] border-[#E08A00] text-white hover:bg-[#C2740A] hover:border-[#C2740A]"
          >
            Pause Docufy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // The state in a pill, the three actions in a menu. Same store, same pause
  // dialog, same notifications the full card used to carry.
  const dotClass =
    state.status === "open"
      ? "bg-green-500"
      : state.status === "paused"
        ? "bg-amber-500"
        : "bg-slate-400";
  const pillClass =
    state.status === "open"
      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
      : state.status === "paused"
        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100";
  const menuItemClass =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent";

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Shop status: ${meta.label}. Open shop status menu.`}
          title={`${meta.label} · ${updatedLine}`}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${pillClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          {PILL_LABEL[state.status]}
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="menu"
              aria-label="Shop status actions"
              className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-800">{meta.label}</p>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{description}</p>
                <p className="mt-1 text-[11px] text-slate-400">{updatedLine}</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={state.status === "open"}
                  onClick={() => applyStatus("open")}
                  className={menuItemClass}
                >
                  <Wifi className="h-3.5 w-3.5" />
                  Mark Open
                  {state.status === "open" && <Check className="ml-auto h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={state.status === "paused"}
                  onClick={() => {
                    setMenuOpen(false);
                    openPause();
                  }}
                  className={menuItemClass}
                >
                  <Pause className="h-3.5 w-3.5" />
                  Mark Paused
                  {state.status === "paused" && <Check className="ml-auto h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={state.status === "closed-scheduled"}
                  onClick={() => applyStatus("closed-scheduled")}
                  className={menuItemClass}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Mark Closed (Scheduled)
                  {state.status === "closed-scheduled" && <Check className="ml-auto h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {pauseDialog}
    </>
  );
}
