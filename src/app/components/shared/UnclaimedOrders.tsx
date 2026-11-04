// "Unclaimed Orders" — Admin/Staff page for the automatically DERIVED
// unclaimed-order records. It shows a small card row (counts + links to the
// Unclaimed Order History and Customer Restrictions pages, which are reached
// ONLY from here, never the sidebar) and a table of the CURRENT offenses —
// orders that reached pickup and still owed money at their pickup deadline
// without being collected. Orders that were eventually collected (late) move to
// the Unclaimed Order History page.
//
// The offence is MONEY still owed at the deadline, not the payment method, so a
// down-payment order that reached printing un-paid-up counts and a fully paid
// order never does (it stays in Pickup Monitoring instead). There is no manual
// review, excuse, or confirm workflow: a record exists only when the real order
// + status-history + payment timeline prove it. Counts are always derived, never
// stored — nothing is enforced or written.

import React, { useEffect, useMemo, useState } from "react";
import {
  PackageX,
  ShieldAlert,
  ClipboardList,
  Search,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { ordersStore } from "../../utils/ordersStore";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SummaryCard } from "../ui/summary-card";
import { DateRangeFilter } from "../ui/date-range-filter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { formatPHDate, formatPHTime, formatPHDateTime } from "../../utils/pht";
import { formatCurrency } from "../../utils/formatNumber";
import { getStatusBadgeClasses } from "../../utils/orderStatusPalette";
import { TableSkeleton } from "../ui/table-skeleton";
import { CopyFieldButton } from "../ui/copy-field-button";
import { useHydrating } from "../../utils/useHydrating";
import {
  isClosingTimeConfigured,
  type UnclaimedPaymentEntry,
  type UnclaimedRecord,
} from "../../utils/unclaimedOrders";
import { useUnclaimedAdminData } from "../../utils/useUnclaimedOffenses";

type OrderRow = ReturnType<typeof ordersStore.getOrders>[number];

interface UnclaimedOrdersProps {
  menuItems: Array<{ label: string; path: string; icon: React.ReactNode }>;
  userRole: "admin" | "staff";
}

const STATUS_LABELS: Record<string, string> = {
  inQueue: "In Queue",
  printing: "Printing",
  completed: "Completed",
  released: "Picked Up",
  canceled: "Canceled",
  awaitingPayment: "Awaiting Payment",
};

const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;

const PAGE_SIZE = 10;

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  verified: "Verified",
  pending: "Awaiting review",
  rejected: "Rejected",
};

const paymentStatusLabel = (status: string) =>
  PAYMENT_STATUS_LABELS[status] ?? status;

const paymentStatusChip = (status: string) => {
  if (status === "verified") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
};

/** What the record says was paid and owed at the pickup deadline. */
function RecordMoney({ record }: { record: UnclaimedRecord }) {
  if (record.balance == null) {
    return <span className="text-xs text-gray-500">—</span>;
  }
  return (
    <>
      <div className="text-sm font-semibold text-red-700">
        {formatCurrency(record.balance)}
      </div>
      <div className="text-xs text-gray-500">
        {record.amountPaid && record.amountPaid > 0
          ? `${formatCurrency(record.amountPaid)} paid by deadline`
          : "Nothing paid by deadline"}
      </div>
    </>
  );
}

