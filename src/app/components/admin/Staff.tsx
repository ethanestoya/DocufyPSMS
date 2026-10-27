import React, { useState, useMemo, useEffect } from "react";
import {
  UserPlus,
  Shield,
  User,
  Users,
  Ban,
  Clock,
  UserCheck,
  AlarmClock,
  LogOut,
  UserX,
  Edit2,
  Wallet,
  History,
  Eye,
  EyeOff,
  Search,
  Mail,
  X,
  Banknote,
  Briefcase,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  ChevronDown,
  Sun,
  ArrowLeft,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PasswordStrengthIndicator, validatePassword } from "../ui/password-strength-indicator";
import { useAuth } from "../../contexts/AuthContext";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import { FilterLabel } from "../ui/filter-label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { SummaryCard } from "../ui/summary-card";
import { staffStore, type Staff } from "../../utils/staffStore";
import { salaryStore } from "../../utils/salaryStore";
import { attendanceStore, sessionTotalMs, hasActiveSession, nowPHT, getWeekStartKey } from "../../utils/attendanceStore";

import { formatCurrency, formatNumber } from "../../utils/formatNumber";
import { getStaffRoster, DEFAULT_STAFF_SHIFT } from "../../utils/staffRoster";
import type { StaffMember } from "../../utils/staffRoster";
import {
  buildRow,
  buildMemberRangeRows,
  useTodaySnapshot,
  fmtHms,
  fmtTime12,
  fmtLongDay,
  fmtDay,
  roleOf,
  scheduleOf,
  MS_PER_HOUR,
} from "../../utils/attendanceView";
import type { AdminRow } from "../../utils/attendanceView";
import { AttendanceDayModal } from "./AttendanceDayModal";
import { AttendanceHistoryModal } from "./AttendanceHistoryModal";
import { AttendanceStatusBadges, todayStatusInfo } from "./AttendanceBadges";

import { adminMenuItems } from "../../utils/adminMenuItems";
import { formatPHDate, formatPHDateTime, todayPHTKey, toPHTKey } from "../../utils/pht";

const menuItems = adminMenuItems;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TodayFilter = "all" | "on-time" | "late" | "on-clock" | "on-leave" | "absent";

const matchesTodayFilter = (row: AdminRow | undefined, filter: TodayFilter): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "on-time":
      return !!row && row.presence === "present" && row.onTime;
    case "late":
      return !!row && row.presence === "present" && row.late;
    case "on-clock":
      return !!row && row.isLive;
    case "on-leave":
      return !!row && row.presence === "on-leave";
    case "absent":
      return !!row && row.presence === "absent";
    default:
      return true;
  }
};

const addDaysKey = (key: string, days: number): string => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return formatPHDate(date, "short");
}

// Salary period split into "September" (month on top) + "15 - 16, 2026" (dates below).
function formatSalaryPeriodStack(start: string, end: string): { month: string; dates: string } {
  const parse = (s: string) => {
    const d = new Date(`${s}T00:00:00`);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      monthLong: d.toLocaleString("en-US", { month: "long" }),
      monthShort: d.toLocaleString("en-US", { month: "short" }),
    };
  };
  const a = parse(start);
  const b = parse(end);
  const sameMonth = a.year === b.year && a.month === b.month;
  if (sameMonth) {
    return { month: a.monthLong, dates: `${a.day} - ${b.day}, ${a.year}` };
  }
  const sameYear = a.year === b.year;
  return {
    month: sameYear
      ? `${a.monthLong} - ${b.monthLong}, ${a.year}`
      : `${a.monthShort} ${a.year} - ${b.monthShort} ${b.year}`,
    dates: `${a.day} - ${b.day}`,
  };
}

