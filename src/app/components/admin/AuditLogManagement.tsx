// Admin Audit Trail — Management -> Audit Trail (/admin/audit-trail).
//
// Read-only investigation surface for "who changed what, when". The table is
// deliberately kept to the six scannable facts plus one action button —
// NO description column. A free-text column repeated what Date/User/Action/
// Module/Reference already said, made every row tall, and pushed the useful
// signal off-screen on a 1366px laptop. The narrative, the exact before/after
// values, and the request metadata (IP / device / transaction) live in the
// "View Details" drawer, which is where an auditor actually needs them.

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  ShieldCheck,
  User,
  Globe,
  Hash,
  ArrowRight,
  Inbox,
  Download,
} from "lucide-react";
import Layout from "../Layout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { SummaryCard } from "../ui/summary-card";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import { FilterLabel } from "../ui/filter-label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  auditLogStore,
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  AUDIT_ROLES,
  type AuditAction,
  type AuditChange,
  type AuditEntry,
  type AuditRole,
} from "../../utils/auditLogStore";
import { formatPHDate, formatPHTime, todayPHTKey, toPHTKey } from "../../utils/pht";

const PAGE_SIZE = 10;

// Semantic colors only. Blue = neutral/expected, green = approved/successful,
// red = rejected/deleted, amber = flagged for review.
const ACTION_BADGE: Record<AuditAction, string> = {
  Created: "bg-[#EAF3FF] text-[#2F6FD6] border-[#C7DCF8]",
  Updated: "bg-slate-100 text-slate-700 border-slate-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Deleted: "bg-red-50 text-red-700 border-red-200",
  Released: "bg-teal-50 text-teal-700 border-teal-200",
};

const ROLE_BADGE: Record<AuditRole, string> = {
  Admin: "bg-[#EAF3FF] text-[#2F6FD6] border-[#C7DCF8]",
  Staff: "bg-slate-100 text-slate-700 border-slate-200",
  Customer: "bg-gray-50 text-gray-700 border-gray-200",
};

const ALL = "All";

const ROLE_OPTIONS = [
  { value: ALL, label: "All Roles" },
  ...AUDIT_ROLES.map((role) => ({ value: role, label: role })),
];

const ACTION_OPTIONS = [
  { value: ALL, label: "All Actions" },
  ...AUDIT_ACTIONS.map((action) => ({ value: action, label: action })),
];

