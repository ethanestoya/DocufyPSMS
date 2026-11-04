// "Pickup Monitoring" — Admin/Staff workspace for tracking orders through the
// pickup phase (ready for pickup, overdue for pickup, collected) and the
// automatically DERIVED unclaimed-order records.
//
// The records here come from the SAME derivation the Unclaimed Orders pages
// use — the live orders plus the retained timelines for archived released
// orders — so the two pages cannot disagree. An order is overdue only when it
// still owed part of its total at the pickup deadline; a fully paid order that
// is never collected stays "Ready for pickup" and is not an offence.
//
// There is no manual review workflow here. The page is display-only except for
// the pickup itself: a staff/admin can mark a waiting order as released.

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  PackageCheck,
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
import { Label } from "../ui/label";
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
import { SummaryCard } from "../ui/summary-card";
import { useHydrating } from "../../utils/useHydrating";
import {
  closingDeadline,
  deriveUnclaimedRecords,
  isClosingTimeConfigured,
  type UnclaimedRecord,
} from "../../utils/unclaimedOrders";
import {
  buildAdminUnclaimedLikes,
  useShopClosingTime,
} from "../../utils/useUnclaimedOffenses";
import { useReleasedOrderTransactions } from "../../utils/useReleasedOrderTransactions";

type OrderRow = ReturnType<typeof ordersStore.getOrders>[number];

interface PickupMonitoringProps {
  menuItems: Array<{ label: string; path: string; icon: React.ReactNode }>;
  userRole: "admin" | "staff";
}

// The four operational pickup states. There is deliberately no "unclaimed"
// filter here: an overdue order IS the unclaimed one, so a second card showing
// the same set (and the same figure) duplicated both the Overdue card and the
// dedicated Unclaimed Orders workspace.
type PickupState = "ready" | "overdue" | "collected" | "late";
type PickupFilter = "all" | PickupState;

// Only these two are still waiting to be collected.
const isWaitingState = (state: PickupState | undefined) =>
  state === "ready" || state === "overdue";

const PAGE_SIZE = 10;

// One line under the cards, so "Overdue" and "Picked up late" say what they
// mean instead of leaving staff to guess.
const FILTER_NOTES: Partial<Record<PickupFilter, string>> = {
  ready:
    "Finished and waiting to be collected. A fully paid order stays here after its deadline — it is not an unclaimed order.",
  overdue:
    "Past the pickup deadline and still owing part of the total. These are the orders the Unclaimed Orders page lists.",
  collected:
    "Handed over on or before the pickup deadline.",
  late:
    "Collected after the pickup deadline while money was still owed at that deadline. The late-pickup record stays on the order.",
};

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