export default function Staff() {
  const { registerStaff, updateStaffAccount, getStaffAccounts, user } = useAuth();

  const buildStaffList = () => {
    const merged = staffStore.getStaff();
    const byEmail = new Map<string, Staff>();
    for (const r of merged) byEmail.set(r.email.toLowerCase(), r);

    // Auth accounts are the source of truth for role/status: the display must
    // always match the real login permission, so registered staff accounts
    // (created via Register New Staff) that somehow lack a roster row are added
    // back, and any matching row is synced to the account's role/status.
    for (const acc of getStaffAccounts()) {
      const existing = byEmail.get(acc.email.toLowerCase());
      if (existing) {
        existing.name = acc.name || existing.name;
        existing.email = acc.email;
        existing.role = acc.role === "admin" ? "Admin" : "Staff";
        existing.status = acc.active === false ? "Inactive" : "Active";
      } else if (acc.isAdminRegistered) {
        const row: Staff = {
          id: `EMP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          name: acc.name || acc.email,
          email: acc.email,
          phone: "Not set",
          role: acc.role === "admin" ? "Admin" : "Staff",
          status: acc.active === false ? "Inactive" : "Active",
          attendanceStatus: "active",
          onLeaveReason: "",
          joinDate: todayPHTKey(),
          skillsMessage: "",
          portfolioLink: "",
          performanceNotes: [],
          salary: 0,
          allowances: [],
          paymentHistory: [],
          permissions: ["view_orders", "edit_orders"],
          tasks: [],
        };
        merged.push(row);
        byEmail.set(row.email.toLowerCase(), row);
      }
    }
    return merged;
  };

  const [staff, setStaff] = useState<Staff[]>(() => buildStaffList());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Merged staff + attendance state ───────────────────────────────────────
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [todayFilter, setTodayFilter] = useState<TodayFilter>("all");
  const [detailPeriod, setDetailPeriod] = useState<"today" | "week" | "range">("today");
  const [detailFrom, setDetailFrom] = useState(() => addDaysKey(todayPHTKey(), -6));
  const [detailTo, setDetailTo] = useState(todayPHTKey());
  const [dayTarget, setDayTarget] = useState<{ email: string; date: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  useEffect(() => {
    setShowAllHistory(false);
    setHistoryFrom("");
    setHistoryTo("");
  }, [selectedStaff?.email]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "staff",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    role: "Staff" | "Admin";
    status: "Active" | "Inactive";
    attendanceStatus: "active" | "on-leave";
    onLeaveReason: string;
  } | null>(null);

  const [activating, setActivating] = useState<Staff | null>(null);
  const [deactivating, setDeactivating] = useState<Staff | null>(null);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [onLeaveInfo, setOnLeaveInfo] = useState<Staff | null>(null);

  const activeCount = staff.filter((s) => s.status === "Active").length;
  const inactiveCount = staff.length - activeCount;

  // ── Attendance snapshot (live, derives from the directory as single master) ──
  // The directory is the roster of record; attendance metadata (shifts, etc.)
  // is picked up from the seeded roster when available, and any log-only staff
  // (clocked in but not in the list) are appended so nothing is missed.
  const attendanceMembers = useMemo((): StaffMember[] => {
    const seedByEmail = new Map(getStaffRoster().map((m) => [m.email.toLowerCase(), m]));
    const merged: StaffMember[] = [];
    const seen = new Set<string>();
    for (const s of staff) {
      const seeded = seedByEmail.get(s.email.toLowerCase());
      merged.push({
        ...(seeded ?? {
          id: s.id,
          name: s.name,
          email: s.email,
          position: "Staff",
          role: s.role === "Admin" ? "Admin" : "Staff",
          shift: DEFAULT_STAFF_SHIFT,
        }),
        attendanceStatus: s.attendanceStatus ?? "active",
      });
      seen.add(s.email.toLowerCase());
    }
    for (const m of getStaffRoster()) {
      if (!seen.has(m.email.toLowerCase())) {
        merged.push(m);
        seen.add(m.email.toLowerCase());
      }
    }
    return merged;
  }, [staff]);

  const { todayKey, now, kpis, liveRows, todayRowByEmail } = useTodaySnapshot(attendanceMembers);

  const hydrating = useHydrating();

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staff.filter((emp) => {
      const matchesSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q);
      const matchesStatus =
        filterStatus === "all" ||
        emp.status.toLowerCase() === filterStatus.toLowerCase();
      const matchesToday = matchesTodayFilter(
        todayRowByEmail.get(emp.email.toLowerCase()),
        todayFilter,
      );
      return matchesSearch && matchesStatus && matchesToday;
    });
  }, [staff, searchQuery, filterStatus, todayFilter, todayRowByEmail]);


  // Right-hand detail pane — the selected staff's attendance for the chosen period.
  const selectedMember = selectedStaff
    ? attendanceMembers.find(
        (m) => m.email.toLowerCase() === selectedStaff.email.toLowerCase(),
      ) ?? null
    : null;

  const detailRows: AdminRow[] = (() => {
    if (!selectedMember) return [];
    if (detailPeriod === "today") return [buildRow(selectedMember, todayKey, now)];
    if (detailPeriod === "week")
      return buildMemberRangeRows(selectedMember, getWeekStartKey(), todayKey, now);
    return buildMemberRangeRows(selectedMember, detailFrom, detailTo, now);
  })();

  const detailTotalMs = detailRows.reduce((sum, r) => sum + r.totalMs, 0);
  const detailRate = salaryStore.getHourlyRate();
  const detailSalary = (detailTotalMs / MS_PER_HOUR) * detailRate;

  // The day modal is derived fresh each render so it stays live through actions.
  const dayMember = dayTarget
    ? attendanceMembers.find(
        (m) => m.email.toLowerCase() === dayTarget.email.toLowerCase(),
      ) ?? null
    : null;
  const dayRow: AdminRow | null =
    dayMember && dayTarget ? buildRow(dayMember, dayTarget.date, now) : null;

  const handleRowSelect = (member: Staff) => {
    // Mobile fast path: tapping a row opens today's day modal directly.
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setDayTarget({ email: member.email, date: todayKey });
      return;
    }
    // Desktop: open the staff's attendance detail in a dialog.
    setSelectedStaff(member);
  };

  const resetAddForm = () => {
    setNewStaff({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "staff",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const applyStaffList = (next: Staff[]) => {
    staffStore.setStaff(next);
    setStaff(next);
  };

  // ── Salary settings + per-staff salary view state ─────────────────────
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [rateInput, setRateInput] = useState(String(salaryStore.getHourlyRate()));
  const [showSalarySettings, setShowSalarySettings] = useState(false);
  const [releasing, setReleasing] = useState<Staff | null>(null);
  const [, setDataTick] = useState(0);

  React.useEffect(() => {
    const unsubSalary = salaryStore.subscribe(() => setDataTick((t) => t + 1));
    const unsubAtt = attendanceStore.subscribe(() => setDataTick((t) => t + 1));
    return () => {
      unsubSalary();
      unsubAtt();
    };
  }, []);

  const handleAddStaff = async () => {
    const name = newStaff.fullName.trim();
    const email = newStaff.email.trim();
    const password = newStaff.password;

    if (!name) {
      toast.error("Please enter the staff member's full name");
      return;
    }

    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error("Password does not meet security requirements");
      return;
    }

    if (password !== newStaff.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (staff.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
      toast.error("This email is already a staff member");
      return;
    }

    const role: "staff" | "admin" = newStaff.role === "admin" ? "admin" : "staff";

    // Register the brand-new staff account so they can sign in (now a REAL
    // Supabase Auth user)
    const result = await registerStaff({ name, email, password, role });
    if (!result.success) {
      toast.error(result.message || "Could not create staff account");
      return;
    }

    const staffMember: Staff = {
      id: `EMP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      name,
      email: email.toLowerCase(),
      phone: "Not set",
      role: role === "admin" ? "Admin" : "Staff",
      status: "Active",
      attendanceStatus: "active",
      onLeaveReason: "",
      joinDate: todayPHTKey(),
      skillsMessage: "",
      portfolioLink: "",
      performanceNotes: [],
      salary: 0,
      allowances: [],
      paymentHistory: [],
      permissions: ["view_orders", "edit_orders"],
      tasks: [],
    };

    applyStaffList([staffMember, ...staff]);
    resetAddForm();
    setShowAddDialog(false);
    toast.success("Staff account created successfully", {
      description: `${name} can now sign in with the email and password you set.`,
    });
  };

  const openEdit = (member: Staff) => {
    setEditingStaff(member);
    setEditForm({
      name: member.name,
      email: member.email,
      role: member.role === "Admin" ? "Admin" : "Staff",
      status: member.status,
      attendanceStatus: member.attendanceStatus === "on-leave" ? "on-leave" : "active",
      onLeaveReason: member.onLeaveReason ?? "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingStaff || !editForm) return;

    const name = editForm.name.trim();
    const email = editForm.email.trim();

    if (!name) {
      toast.error("Please enter the staff member's full name");
      return;
    }

    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (
      staff.some(
        (s) =>
          s.id !== editingStaff.id &&
          s.email.toLowerCase() === email.toLowerCase(),
      )
    ) {
      toast.error("This email is already used by another staff member");
      return;
    }

    const updated: Staff = {
      ...editingStaff,
      name,
      email: email.toLowerCase(),
      role: editForm.role,
      status: editForm.status,
      attendanceStatus: editForm.attendanceStatus,
      onLeaveReason:
        editForm.attendanceStatus === "on-leave" ? editForm.onLeaveReason.trim() : "",
    };

    if (updated.attendanceStatus === "on-leave" && !updated.onLeaveReason) {
      toast.error("Please state the reason this staff member is on leave");
      return;
    }

    const accountUpdated = updateStaffAccount(editingStaff.email, {
      email: email.toLowerCase() !== editingStaff.email.toLowerCase() ? email.toLowerCase() : undefined,
      name: name !== editingStaff.name ? name : undefined,
      role: editForm.role !== editingStaff.role ? (editForm.role === "Admin" ? "admin" : "staff") : undefined,
      active: editForm.status !== editingStaff.status ? editForm.status === "Active" : undefined,
    });

    applyStaffList(staff.map((s) => (s.id === updated.id ? updated : s)));

    // Make the new attendance status take effect immediately: clear or set
    // today's day-specific absence so the status badge reflects the choice
    // right away (and no leftover demo/day mark lingers).
    if (updated.attendanceStatus !== (editingStaff.attendanceStatus === "on-leave" ? "on-leave" : "active")) {
      attendanceStore.setAbsence(
        updated.email,
        todayKey,
        updated.attendanceStatus === "active" ? null : "on-leave",
      );
    }

    setEditingStaff(null);
    setEditForm(null);
    toast.success(
      accountUpdated
        ? "Staff account updated successfully"
        : "Staff details updated successfully",
    );
  };

  const confirmActivate = (member: Staff) => {
    applyStaffList(
      staff.map((s) =>
        s.id === member.id ? { ...s, status: "Active" as const } : s,
      ),
    );
    updateStaffAccount(member.email, { active: true });
    toast.success(`${member.name}'s account has been activated`);
    setActivating(null);
  };

  const confirmDeactivate = (member: Staff) => {
    applyStaffList(
      staff.map((s) =>
        s.id === member.id ? { ...s, status: "Inactive" as const } : s,
      ),
    );
    updateStaffAccount(member.email, { active: false });
    toast.success(`${member.name}'s account has been deactivated`);
    setDeactivating(null);
  };

  return (
    <Layout
      menuItems={menuItems}
      title={
        selectedStaff
          ? `${selectedStaff.name} — Attendance & Salary`
          : "Staff Management"
      }
      showBackButton
    >
      {selectedStaff && selectedMember ? null : (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <p className="text-gray-600 mt-1">
            Manage staff accounts, roles, and access permissions.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:items-center w-full sm:w-auto">
            <Button
              className="h-11 sm:h-10 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowSalarySettings(true)}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Salary Settings
            </Button>
            <Button
              className="h-11 sm:h-10 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowAddDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </div>
        </div>

        {/* Today's attendance — dashboard-style KPI cards; click to filter the directory */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { value: "all", label: "All", count: kpis.total, icon: Users, iconBg: "bg-blue-50", iconColor: "text-[#2F6FD6]", pulse: false },
            { value: "on-time", label: "On Time", count: kpis.onTime, icon: UserCheck, iconBg: "bg-green-50", iconColor: "text-green-600", pulse: false },
            { value: "late", label: "Late", count: kpis.late, icon: AlarmClock, iconBg: "bg-amber-50", iconColor: "text-amber-500", pulse: false },
            { value: "on-clock", label: "On Clock", count: kpis.onClock, icon: Clock, iconBg: "bg-green-50", iconColor: "text-green-600", pulse: true },
            { value: "on-leave", label: "On Leave", count: kpis.away, icon: LogOut, iconBg: "bg-orange-50", iconColor: "text-orange-500", pulse: false },
            { value: "absent", label: "Absent", count: kpis.absent, icon: UserX, iconBg: "bg-red-50", iconColor: "text-red-600", pulse: false },
          ].map((card) => {
            const active = todayFilter === card.value;
            return (
              <SummaryCard
                key={card.value}
                label={card.label}
                value={card.count}
                icon={card.icon}
                iconBg={card.iconBg}
                iconColor={card.iconColor}
                chipClassName={card.pulse ? "animate-pulse" : undefined}
                active={active}
                onClick={() =>
                  setTodayFilter(active ? "all" : (card.value as TodayFilter))
                }
              />
            );
          })}
        </div>

        {/* Currently Working — live strip of staff on the clock now */}
        <Card className="gap-0 overflow-hidden border border-slate-100 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <p className="text-sm font-semibold text-gray-900">Currently Working</p>
            </div>
            {kpis.onClock > 0 && (
              <Badge className="bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                {kpis.onClock} on clock now
              </Badge>
            )}
          </div>
          {liveRows.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nobody is on the clock right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 p-4">
              {liveRows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setDayTarget({ email: row.member.email, date: todayKey })}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 hover:border-green-300 hover:bg-green-50/40 text-left cursor-pointer transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-[#1668D9] text-white flex items-center justify-center text-xs font-bold">
                      {getInitials(row.member.name)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {row.member.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {row.member.role || "Staff"} &middot; Clocked In{" "}
                      {row.clockIn ? fmtTime12(row.clockIn) : "\u2014"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-green-700 tabular-nums">
                      {fmtHms(row.totalMs)}
                    </p>
                    <p className="text-[10px] text-gray-500">working</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Directory */}
        <Card className="gap-0 overflow-hidden border border-slate-100 shadow-sm">
          <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="w-full sm:max-w-xs">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</Label>
              <div className="group relative mt-1.5">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                <Input
                  aria-label="Search staff"
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <FilterLabel applied={filterStatus !== "all"}>Status</FilterLabel>
              <ZoomSafeDropdown
                label="Status filter"
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="All Statuses"
                className="mt-1.5"
                applied={filterStatus !== "all"}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </div>
            <Button
              variant="outline"
              className="h-9 border border-[#D5DCE6] bg-white text-[#64748B] hover:border-[#B7C3D4] hover:bg-[#FCFDFF] hover:text-[#475467] hover:translate-y-0 hover:shadow-none"
              onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          </div>
          </div>
          {/* The roster paints from the local mirror first, so an empty list is
              ambiguous. The skeleton claims the loading case and leaves the
              empty state meaning what it says. */}
          {hydrating && <TableSkeleton columns={6} rows={8} />}
          {!hydrating && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 sticky top-0 z-10">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Staff
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Account Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Date Added
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((member) => {
                const todayRow = todayRowByEmail.get(member.email.toLowerCase());
                const statusInfo = todayRow ? todayStatusInfo(todayRow) : null;
                const isSelected = selectedStaff?.id === member.id;
                return (
                  <tr
                    key={member.id}
                    onClick={() => handleRowSelect(member)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50/70"
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1668D9] text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-500">{member.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-600 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        className={
                          member.role === "Admin"
                            ? "bg-[#1668D9]/10 text-[#1668D9] border border-[#1668D9]/20"
                            : "bg-gray-100 text-gray-700 border border-gray-200"
                        }
                      >
                        {member.role === "Admin" ? (
                          <Shield className="w-3 h-3" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        {member.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      {statusInfo ? (
                        member.attendanceStatus === "on-leave" ? (
                          <button
                            type="button"
                            title="View reason for leave"
                            aria-label={`View reason for leave — ${member.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOnLeaveInfo(member);
                            }}
                            className="transition-transform hover:scale-105"
                          >
                            <Badge className={statusInfo.className}>
                              {statusInfo.label}
                            </Badge>
                          </button>
                        ) : (
                          <Badge className={statusInfo.className}>
                            {statusInfo.label}
                          </Badge>
                        )
                      ) : (
                        <Badge className="border border-red-200 bg-red-100 text-red-700">
                          Absent
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {member.status === "Active" ? (
                        <Badge className="bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-600">
                        {formatDate(member.joinDate)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View attendance and salary for ${member.name}`}
                          title="View attendance & salary"
                          className="group"
                          onClick={() => handleRowSelect(member)}
                        >
                          <CalendarClock className="w-4 h-4 text-[#2F6FD6] group-hover:text-white" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${member.name}`}
                          title="Edit staff"
                          className="group"
                          onClick={() => openEdit(member)}
                        >
                          <Edit2 className="w-4 h-4 text-[#2F6FD6] group-hover:text-white" />
                        </Button>
                        {member.status === "Active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Deactivate ${member.name}`}
                            title="Deactivate account"
                            className="group bg-red-50 hover:bg-red-500 hover:text-white transition-all"
                            onClick={() => setDeactivating(member)}
                          >
                            <Ban className="w-4 h-4 text-red-500 group-hover:text-white" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Activate ${member.name}`}
                            title="Activate account"
                            className="hover:bg-green-50"
                            onClick={() => setActivating(member)}
                          >
                            <UserCheck className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
          )}

          {filteredStaff.length === 0 && (
            <div className="py-16 text-center">
              <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                No staff members found matching your search criteria.
              </p>
            </div>
          )}

          <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs text-gray-500 shrink-0">
            <span>
              Showing {filteredStaff.length} of {staff.length} staff members
            </span>
            <span>
              {activeCount} active &middot; {inactiveCount} inactive
            </span>
          </div>
        </Card>

      </div>
      )}

        {/* Day modal */}
        {dayRow && (
          <AttendanceDayModal
            row={dayRow}
            open={!!dayTarget}
            onOpenChange={(open) => {
              if (!open) setDayTarget(null);
            }}
          />
        )}

        {/* All attendance history modal */}
        {selectedStaff && historyOpen && (
          <AttendanceHistoryModal
            member={{ name: selectedStaff.name, email: selectedStaff.email }}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            onOpenDay={(date) => setDayTarget({ email: selectedStaff.email, date })}
          />
        )}

        {/* Staff attendance detail — in-page view (click a directory row) */}
        {selectedStaff && selectedMember && (
          <div className="mx-auto w-full max-w-6xl pb-8">
            <div className="px-6 sm:px-8">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#54606E] transition-all hover:-translate-y-0.5 hover:border-[#1677F2]/60 hover:bg-[#1677F2]/5 hover:text-[#1677F2] hover:shadow-md"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Staff Management
              </button>
            </div>
                <h2 className="sr-only">
                  {selectedStaff.name} — Attendance &amp; Salary
                </h2>
                <p className="sr-only">
                  Attendance and salary details for {selectedStaff.name}.
                </p>

                {/* ── 1. Staff profile header ── */}
                <div className="pt-4 sm:pt-5 px-6 sm:px-8">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#1677F2] to-[#1668D9] text-white flex items-center justify-center text-2xl sm:text-[28px] font-bold shrink-0 shadow-[0_10px_24px_-8px_rgba(22,119,242,0.6)]">
                        {getInitials(selectedStaff.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl sm:text-2xl font-bold text-[#14213D] tracking-tight truncate">
                            {selectedStaff.name}
                          </h2>
                          <Badge className="bg-[#1677F2]/10 text-[#1677F2] border border-[#1677F2]/25">
                            {selectedStaff.role === "Admin" ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {selectedStaff.role}
                          </Badge>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-[#5C5D6E]">
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-[#1677F2] shrink-0" />
                            <span className="truncate">{selectedStaff.email}</span>
                          </span>
                          <span className="hidden sm:inline text-[#CBD6E7]">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#1677F2] shrink-0" />
                            {scheduleOf(selectedMember)}
                          </span>
                          <span className="hidden sm:inline text-[#CBD6E7]">·</span>
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#14213D]">
                            {selectedStaff.id}
                          </span>
                        </div>
                        {(() => {
                          const todayInfo = todayRowByEmail.get(
                            selectedStaff.email.toLowerCase(),
                          );
                          return todayInfo ? (
                            <div className="mt-3">
                              <div className="flex items-center gap-1.5">
                                {todayInfo.isLive ? (
                                  <Badge className="bg-green-50 text-green-700 border-green-200">
                                    <span className="relative flex h-1.5 w-1.5 mr-1">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                                    </span>
                                    On Clock
                                  </Badge>
                                ) : (
                                  selectedStaff.attendanceStatus === "on-leave" ? (
                                    <button
                                      type="button"
                                      title="View reason for leave"
                                      aria-label={`View reason for leave — ${selectedStaff.name}`}
                                      onClick={() => setOnLeaveInfo(selectedStaff)}
                                      className="transition-transform hover:scale-105"
                                    >
                                      <Badge className={todayStatusInfo(todayInfo).className}>
                                        {todayStatusInfo(todayInfo).label}
                                      </Badge>
                                    </button>
                                  ) : (
                                    <Badge className={todayStatusInfo(todayInfo).className}>
                                      {todayStatusInfo(todayInfo).label}
                                    </Badge>
                                  )
                                )}
                                <button
                                  type="button"
                                  title="Edit attendance status"
                                  aria-label={`Edit attendance status for ${selectedStaff.name}`}
                                  onClick={() => openEdit(selectedStaff)}
                                  className="p-1 rounded-md text-slate-400 hover:text-[#2F6FD6] hover:bg-blue-50 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Secondary info — right side */}
                    <div className="sm:border-l sm:border-[#E5EDF9] sm:pl-6 flex sm:flex-col gap-4 sm:gap-5 sm:min-w-[190px] shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1677F2]/10 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-4 h-4 text-[#1677F2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                            Date Hired
                          </p>
                          <p className="text-sm font-semibold text-[#14213D]">
                            {formatDate(selectedStaff.joinDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1677F2]/10 flex items-center justify-center shrink-0">
                          <Briefcase className="w-4 h-4 text-[#1677F2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                            Position
                          </p>
                          <p className="text-sm font-semibold text-[#14213D]">
                            {selectedStaff.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 2. Attendance period navigation ── */}
                <div className="mt-7 px-6 sm:px-8">
                  <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#EAF2FF] p-1.5">
                    {[
                      { v: "today", l: "Today", Icon: Sun },
                      { v: "week", l: "This Week", Icon: CalendarRange },
                      { v: "range", l: "Date Range", Icon: CalendarDays },
                    ].map((opt) => {
                      const Icon = opt.Icon;
                      return (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() =>
                            setDetailPeriod(opt.v as "today" | "week" | "range")
                          }
                          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                            detailPeriod === opt.v
                              ? "bg-[#1677F2] text-white shadow-[0_6px_16px_-6px_rgba(22,119,242,0.6)]"
                              : "text-[#14213D] hover:bg-[#1677F2]/10"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {opt.l}
                        </button>
                      );
                    })}
                  </div>
                  {detailPeriod === "range" && (
                    <div className="mt-3">
                      <DateRangeFilter
                        value={{ from: detailFrom, to: detailTo }}
                        onChange={(next) => {
                          setDetailFrom(next.from);
                          setDetailTo(next.to);
                        }}
                        max={todayKey}
                        compact
                        className="max-w-md"
                      />
                    </div>
                  )}
                </div>

                {/* ── 3. Attendance Period card ── */}
                <div className="mt-6 px-6 sm:px-8">
                  <div className="rounded-2xl border border-[#E5EDF9] bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 pt-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-[#1677F2]" />
                          <p className="text-sm font-semibold text-[#14213D]">
                            Attendance Period
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-[#5C5D6E]">
                          {detailPeriod === "today" && <>Today's attendance and working hours.</>}
                          {detailPeriod === "week" && <>This week's attendance and working hours.</>}
                          {detailPeriod === "range" && <>Selected range attendance and working hours.</>}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setDayTarget({ email: selectedStaff.email, date: todayKey })
                        }
                        className="h-9 gap-2 rounded-lg px-3 text-xs font-semibold text-[#14213D] hover:bg-[#1677F2]/5 hover:text-[#14213D] hover:border-[#1677F2]/60"
                      >
                        <CalendarClock className="h-4 w-4 text-[#1677F2]" />
                        View Day Records
                      </Button>
                    </div>

                    {/* Metrics */}
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-[#EEF3FA]">
                      {[
                        {
                          label: "Total Hours",
                          value: fmtHms(detailTotalMs),
                          icon: Clock,
                          money: false,
                        },
                        {
                          label: "Hourly Rate",
                          value: `₱${formatNumber(detailRate, 2)}`,
                          icon: Wallet,
                          money: true,
                        },
                        {
                          label: "Salary",
                          value: formatCurrency(detailSalary),
                          icon: Banknote,
                          money: true,
                        },
                        {
                          label: "Position",
                          value: selectedStaff.role,
                          icon: Briefcase,
                          money: false,
                        },
                      ].map((m) => {
                        const Icon = m.icon;
                        return (
                          <div
                            key={m.label}
                            className="flex items-center gap-3 px-5 sm:px-6 py-4"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#EBF3FF] flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-[#1677F2]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                                {m.label}
                              </p>
                              <p
                                className={`text-base font-bold tabular-nums ${
                                  m.money ? "text-[#1677F2]" : "text-[#14213D]"
                                }`}
                              >
                                {m.value}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Period records list */}
                    <div className="border-t border-[#EEF3FA]">
                      <div className="px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#8A94A6]">
                          {detailPeriod === "today" && <>Today · {fmtLongDay(todayKey)}</>}
                          {detailPeriod === "week" && (
                            <>
                              This Week · {fmtLongDay(getWeekStartKey())} – {fmtLongDay(todayKey)}
                            </>
                          )}
                          {detailPeriod === "range" && (
                            <>
                              {fmtLongDay(detailFrom)} – {fmtLongDay(detailTo)}
                            </>
                          )}
                        </p>
                        <span className="text-xs text-[#5C5D6E]">
                          {detailRows.length} record{detailRows.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {detailRows.length === 0 ? (
                        <div className="py-10 text-center">
                          <Clock className="w-8 h-8 text-[#C9D4E4] mx-auto mb-2" />
                          <p className="text-sm text-[#8A94A6]">No records for this period.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#EEF3FA]">
                          {detailRows.map((row) => {
                            const rInfo = todayStatusInfo(row);
                            return (
                              <div
                                key={row.key}
                                className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-3 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#14213D]">
                                    {fmtDay(row.date)}
                                  </p>
                                  <p className="text-xs text-[#5C5D6E] truncate">
                                    {row.clockIn ? `In ${fmtTime12(row.clockIn)}` : "—"}
                                    {" → "}
                                    {row.isLive
                                      ? "On Clock"
                                      : row.clockOut
                                        ? `Out ${fmtTime12(row.clockOut)}`
                                        : "—"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-semibold text-[#14213D] tabular-nums">
                                    {row.totalMs > 0 ? fmtHms(row.totalMs) : "—"}
                                  </span>
                                  <Badge className={rInfo.className}>{rInfo.label}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 4. Staff Attendance Summary ── */}
                {(() => {
                  const summary = salaryStore.getStaffSummary(selectedStaff.email);
                  const salaryRecords = salaryStore.getPeriodAttendance(selectedStaff.email);
                  const history = salaryStore.getSalaryHistory(selectedStaff.email);
                  const filteredHistory = history.filter((h) => {
                    const key = toPHTKey(h.releasedAt);
                    if (historyFrom && key < historyFrom) return false;
                    if (historyTo && key > historyTo) return false;
                    return true;
                  });
                  const visibleHistory = showAllHistory
                    ? filteredHistory
                    : filteredHistory.slice(0, 3);
                  const hasHistory = history.length > 0;
                  const salaryRange = formatSalaryPeriodStack(summary.periodStart, summary.periodEnd);
                  return (
                    <>
                      <div className="mt-6 px-6 sm:px-8">
                        <div className="rounded-2xl border border-[#DCEBFF] bg-[#F4F9FF]">
                          <div className="px-5 sm:px-6 pt-5">
                            <p className="text-sm font-semibold text-[#14213D]">
                              Staff Attendance Summary
                            </p>
                          </div>
                          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-[#DCEBFF]">
                            {[
                              {
                                label: "Salary Period",
                                value: salaryRange.month,
                                sub: salaryRange.dates,
                                icon: CalendarDays,
                              },
                              {
                                label: "Hours Worked",
                                value: `${formatNumber(summary.totalHours, 2)} hrs`,
                                icon: Clock,
                              },
                              {
                                label: "Hourly Rate",
                                value: `₱${formatNumber(summary.hourlyRate, 2)} / hr`,
                                icon: Wallet,
                              },
                              {
                                label: "Current Salary",
                                value: formatCurrency(summary.amount),
                                icon: Banknote,
                              },
                            ].map((m) => {
                              const Icon = m.icon;
                              return (
                                <div
                                  key={m.label}
                                  className="flex items-center gap-3 px-5 sm:px-6 py-4"
                                >
                                  <div className="w-9 h-9 rounded-full bg-white border border-[#DCEBFF] flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-[#1677F2]" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">
                                      {m.label}
                                    </p>
                                    <p
                                      className={`text-sm font-bold tabular-nums ${
                                        m.label === "Current Salary"
                                          ? "text-[#1677F2]"
                                          : "text-[#14213D]"
                                      }`}
                                    >
                                      {m.value}
                                    </p>
                                    {m.sub && (
                                      <p className="text-xs font-semibold text-[#14213D] tabular-nums -mt-0.5">
                                        {m.sub}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* ── 5. Attendance Records (current period) ── */}
                      <div className="mt-6 px-6 sm:px-8">
                        <div className="rounded-2xl border border-[#E5EDF9] bg-white overflow-hidden">
<div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#EEF3FA]">
            <p className="text-sm font-semibold text-[#14213D] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#1677F2]" />
              Attendance Records
            </p>
            <span className="flex items-center gap-3">
              <span className="text-xs text-[#5C5D6E]">
                {salaryRecords.length} day{salaryRecords.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border-2 border-blue-400 bg-white px-3 py-2 text-xs font-semibold text-[#14213D] transition-all hover:-translate-y-0.5 hover:border-[#1677F2]/60 hover:bg-[#1677F2]/5 hover:shadow-md"
              >
                <History className="h-4 w-4 text-[#1677F2]" />
                View All Attendance History
              </button>
            </span>
          </div>
                          {salaryRecords.length === 0 ? (
                            <div className="py-14 text-center">
                              <Clock className="w-10 h-10 text-[#C9D4E4] mx-auto mb-3" />
                              <p className="text-sm font-medium text-[#54606E]">
                                No attendance records in the current period.
                              </p>
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
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#EEF3FA]">
                                  {salaryRecords.map((r) => {
                                    const hours = sessionTotalMs(r, nowPHT()) / 3_600_000;
                                    const status = hasActiveSession(r) ? "Active" : r.timeIn && r.timeOut ? (r.exceeded ? "Exceeded" : "Complete") : "Incomplete";
                                    return (
                                      <tr key={r.id} className="hover:bg-[#F7FAFF]">
                                        <td className="px-5 py-2.5 text-[#14213D] whitespace-nowrap font-medium">{formatPHDate(r.date, "short")}</td>
                                        <td className="px-4 py-2.5 text-[#5C5D6E] whitespace-nowrap">{fmtTime12(r.timeIn)}</td>
                                        <td className="px-4 py-2.5 text-[#5C5D6E] whitespace-nowrap">
                                          {r.timeOut ? fmtTime12(r.timeOut) : <span className="text-green-600 font-medium">On Clock</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-[#14213D] whitespace-nowrap font-medium">{formatNumber(hours, 2)} hrs</td>
                                        <td className="px-4 py-2.5">
                                          <Badge className={
                                            status === "Complete"
                                              ? "bg-green-50 text-green-700 border border-green-200"
                                              : status === "Active"
                                              ? "bg-blue-50 text-[#1677F2] border border-blue-200"
                                              : status === "Exceeded"
                                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                                              : "bg-gray-100 text-gray-600 border border-gray-200"
                                          }>
                                            {status}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── 6. Release Salary ── */}
                      <div className="mt-6 px-6 sm:px-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#CFE3FF] bg-[#F0F6FF] p-5">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-white border border-[#CFE3FF] flex items-center justify-center shrink-0">
                              <Banknote className="w-5 h-5 text-[#1677F2]" />
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-[#14213D]">
                                Current Salary:{" "}
                                <span className="text-[#1677F2]">{formatCurrency(summary.amount)}</span>
                              </p>
                              <p className="mt-0.5 text-xs text-[#54606E] max-w-sm">
                                Starts a new period. Attendance history is kept.
                              </p>
                            </div>
                          </div>
                          <Button
                            className="h-10 sm:h-11 min-w-[180px] rounded-lg bg-[#1677F2] text-white hover:bg-[#0E63D8] shadow-[0_10px_20px_-8px_rgba(22,119,242,0.6)]"
                            onClick={() => setReleasing(selectedStaff)}
                          >
                            <Wallet className="w-4 h-4 mr-2" />
                            Release Salary
                          </Button>
                        </div>
                      </div>

                      {/* ── 7. Salary History ── */}
                      <div className="mt-6 px-6 sm:px-8">
                        <div className="rounded-2xl border border-[#E5EDF9] bg-white overflow-hidden">
                          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#EEF3FA]">
                            <p className="text-sm font-semibold text-[#14213D] flex items-center gap-2">
                              <History className="w-4 h-4 text-[#1677F2]" />
                              Salary History
                            </p>
                            <span className="text-xs text-[#5C5D6E] flex items-center gap-1">
                              {filteredHistory.length} release{filteredHistory.length === 1 ? "" : "s"}
                              {historyFrom || historyTo ? ` of ${history.length}` : ""}
                              <ChevronDown className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          {history.length === 0 ? (
                            <div className="py-12 text-center">
                              <History className="w-8 h-8 text-[#C9D4E4] mx-auto mb-2" />
                              <p className="text-sm text-[#54606E]">No releases yet for this staff member.</p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 sm:px-6 py-3 border-b border-[#EEF3FA]">
                              <DateRangeFilter
                                value={{ from: historyFrom, to: historyTo }}
                                onChange={(next) => {
                                  setHistoryFrom(next.from);
                                  setHistoryTo(next.to);
                                }}
                                fromLabel="From"
                                toLabel="To"
                                labelsInline
                                compact
                                className="min-w-[15rem] flex-1"
                              />
                              {(historyFrom || historyTo) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHistoryFrom("");
                                    setHistoryTo("");
                                  }}
                                  className="text-xs font-semibold text-[#1677F2] hover:underline"
                                >
                                  Clear Dates
                                </button>
                              )}
                            </div>
                          )}
                          {hasHistory && visibleHistory.length === 0 ? (
                            <div className="py-12 text-center">
                              <History className="w-8 h-8 text-[#C9D4E4] mx-auto mb-2" />
                              <p className="text-sm text-[#54606E]">
                                No releases match the selected date range.
                              </p>
                            </div>
                          ) : hasHistory ? (
                            <div className="p-4 sm:p-5 space-y-3">
                              {visibleHistory.map((h) => (
                                <div
                                  key={h.id}
                                  className="rounded-xl border border-[#EEF3FA] bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                                >
                                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 sm:divide-x sm:divide-[#EEF3FA]">
                                    <div className="sm:pr-4">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Salary Period</p>
                                      {(() => {
                                        const sp = formatSalaryPeriodStack(h.periodStart, h.periodEnd);
                                        return (
                                          <>
                                            <p className="mt-0.5 text-[13px] font-semibold text-[#14213D]">{sp.month}</p>
                                            <p className="text-xs font-semibold text-[#14213D] tabular-nums">{sp.dates}</p>
                                          </>
                                        );
                                      })()}
                                    </div>
                                    <div className="sm:px-4">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Hours Worked</p>
                                      <p className="mt-0.5 text-[13px] font-semibold text-[#14213D] tabular-nums">{formatNumber(h.totalHours, 2)} hrs</p>
                                    </div>
                                    <div className="sm:px-4">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Rate</p>
                                      <p className="mt-0.5 text-[13px] font-semibold text-[#14213D] tabular-nums">₱{formatNumber(h.hourlyRate, 2)}/hr</p>
                                    </div>
                                    <div className="sm:px-4">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Release</p>
                                      <p className="mt-0.5 text-[13px] font-semibold text-[#14213D]">{formatPHDateTime(h.releasedAt)}</p>
                                      <p className="text-xs text-[#8A94A6]">by {h.releasedBy}</p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 rounded-xl border border-[#DCEBFF] bg-[#F0F6FF] px-4 py-2.5 text-right">
                                    <p className="text-base sm:text-lg font-bold text-[#1677F2] tabular-nums">{formatCurrency(h.amount)}</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A94A6]">Total Salary</p>
                                  </div>
                                </div>
                              ))}
                              {filteredHistory.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllHistory((v) => !v)}
                                  className="mx-auto flex items-center gap-1.5 rounded-lg border border-[#DCEBFF] bg-[#F0F6FF] px-3 py-1.5 text-xs font-semibold text-[#1677F2] hover:bg-[#E3EEFF] transition-colors"
                                >
                                  {showAllHistory ? "Show Less" : `Show All (${filteredHistory.length})`}
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${showAllHistory ? "rotate-180" : ""}`}
                                  />
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

        {/* Salary Settings dialog */}
        <Dialog open={showSalarySettings} onOpenChange={setShowSalarySettings}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#10316B]">Salary Settings</DialogTitle>
              <DialogDescription>
                Hourly rate used to compute each staff member's salary from their
                attendance hours.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-4">
                <div className="w-11 h-11 rounded-xl bg-[#1668D9]/10 text-[#1668D9] flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Hourly Rate</p>
                  <p className="text-xl font-semibold text-slate-900 leading-tight tabular-nums">
                    ₱{formatNumber(salaryStore.getHourlyRate(), 2)}
                    <span className="text-xs font-normal text-gray-500">
                      {" "}/ hour
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                The rate is applied to each staff member's total attendance hours
                to compute their current salary in the attendance detail and
                salary views.
              </p>
            </div>
            <DialogFooter>
              <Button
                className="w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
                onClick={() => {
                  setRateInput(String(salaryStore.getHourlyRate()));
                  setShowSalarySettings(false);
                  setShowRateDialog(true);
                }}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Rate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Register New Staff Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">Add Staff</DialogTitle>
            <DialogDescription>
              Create a staff account. The staff member can sign in with the
              email and password you set below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="fullName"
                type="text"
                value={newStaff.fullName}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, fullName: e.target.value })
                }
                placeholder="e.g. Maria Santos"
                className="h-11 bg-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffEmail">Email Address <span className="text-red-500">*</span></Label>
              <Input
                id="staffEmail"
                type="email"
                value={newStaff.email}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, email: e.target.value })
                }
                placeholder="staff@example.com"
                className="h-11 bg-white text-sm"
              />
              <p className="text-xs text-gray-500">
                Used to sign in to the new staff account
              </p>
            </div>

            <div className="space-y-2">
              <Label>Role <span className="text-red-500">*</span></Label>
              <ZoomSafeDropdown
                label="Role"
                value={newStaff.role}
                onChange={(value) => setNewStaff({ ...newStaff, role: value })}
                placeholder="Select role"
                triggerClassName="h-11 bg-white"
                options={[
                  { value: "staff", label: "Staff" },
                  { value: "admin", label: "Admin" },
                ]}
              />
              <p className="text-xs text-gray-500">
                Admins get full system access, staff get order and payment
                access.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffPassword">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="staffPassword"
                    type={showPassword ? "text" : "password"}
                    value={newStaff.password}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, password: e.target.value })
                    }
                    placeholder="Enter password"
                    className="h-11 bg-white text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffConfirmPassword">Confirm <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="staffConfirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={newStaff.confirmPassword}
                    onChange={(e) =>
                      setNewStaff({
                        ...newStaff,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Confirm password"
                    className="h-11 bg-white text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {newStaff.password && (
              <PasswordStrengthIndicator password={newStaff.password} />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowAddConfirm(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Staff Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog
        open={!!editingStaff}
        onOpenChange={(open) => {
          if (!open) {
            setEditingStaff(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              Edit Staff
            </DialogTitle>
            <DialogDescription>
              Update {editingStaff?.name || "this staff member"}'s details,
              role, account status, and attendance status.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="editFullName"
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  placeholder="e.g. Maria Santos"
                  className="h-11 bg-white text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail">Email Address <span className="text-red-500">*</span></Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  placeholder="staff@example.com"
                  className="h-11 bg-white text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role <span className="text-red-500">*</span></Label>
                  <ZoomSafeDropdown
                    label="Role"
                    value={editForm.role}
                    onChange={(value) =>
                      setEditForm({ ...editForm, role: value as "Staff" | "Admin" })
                    }
                    placeholder="Select role"
                    triggerClassName="h-11 bg-white"
                    options={[
                      { value: "Staff", label: "Staff" },
                      { value: "Admin", label: "Admin" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Status <span className="text-red-500">*</span></Label>
                  <ZoomSafeDropdown
                    label="Account status"
                    value={editForm.status}
                    onChange={(value) =>
                      setEditForm({ ...editForm, status: value as "Active" | "Inactive" })
                    }
                    placeholder="Select status"
                    triggerClassName="h-11 bg-white"
                    options={[
                      { value: "Active", label: "Active" },
                      { value: "Inactive", label: "Inactive" },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Attendance Status</Label>
                <ZoomSafeDropdown
                  label="Attendance status"
                  value={editForm.attendanceStatus}
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      attendanceStatus: value as "active" | "on-leave",
                    })
                  }
                  placeholder="Select attendance status"
                  triggerClassName="h-11 bg-white"
                  options={[
                    { value: "active", label: "Active — normal shift" },
                    { value: "on-leave", label: "On Leave" },
                  ]}
                />
                {editForm.attendanceStatus === "on-leave" ? (
                  <div className="space-y-2 pt-1">
                    <Label>Reason for leave</Label>
                    <textarea
                      value={editForm.onLeaveReason}
                      onChange={(e) =>
                        setEditForm({ ...editForm, onLeaveReason: e.target.value })
                      }
                      placeholder="State why this staff member is on leave…"
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-[#5C6B7F] focus:border-[#2F6FD6] focus:ring-1 focus:ring-[#2F6FD6] outline-none resize-none"
                    />
                    <p className="text-xs text-gray-500">
                      The reason is shown next to the On Leave badge until the
                      status is changed again.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Active staff clock in as usual — anyone who doesn't clock in
                    for the day is shown as Absent automatically.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => {
                setEditingStaff(null);
                setEditForm(null);
              }}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              disabled={
                !editForm ||
                (editForm.attendanceStatus === "on-leave" &&
                  !editForm.onLeaveReason.trim())
              }
              onClick={() => setShowEditConfirm(true)}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={!!activating}
        onOpenChange={(open) => {
          if (!open) setActivating(null);
        }}
        onConfirm={() => {
          if (activating) confirmActivate(activating);
        }}
        title="Activate Staff Account?"
        description={
          activating
            ? `${activating.name} will regain access to the system and can sign in again.`
            : ""
        }
        confirmLabel="Activate"
        destructive={false}
      />

      <ConfirmationDialog
        open={!!deactivating}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        onConfirm={() => {
          if (deactivating) confirmDeactivate(deactivating);
        }}
        title="Deactivate Staff Account?"
        description={
          deactivating
            ? `${deactivating.name} will no longer be able to sign in until the account is reactivated.`
            : ""
        }
        confirmLabel="Deactivate"
        destructive={true}
      />

      <ConfirmationDialog
        open={showAddConfirm}
        onOpenChange={setShowAddConfirm}
        onConfirm={handleAddStaff}
        title="Create Staff Account?"
        description={`${newStaff.fullName.trim() || "This staff member"} (${newStaff.email.trim() || "no email"}) can sign in with the password you set.`}
        confirmLabel="Create Account"
        cancelLabel="Go Back"
        destructive={false}
        loadingText="Creating Account..."
      />

      <ConfirmationDialog
        open={showEditConfirm}
        onOpenChange={setShowEditConfirm}
        onConfirm={handleSaveEdit}
        title={`Save Changes${editingStaff ? ` to ${editForm?.name || editingStaff.name}?` : "?"}`}
        description="Email and role changes apply immediately."
        confirmLabel="Save Changes"
        cancelLabel="Go Back"
        destructive={false}
      />

      {/* Edit Hourly Rate Dialog */}
      <Dialog
        open={showRateDialog}
        onOpenChange={(open) => {
          setShowRateDialog(open);
          if (!open) setRateInput(String(salaryStore.getHourlyRate()));
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">Edit Hourly Rate</DialogTitle>
            <DialogDescription>
              Set the hourly rate used to compute every staff member's current
              salary from their attendance hours.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="hourlyRate">Hourly Rate (₱ per hour) <span className="text-red-500">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
              <Input
                id="hourlyRate"
                type="number"
                min={0}
                step={0.01}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="50"
                className="h-11 pl-8 bg-white text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
                Salary = Total Approved Working Hours × Hourly Rate.
              </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={() => setShowRateDialog(false)}>
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => {
                const rate = Number(rateInput);
                if (Number.isNaN(rate) || rate < 0) {
                  toast.error("Please enter a valid hourly rate");
                  return;
                }
                salaryStore.setHourlyRate(rate);
                setShowRateDialog(false);
                toast.success("Hourly rate updated successfully", {
                  description: `Salary computations now use ₱${formatNumber(rate, 2)} / hour.`,
                });
              }}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Save Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Salary Confirmation */}
      <ConfirmationDialog
        open={!!releasing}
        onOpenChange={(open) => {
          if (!open) setReleasing(null);
        }}
        onConfirm={() => {
          if (!releasing) return;
          const rec = salaryStore.releaseSalary(releasing.email, releasing.name, user?.name || "Admin");
          toast.success("Salary released successfully", {
            description: `${rec.staffName} earned ${formatCurrency(rec.amount)} (${formatNumber(rec.totalHours, 2)} hrs × ₱${formatNumber(rec.hourlyRate, 2)}/hr). A new salary period has started.`,
          });
          setReleasing(null);
        }}
        title="Release Salary?"
        description={
          releasing
            ? `Paying ${releasing.name}: ${formatCurrency(
                salaryStore.getStaffSummary(releasing.email).amount,
              )}. A new salary period starts after this.`
            : ""
        }
        confirmLabel="Confirm Release"
        cancelLabel="Go Back"
        destructive={false}
      />

      {/* On Leave — reason dialog */}
      <Dialog
        open={!!onLeaveInfo}
        onOpenChange={(open) => {
          if (!open) setOnLeaveInfo(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10316B] flex items-center gap-2">
              <Badge className="border border-orange-200 bg-orange-100 text-orange-700">
                On Leave
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Why {onLeaveInfo?.name} is on leave.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-4">
              <p className="text-sm text-orange-900">
                {onLeaveInfo?.onLeaveReason?.trim()
                  ? onLeaveInfo.onLeaveReason.trim()
                  : "Reason not specified"}
              </p>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              This status and reason apply until an admin changes them in the
              Edit Staff dialog.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}