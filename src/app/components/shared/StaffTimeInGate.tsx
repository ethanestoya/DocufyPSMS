import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Clock,
  LogIn,
  Lock,
  CalendarDays,
  CreditCard,
  Package,
  ShoppingCart,
  Boxes,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { attendanceStore, todayPHTKey } from "../../utils/attendanceStore";
import type { NextAction } from "../../utils/attendanceStore";
import { formatPHTime, internetUtcMs, subscribeInternetTime, toPHT } from "../../utils/pht";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

interface StaffTimeInGateProps {
  children: React.ReactNode;
}

const LOCKED_ACTIONS = [
  { icon: CreditCard, label: "Payment verification" },
  { icon: Package, label: "Order processing" },
  { icon: ShoppingCart, label: "Walk-in transactions" },
  { icon: Boxes, label: "Inventory management" },
];

// Gives every staff-facing page a single, consistent time-in lockout.
// While staff haven't clocked in, the page content stays rendered beneath a
// blurred backdrop (unmodified) and a centered Time-In modal sits on top.
export default function StaffTimeInGate({ children }: StaffTimeInGateProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nextAction, setNextAction] = useState<NextAction>(() =>
    user ? attendanceStore.getNextAction(user.email) : "time-in",
  );
  const [now, setNow] = useState(() => new Date(internetUtcMs()));
  const [showExtraConfirm, setShowExtraConfirm] = useState(false);

  // Admin / customer flows are never locked out.
  const staffUser = user?.role === "staff" ? user : null;

  // Currently "on the clock" only while a session is active.
  const locked = !!staffUser && nextAction !== "time-out";

  // On-leave / absent staff can't clock in — the gate still shows, but the
  // action is disabled (mirrors the Clock-In & Timesheet page).
  const absence = staffUser
    ? attendanceStore.getAbsence(staffUser.email, todayPHTKey())
    : null;
  const primaryDisabled = absence === "on-leave" || absence === "absent";

  // Live clock (internet GMT+8) — tick only while a lockout panel is visible.
  useEffect(() => {
    if (!locked) return;
    const tick = () => setNow(new Date(internetUtcMs()));
    const t = setInterval(tick, 1_000);
    const unsubscribe = subscribeInternetTime(tick);
    return () => {
      clearInterval(t);
      unsubscribe();
    };
  }, [locked]);

  useEffect(() => {
    if (!user) return;
    const unsub = attendanceStore.subscribe(() => {
      setNextAction(attendanceStore.getNextAction(user.email));
    });
    return unsub;
  }, [user]);

  if (!staffUser || !locked) {
    return <>{children}</>;
  }

  const phtNow = toPHT(now);

  const doTimeIn = () => {
    try {
      const userName = staffUser.name || staffUser.email.split("@")[0];
      attendanceStore.timeIn(staffUser.email, userName, "staff");
      toast.success(
        nextAction === "complete"
          ? "Time In Again recorded — today is logged as exceeded."
          : `Time In recorded at ${formatPHTime(new Date(internetUtcMs()), { hour12: true, includeSeconds: true })}. Staff functions unlocked!`,
      );
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  const handleTimeIn = () => {
    if (primaryDisabled) return;
    if (nextAction === "complete") {
      setShowExtraConfirm(true);
      return;
    }
    doTimeIn();
  };

  // Clicking the dimmed/blurred backdrop — rather than the Time In buttons —
  // sends the staff back to the page they were on before this locked page
  // opened (e.g. Inventory → tapped Orders → back to Inventory) instead of
  // always dropping them on the dashboard. The dashboard is only the fallback
  // for a direct open (refresh / deep link), where there is no earlier in-app
  // history entry to return to.
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    // Clicks on the panel itself (and everything inside it) keep the lockout up.
    if (target?.closest("[data-lockout-panel]")) return;

    const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIdx === "number" && historyIdx > 0) navigate(-1);
    else navigate("/staff/dashboard");
  };

  return (
    <>
      {children}

      {/* Lockout overlay — fixed modal over a blurred backdrop. Clicking the
          blurred area returns the staff to the page they came from. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-lockout-title"
        onClick={handleOverlayClick}
        className="fixed inset-0 z-50 cursor-pointer overflow-y-auto bg-[#1668D9]/25 backdrop-blur-[3px]"
      >
        <div className="flex min-h-full w-full items-center justify-center p-3 sm:p-6">
          <Card
            data-lockout-panel=""
            className="w-full max-w-2xl cursor-default border-slate-100 bg-white p-6 shadow-xl sm:p-8"
          >
            {/* Horizontal header — icon left, title/description right */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F2F7FF] sm:h-16 sm:w-16">
                <Lock className="h-7 w-7 text-[#1668D9] sm:h-8 sm:w-8" />
              </div>
              <div className="min-w-0">
                <h2
                  id="staff-lockout-title"
                  className="text-lg font-bold text-[#1c1f26] sm:text-xl"
                >
                  Time In to Unlock Staff Functions
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Record your time-in to unlock staff actions.
                </p>
              </div>
            </div>

            {/* Live date / time — 12-hour clock with AM/PM */}
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-[#f0f4f8] px-4 py-3">
              <CalendarDays className="h-4 w-4 flex-shrink-0 text-[#1668D9]" />
              <span className="text-xs font-semibold text-slate-600 sm:text-sm">
                {phtNow.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span className="ml-auto font-mono text-sm font-bold text-[#1668D9] sm:text-base">
                {formatPHTime(now, { hour12: true, includeSeconds: true })}
              </span>
            </div>

            {/* Locked actions — 2-column grid keeps the panel compact */}
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                Locked until you time in
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LOCKED_ACTIONS.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[#1668D9]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                    <Lock className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                  </li>
                ))}
              </ul>
            </div>

            {/* Time-in button — primary blue, same as the Clock-In & Timesheet page */}
            <Button
              onClick={handleTimeIn}
              disabled={primaryDisabled}
              className="mt-4 h-[56px] w-full rounded-xl text-base font-bold transition-all bg-[#1668D9] text-white hover:bg-[#1659c4] border border-white/10 shadow-[0_10px_20px_-8px_rgba(29,115,236,0.55)] hover:translate-y-0 hover:shadow-[0_10px_20px_-8px_rgba(29,115,236,0.55)] disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {primaryDisabled ? (
                <>
                  <Lock className="size-5" />
                  {absence === "on-leave" ? "On Leave" : "Marked Absent"}
                </>
              ) : nextAction === "complete" ? (
                <>
                  <LogIn className="size-5" />
                  Time In Again (Extra)
                </>
              ) : (
                <>
                  <LogIn className="size-5" />
                  Time In — Start Shift
                </>
              )}
            </Button>

            {/* Secondary links — compact Details-style group */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/staff/timesheet")}
                className="w-full text-xs border-2 border-[#1668D9]/30 text-[#1668D9] hover:bg-[#1668D9] hover:text-white font-medium transition-colors"
              >
                Open Clock-In & Timesheet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/staff/dashboard")}
                className="w-full text-xs border-2 border-[#1668D9]/30 text-[#1668D9] hover:bg-[#1668D9] hover:text-white font-medium transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Return to Dashboard
              </Button>
            </div>

            <p className="mt-3 text-center text-[11px] text-gray-500">
              Click outside this panel to go back to the page you were on.
            </p>
          </Card>
        </div>
      </div>

      {showExtraConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowExtraConfirm}
          onConfirm={() => {
            setShowExtraConfirm(false);
            doTimeIn();
          }}
          title="Clock In Again?"
          description="Today's shift is already complete. This starts an extra session, recorded as exceeded time."
          confirmLabel="Yes, Clock In Again"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
    </>
  );
}