function PaymentTimelineRows({
  entries,
  deadlineAt,
}: {
  entries: UnclaimedPaymentEntry[];
  deadlineAt: Date;
}) {
  return (
    <ul className="mt-2 space-y-2">
      {entries.map((entry, index) => {
        const submittedAt = new Date(entry.submittedAt);
        const afterDeadline = submittedAt.getTime() > deadlineAt.getTime();
        return (
          <li
            key={`${entry.submittedAt}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
          >
            <span className="text-xs font-medium text-gray-800">
              {entry.method || "Payment"} · {formatCurrency(entry.amount)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${paymentStatusChip(
                entry.status,
              )}`}
            >
              {paymentStatusLabel(entry.status)}
            </span>
            <span className="w-full text-[11px] text-gray-500">
              Submitted {formatPHDateTime(submittedAt)}
              {entry.verifiedAt
                ? ` · Verified ${formatPHDateTime(new Date(entry.verifiedAt))}`
                : ""}
              {afterDeadline && (
                <span className="text-red-600"> · after the deadline</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function UnclaimedOrders({
  menuItems,
  userRole,
}: UnclaimedOrdersProps) {
  const navigate = useNavigate();
  const hydrating = useHydrating();
  const {
    closingTime,
    uncollectedRecords,
    uncollectedCount,
    latePickups,
    restrictedSummaries,
    ordersById,
    historyUnavailable,
  } = useUnclaimedAdminData();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<UnclaimedRecord | null>(
    null,
  );

  const base =
    userRole === "admin" ? "/admin/orders/unclaimed" : "/staff/queue/unclaimed";

  const filteredRecords = useMemo(() => {
    let rows = [...uncollectedRecords].sort(
      (a, b) => b.deadlineAt.getTime() - a.deadlineAt.getTime(),
    );
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const displayId =
          ordersById.get(r.orderId)?.displayId ?? r.displayId ?? r.orderId;
        return `${r.customerName} ${r.customerEmail} ${displayId}`
          .toLowerCase()
          .includes(q);
      });
    }
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`).getTime();
      rows = rows.filter((r) => r.deadlineAt.getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`).getTime();
      rows = rows.filter((r) => r.deadlineAt.getTime() <= to);
    }
    return rows;
  }, [uncollectedRecords, ordersById, search, dateFrom, dateTo]);

  // Same 10-per-page paging as All Orders and Pickup Monitoring.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pageRows = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <Layout menuItems={menuItems} title="Unclaimed Orders" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-6">
          {!isClosingTimeConfigured(closingTime) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <span>
                Unclaimed orders cannot be computed yet — set the shop closing
                time in Admin → Landing Page → Shop Information.
              </span>
            </div>
          )}

          {historyUnavailable && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              <span>
                Order status history could not be read, so these counts may be incomplete.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 @min-[560px]:grid-cols-3 gap-2 sm:gap-3 mb-4 shrink-0">
            <SummaryCard
              label="Unclaimed Orders"
              value={uncollectedCount}
              icon={PackageX}
              iconBg="bg-[#FDE8E8]"
              iconColor="text-[#B91C1C]"
            />
            <SummaryCard
              label="Late Pick-up History"
              value={latePickups.length}
              icon={ClipboardList}
              iconBg="bg-[#EAF3FF]"
              iconColor="text-[#2F6FD6]"
              onClick={() => navigate(`${base}/history`)}
            />
            <SummaryCard
              label="Customers Restricted"
              value={restrictedSummaries.length}
              icon={ShieldAlert}
              iconBg="bg-[#FDE8E8]"
              iconColor="text-[#B91C1C]"
              onClick={() => navigate(`${base}/restrictions`)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
            <span>
              A fully paid order that is never collected does not appear here.
              It stays in Pickup Monitoring so staff can follow up, and it is not
              treated as an unclaimed order.
            </span>
          </div>

          <Card className="p-4 border border-slate-100 shadow-sm mb-6 shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Search
                </Label>
                <div className="group relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                  <Input
                    aria-label="Search unclaimed orders"
                    placeholder="Search customer or order ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <DateRangeFilter
                value={{ from: dateFrom, to: dateTo }}
                onChange={(next) => {
                  setDateFrom(next.from);
                  setDateTo(next.to);
                }}
                fromLabel="From"
                toLabel="To"
                className="w-full lg:w-[21rem]"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Date range filters by the day an order became unclaimed (its missed
              pickup deadline).
            </p>
          </Card>

          <Card className="overflow-hidden">
            {hydrating && <TableSkeleton columns={8} rows={8} />}
            {!hydrating && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider w-14 whitespace-nowrap">
                        #
                      </th>
                      {[
                        "Customer",
                        "Order ID",
                        "Status",
                        "Owed",
                        "Ready",
                        "Deadline",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-14">
                          <div className="flex flex-col items-center text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1668D9] ring-1 ring-[#1668D9]/15">
                              <ClipboardList className="h-6 w-6" />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-gray-800">
                              No orders are currently unclaimed
                            </p>
                            <p className="mt-1 max-w-md text-xs text-gray-500">
                              An order appears here once it reaches pickup, is
                              not collected by its deadline, and still owes part
                              of its total at that deadline.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((record, index) => {
                        const order = ordersById.get(record.orderId);
                        const listPosition =
                          (currentPage - 1) * PAGE_SIZE + index + 1;
                        return (
                          <tr
                            key={record.orderId}
                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-[#10316B]">
                              {listPosition}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">
                                {record.customerName}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="min-w-0">
                                  {record.customerEmail || "—"}
                                </span>
                                <CopyFieldButton
                                  value={record.customerEmail}
                                  label="customer email"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-gray-700">
                                {order?.displayId ?? record.displayId ?? record.orderId}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {order ? (
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium ${getStatusBadgeClasses(
                                    order.status,
                                  )}`}
                                >
                                  {statusLabel(order.status)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-500">—</span>
                              )}
                              <div
                                className={`mt-1 text-[11px] font-medium ${
                                  record.releasedAt
                                    ? "text-slate-500"
                                    : "text-red-600"
                                }`}
                              >
                                {record.releasedAt
                                  ? "Collected late"
                                  : "Uncollected"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <RecordMoney record={record} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-gray-700">
                                {formatPHDate(record.readyAt)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatPHTime(record.readyAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                                <CircleSlash className="h-3.5 w-3.5" />
                                {formatPHDateTime(record.deadlineAt)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRecord(record);
                                }}
                                className="h-8"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-white">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {totalPages === 1
                    ? filteredRecords.length
                    : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                        currentPage * PAGE_SIZE,
                        filteredRecords.length,
                      )}`}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {filteredRecords.length}
                </span>{" "}
                order{filteredRecords.length === 1 ? "" : "s"}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pg) => (
                      <Button
                        key={pg}
                        type="button"
                        variant={pg === currentPage ? "primary" : "outline"}
                        size="icon"
                        onClick={() => setCurrentPage(pg)}
                      >
                        {pg}
                      </Button>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="h-9 px-3"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </StaffTimeInGate>

      {/* Unclaimed order details */}
      <Dialog
        open={!!selectedRecord}
        onOpenChange={(open) => {
          if (!open) setSelectedRecord(null);
        }}
      >
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto p-[26px]">
          {selectedRecord && (
            <>
              <DialogHeader className="border-b border-gray-100 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-[22px] font-bold text-[#10316B]">
                        {selectedRecord.customerName}
                      </DialogTitle>
                      <span className="font-mono text-sm text-gray-500">
                        {ordersById.get(selectedRecord.orderId)?.displayId ??
                          selectedRecord.displayId ??
                          selectedRecord.orderId}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <DialogDescription className="min-w-0 text-sm text-gray-500">
                        {selectedRecord.customerEmail || "No email on file"}
                      </DialogDescription>
                      <CopyFieldButton
                        value={selectedRecord.customerEmail}
                        label="customer email"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ordersById.get(selectedRecord.orderId) && (
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${getStatusBadgeClasses(
                          ordersById.get(selectedRecord.orderId)!.status,
                        )}`}
                      >
                        {statusLabel(
                          ordersById.get(selectedRecord.orderId)!.status,
                        )}
                      </Badge>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        selectedRecord.releasedAt
                          ? "bg-slate-100 text-slate-600"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {selectedRecord.releasedAt
                        ? "Collected late"
                        : "Uncollected"}
                    </span>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ready for Pickup
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatPHDate(selectedRecord.readyAt)} ·{" "}
                    {formatPHTime(selectedRecord.readyAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                    Pickup Deadline
                  </p>
                  <p className="mt-1 text-sm font-semibold text-red-800">
                    {formatPHDateTime(selectedRecord.deadlineAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                    Owed at Deadline
                  </p>
                  <p className="mt-1 text-sm font-semibold text-red-800">
                    {selectedRecord.balance != null
                      ? formatCurrency(selectedRecord.balance)
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-red-700/80">
                    {selectedRecord.amountPaid && selectedRecord.amountPaid > 0
                      ? `${formatCurrency(selectedRecord.amountPaid)} paid by then`
                      : "Nothing paid by then"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Order Total
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedRecord.orderTotal != null
                      ? formatCurrency(selectedRecord.orderTotal)
                      : "—"}
                  </p>
                </div>
              </div>

              {(() => {
                const entries =
                  ordersById.get(selectedRecord.orderId)?.paymentTimeline ?? [];
                if (entries.length === 0) return null;
                return (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment History
                    </p>
                    <PaymentTimelineRows
                      entries={entries}
                      deadlineAt={selectedRecord.deadlineAt}
                    />
                  </div>
                );
              })()}

              <p className="text-xs text-gray-500">
                Recorded as unclaimed because the order was not collected by its
                pickup deadline and still owed{" "}
                {selectedRecord.balance != null
                  ? formatCurrency(selectedRecord.balance)
                  : "part of its total"}{" "}
                at that deadline.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
