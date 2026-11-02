import { useState, useEffect } from "react";
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Info,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  Package,
  CreditCard,
  ShoppingCart,
  TrendingUp,
  User as UserRound,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Button } from "../ui/button";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { CardSkeleton } from "../ui/card-skeleton";
import { SummaryCard } from "../ui/summary-card";
import { useHydrating } from "../../utils/useHydrating";
import { useAuth } from "../../contexts/AuthContext";
import {
  attendanceStore,
  getWeekStartKey,
  sessionTotalMs,
  overtimeMs,
  hasActiveSession,
  isExceeded,
  STANDARD_DAILY_HOURS,
  STANDARD_WEEKLY_HOURS,
  todayPHTKey,
} from "../../utils/attendanceStore";
import type { DailyAttendanceRecord } from "../../utils/attendanceStore";
import { internetUtcMs, subscribeInternetTime, toPHT } from "../../utils/pht";
import { getStaffRoster, DEFAULT_STAFF_SHIFT } from "../../utils/staffRoster";

// ── Layout shell (staff nav — page chrome only) ─────────────────────────────
const menuItems = [
  { label: "Dashboard", path: "/staff/dashboard", icon: <LayoutGrid className="w-5 h-5" /> },
  { label: "Orders", path: "/staff/queue", icon: <Package className="w-5 h-5" /> },
  { label: "Payment Verification", path: "/staff/payment-verification", icon: <CreditCard className="w-5 h-5" /> },
  { label: "Walk-in Transactions", path: "/staff/walk-in", icon: <ShoppingCart className="w-5 h-5" /> },
  { label: "Inventory", path: "/staff/inventory", icon: <Boxes className="w-5 h-5" /> },
  { label: "Clock-In & Timesheet", path: "/staff/timesheet", icon: <Clock className="w-5 h-5" /> },
];

// ── Formatting helpers ──────────────────────────────────────────────────────
const pad2 = (n: number): string => String(n).padStart(2, "0");

// 12-hour PHT clock time (e.g. "03:12 AM").
const fmt12 = (d?: Date): string => {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
};

