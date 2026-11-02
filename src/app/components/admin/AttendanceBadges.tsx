// Shared attendance status badges for the merged Staff Management page.
import React from "react";
import { Badge } from "../ui/badge";
import type { AdminRow } from "../../utils/attendanceView";

// A single compact today-status pill for the directory "Status" column / the
// KPI filter in the right-hand detail pane header. Colors mirror the badges
// used across the monitoring views (On Leave orange, Absent red, present
// states green/amber). A staff member who hasn't clocked in shows as Absent.
export function todayStatusInfo(row: AdminRow): {
  label: string;
  className: string;
  pulse?: boolean;
} {
  if (row.presence !== "present") {
    if (row.presence === "on-leave")
      return { label: "On Leave", className: "border border-orange-200 bg-orange-100 text-orange-700" };
    return { label: "Absent", className: "border border-red-200 bg-red-100 text-red-700" };
  }
  if (row.isLive)
    return {
      label: "On Clock",
      className: "border border-green-200 bg-green-50 text-green-700",
      pulse: true,
    };
  if (row.onTime)
    return { label: "On Time", className: "border border-green-200 bg-green-100 text-green-700" };
  return { label: "Late", className: "border border-amber-200 bg-amber-100 text-amber-700" };
}

// The full badge set (On Time / Late / Overtime / Exceeded / On Clock plus the
// non-present pills) — used in the day modal and detail rows.
export function AttendanceStatusBadges({ row }: { row: AdminRow }) {
  if (row.presence !== "present") {
    const info = todayStatusInfo(row);
    return <Badge className={info.className}>{info.label}</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {row.onTime && <Badge className="border border-green-200 bg-green-100 text-green-700">On Time</Badge>}
      {row.late && <Badge className="border border-amber-200 bg-amber-100 text-amber-700">Late</Badge>}
      {row.overtime && <Badge className="border border-purple-200 bg-purple-100 text-purple-700">Overtime</Badge>}
      {row.exceeded && (
        <Badge className="border border-amber-200 bg-amber-100 text-amber-700">Exceeded</Badge>
      )}
      {row.isLive && (
        <Badge className="border border-green-200 bg-green-50 text-green-700">
          <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          On Clock
        </Badge>
      )}
    </span>
  );
}
