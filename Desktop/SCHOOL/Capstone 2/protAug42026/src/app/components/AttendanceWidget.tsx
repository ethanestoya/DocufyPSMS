import React, { useState, useEffect } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  Sun,
  Sunset,
  CheckCircle2,
  Calendar,
  Timer,
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import {
  attendanceStore,
  calcDurationMs,
} from "../utils/attendanceStore";
import type {
  DailyAttendanceRecord,
  NextAction,
} from "../utils/attendanceStore";
import { useAuth } from "../contexts/AuthContext";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d?: Date): string =>
  d
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "——";

const fmtDuration = (ms: number): string => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const sessionDuration = (timeIn?: Date, timeOut?: Date, now?: Date): string => {
  if (!timeIn) return "——";
  const end = timeOut ?? now ?? new Date();
  return fmtDuration(calcDurationMs(timeIn, end));
};

// Labels / config per next-action state
const ACTION_CONFIG: Record<
  NextAction,
  {
    buttonLabel: string;
    buttonIcon: "in" | "out" | "none";
    period: "morning" | "afternoon" | null;
    isTimeIn: boolean;
  }
> = {
  "morning-time-in":    { buttonLabel: "Time In — Morning",   buttonIcon: "in",   period: "morning",   isTimeIn: true  },
  "morning-time-out":   { buttonLabel: "Time Out — Morning",  buttonIcon: "out",  period: "morning",   isTimeIn: false },
  "afternoon-time-in":  { buttonLabel: "Time In — Afternoon", buttonIcon: "in",   period: "afternoon", isTimeIn: true  },
  "afternoon-time-out": { buttonLabel: "Time Out — Afternoon",buttonIcon: "out",  period: "afternoon", isTimeIn: false },
  complete:             { buttonLabel: "Attendance Complete",  buttonIcon: "none", period: null,        isTimeIn: false },
};

// ── Session Row ────────────────────────────────────────────────────────────
interface SessionRowProps {
  label: string;
  icon: React.ReactNode;
  record?: { timeIn?: Date; timeOut?: Date };
  isActiveSession: boolean; // currently open (timeIn set, no timeOut)
  now: Date;
  accentColor: string;      // Tailwind color class for accent
  bgColor: string;
}