// Live session/clock timer hh:mm:ss.
const fmtTimer = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const h = Math.floor(total / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

// "0h 21m" — used for the summary values and the timesheet Total/Overtime.
const fmtHM = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${pad2(m)}m`;
};

const weekdayOf = (dateKey: string): string => {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-PH", { weekday: "long" });
};

const shortDateOf = (dateKey: string): string => {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const getInitials = (name?: string): string => {
  if (!name) return "U";
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "U";
};

type Pill = { label: string; cls: string; dot: string };

const PILL_STYLES = {
  green: "bg-green-100 text-green-700 border-green-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  red: "bg-red-100 text-red-600 border-red-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-500 border-slate-200",
} as const;

function StatusPill({ meta }: { meta: Pill }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${meta.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export default function StaffTimesheet() {
  const hydrating = useHydrating();
  const { user } = useAuth();
  const email = user?.email ?? "";

  const [logs, setLogs] = useState<DailyAttendanceRecord[]>(() =>
    email ? attendanceStore.getUserLogs(email) : [],
  );
  const [now, setNow] = useState(() => new Date(internetUtcMs()));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showClockConfirm, setShowClockConfirm] = useState(false);

  // Live clock — real internet GMT+8 (Philippines time) even if device clock is off.
  useEffect(() => {
    const tick = () => setNow(new Date(internetUtcMs()));
    const t = setInterval(tick, 1_000);
    const unsubscribe = subscribeInternetTime(tick);
    return () => {
      clearInterval(t);
      unsubscribe();
    };
  }, []);

  // React to clock-ins / clock-outs (this page + any other open tab).
  useEffect(() => {
    if (!email) return;
    const unsub = attendanceStore.subscribe(() => {
      setLogs(attendanceStore.getUserLogs(email));
    });
    return unsub;
  }, [email]);

  if (!user) return null;

  const phtNow = toPHT(now);
  const todayKey = todayPHTKey();
  const todayRecord = logs.find((l) => l.date === todayKey) ?? undefined;
  const absence = attendanceStore.getAbsence(email, todayKey);

  const isOnClock = hasActiveSession(todayRecord);
  const curDone = !!todayRecord?.timeIn && !!todayRecord?.timeOut && !isOnClock;
  const exceeded = isExceeded(todayRecord);
  const notStarted = !todayRecord?.timeIn;

  const activeSession =
    todayRecord && todayRecord.timeIn && !todayRecord.timeOut
      ? { timeIn: todayRecord.timeIn }
      : todayRecord?.extraSessions?.find((s) => s.timeIn && !s.timeOut) ?? null;
  const activeStart = activeSession?.timeIn;
  const sessionMs = isOnClock && activeStart ? now.getTime() - activeStart.getTime() : 0;

  const todayTotalMs = todayRecord ? sessionTotalMs(todayRecord, now) : 0;
  const weekStartKey = getWeekStartKey(phtNow);
  const weekRecords = logs.filter((l) => l.date >= weekStartKey);
  const weekTotalMs = weekRecords.reduce((sum, r) => sum + sessionTotalMs(r, now), 0);
  const weekOvertimeMs = overtimeMs(weekTotalMs, STANDARD_WEEKLY_HOURS);

  // The staff's scheduled shift from the shared roster (default fallback).
  const shift =
    getStaffRoster().find((m) => m.email.toLowerCase() === email.toLowerCase())?.shift ??
    DEFAULT_STAFF_SHIFT;

  const headerDate = phtNow.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const initials = getInitials(user?.name || user?.email);
  const displayName = user?.name || email.split("@")[0];
  const displayRole = user?.role === "admin" ? "Admin" : "Staff";

  // ── Today's prevailing status + state-driven session copy ────────────────
  const todayStatusMeta: Pill = (() => {
    if (absence === "on-leave") return { label: "On Leave", cls: PILL_STYLES.amber, dot: "bg-amber-500" };
    if (absence === "absent") return { label: "Absent", cls: PILL_STYLES.red, dot: "bg-red-500" };
    if (isOnClock) return { label: "On Clock", cls: PILL_STYLES.green, dot: "bg-green-500" };
    if (exceeded) return { label: "Exceeded", cls: PILL_STYLES.amber, dot: "bg-amber-500" };
    if (curDone) return { label: "Completed", cls: PILL_STYLES.green, dot: "bg-green-500" };
    if (todayRecord?.timeIn) return { label: "In Progress", cls: PILL_STYLES.blue, dot: "bg-blue-500" };
    return { label: "Not Clocked In", cls: PILL_STYLES.slate, dot: "bg-slate-400" };
  })();

  const sessionDisplay = fmtTimer(sessionMs);

  const sessionLabel = isOnClock ? "Current Session" : "Current Time";
  const sessionNote = absence === "on-leave"
    ? "You're marked on leave for today."
    : absence === "absent"
      ? "You're marked absent for today."
      : isOnClock
        ? `Started at ${fmt12(activeStart)}${exceeded ? " · extra clock-in after the day was done" : ""}`
        : curDone && exceeded
          ? "Day complete, with an extra clock-in — recorded as exceeded."
          : curDone
            ? "Time in and time out are recorded for today."
            : "Clock in to start your shift.";

  // ── Primary action (state-driven) ────────────────────────────────────────
  const isOnLeave = absence === "on-leave";
  const isAbsent = absence === "absent";
  const primaryDisabled = isOnLeave || isAbsent;
  const primaryLabel = isOnLeave
    ? "On Leave"
    : isAbsent
      ? "Marked Absent"
      : isOnClock
        ? "Time Out"
        : curDone
          ? "Clock In Again"
          : "Time In";

  const handleClock = () => {
    if (!email || primaryDisabled) return;
    try {
      if (isOnClock) {
        attendanceStore.timeOut(email);
        toast.success(`Time Out recorded at ${fmt12(new Date(internetUtcMs()))}. See you next shift!`);
      } else if (curDone) {
        attendanceStore.timeIn(email, user?.name || email.split("@")[0], "staff");
        toast.success("Extra time-in recorded — today is logged as exceeded.");
      } else {
        attendanceStore.timeIn(email, user?.name || email.split("@")[0], "staff");
        toast.success(`Time In recorded at ${fmt12(new Date(internetUtcMs()))}.`);
      }
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  // ── Per-row status (timesheet table) ─────────────────────────────────────
  const rowStatus = (record: DailyAttendanceRecord): Pill => {
    if (record.date === todayKey && absence === "on-leave")
      return { label: "On Leave", cls: PILL_STYLES.amber, dot: "bg-amber-500" };
    if (record.date === todayKey && absence === "absent")
      return { label: "Absent", cls: PILL_STYLES.red, dot: "bg-red-500" };
    if (record.date === todayKey && isOnClock)
      return { label: "On Clock", cls: PILL_STYLES.green, dot: "bg-green-500" };
    if (!record.timeIn)
      return { label: "Not Started", cls: PILL_STYLES.slate, dot: "bg-slate-400" };
    if (isExceeded(record))
      return { label: "Exceeded", cls: PILL_STYLES.amber, dot: "bg-amber-500" };
    if (record.timeIn && !record.timeOut)
      return { label: "Ongoing", cls: PILL_STYLES.blue, dot: "bg-blue-500" };
    return { label: "Completed", cls: PILL_STYLES.green, dot: "bg-green-500" };
  };

  return (
    <Layout menuItems={menuItems} title="Clock-In & Timesheet">
      <div className="bg-[#F5F7FA] min-h-full">
        <div className="mx-auto max-w-[1120px] space-y-6 pb-10">
          {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#102A5C]">
                Clock-In &amp; Timesheet
              </h2>
              <p className="mt-1 text-sm text-[#6B7890]">
                Track your work hours, manage your attendance, and view your timesheet.
              </p>
            </div>
          </header>

          {/* ── CURRENT STAFF / SESSION CARD ─────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,42,92,0.06)]">
            <div className="flex flex-col lg:flex-row lg:items-stretch p-6 sm:p-8">
              {/* Section A — Staff information */}
              <div className="flex-1 lg:pr-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-full bg-[#1668D9] text-white flex items-center justify-center text-lg font-bold uppercase shadow-lg shadow-[#1668D9]/20">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-[#102A5C] leading-tight">
                        Hello, {displayName}
                      </h2>
                      <span className="rounded-md bg-[#EAF2FF] border border-[#BFD7FF] px-2 py-0.5 text-[11px] font-bold text-[#1976F3]">
                        {displayRole}
                      </span>
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-sm">
                      <p className="flex items-center gap-2 text-[#6B7890]">
                        <Mail className="w-4 h-4 text-[#1976F3]" />
                        <span className="truncate">{email}</span>
                      </p>
                      <p className="flex items-center gap-2 text-[#6B7890]">
                        <Clock className="w-4 h-4 text-[#1976F3]" />
                        {shift}
                      </p>
                    </div>
                    <div className="mt-3.5">
                      <StatusPill meta={todayStatusMeta} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden lg:block w-px bg-slate-200" aria-hidden />

              {/* Section B — Today / Role */}
              <div className="mt-6 lg:mt-0 lg:px-6 lg:w-[210px] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#EAF2FF] flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-[#1976F3]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Today</p>
                    <p className="text-sm font-bold text-[#102A5C]">{headerDate}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#EAF2FF] flex items-center justify-center shrink-0">
                    <UserRound className="w-5 h-5 text-[#1976F3]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Role</p>
                    <p className="text-sm font-bold text-[#102A5C] capitalize">{displayRole}</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden lg:block w-px bg-slate-200" aria-hidden />

              {/* Section C — Current session */}
              <div className="mt-6 lg:mt-0 lg:pl-6 flex-1">
                <div className="rounded-2xl bg-[#F0F6FF] border border-blue-100 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-[#1976F3]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                        {sessionLabel}
                      </p>
                      <p className="text-sm text-[#6B7890] truncate">{sessionNote}</p>
                    </div>
                  </div>
                  <p className="mt-4 font-mono font-bold tabular-nums tracking-tight text-4xl text-[#1976F3]">
                      {isOnClock ? sessionDisplay : "--:--:--"}
                    </p>
                  <button
                    type="button"
                    onClick={() => setShowClockConfirm(true)}
                    disabled={primaryDisabled}
                    className="mt-4 w-full h-11 rounded-lg inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#1668D9] hover:bg-[#1659c4] border border-white/10 shadow-[0_6px_14px_-8px_rgba(29,115,236,0.55)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {isOnClock ? (
                      <LogOut className="w-4 h-4" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    {primaryLabel}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── ATTENDANCE SUMMARY CARDS ─────────────────────────────────── */}
          {hydrating && <CardSkeleton cards={3} columns={3} label="Loading attendance" />}
          <div className={hydrating ? "hidden" : "grid grid-cols-1 @min-[720px]:grid-cols-3 gap-4"}>
            <SummaryCard
              icon={Clock}
              label="Today"
              value={fmtHM(todayTotalMs)}
              subtitle={isOnClock ? "Current session" : "Total today"}
            />
            <SummaryCard
              icon={CalendarDays}
              label="This Week"
              value={fmtHM(weekTotalMs)}
              subtitle="Total hours"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Overtime this week"
              value={fmtHM(weekOvertimeMs)}
              subtitle={
                weekOvertimeMs > 0 ? "This week's overtime" : "No overtime yet"
              }
              iconColor="text-amber-600"
              valueColor="text-amber-600"
            />
          </div>

          {/* ── PERSONAL TIME LOGS ─────────────────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,42,92,0.06)]">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-[#EAF2FF] flex items-center justify-center shrink-0">
                  <History className="w-5 h-5 text-[#1976F3]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#102A5C]">Personal Time Logs</h3>
                  <p className="text-xs text-[#6B7890] mt-0.5">
                    {logs.length} day{logs.length === 1 ? "" : "s"} recorded
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen((v) => !v)}
                className="shrink-0 rounded-lg border-[#1976F3] text-[#1976F3] hover:bg-[#1976F3] hover:text-white"
              >
                {historyOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" /> Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" /> Full History
                  </>
                )}
              </Button>
            </div>

            {historyOpen ? (
              /* Expanded table */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F4F7FB]">
                    <tr>
                      {["Date", "Clock-In", "Clock-Out", "Total", "Overtime", "Status"].map((c) => (
                        <th
                          key={c}
                          className="px-6 sm:px-8 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6] whitespace-nowrap"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {logs.length > 0 ? (
                      logs.map((record) => {
                        const isToday = record.date === todayKey;
                        const live = isToday && isOnClock;
                        const rTotal = sessionTotalMs(record, now);
                        const rOt = overtimeMs(rTotal);
                        const meta = rowStatus(record);
                        return (
                          <tr
                            key={record.id}
                            className={`border-b border-slate-100 last:border-0 transition-colors ${
                              isToday ? "bg-blue-50/40" : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap align-top">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[#102A5C]">
                                  {shortDateOf(record.date)}
                                </span>
                                {isToday && (
                                  <span className="rounded-full bg-[#EAF2FF] border border-[#BFD7FF] px-2 py-0.5 text-[10px] font-bold text-[#1976F3]">
                                    Today
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#8A94A6] mt-0.5">{weekdayOf(record.date)}</p>
                            </td>
                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap align-top">
                              <p className="text-sm font-semibold text-[#102A5C] tabular-nums">
                                {fmt12(record.timeIn)}
                              </p>
                              <span className="text-[11px] text-[#8A94A6]">(PHT)</span>
                            </td>
                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap align-top">
                              {live ? (
                                <>
                                  <p className="text-sm text-[#8A94A6] tabular-nums">—</p>
                                  <span className="text-[11px] text-[#6B7890]">In Progress</span>
                                </>
                              ) : record.timeOut ? (
                                <>
                                  <p className="text-sm font-semibold text-[#102A5C] tabular-nums">
                                    {fmt12(record.timeOut)}
                                  </p>
                                  <span className="text-[11px] text-[#8A94A6]">(PHT)</span>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm text-[#8A94A6] tabular-nums">—</p>
                                  <span className="text-[11px] text-[#6B7890]">—</span>
                                </>
                              )}
                            </td>
                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap align-top">
                              <p className="text-sm font-bold text-[#102A5C] tabular-nums">{fmtHM(rTotal)}</p>
                            </td>
                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap align-top">
                              <p className="text-sm font-semibold text-amber-600 tabular-nums">{fmtHM(rOt)}</p>
                            </td>
                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap align-top">
                              <StatusPill meta={meta} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-16 text-[#8A94A6]">
                            <Clock className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm font-medium text-[#6B7890]">No clock entries yet</p>
                            <p className="text-xs mt-1">Use the Time In button above to start your first shift.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Collapsed — recent entries as compact rows */
              <div className="px-6 sm:px-8 py-2">
                {logs.length > 0 ? (
                  logs.slice(0, 5).map((record) => {
                    const isToday = record.date === todayKey;
                    const live = isToday && isOnClock;
                    const meta = rowStatus(record);
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between gap-4 border-b border-slate-100 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#102A5C]">
                            {shortDateOf(record.date)}
                            <span className="ml-1.5 text-xs font-medium text-[#8A94A6]">
                              {isToday ? "Today" : weekdayOf(record.date)}
                            </span>
                          </p>
                          <p className="text-sm text-[#6B7890] tabular-nums">
                            {fmt12(record.timeIn)} → {live ? "—" : fmt12(record.timeOut)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-[#102A5C] tabular-nums">
                            {fmtHM(sessionTotalMs(record, now))}
                          </span>
                          <StatusPill meta={meta} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8">
                    <p className="text-sm text-[#6B7890]">
                      No clock entries yet. Click{" "}
                      <span className="font-semibold text-[#1976F3]">Time In</span> above to start your first
                      shift.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Information message */}
            <div className="px-6 sm:px-8 py-4 border-t border-slate-100">
              <div className="flex items-start gap-2.5 rounded-xl bg-[#EEF6FF] px-4 py-3.5">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-[#1976F3]" />
                <p className="text-[13px] leading-relaxed text-[#5C6B84]">
                  Standard shift: {STANDARD_DAILY_HOURS}h/day ·{" "}
                  {STANDARD_WEEKLY_HOURS}h/week. Extra clock-ins are logged as Exceeded.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showClockConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowClockConfirm}
          onConfirm={() => {
            handleClock();
            setShowClockConfirm(false);
          }}
          title={isOnClock ? "Time Out?" : curDone ? "Clock In Again?" : "Time In?"}
          description={
            isOnClock
              ? `End your shift now? Your clock-out time will be recorded at ${fmt12(new Date(internetUtcMs()))}.`
              : curDone
                ? "Time in and out are already done today. Clock in again? It is recorded as exceeded time."
                : `Start your shift? Clock-in recorded at ${fmt12(new Date(internetUtcMs()))}.`
          }
          confirmLabel={isOnClock ? "Time Out" : curDone ? "Yes, Clock In Again" : "Time In"}
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
    </Layout>
  );
}