const MODULE_OPTIONS = [
  { value: ALL, label: "All Modules" },
  ...AUDIT_MODULES.map((module) => ({ value: module, label: module })),
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function csvCell(value: string | number | undefined | null): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

// Export the currently-filtered activities as a CSV download (Excel-friendly:
// BOM so ₱/em-dashes render, quoted cells so commas/newlines stay intact).
function exportAuditCsv(rows: AuditEntry[]) {
  const header = [
    "Date & Time (PHT)",
    "Actor",
    "Role",
    "Module",
    "Action",
    "Reference",
    "Title",
    "Description",
    "Changes",
    "IP Address",
    "Device / Browser",
    "Transaction ID",
    "Log ID",
  ];
  const lines = rows.map((entry) => {
    const changes = entry.changes
      .map((change) => `${change.field}: ${change.previous} -> ${change.next}`)
      .join("; ");
    return [
      `${formatPHDate(entry.timestamp, "short")} ${formatPHTime(entry.timestamp)}`,
      entry.actorName,
      entry.actorRole,
      entry.module,
      entry.action,
      entry.reference,
      entry.title,
      entry.description,
      changes,
      entry.ipAddress ?? "",
      entry.device ?? "",
      entry.transactionId ?? "",
      entry.id,
    ]
      .map(csvCell)
      .join(",");
  });
  const csv = "\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `docufy-audit-trail-${todayPHTKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ChangeRow({ change }: { change: AuditChange }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-center sm:gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {change.field}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-red-700 line-through decoration-red-400/70">
          {change.previous}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
          {change.next}
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}

export default function AuditLogManagement() {
  const [entries, setEntries] = useState<AuditEntry[]>(() =>
    auditLogStore.getEntries(),
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [actionFilter, setActionFilter] = useState<string>(ALL);
  const [moduleFilter, setModuleFilter] = useState<string>(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => auditLogStore.subscribe(() => setEntries(auditLogStore.getEntries())), []);

  const hasFilters =
    search.trim() !== "" ||
    roleFilter !== ALL ||
    actionFilter !== ALL ||
    moduleFilter !== ALL ||
    fromDate !== "" ||
    toDate !== "";

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, actionFilter, moduleFilter, fromDate, toDate]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // A from-date is inclusive of the whole day, so compare against the start
    // of the day rather than 00:00 of the raw input.
    const fromKey = fromDate === "" ? null : fromDate;
    const toKey = toDate === "" ? null : toDate;

    return entries.filter((entry) => {
      if (roleFilter !== ALL && entry.actorRole !== roleFilter) return false;
      if (actionFilter !== ALL && entry.action !== actionFilter) return false;
      if (moduleFilter !== ALL && entry.module !== moduleFilter) return false;

      if (fromKey || toKey) {
        const day = toPHTKey(entry.timestamp);
        if (fromKey && day < fromKey) return false;
        if (toKey && day > toKey) return false;
      }

      if (!term) return true;
      return (
        entry.actorName.toLowerCase().includes(term) ||
        entry.reference.toLowerCase().includes(term) ||
        entry.module.toLowerCase().includes(term) ||
        entry.action.toLowerCase().includes(term) ||
        entry.title.toLowerCase().includes(term)
      );
    });
  }, [entries, search, roleFilter, actionFilter, moduleFilter, fromDate, toDate]);

  const todayKey = todayPHTKey();
  const totalToday = entries.filter(
    (entry) => toPHTKey(entry.timestamp) === todayKey,
  ).length;
  const totalAdminActions = entries.filter(
    (entry) => entry.actorRole === "Admin",
  ).length;
  const totalFlagged = entries.filter(
    (entry) => entry.action === "Rejected" || entry.action === "Deleted",
  ).length;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  const clearFilters = () => {
    setSearch("");
    setRoleFilter(ALL);
    setActionFilter(ALL);
    setModuleFilter(ALL);
    setFromDate("");
    setToDate("");
  };

  return (
    <Layout menuItems={adminMenuItems} title="Audit Trail">
      <div className="mx-auto max-w-[1600px] space-y-5 pb-8">
        {/* Page header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Audit Trail
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              A permanent record of every change made in Docufy — who acted, what
              they changed, and when.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={filtered.length === 0}
            onClick={() => exportAuditCsv(filtered)}
            className="h-10 rounded-md border border-gray-200 bg-white px-4 text-slate-600 hover:border-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white disabled:pointer-events-none disabled:opacity-40"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV{filtered.length > 0 ? ` (${filtered.length})` : ""}
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={Activity}
            label="Total Activities"
            value={entries.length.toLocaleString()}
            subtitle="All recorded changes"
          />
          <SummaryCard
            icon={Calendar}
            label="Activities Today"
            value={totalToday.toLocaleString()}
            subtitle={formatPHDate(new Date(), "long")}
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Admin Actions"
            value={totalAdminActions.toLocaleString()}
            subtitle="Configuration & staff changes"
          />
          <SummaryCard
            icon={Inbox}
            label="Flagged for Review"
            value={totalFlagged.toLocaleString()}
            subtitle="Rejected or deleted records"
          />
        </div>

        {/* Filters */}
        <Card className="border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-2">
              <Label className="mb-1.5 block text-sm font-medium text-slate-700">
                Search
              </Label>
              <div className="group relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="User, reference, or module…"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <FilterLabel
                applied={roleFilter !== ALL}
                className="mb-1.5 text-sm font-medium text-slate-700 normal-case tracking-normal"
              >
                Role
              </FilterLabel>
              <ZoomSafeDropdown
                value={roleFilter}
                onChange={setRoleFilter}
                options={ROLE_OPTIONS}
                className="w-full"
                applied={roleFilter !== ALL}
              />
            </div>

            <div className="lg:col-span-2">
              <FilterLabel
                applied={actionFilter !== ALL}
                className="mb-1.5 text-sm font-medium text-slate-700 normal-case tracking-normal"
              >
                Action
              </FilterLabel>
              <ZoomSafeDropdown
                value={actionFilter}
                onChange={setActionFilter}
                options={ACTION_OPTIONS}
                className="w-full"
                applied={actionFilter !== ALL}
              />
            </div>

            <div className="lg:col-span-2">
              <FilterLabel
                applied={moduleFilter !== ALL}
                className="mb-1.5 text-sm font-medium text-slate-700 normal-case tracking-normal"
              >
                Module
              </FilterLabel>
              <ZoomSafeDropdown
                value={moduleFilter}
                onChange={setModuleFilter}
                options={MODULE_OPTIONS}
                className="w-full"
                applied={moduleFilter !== ALL}
              />
            </div>

            <div className="lg:col-span-4">
              <FilterLabel
                applied={Boolean(fromDate || toDate)}
                className="mb-1.5 text-sm font-medium text-slate-700 normal-case tracking-normal"
              >
                Date Range
              </FilterLabel>
              <DateRangeFilter
                value={{ from: fromDate, to: toDate }}
                onChange={(next) => {
                  setFromDate(next.from);
                  setToDate(next.to);
                }}
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-9 rounded-md border border-gray-200 bg-white px-4 text-slate-600 hover:border-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
              >
                Clear Filters
              </Button>
            </div>
          ) : null}
        </Card>

        {/* Activity table — no Description column by design */}
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date &amp; Time
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Module
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <Activity className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No activity found
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {hasFilters
                          ? "Try adjusting or clearing the filters."
                          : "Actions taken in Docufy will appear here."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  pageEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-[#F7FAFF]"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block text-slate-500">
                          {formatPHDate(entry.timestamp, "short")}
                        </span>
                        <span className="block font-semibold text-slate-800">
                          {formatPHTime(entry.timestamp)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF] text-xs font-semibold text-[#2F6FD6]">
                            {initials(entry.actorName)}
                          </span>
                          <span className="font-medium text-slate-800">
                            {entry.actorName}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[entry.actorRole]}`}
                        >
                          {entry.actorRole}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ACTION_BADGE[entry.action]}`}
                        >
                          {entry.action}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {entry.module}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">
                          {entry.reference}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelected(entry)}
                          className="h-8 rounded-md border border-gray-200 bg-white px-3 text-slate-600 hover:border-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              {filtered.length === 0
                ? "Showing 0 activities"
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} activit${
                    filtered.length === 1 ? "y" : "ies"
                  }`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-slate-600 hover:border-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6] disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2F6FD6] font-medium text-white shadow-sm shadow-[#2F6FD6]/30">
                {page}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page === pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-slate-600 hover:border-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6] disabled:pointer-events-none disabled:opacity-40"
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Details pop-up — everything the table deliberately omits */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 pr-12">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ACTION_BADGE[selected.action]}`}
                  >
                    {selected.action}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[selected.actorRole]}`}
                  >
                    {selected.actorRole}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {selected.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  {formatPHDate(selected.timestamp, "long")} at{" "}
                  {formatPHTime(selected.timestamp)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                {/* Performed by */}
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Performed By
                  </h3>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF] text-sm font-semibold text-[#2F6FD6]">
                      {initials(selected.actorName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {selected.actorName}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="h-3 w-3" />
                        {selected.actorRole}
                      </p>
                    </div>
                  </div>
                </section>

                {/* What was affected */}
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Activity Details
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-1">
                    <DetailRow label="Module" value={selected.module} />
                    <DetailRow label="Action" value={selected.action} />
                    <DetailRow
                      label="Reference"
                      icon={Hash}
                      value={selected.reference}
                    />
                    <DetailRow label="Log ID" value={selected.id} />
                  </div>
                </section>

                {/* Before / after */}
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Changes Made
                  </h3>
                  {selected.changes.length > 0 ? (
                    <div className="space-y-2">
                      {selected.changes.map((change) => (
                        <ChangeRow key={change.field} change={change} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      No field values changed for this activity.
                    </p>
                  )}
                </section>

                {/* Narrative */}
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </h3>
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {selected.description}
                  </p>
                </section>

                {/* Optional investigation metadata — omitted when unknown */}
                {selected.ipAddress ||
                selected.device ||
                selected.transactionId ? (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Request Metadata
                    </h3>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-1">
                      {selected.ipAddress ? (
                        <DetailRow
                          label="IP Address"
                          icon={Globe}
                          value={selected.ipAddress}
                        />
                      ) : null}
                      {selected.device ? (
                        <DetailRow
                          label="Device / Browser"
                          value={selected.device}
                        />
                      ) : null}
                      {selected.transactionId ? (
                        <DetailRow
                          label="Transaction ID"
                          icon={Hash}
                          value={selected.transactionId}
                        />
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}