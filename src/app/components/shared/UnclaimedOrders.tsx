// "Unclaimed Orders" â€” Admin/Staff page for the automatically DERIVED
// unclaimed-order records. It shows a small card row (counts + links to the
// Unclaimed Order History and Customer Restrictions pages, which are reached
// ONLY from here, never the sidebar) and a table of the CURRENT offenses â€”
// Cash-on-Pickup orders that passed their pickup deadline and have NOT yet
// been collected. Orders that were eventually collected (late) move to the
// Unclaimed Order History page.
//
// There is no manual review, excuse, or confirm workflow: a record exists only
// when the real order + status-history timeline proves a Cash-on-Pickup order
// passed its pickup deadline (the shop's configured closing time) without being
// collected on time. Counts are always derived, never stored â€” nothing is
// enforced or written.

import React, { useEffect, useMemo, useState } from "react";
import {
  PackageX,
  ShieldAlert,
  ClipboardList,
  Search,
  Eye,
  AlertTriangle,
  CircleSlash,
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
import { computeOrderPayment } from "./OrderPaymentSummary";
import {
  isClosingTimeConfigured,
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

export default function UnclaimedOrders({
  menuItems,
  userRole,
}: UnclaimedOrdersProps) {
  const navigate = useNavigate();
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
        const displayId = ordersById.get(r.orderId)?.displayId ?? r.orderId;
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

  return (
    <Layout menuItems={menuItems} title="Unclaimed Orders" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-5">
          <p className="max-w-2xl text-sm text-slate-500">
            Every order listed here was automatically recorded as unclaimed â€”
            a Cash-on-Pickup order that passed its pickup deadline without being
            collected. Orders collected late are kept on the Late Pick-up History
            page. Counts are derived from real order status history, so
            they can never drift or be edited.
          </p>

          {!isClosingTimeConfigured(closingTime) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <span>
                Unclaimed orders cannot be computed yet â€” set the shop closing
                time in Admin â†’ Landing Page â†’ Shop Information. Until then no
                order can pass a pickup deadline.
              </span>
            </div>
          )}

          {historyUnavailable && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              <span>
                Unclaimed-order information is unavailable right now â€” some order
                status history could not be read, so these counts may be
                incomplete.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

          <Card className="p-4 border border-slate-100 shadow-sm shrink-0">
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

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-[#10316B]">
              Unclaimed Orders
            </h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                    <tr>
                      {[
                        "Customer",
                        "Order ID",
                        "Order Status",
                        "Payment & Balance",
                        "Ready for Pickup",
                        "Pickup Deadline",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-14">
                          <div className="flex flex-col items-center text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1668D9] ring-1 ring-[#1668D9]/15">
                              <ClipboardList className="h-6 w-6" />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-gray-800">
                              No orders are currently unclaimed
                            </p>
                            <p className="mt-1 max-w-md text-xs text-gray-500">
                              A Cash-on-Pickup order appears here once it passes
                              its pickup deadline without being collected.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record) => {
                        const order = ordersById.get(record.orderId);
                        const payment = order
                          ? computeOrderPayment(order, order.manualTotal ?? 0)
                          : null;
                        return (
                          <tr
                            key={record.orderId}
                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">
                                {record.customerName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {record.customerEmail || "â€”"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-gray-700">
                                {order?.displayId ?? record.orderId}
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
                                <span className="text-xs text-gray-500">â€”</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {payment ? (
                                <>
                                  <div className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(payment.total)}
                                  </div>
                                  <div
                                    className={`text-xs ${
                                      payment.remaining > 0
                                        ? "text-amber-700"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {payment.remaining > 0
                                      ? `Balance ${formatCurrency(payment.remaining)}`
                                      : "Fully paid"}
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs text-gray-500">â€”</span>
                              )}
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
                                className="h-8 bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
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
            </Card>
          </div>
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
                          selectedRecord.orderId}
                      </span>
                    </div>
                    <DialogDescription className="mt-1 text-sm text-gray-500">
                      {selectedRecord.customerEmail || "No email on file"}
                    </DialogDescription>
                  </div>
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
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ready for Pickup
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatPHDate(selectedRecord.readyAt)} Â·{" "}
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
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Collected
                  </p>
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    Not collected
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Order Total
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedRecord.orderTotal != null
                      ? formatCurrency(selectedRecord.orderTotal)
                      : "â€”"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                This order was recorded as unclaimed because it was not collected
                by its pickup deadline.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
