// "Pickup Monitoring" — Admin/Staff workspace for tracking orders through the
// pickup phase (ready for pickup, overdue for pickup, collected) and the
// automatically DERIVED unclaimed-order records.
//
// There is no manual review workflow here: an order counts as unclaimed only
// when the real order + status-history timeline proves it reached Completed and
// was not collected by the shop's configured closing time. The page is otherwise
// display-only (view an order's details); the one thing it can change is the
// pickup itself — a staff/admin can mark a waiting order as released.

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { useAuth } from "../../contexts/AuthContext";
import { ordersStore } from "../../utils/ordersStore";
import { notificationStore } from "../../utils/notificationStore";
import { auditLogStore } from "../../utils/auditLogStore";
import { getLock } from "../../utils/orderLocks";
import { showDbError } from "../../../lib/db/errors";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import {
  closingDeadline,
  deriveUnclaimedRecords,
  isClosingTimeConfigured,
  toUnclaimedOrderLikes,
  type UnclaimedRecord,
} from "../../utils/unclaimedOrders";
import { useShopClosingTime } from "../../utils/useUnclaimedOffenses";

type OrderRow = ReturnType<typeof ordersStore.getOrders>[number];

interface PickupMonitoringProps {
  menuItems: Array<{ label: string; path: string; icon: React.ReactNode }>;
  userRole: "admin" | "staff";
}

type PickupState = "ready" | "overdue" | "collected";
type PickupFilter = "all" | PickupState | "unclaimed";

const PAGE_SIZE = 10;

const PICKUP_FILTERS: { key: PickupFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "overdue", label: "Overdue" },
  { key: "collected", label: "Picked up" },
  { key: "unclaimed", label: "Unclaimed" },
];

const STATUS_LABELS: Record<string, string> = {
  inqueue: "In Queue",
  printing: "Printing",
  completed: "Completed",
  released: "Picked Up",
  canceled: "Canceled",
  awaitingpayment: "Awaiting Payment",
};

const statusLabel = (status: string) =>
  STATUS_LABELS[status?.toLowerCase()] ?? status;

// The Status column combines the pickup state with whether the order also
// carries a derived unclaimed record: a collection made after the deadline
// reads as "Picked up late" rather than a plain "Picked up".
function rowStatus(
  state: PickupState,
  unclaimed: boolean,
): { label: string; classes: string } {
  if (state === "overdue") {
    return {
      label: "Overdue",
      classes: "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40",
    };
  }
  if (state === "ready") {
    return {
      label: "Ready for pickup",
      classes: "bg-[#EAF3FF] text-[#1668D9] border-[#1668D9]/30",
    };
  }
  if (unclaimed) {
    return {
      label: "Picked up late",
      classes: "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40",
    };
  }
  return {
    label: "Picked up",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  };
}

function paymentBadgeClasses(status: string): string {
  if (status === "Paid") return "bg-[#E8F7D8] text-[#3B7A1E] border-[#55A630]/40";
  if (status === "Partially Paid")
    return "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40";
  return "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40";
}

// Earliest time the order's own timeline shows it entering `status`.
function earliestStatusAt(
  history: OrderRow["statusHistory"],
  status: string,
): Date | null {
  if (!history?.length) return null;
  let best: Date | null = null;
  for (const entry of history) {
    if (entry.status !== status) continue;
    const at = entry.at instanceof Date ? entry.at : new Date(entry.at);
    if (isNaN(at.getTime())) continue;
    if (!best || at.getTime() < best.getTime()) best = at;
  }
  return best;
}

