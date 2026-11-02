// Floating modal showing every attendance record for one staff member (all time),
// opened from the "View All Attendance History" button in the staff detail page.
// Clicking a row opens that day's record editor.
import React from "react";
import { CalendarDays, ChevronRight, Clock, History, UserCheck, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { attendanceStore, hasActiveSession, sessionTotalMs, nowPHT, type DailyAttendanceRecord } from "../../utils/attendanceStore";
import { fmtHms, fmtTime12, initialsOf } from "../../utils/attendanceView";
import { formatPHDate } from "../../utils/pht";

type AttendanceHistoryModalProps = {
  member: { name: string; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDay: (date: string) => void;
};

export function AttendanceHistoryModal({
  member,
  open,
  onOpenChange,
  onOpenDay,
}: AttendanceHistoryModalProps) {
  const records = open
    ? attendanceStore.getUserLogs(member.email.toLowerCase())
    : [];

  let totalMs = 0;
  let daysPresent = 0;
  for (const r of records) {
    totalMs += sessionTotalMs(r, nowPHT());
    if (r.timeIn) daysPresent += 1;
  }
  const totalHours = totalMs / 3_600_000;

  const statusOf = (r: DailyAttendanceRecord) => {
    if (hasActiveSession(r)) return "Active";
    if (r.timeIn && r.timeOut) return r.exceeded ? "Exceeded" : "Complete";
    return "Incomplete";
  };

  const statusBadge = (status: string) =>
    status === "Complete"
      ? "bg-green-50 text-green-700 border border-green-200"
      : status === "Active"
        ? "bg-blue-50 text-[#1677F2] border border-blue-200"
        : status === "Exceeded"
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-gray-100 text-gray-600 border border-gray-200";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-[22px] border-[#DCE7F5] bg-white p-0 shadow-[0_30px_90px_-20px_rgba(15,33,66,0.45)] sm:max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Attendance History - {member.name}</DialogTitle>
        <DialogDescription className="sr-only">
          All attendance records for {member.name}.
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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1677F2] to-[#1668D9] text-base font-bold text-white shadow-[0_8px_18px_-8px_rgba(22,119,242,0.6)]">
              {initialsOf(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold tracking-tight text-[#14213D] sm:text-2xl">
                {member.name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[#8A94A6]">
                <History className="h-3.5 w-3.5 text-[#1677F2]" />
                Attendance History · {records.length} record{records.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-[#8A94A6]">
              <CalendarDays className="h-4 w-4 text-[#1677F2]" />
              All time
            </span>
          </div>

          {/* Lifetime summary */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5EDF9] bg-[#F7FAFF] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF3FF]">
                <CalendarDays className="h-4 w-4 text-[#1677F2]" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Records</p>
                <p className="text-base font-bold tabular-nums text-[#14213D]">{records.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5EDF9] bg-[#F7FAFF] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF3FF]">
                <UserCheck className="h-4 w-4 text-[#1677F2]" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Days Present</p>
                <p className="text-base font-bold tabular-nums text-[#14213D]">{daysPresent}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5EDF9] bg-[#F7FAFF] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF3FF]">
                <Clock className="h-4 w-4 text-[#1677F2]" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Total Hours</p>
                <p className="text-base font-bold tabular-nums text-[#14213D]">
                  {totalHours > 0 ? `${totalHours.toFixed(2)} hrs` : fmtHms(totalMs)}
                </p>
              </div>
            </div>
          </div>

          {/* Records */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#E5EDF9] bg-white">
            <div className="flex items-center justify-between border-b border-[#EEF3FA] px-5 py-4 sm:px-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#14213D]">
                <History className="h-4 w-4 text-[#1677F2]" />
                Attendance Records
              </p>
              <span className="text-xs text-[#5C5D6E]">
                {records.length} day{records.length === 1 ? "" : "s"}
              </span>
            </div>

            {records.length === 0 ? (
              <div className="py-14 text-center">
                <Clock className="mx-auto mb-3 h-10 w-10 text-[#C9D4E4]" />
                <p className="text-sm font-medium text-[#54606E]">No attendance records yet.</p>
                <p className="mt-1 text-xs text-[#8A94A6]">
                  Records appear here once the staff member clocks in.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#EEF3FA] bg-[#FBFDFE]">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Date</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Clock In</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Clock Out</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Hours</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3FA]">
                    {records.map((r) => {
                      const status = statusOf(r);
                      const hours = sessionTotalMs(r, nowPHT()) / 3_600_000;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => onOpenDay(r.date)}
                          className="cursor-pointer transition-colors hover:bg-[#F7FAFF]"
                        >
                          <td className="whitespace-nowrap px-5 py-2.5 font-medium text-[#14213D]">
                            {formatPHDate(r.date, "short")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-[#5C5D6E]">
                            {r.timeIn ? fmtTime12(r.timeIn) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-[#5C5D6E]">
                            {r.timeOut ? (
                              fmtTime12(r.timeOut)
                            ) : hasActiveSession(r) ? (
                              <span className="font-medium text-green-600">On Clock</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-[#14213D]">
                            {hours > 0 ? `${hours.toFixed(2)} hrs` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={statusBadge(status)}>{status}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right">
                            <ChevronRight className="ml-auto h-4 w-4 text-[#C9D4E4]" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-[#EEF3FA] px-5 py-3 sm:px-6">
              <p className="text-[11px] text-[#8A94A6]">
                Click a day to view or adjust that day's clock-in/out.
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-lg px-4 text-xs font-semibold text-[#14213D] hover:bg-[#1677F2]/5 hover:text-[#14213D] hover:border-[#1677F2]/60"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
