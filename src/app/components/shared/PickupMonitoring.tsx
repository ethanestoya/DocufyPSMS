// "Pickup Monitoring" — Admin/Staff workspace for tracking orders through the
// pickup phase (ready for pickup, overdue for pickup, collected) and the
// automatically DERIVED unclaimed-order records.
//
// There is no manual review workflow here: an order counts as unclaimed only
// when the real order + status-history timeline proves it reached Completed and
// was not collected by the shop's configured closing time. The page is
// display-only (view an order's details); nothing is enforced or written.

import React, { useEffect, useMemo, useState } from "react";
import {
  PackageCheck,
  Clock,
  Search,
  Eye,
  AlertTriangle,
  ClipboardList,
  CalendarClock,
  PackageX,
} from "lucide-react";
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

const PICKUP_STATE_LABELS: Record<PickupState, string> = {
  ready: "Ready for Pickup",
  overdue: "Overdue for Pickup",
  collected: "Picked Up",
};

const PICKUP_FILTERS: { key: PickupFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "overdue", label: "Overdue for Pickup" },
  { key: "collected", label: "Picked Up" },
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

function pickupStateClasses(state: PickupState): string {
  switch (state) {
    case "ready":
      return "bg-[#EAF3FF] text-[#1D73EC] border-[#1D73EC]/30";
    case "overdue":
      return "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
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
  userRole,
}: PickupMonitoringProps) {
  const closingTime = useShopClosingTime();

  const [orders, setOrders] = useState<OrderRow[]>(() => ordersStore.getOrders());
  const [filter, setFilter] = useState<PickupFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);

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

  return (
    <Layout menuItems={menuItems} title="Pickup Monitoring" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-5">
          <p className="max-w-2xl text-sm text-slate-500">
            Track orders that are ready for pickup, overdue for pickup, or already
            collected. Overdue status is computed automatically from each order's
            status history and the shop's configured closing time.
          </p>

          {!isClosingTimeConfigured(closingTime) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <span>
                Pickup deadlines cannot be computed yet — set the shop closing time
                in Admin → Landing Page → Shop Information to start tracking
                overdue and unclaimed orders.
              </span>
            </div>
          )}

          {historyUnavailable && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              <span>
                Unclaimed-order information is unavailable right now — some order
                status history could not be read.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Ready for Pickup"
              value={counts.ready}
              icon={PackageCheck}
              iconBg="bg-[#EAF3FF]"
              iconColor="text-[#1D73EC]"
              active={filter === "ready"}
              onClick={() => setFilter((f) => (f === "ready" ? "all" : "ready"))}
            />
            <SummaryCard
              label="Overdue for Pickup"
              value={counts.overdue}
              icon={CalendarClock}
              iconBg="bg-[#FDE8E8]"
              iconColor="text-[#B91C1C]"
              active={filter === "overdue"}
              onClick={() =>
                setFilter((f) => (f === "overdue" ? "all" : "overdue"))
              }
            />
            <SummaryCard
              label="Picked Up"
              value={counts.collected}
              icon={Clock}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
              active={filter === "collected"}
              onClick={() =>
                setFilter((f) => (f === "collected" ? "all" : "collected"))
              }
            />
            <SummaryCard
              label="Unclaimed Orders"
              value={counts.unclaimed}
              icon={PackageX}
              iconBg="bg-[#FDE8E8]"
              iconColor="text-[#B91C1C]"
              active={filter === "unclaimed"}
              onClick={() =>
                setFilter((f) => (f === "unclaimed" ? "all" : "unclaimed"))
              }
            />
          </div>

          <Card className="p-4 border border-slate-100 shadow-sm shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Search
                  </Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      aria-label="Search pickup orders"
                      placeholder="Search order ID or customer..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 bg-[#FBFDFF] border-gray-200 shadow-sm ring-1 ring-blue-300 rounded-lg"
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
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Pickup Status
                </span>
                {PICKUP_FILTERS.map(({ key, label }) => {
                  const active = filter === key;
                  return (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setFilter(key)}
                      className={
                        active
                          ? "h-8 rounded-lg border-2 border-[#2F6FD6] bg-[#2F6FD6] text-white hover:bg-[#2557b8] hover:text-white"
                          : "h-8 rounded-lg border border-gray-200 bg-white text-slate-600 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6]"
                      }
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F7FF] border-b border-[#1D73EC]/10">
                  <tr>
                    {[
                      "Order ID",
                      "Customer",
                      "Order Status",
                      "Payment Status",
                      "Pickup Status",
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
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14">
                        <div className="flex flex-col items-center text-center">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1D73EC] ring-1 ring-[#1D73EC]/15">
                            <ClipboardList className="h-6 w-6" />
                          </span>
                          <p className="mt-3 text-sm font-semibold text-gray-800">
                            No pickup orders to show
                          </p>
                          <p className="mt-1 max-w-md text-xs text-gray-500">
                            Orders appear here once they are completed or released.
                            Overdue and unclaimed orders are tracked automatically
                            once the shop closing time is configured.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((order) => {
                      const payment = payFor(order);
                      const state = stateById.get(order.id) ?? "collected";
                      const readyAt = readyAtFor(order);
                      const deadline = deadlineFor(order);
                      const isUnclaimed = recordById.has(order.id);
                      return (
                        <tr
                          key={order.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelected(order)}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-gray-700">
                              {order.displayId ?? order.id}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {order.customer}
                            </div>
                            {order.customerEmail && (
                              <div className="text-xs text-gray-500">
                                {order.customerEmail}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${getStatusBadgeClasses(
                                order.status,
                              )}`}
                            >
                              {statusLabel(order.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${paymentBadgeClasses(
                                payment.status,
                              )}`}
                            >
                              {payment.status}
                            </Badge>
                            {payment.remaining > 0 && (
                              <div className="mt-1 text-xs text-amber-700">
                                Balance {formatCurrency(payment.remaining)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${pickupStateClasses(
                                state,
                              )}`}
                            >
                              {PICKUP_STATE_LABELS[state]}
                            </Badge>
                            {isUnclaimed && state === "collected" && (
                              <div className="mt-1 text-xs text-red-700">
                                Collected after deadline
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {readyAt ? (
                              <>
                                <div className="text-xs text-gray-700">
                                  {formatPHDate(readyAt)}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {formatPHTime(readyAt)}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {state === "collected" ? "—" : "Not available"}
                              </span>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(order);
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
    </Layout>
  );
}
