import React, { useState, useEffect } from "react";
import {
  Store,
  Wifi,
  WifiOff,
  CalendarClock,
  Clock,
  Check,
  Pause,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
import { shopStatusStore, type ShopStatus, type ShopStatusState } from "../../utils/shopStatusStore";
import { formatPHTime } from "../../utils/pht";
import { useAuth } from "../../contexts/AuthContext";

const STATUS_META: Record<ShopStatus, { label: string; chip: string; icon: React.ElementType }> = {
  open: { label: "Open for Business", chip: "bg-green-100 text-green-700 border-green-200", icon: Wifi },
  paused: { label: "Paused", chip: "bg-amber-100 text-amber-700 border-amber-200", icon: WifiOff },
  "closed-scheduled": { label: "Scheduled Close", chip: "bg-gray-100 text-gray-600 border-gray-200", icon: CalendarClock },
};

// The header pill has one line to work with, so it says the state in a word.
const PILL_LABEL: Record<ShopStatus, string> = {
  open: "Open",
  paused: "Paused",
  "closed-scheduled": "Closed",
};

interface ShopStatusControlProps {
  // "card" is the full-width block the Overview tab has always rendered.
  // "pill" is the compact header control: the same state and the same three
  // actions, folded into a menu, so the dashboard does not spend ~92px of its
  // first screen on a badge that says "open" almost every day.
  variant?: "card" | "pill";
}

export default function ShopStatusControl({ variant = "card" }: ShopStatusControlProps) {
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

  // Header control: the state in a pill, the three actions in a menu. Same
  // store, same pause dialog, same notifications as the card below.
  if (variant === "pill") {
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

  return (
    <>
      <Card className="bg-white shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 pt-4 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-[#2F6FD6] flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-slate-800">Shop Status</h3>
                <Badge variant="outline" className={`border text-xs font-bold ${meta.chip}`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {meta.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {state.updatedBy ? `Updated by ${state.updatedBy}` : "Updated"} · {formatPHTime(state.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Mark Open — a quiet "this is the current state" chip while the shop
                is open, and the filled primary way back when it is not. */}
            <Button
              type="button"
              disabled={state.status === "open"}
              onClick={() => applyStatus("open")}
              className={
                state.status === "open"
                  ? "rounded-[10px] border border-solid border-[#E4E7EC] bg-[#F2F4F7] text-[#98A2B3] shadow-none hover:bg-[#F2F4F7] hover:text-[#98A2B3] hover:translate-y-0 hover:shadow-none text-xs h-9 px-3 disabled:opacity-100 disabled:bg-[#F2F4F7] disabled:border-[#E4E7EC] disabled:text-[#98A2B3] disabled:hover:bg-[#F2F4F7] disabled:hover:text-[#98A2B3]"
                  : "rounded-[10px] border border-solid border-[#2F6FD6] bg-[#2F6FD6] text-white shadow-[0_1px_2px_rgba(47,111,214,0.22)] hover:bg-[#2557B8] hover:border-[#2557B8] hover:text-white text-xs h-9 px-3"
              }
            >
              {state.status === "open" ? (
                <Check className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Wifi className="w-3.5 h-3.5 mr-1.5" />
              )}
              Mark Open
            </Button>
            {/* Mark Paused — tonal amber at rest (so it reads as a real action
                without competing with the blue primary), solid amber on hover,
                and a settled "already paused" state instead of a faded ghost. */}
            <Button
              type="button"
              disabled={state.status === "paused"}
              onClick={openPause}
              className={
                state.status === "paused"
                  ? "rounded-[10px] border border-dashed border-[#E3C79B] bg-[#F8FAFC] text-[#B08A4A] shadow-none hover:bg-[#F8FAFC] hover:text-[#B08A4A] hover:translate-y-0 hover:shadow-none text-xs h-9 px-3 disabled:opacity-100 disabled:bg-[#F8FAFC] disabled:border-[#E3C79B] disabled:text-[#B08A4A] disabled:hover:bg-[#F8FAFC] disabled:hover:text-[#B08A4A]"
                  : "rounded-[10px] border border-solid border-[#F5CE8A] bg-[#FFF8EB] text-[#8A5007] shadow-[0_1px_2px_rgba(138,80,7,0.08)] hover:bg-[#E08A00] hover:border-[#E08A00] hover:text-white hover:-translate-y-px hover:shadow-[0_5px_12px_rgba(224,138,0,0.30)] active:translate-y-0 active:bg-[#C2740A] active:border-[#C2740A] active:text-white active:shadow-[inset_0_2px_5px_rgba(90,50,0,0.22)] focus-visible:border-[#F5CE8A] focus-visible:ring-2 focus-visible:ring-[#E08A00] focus-visible:ring-offset-2 focus-visible:ring-offset-white text-xs h-9 px-3"
              }
            >
              {state.status === "paused" ? (
                <Check className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Pause className="w-3.5 h-3.5 mr-1.5" />
              )}
              {state.status === "paused" ? "Already Paused" : "Mark Paused"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={state.status === "closed-scheduled"}
              onClick={() => applyStatus("closed-scheduled")}
              className="rounded-[10px] border-slate-300 text-slate-600 bg-white hover:bg-slate-600 hover:border-slate-600 hover:text-white text-xs h-9 px-3 disabled:opacity-50"
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
              Mark Closed (Scheduled)
            </Button>
          </div>
        </div>
      </Card>

      {pauseDialog}
    </>
  );
}