// The Status column reads the pickup state itself: a collection made after the
// deadline is its own state, so the row label and the "Picked up late" chip
// count the same orders.
function rowStatus(state: PickupState): { label: string; classes: string } {
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
  if (state === "late") {
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
  const releasedTransactions = useReleasedOrderTransactions();
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

  const records = useMemo(
    () =>
      deriveUnclaimedRecords(
        buildAdminUnclaimedLikes(orders, releasedTransactions),
        closingTime,
      ),
    [orders, releasedTransactions, closingTime],
  );

  const recordById = useMemo(() => {
    const map = new Map<string, UnclaimedRecord>();
    records.forEach((r) => map.set(r.orderId, r));
    return map;
  }, [records]);

  const pickupStateOf = (order: OrderRow): PickupState | null => {
    const status = order.status?.toLowerCase();
    const released = status === "released";
    const hasRecord = recordById.has(order.id);
    if (hasRecord && !released) return "overdue";
    if (released) return hasRecord ? "late" : "collected";
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
    let late = 0;
    stateById.forEach((s) => {
      if (s === "ready") ready += 1;
      else if (s === "overdue") overdue += 1;
      else if (s === "collected") collected += 1;
      else if (s === "late") late += 1;
    });
    return { ready, overdue, collected, late };
  }, [stateById]);

  // Same card row as All Orders: the cards ARE the filter, so the page keeps
  // one control for the four pickup states plus All. The accent colours match
  // the status the card stands for.
  const pickupCards = [
    {
      key: "all" as PickupFilter,
      label: "All",
      count: pickupOrders.length,
      icon: LayoutGrid,
      iconColor: "text-[#2F6FD6]",
      labelColor: "text-[#1668D9]",
      activeBorder: "border-[#1668D9]",
      activeBg: "bg-[#EAF3FF]",
    },
    {
      key: "ready" as PickupFilter,
      label: "Ready",
      count: counts.ready,
      icon: PackageCheck,
      iconColor: "text-[#1668D9]",
      labelColor: "text-[#1668D9]",
      activeBorder: "border-[#1668D9]",
      activeBg: "bg-[#EAF3FF]",
    },
    {
      key: "overdue" as PickupFilter,
      label: "Overdue",
      count: counts.overdue,
      icon: AlertTriangle,
      iconColor: "text-[#B91C1C]",
      labelColor: "text-[#B91C1C]",
      activeBorder: "border-[#DC2626]",
      activeBg: "bg-[#FDE8E8]",
    },
    {
      key: "collected" as PickupFilter,
      label: "Picked up",
      count: counts.collected,
      icon: CheckCircle2,
      iconColor: "text-slate-500",
      labelColor: "text-slate-600",
      activeBorder: "border-slate-400",
      activeBg: "bg-slate-50",
    },
    {
      key: "late" as PickupFilter,
      label: "Picked up late",
      count: counts.late,
      icon: Clock3,
      iconColor: "text-[#B91C1C]",
      labelColor: "text-[#B91C1C]",
      activeBorder: "border-[#DC2626]",
      activeBg: "bg-[#FDE8E8]",
    },
  ];

  const tableRows = useMemo(() => {
    let rows = [...pickupOrders];
    if (filter !== "all") {
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
      const aWaiting = isWaitingState(stateById.get(a.id));
      const bWaiting = isWaitingState(stateById.get(b.id));
      if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });
  }, [pickupOrders, filter, stateById, search, dateFrom, dateTo]);

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
    isWaitingState(stateById.get(order.id));

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
        <div className="flex flex-col space-y-6">
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

          {/* Summary cards - the same row the All Orders page opens with, and
              the cards themselves are the filter. */}
          <div className="grid grid-cols-2 @min-[720px]:grid-cols-3 @min-[840px]:grid-cols-5 gap-2 sm:gap-3 mb-4 shrink-0">
            {pickupCards.map((card) => (
              <SummaryCard
                key={card.key}
                label={card.label}
                value={card.count}
                icon={card.icon}
                iconColor={card.iconColor}
                labelColor={card.labelColor}
                active={filter === card.key}
                activeBorder={card.activeBorder}
                activeBg={card.activeBg}
                onClick={() =>
                  setFilter(filter === card.key ? "all" : card.key)
                }
              />
            ))}
          </div>

          {filter !== "all" && FILTER_NOTES[filter] && (
            <p className="text-xs text-slate-500">{FILTER_NOTES[filter]}</p>
          )}

          <Card className="p-4 border border-slate-100 shadow-sm mb-6 shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Search
                </Label>
                <div className="group relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                  <Input
                    aria-label="Search pickup orders"
                    placeholder="Search order or customer"
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
          </Card>

          <Card className="overflow-hidden">
            {hydrating && <TableSkeleton columns={6} rows={10} />}
            {!hydrating && (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider w-14">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                      <div className="flex flex-col leading-tight">
                        Customer
                        <span className="text-[10px] font-medium text-[#10316B]/60 normal-case tracking-normal">
                          Order ID
                        </span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                      Pickup Deadline
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14">
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
                    pageRows.map((order, index) => {
                      const payment = payFor(order);
                      const record = recordById.get(order.id);
                      const state = stateById.get(order.id) ?? "collected";
                      const isUnclaimed = !!record;
                      const status = rowStatus(state);
                      const deadline = deadlineFor(order);
                      const listPosition =
                        (currentPage - 1) * PAGE_SIZE + index + 1;
                      return (
                        <tr
                          key={order.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelected(order)}
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-[#10316B]">
                            {listPosition}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {order.customer}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {order.displayId ?? order.id}
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
                            {record ? (
                              <>
                                <div className="text-xs font-semibold text-red-700">
                                  {record.balance != null
                                    ? formatCurrency(record.balance)
                                    : "—"}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  Owed at deadline
                                </div>
                              </>
                            ) : payment.remaining > 0 ? (
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
                    <ChevronLeft className="h-4 w-4" /> Previous
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
                  {recordById.get(selected.id) ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-red-700">
                        {recordById.get(selected.id)!.balance != null
                          ? `${formatCurrency(
                              recordById.get(selected.id)!.balance!,
                            )} owed at deadline`
                          : "Owed at deadline"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Now {payFor(selected).status.toLowerCase()} · remaining{" "}
                        {formatCurrency(payFor(selected).remaining)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {payFor(selected).status}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Remaining {formatCurrency(payFor(selected).remaining)}
                      </p>
                    </>
                  )}
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
                      {recordById.get(selected.id)!.releasedAt
                        ? "Collected after this deadline — "
                        : "Not collected by this deadline — "}
                      {recordById.get(selected.id)!.balance != null
                        ? `${formatCurrency(
                            recordById.get(selected.id)!.balance!,
                          )} was still owed at that time.`
                        : "part of the total was still owed at that time."}
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