export default function PickupMonitoring({
  menuItems,
}: PickupMonitoringProps) {
  const closingTime = useShopClosingTime();
  const hydrating = useHydrating();

  const [orders, setOrders] = useState<OrderRow[]>(() => ordersStore.getOrders());
  const [filter, setFilter] = useState<PickupFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<OrderRow | null>(null);

  const { user } = useAuth();
  const myName = user?.name || "Staff";

  useEffect(() => {
    const sync = () => setOrders(ordersStore.getOrders());
    sync();
    return ordersStore.subscribe(sync);
  }, []);

  const payFor = (order: OrderRow) =>
    computeOrderPayment(order, order.manualTotal ?? 0);

  const recordById = useMemo(() => {
    const records = deriveUnclaimedRecords(
      toUnclaimedOrderLikes(orders),
      closingTime,
    );
    const map = new Map<string, UnclaimedRecord>();
    records.forEach((r) => map.set(r.orderId, r));
    return map;
  }, [orders, closingTime]);

  const pickupStateOf = (order: OrderRow): PickupState | null => {
    const status = order.status?.toLowerCase();
    const released = status === "released";
    const hasRecord = recordById.has(order.id);
    if (hasRecord && !released) return "overdue";
    if (released) return "collected";
    if (status === "completed") return "ready";
    return null;
  };

  const stateById = useMemo(() => {
    const map = new Map<string, PickupState>();
    orders.forEach((o) => {
      const s = pickupStateOf(o);
      if (s) map.set(o.id, s);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, recordById]);

  const pickupOrders = useMemo(
    () => orders.filter((o) => stateById.has(o.id)),
    [orders, stateById],
  );

  const counts = useMemo(() => {
    let ready = 0;
    let overdue = 0;
    let collected = 0;
    stateById.forEach((s) => {
      if (s === "ready") ready += 1;
      else if (s === "overdue") overdue += 1;
      else if (s === "collected") collected += 1;
    });
    return { ready, overdue, collected, unclaimed: recordById.size };
  }, [stateById, recordById]);

  const tableRows = useMemo(() => {
    let rows = [...pickupOrders];
    if (filter === "unclaimed") {
      rows = rows.filter((o) => recordById.has(o.id));
    } else if (filter !== "all") {
      rows = rows.filter((o) => stateById.get(o.id) === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        `${o.customer} ${o.displayId ?? o.id} ${o.customerEmail ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`).getTime();
      rows = rows.filter((o) => o.submittedAt.getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`).getTime();
      rows = rows.filter((o) => o.submittedAt.getTime() <= to);
    }
    return rows.sort((a, b) => {
      const aActive = stateById.get(a.id) !== "collected";
      const bActive = stateById.get(b.id) !== "collected";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });
  }, [pickupOrders, filter, stateById, recordById, search, dateFrom, dateTo]);

  // Narrowing the list (filter, search or date range) sends it back to page 1,
  // so a filter change can never leave you staring at an empty page 3.
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () =>
      tableRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [tableRows, currentPage],
  );

  // Ready-for-pickup time: from the derived record, else the order's own
  // Completed transition. Released orders that were collected in time no longer
  // carry a ready timestamp once `statusUpdatedAt` moved to the collection time.
  const readyAtFor = (order: OrderRow): Date | null =>
    recordById.get(order.id)?.readyAt ??
    earliestStatusAt(order.statusHistory, "Completed");

  const deadlineFor = (order: OrderRow): Date | null => {
    const record = recordById.get(order.id);
    if (record) return record.deadlineAt;
    const readyAt = earliestStatusAt(order.statusHistory, "Completed");
    return readyAt ? closingDeadline(readyAt, closingTime) : null;
  };

  const historyUnavailable = orders.some((o) => o.statusHistoryUnavailable);

  const readyForDisplay = (order: OrderRow): string => {
    const readyAt = readyAtFor(order);
    if (!readyAt) return "—";
    return `${formatPHDate(readyAt)} · ${formatPHTime(readyAt)}`;
  };

  // A row can be released only while it is still waiting to be collected —
  // an order already marked Released has nothing left to do here.
  const canRelease = (order: OrderRow): boolean =>
    stateById.get(order.id) !== "collected";

  // The customer address to notify, or null when the order has no real account
  // behind it — a walk-in has no signed-in customer to receive the alert.
  const notifyAddressFor = (order: OrderRow): string | null => {
    const email = (order.customerEmail ?? "").trim().toLowerCase();
    return email && !email.includes("@example.com") ? email : null;
  };

  // Opening the confirm is also the moment we check the order session lock, so
  // a release never lands on top of an order another reviewer has open in Orders.
  const openReleaseConfirm = (order: OrderRow) => {
    const holder = getLock(order.id);
    if (holder && holder.heldBy !== myName) {
      toast.error(`${holder.heldBy} is managing this order`, {
        description:
          "Only the current reviewer can change it. Try again once they close it.",
      });
      return;
    }
    setReleaseTarget(order);
  };

  // The same release path the Orders page uses: one status write, its audit
  // entry, and the customer notification. Nothing else on this page changes.
  const confirmRelease = async (order: OrderRow) => {
    try {
      await ordersStore.updateOrder(order.id, {
        status: "released",
        statusUpdatedAt: new Date(),
      });
    } catch (err) {
      showDbError("releasing the order", err);
      // Rejection keeps the confirmation open so staff can retry.
      throw err;
    }

    auditLogStore.record({
      module: "Orders",
      action: "Released",
      reference: `Order #${order.displayId ?? order.id}`,
      entityType: "Order",
      entityId: order.id,
      title: "Order Released",
      description: `The order was marked as released from Pickup Monitoring. Status changed from ${statusLabel(order.status)} to Released.`,
      changes: [
        { field: "Order Status", previous: statusLabel(order.status), next: "Released" },
      ],
    });

    const notifyEmail = notifyAddressFor(order);
    if (notifyEmail) {
      notificationStore.addNotification(
        "status_update",
        "Order Released",
        "Your order has been released.",
        {
          clickable: true,
          relatedOrderId: order.id,
          relatedRoute: `/customer/track/${order.id}`,
          recipientEmail: notifyEmail,
          recipientRole: "customer",
          recipientProfileId: order.customerId ?? null,
        },
      );
    }

    toast.success(
      `Order ${order.displayId ?? order.id} marked as released.`,
    );
    // The shared confirmation closes itself once this promise settles, and the
    // row itself re-renders from the ordersStore subscription.
  };

  return (
    <Layout menuItems={menuItems} title="Pickup Monitoring" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-5">
          {!isClosingTimeConfigured(closingTime) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <span>
                Pickup deadlines cannot be computed yet — set the shop closing time in Admin → Landing Page → Shop Information.
              </span>
            </div>
          )}

          {historyUnavailable && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              <span>
                Order status history could not be read.
              </span>
            </div>
          )}

          <Card className="p-4 border border-slate-100 shadow-sm shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="group relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                  <Input
                    aria-label="Search pickup orders"
                    placeholder="Search order or customer"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <DateRangeFilter
                  value={{ from: dateFrom, to: dateTo }}
                  onChange={(next) => {
                    setDateFrom(next.from);
                    setDateTo(next.to);
                  }}
                  compact
                  className="w-full sm:w-[18rem]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {PICKUP_FILTERS.map(({ key, label }) => {
                  const active = filter === key;
                  const count =
                    key === "all"
                      ? pickupOrders.length
                      : counts[key as Exclude<PickupFilter, "all">];
                  return (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={active ? "primary" : "outline"}
                      onClick={() => setFilter(key)}
                      className="group h-8 rounded-lg"
                    >
                      {label}
                      <span
                        className={`ml-1.5 text-[11px] font-semibold ${
                          active ? "text-white/80" : "text-slate-400 group-hover:text-white/80"
                        }`}
                      >
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {hydrating && <TableSkeleton columns={5} rows={10} />}
            {!hydrating && (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                  <tr>
                    {[
                      "Order / Customer",
                      "Status",
                      "Payment",
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
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14">
                        <div className="flex flex-col items-center text-center">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1668D9] ring-1 ring-[#1668D9]/15">
                            <ClipboardList className="h-6 w-6" />
                          </span>
                          <p className="mt-3 text-sm font-semibold text-gray-800">
                            No pickup orders to show
                          </p>
                          <p className="mt-1 max-w-md text-xs text-gray-500">
                            Orders appear here once they are completed or released.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((order) => {
                      const payment = payFor(order);
                      const state = stateById.get(order.id) ?? "collected";
                      const isUnclaimed = recordById.has(order.id);
                      const status = rowStatus(state, isUnclaimed);
                      const deadline = deadlineFor(order);
                      return (
                        <tr
                          key={order.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelected(order)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-gray-700">
                              {order.displayId ?? order.id}
                            </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {order.customer}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${status.classes}`}
                            >
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {payment.remaining > 0 ? (
                              <span className="text-xs font-semibold text-amber-700">
                                {formatCurrency(payment.remaining)} due
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold ${paymentBadgeClasses(
                                  payment.status,
                                )}`}
                              >
                                {payment.status}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {deadline ? (
                              <span
                                className={
                                  isUnclaimed
                                    ? "text-xs font-medium text-red-700"
                                    : "text-xs text-gray-700"
                                }
                              >
                                {formatPHDateTime(deadline)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                Not configured
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(order);
                                }}
                                className="h-8"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              {canRelease(order) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReleaseConfirm(order);
                                  }}
                                  className="h-8"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Mark as released
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer — how many orders are in view, plus pagination. */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {tableRows.length === 0
                    ? 0
                    : totalPages === 1
                      ? tableRows.length
                      : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                          currentPage * PAGE_SIZE,
                          tableRows.length,
                        )}`}
                </span>{" "}
                of <span className="font-semibold text-slate-700">{tableRows.length}</span>{" "}
                order{tableRows.length === 1 ? "" : "s"}
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
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <Button
                      key={pg}
                      type="button"
                      variant={pg === currentPage ? "primary" : "outline"}
                      size="icon"
                      onClick={() => setCurrentPage(pg)}
                    >
                      {pg}
                    </Button>
                  ))}
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
            </>
            )}
          </Card>
        </div>
      </StaffTimeInGate>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto p-[26px]">
          {selected && (
            <>
              <DialogHeader className="border-b border-gray-100 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-[22px] font-bold text-[#10316B]">
                        {selected.customer}
                      </DialogTitle>
                      <span className="font-mono text-sm text-gray-500">
                        {selected.displayId ?? selected.id}
                      </span>
                    </div>
                    <DialogDescription className="mt-1 text-sm text-gray-500">
                      Submitted on {formatPHDate(selected.submittedAt)} ·{" "}
                      {formatPHTime(selected.submittedAt)}
                    </DialogDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${getStatusBadgeClasses(
                      selected.status,
                    )}`}
                  >
                    {statusLabel(selected.status)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {payFor(selected).status}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Remaining {formatCurrency(payFor(selected).remaining)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ready for Pickup
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {readyForDisplay(selected)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pickup Deadline
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {deadlineFor(selected)
                      ? formatPHDateTime(deadlineFor(selected)!)
                      : "Not configured — set the shop closing time to enable pickup deadlines."}
                  </p>
                  {recordById.get(selected.id) && (
                    <p className="mt-1.5 text-xs text-red-700">
                      This order passed its pickup deadline without being
                      collected{recordById.get(selected.id)?.releasedAt ? " on time" : ""}.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {releaseTarget && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setReleaseTarget(null);
          }}
          onConfirm={() => confirmRelease(releaseTarget)}
          title="Mark order as released?"
          description={`Order ${releaseTarget.displayId ?? releaseTarget.id} for ${releaseTarget.customer} will move to Released.${
            notifyAddressFor(releaseTarget)
              ? " The customer will be notified."
              : ""
          }`}
          confirmLabel="Mark as Released"
          cancelLabel="Go Back"
          success
        />
      )}
    </Layout>
  );
}