function SessionRow({
  label,
  icon,
  record,
  isActiveSession,
  now,
  accentColor,
  bgColor,
}: SessionRowProps) {
  const hasTimeIn  = !!record?.timeIn;
  const hasTimeOut = !!record?.timeOut;
  const isComplete = hasTimeIn && hasTimeOut;

  return (
    <div className={`rounded-xl border ${bgColor} p-4`}>
      {/* Session header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`${accentColor}`}>{icon}</span>
          <span className={`text-xs font-bold uppercase tracking-wider ${accentColor}`}>
            {label}
          </span>
        </div>
        {isActiveSession && (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold px-2 py-0.5 animate-pulse">
            Active
          </Badge>
        )}
        {isComplete && (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
        {!hasTimeIn && !isActiveSession && (
          <span className="text-[10px] text-gray-400 font-medium uppercase">Not started</span>
        )}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Time In */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Time In
          </span>
          <span
            className={`text-sm font-bold ${
              hasTimeIn ? "text-slate-800" : "text-gray-300"
            }`}
          >
            {fmt(record?.timeIn)}
          </span>
        </div>

        {/* Time Out */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Time Out
          </span>
          <span
            className={`text-sm font-bold ${
              hasTimeOut
                ? "text-slate-800"
                : isActiveSession
                ? "text-gray-400 italic"
                : "text-gray-300"
            }`}
          >
            {hasTimeOut ? fmt(record?.timeOut) : isActiveSession ? "Ongoing…" : "——"}
          </span>
        </div>
      </div>

      {/* Duration row */}
      {hasTimeIn && (
        <div className="mt-2 pt-2 border-t border-white/60 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase">
            <Timer className="w-3 h-3" />
            Duration
          </div>
          <span
            className={`text-sm font-mono font-bold ${
              isActiveSession ? accentColor : "text-slate-600"
            }`}
          >
            {sessionDuration(record?.timeIn, record?.timeOut, isActiveSession ? now : undefined)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────
export default function AttendanceWidget() {
  const { user } = useAuth();

  const [record, setRecord]         = useState<DailyAttendanceRecord | null>(() =>
    user ? attendanceStore.getTodayRecord(user.email) : null,
  );
  const [nextAction, setNextAction] = useState<NextAction>(() =>
    user ? attendanceStore.getNextAction(user.email) : "morning-time-in",
  );
  const [now, setNow]               = useState(new Date());

  // Live clock (1-second tick)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to store changes
  useEffect(() => {
    if (!user) return;
    const unsub = attendanceStore.subscribe(() => {
      setRecord(attendanceStore.getTodayRecord(user.email));
      setNextAction(attendanceStore.getNextAction(user.email));
    });
    return unsub;
  }, [user]);

  const handleAction = () => {
    if (!user) return;
    const cfg = ACTION_CONFIG[nextAction];
    const userName = user.name || user.email.split("@")[0];
    const role = user.role === "admin" ? "admin" : "staff";

    try {
      if (cfg.isTimeIn) {
        attendanceStore.timeIn(user.email, userName, role);
        toast.success(
          `${cfg.period === "morning" ? "🌅 Morning" : "🌆 Afternoon"} Time In recorded at ${fmt(new Date())}`,
        );
      } else if (nextAction !== "complete") {
        attendanceStore.timeOut(user.email);
        toast.success(
          `${cfg.period === "morning" ? "🌅 Morning" : "🌆 Afternoon"} Time Out recorded at ${fmt(new Date())}`,
        );
      }
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  const cfg = ACTION_CONFIG[nextAction];

  // Determine which session is currently active for live duration
  const morningActive   = !!(record?.morning.timeIn  && !record?.morning.timeOut);
  const afternoonActive = !!(record?.afternoon.timeIn && !record?.afternoon.timeOut);

  // Status badge
  const statusLabel =
    nextAction === "complete"
      ? "Complete"
      : morningActive || afternoonActive
      ? "Active"
      : "Inactive";

  const statusStyle =
    statusLabel === "Complete"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : statusLabel === "Active"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <Card className="p-5 bg-white border border-slate-100 shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#1D73EC]" />
          <h3 className="text-base font-bold text-slate-800">Attendance</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[11px] font-bold px-2.5 py-0.5 ${statusStyle}`}
          >
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* ── Date + Live Clock ── */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {now.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-[#1D73EC]">
          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* ── Sessions ── */}
      <div className="space-y-3">
        <SessionRow
          label="Morning Session"
          icon={<Sun className="w-4 h-4" />}
          record={record?.morning}
          isActiveSession={morningActive}
          now={now}
          accentColor="text-amber-600"
          bgColor="bg-amber-50 border-amber-100"
        />

        <SessionRow
          label="Afternoon Session"
          icon={<Sunset className="w-4 h-4" />}
          record={record?.afternoon}
          isActiveSession={afternoonActive}
          now={now}
          accentColor="text-blue-600"
          bgColor="bg-blue-50 border-blue-100"
        />
      </div>

      {/* ── Action Button ── */}
      <Button
        onClick={handleAction}
        disabled={nextAction === "complete"}
        className={`w-full font-bold h-11 mt-4 text-sm transition-all ${
          nextAction === "complete"
            ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-50 cursor-default"
            : nextAction === "morning-time-out" || nextAction === "afternoon-time-out"
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-[#1D73EC] hover:bg-[#1659c4] text-white"
        }`}
      >
        {cfg.buttonIcon === "in"  && <LogIn  className="w-4 h-4 mr-2" />}
        {cfg.buttonIcon === "out" && <LogOut className="w-4 h-4 mr-2" />}
        {cfg.buttonIcon === "none" && <CheckCircle2 className="w-4 h-4 mr-2" />}
        {cfg.buttonLabel}
      </Button>

      {/* ── Hint text ── */}
      <p className="text-[10px] text-gray-400 text-center mt-2 font-medium uppercase tracking-wide">
        {nextAction === "morning-time-in"    && "Clock in to start your morning session"}
        {nextAction === "morning-time-out"   && "Click when you break for lunch"}
        {nextAction === "afternoon-time-in"  && "Clock in after your lunch break"}
        {nextAction === "afternoon-time-out" && "Click to end your afternoon session"}
        {nextAction === "complete"           && "Both sessions recorded for today ✓"}
      </p>
    </Card>
  );
}
