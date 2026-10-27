// Per-day attendance detail modal (Staff Management page). Shows one staff
// member's record for one date and hosts all the day-level actions (adjust
// clock-in/out, mark/clear on-leave/absent, reset the day). The modal stays
// open through actions — confirmations stack on top and the store subscription
// refreshes the row live.
import React, { useState } from "react";
import {
  Pencil,
  Clock,
  PlaneTakeoff,
  UserX,
  Trash2,
  Shield,
  CalendarDays,
  LogIn,
  LogOut,
  Timer,
  BadgeCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { attendanceStore } from "../../utils/attendanceStore";
import type { AbsenceType } from "../../utils/attendanceStore";
import {
  fmtTime12,
  fmtHms,
  fmtLongDay,
  toLocalInput,
  fromPHTInput,
  initialsOf,
  roleOf,
  scheduleOf,
} from "../../utils/attendanceView";
import type { AdminRow, AdjustTarget } from "../../utils/attendanceView";
import { AttendanceStatusBadges } from "./AttendanceBadges";

type AttendanceDayModalProps = {
  row: AdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AttendanceDayModal({ row, open, onOpenChange }: AttendanceDayModalProps) {
  const [adjust, setAdjust] = useState<AdjustTarget>(null);
  const [adjValue, setAdjValue] = useState("");
  const [showSaveAdjustConfirm, setShowSaveAdjustConfirm] = useState(false);
  const [absenceTarget, setAbsenceTarget] = useState<{ row: AdminRow; type: AbsenceType } | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);

  const openAdjust = (_row: AdminRow, field: "timeIn" | "timeOut") => {
    const current = _row.record?.[field];
    setAdjust({ row: _row, field });
    setAdjValue(current ? toLocalInput(current) : toLocalInput(new Date()));
  };

  const saveAdjust = () => {
    if (!adjust) return;
    const { row: target, field } = adjust;
    const parsed = adjValue ? fromPHTInput(adjValue) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      toast.error("Please choose a valid date and time.");
      return;
    }
    try {
      attendanceStore.upsertTime(
        target.member.email,
        target.member.name,
        "staff",
        target.date,
        field,
        parsed,
      );
      toast.success(
        `Updated ${field === "timeIn" ? "clock-in" : "clock-out"} for ${target.member.name} (${fmtLongDay(target.date)}).`,
      );
      setAdjust(null);
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  const toggleAbsence = (target: AdminRow, type: AbsenceType) => {
    if (target.absence === type) {
      attendanceStore.setAbsence(target.member.email, target.date, null);
      toast.success(`Cleared ${type === "on-leave" ? "On Leave" : "Absent"} for ${target.member.name}.`);
    } else {
      attendanceStore.setAbsence(target.member.email, target.date, type);
      toast.success(`${target.member.name} marked ${type === "on-leave" ? "On Leave" : "Absent"} for ${fmtLongDay(target.date)}.`);
    }
  };

  const resetDay = (target: AdminRow) => {
    attendanceStore.upsertTime(target.member.email, target.member.name, "staff", target.date, "timeIn", null);
    attendanceStore.setAbsence(target.member.email, target.date, null);
    toast.success(`Attendance reset for ${target.member.name} on ${fmtLongDay(target.date)}.`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 rounded-[22px] border-[#DCE7F5] bg-white p-0 shadow-[0_30px_90px_-20px_rgba(15,33,66,0.45)] sm:max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">Attendance - {row.member.name}</DialogTitle>
          <DialogDescription className="sr-only">
            {fmtLongDay(row.date)} attendance record for {row.member.name}.
          </DialogDescription>

          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[#54606E] transition-colors hover:bg-[#1677F2]/10 hover:text-[#1677F2]"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="w-full px-6 pb-8 pt-7 sm:px-8 sm:pt-8">
            {/* Header */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1677F2]/10">
                <CalendarDays className="h-5 w-5 text-[#1677F2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold tracking-tight text-[#14213D] sm:text-2xl">
                  Attendance – {row.member.name}
                </h2>
                <p className="mt-0.5 text-sm text-[#8A94A6]">{fmtLongDay(row.date)}</p>
              </div>
            </div>

            {/* Staff Details */}
            <div className="mt-6 rounded-2xl border border-[#E5EDF9] bg-[#F7FAFF] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                Staff Details
              </p>
              <div className="mt-1 divide-y divide-[#EEF3FA]">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[#5C5D6E]">Name</span>
                  <span className="text-sm font-semibold text-[#14213D]">{row.member.name}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[#5C5D6E]">Email</span>
                  <span className="text-sm font-medium text-[#14213D]">{row.member.email}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[#5C5D6E]">Role</span>
                  <Badge
                    className={
                      roleOf(row.member) === "Admin"
                        ? "border border-[#1677F2]/20 bg-[#1677F2]/10 font-medium text-[#1677F2]"
                        : "border border-[#E5EDF9] bg-[#EEF3FA] font-medium text-[#5C5D6E]"
                    }
                  >
                    {roleOf(row.member) === "Admin" && <Shield className="h-3 w-3" />}
                    {roleOf(row.member)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[#5C5D6E]">Schedule</span>
                  <span className="text-sm font-medium text-[#14213D]">{scheduleOf(row.member)}</span>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="mt-4 rounded-2xl border border-[#E5EDF9] bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                Attendance Summary
              </p>
              <div className="mt-1 divide-y divide-[#EEF3FA]">
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EBF3FF]">
                      <LogIn className="h-3.5 w-3.5 text-[#1677F2]" />
                    </span>
                    <span className="text-[13px] text-[#5C5D6E]">Clock In</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[#14213D]">
                    {row.clockIn ? fmtTime12(row.clockIn) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EBF3FF]">
                      <LogOut className="h-3.5 w-3.5 text-[#1677F2]" />
                    </span>
                    <span className="text-[13px] text-[#5C5D6E]">Clock Out</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[#14213D]">
                    {row.isLive ? (
                      <span className="flex items-center gap-1.5 text-green-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                        On Clock
                      </span>
                    ) : (
                      row.clockOut ? fmtTime12(row.clockOut) : "—"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EBF3FF]">
                      <Timer className="h-3.5 w-3.5 text-[#1677F2]" />
                    </span>
                    <span className="text-[13px] text-[#5C5D6E]">Hours Worked</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#14213D]">
                    {row.totalMs > 0 ? fmtHms(row.totalMs) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EBF3FF]">
                      <BadgeCheck className="h-3.5 w-3.5 text-[#1677F2]" />
                    </span>
                    <span className="text-[13px] text-[#5C5D6E]">Status</span>
                  </div>
                  <AttendanceStatusBadges row={row} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                Actions
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#14213D] hover:bg-[#1677F2]/5 hover:text-[#14213D] hover:border-[#1677F2]/60"
                  onClick={() => openAdjust(row, "timeIn")}
                >
                  <Pencil className="h-4 w-4 text-[#1677F2]" />
                  Adjust Clock-In
                </Button>
                <Button
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#14213D] hover:bg-[#1677F2]/5 hover:text-[#14213D] hover:border-[#1677F2]/60"
                  onClick={() => openAdjust(row, "timeOut")}
                >
                  <Clock className="h-4 w-4 text-[#1677F2]" />
                  Adjust Clock-Out
                </Button>
                <Button
                  variant="outline"
                  className={`h-10 justify-start gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#14213D] hover:bg-[#1677F2]/5 hover:text-[#14213D] hover:border-[#1677F2]/60 ${
                    row.absence === "on-leave"
                      ? "border-amber-300 text-amber-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                      : ""
                  }`}
                  onClick={() => setAbsenceTarget({ row, type: "on-leave" })}
                >
                  <PlaneTakeoff className={`h-4 w-4 ${row.absence === "on-leave" ? "text-amber-500" : "text-[#1677F2]"}`} />
                  {row.absence === "on-leave" ? "Clear On Leave" : "Mark On Leave"}
                </Button>
                <Button
                  variant="outline"
                  className={`h-10 justify-start gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#14213D] hover:bg-[#1677F2]/5 hover:text-[#14213D] hover:border-[#1677F2]/60 ${
                    row.absence === "absent"
                      ? "border-red-300 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      : ""
                  }`}
                  onClick={() => setAbsenceTarget({ row, type: "absent" })}
                >
                  <UserX className={`h-4 w-4 ${row.absence === "absent" ? "text-red-500" : "text-[#1677F2]"}`} />
                  {row.absence === "absent" ? "Clear Absent" : "Mark Absent"}
                </Button>
              </div>
              <Button
                variant="outline"
                className="mt-2.5 h-10 w-full justify-start gap-2 rounded-lg px-3 text-[13px] font-semibold text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 border-red-200 bg-red-50/50"
                onClick={() => setResetTarget(row)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                Reset Day's Record
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust dialog (stacks over the detail modal) */}
      <Dialog open={!!adjust} onOpenChange={openD => !openD && setAdjust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adjust {adjust?.field === "timeIn" ? "Clock-In" : "Clock-Out"} Time
            </DialogTitle>
            <DialogDescription>
              {adjust ? `${adjust.row.member.name} · ${fmtLongDay(adjust.row.date)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</Label>
              <Input
                type="datetime-local"
                value={adjValue}
                onChange={e => setAdjValue(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500">
              Saving will overwrite this staff member's{" "}
              {adjust?.field === "timeIn" ? "clock-in" : "clock-out"} timestamp for the day.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjust(null)}>
              Cancel
            </Button>
            <Button data-primary-action className="bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white" onClick={() => setShowSaveAdjustConfirm(true)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Adjust Confirmation */}
      {showSaveAdjustConfirm && adjust && (
        <ConfirmationDialog
          open={showSaveAdjustConfirm}
          onOpenChange={setShowSaveAdjustConfirm}
          onConfirm={saveAdjust}
          title="Adjust Time?"
          description={`Set ${adjust.row.member.name}'s ${adjust.field === "timeIn" ? "clock-in" : "clock-out"} for ${fmtLongDay(adjust.row.date)} to ${adjValue}?`}
          confirmLabel="Save Changes"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Absence Confirmation */}
      {absenceTarget && (
        <ConfirmationDialog
          open
          onOpenChange={() => setAbsenceTarget(null)}
          onConfirm={() => { toggleAbsence(absenceTarget.row, absenceTarget.type); setAbsenceTarget(null); }}
          title={absenceTarget.row.absence === absenceTarget.type ? "Clear Absence?" : (absenceTarget.type === "on-leave" ? "Mark On Leave?" : "Mark Absent?")}
          description={
            absenceTarget.row.absence === absenceTarget.type
              ? `Clear the ${absenceTarget.type === "on-leave" ? "On Leave" : "Absent"} status for ${absenceTarget.row.member.name} on ${fmtLongDay(absenceTarget.row.date)}?`
              : `Mark ${absenceTarget.row.member.name} as ${absenceTarget.type === "on-leave" ? "On Leave" : "Absent"} for ${fmtLongDay(absenceTarget.row.date)}?`
          }
          confirmLabel={absenceTarget.row.absence === absenceTarget.type ? "Clear" : (absenceTarget.type === "on-leave" ? "Mark On Leave" : "Mark Absent")}
          cancelLabel="Go Back"
          destructive={absenceTarget.type === "absent"}
        />
      )}

      {/* Reset Day Confirmation */}
      {resetTarget && (
        <ConfirmationDialog
          open
          onOpenChange={() => setResetTarget(null)}
          onConfirm={() => { resetDay(resetTarget); setResetTarget(null); }}
          title="Reset Day's Record?"
          description={`Delete ${resetTarget.member.name}'s attendance for ${fmtLongDay(resetTarget.date)}? This cannot be undone.`}
          confirmLabel="Reset Record"
          cancelLabel="Keep Record"
          destructive
          requirePhrase
        />
      )}
    </>
  );
}