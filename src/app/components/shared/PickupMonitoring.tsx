// PREVIEW PAGE — "Pickup Monitoring".
//
// Dedicated Admin/Staff workspace for tracking orders through the pickup phase:
// ready for pickup, still within the (proposed) pickup window, and orders that
// need review because they are overdue / flagged. It intentionally does NOT
// duplicate the All Orders queue — the queue stays focused on normal order
// management (status updates, payment, invoicing); this page owns pickup
// tracking and the flag / note / decision workflow.
//
// Everything here is a DESIGN PREVIEW built on the in-memory preview store
// (utils/pickupReview.ts). Nothing is persisted, enforced, notified, or written
// to a real customer record. No order is ever auto-marked overdue: because the
// collection window is pending policy approval, "Overdue for Pickup" stays at
// zero and "Needs Review" is driven only by staff/Admin flags.
//
// Roles: Admin makes every final decision (Confirm / Excuse / arrangement /
// Remove Restriction). Staff may monitor, flag overdue orders, and add notes
// for Admin — the final-decision controls are Admin-only (enforced inside
// OrderPickupReview).

import React, { useEffect, useMemo, useState } from "react";
import {
  PackageCheck,
  PackageX,
  Clock,
  Search,
  Eye,
  Flag,
  AlertTriangle,
  ClipboardList,
  Lock,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { ordersStore } from "../../utils/ordersStore";
import { withDemoOrders, seedDemoIncidentsOnce } from "../../utils/pickupReviewDemoSeed";
import { useAuth } from "../../contexts/AuthContext";
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
import OrderPickupReview from "./OrderPickupReview";
import {
  pickupReview,
  type PickupIncident,
} from "../../utils/pickupReview";

type OrderRow = ReturnType<typeof ordersStore.getOrders>[number];

interface PickupMonitoringProps {
  menuItems: Array<{ label: string; path: string; icon: React.ReactNode }>;
  userRole: "admin" | "staff";
}

// Pickup-phase state derived per order. "needs_review" is the only "overdue"
// signal available while the pickup deadline policy is undecided — it is set
// manually by staff/Admin (never computed from a guessed deadline).
type PickupState =
  | "ready"
  | "awaiting_release"
  | "needs_review"
  | "confirmed"
  | "excused";

type PickupFilter = "all" | PickupState;

const PICKUP_STATE_LABELS: Record<PickupState, string> = {
  ready: "Ready for Pickup",
  awaiting_release: "Awaiting Release",
  needs_review: "Needs Review",
  confirmed: "Confirmed Unclaimed",
  excused: "Excused",
};

const PICKUP_FILTERS: { key: PickupFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "awaiting_release", label: "Awaiting Release" },
  { key: "needs_review", label: "Needs Review" },
  { key: "confirmed", label: "Confirmed Unclaimed" },
];

const STATUS_LABELS: Record<string, string> = {
  inQueue: "In Queue",
  printing: "Printing",
  completed: "Completed",
  released: "Ready for Pickup",
  canceled: "Canceled",
  awaitingPayment: "Awaiting Payment",
};

const statusLabel = (status: string) =>
  STATUS_LABELS[status] ?? STATUS_LABELS[status?.toLowerCase()] ?? status;

function pickupStateClasses(state: PickupState): string {
  switch (state) {
    case "ready":
      return "bg-[#EAF3FF] text-[#1D73EC] border-[#1D73EC]/30";
    case "needs_review":
      return "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40";
    case "confirmed":
      return "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40";
    case "excused":
      return "bg-[#E0F7F5] text-[#0F766E] border-[#159A9C]/40";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function paymentBadgeClasses(status: string): string {
  if (status === "Paid")
    return "bg-[#E8F7D8] text-[#3B7A1E] border-[#55A630]/40";
  if (status === "Partially Paid")
    return "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40";
  return "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40";
}

// Pickup-deadline cell states. Kept deliberately short and scannable so the
// table never carries policy prose — the full explanation lives in the order
// details view (OrderPickupReview).
type PickupDeadlineInfo =
  | { kind: "configured"; at: Date }
  | { kind: "pending" }
  | { kind: "unset" };

// Read a configured pickup deadline if the order ever carries one. No pickup
// deadline field or shop policy exists yet — the collection window is still
// awaiting client approval — so this stays null today and no date or time is
// ever invented.
function readConfiguredPickupDeadline(order: OrderRow): Date | null {
  const raw = (order as Record<string, unknown>).pickupDeadline;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// Resolve the Pickup Deadline cell to one of three honest states:
//   • configured — the actual deadline date + time (when one is set)
//   • pending    — a deadline rule applies but is awaiting policy approval
//   • unset      — no pickup window has been defined for the order
// Cash-on-pickup / unpaid orders have a proposed same-day window whose cutoff
// is pending approval; fully-paid orders have no pickup window configured yet.
function pickupDeadlineInfo(
  order: OrderRow,
  hasOutstandingBalance: boolean,
): PickupDeadlineInfo {
  const configured = readConfiguredPickupDeadline(order);
  if (configured) return { kind: "configured", at: configured };
  if (hasOutstandingBalance) return { kind: "pending" };
  return { kind: "unset" };
}

export default function PickupMonitoring({
  menuItems,
  userRole,
}: PickupMonitoringProps) {
  const { user } = useAuth();
  const myName = user?.name || "Staff";
  const isAdmin = userRole === "admin";

  const [orders, setOrders] = useState<OrderRow[]>(() => {
    const next = ordersStore.getOrders();
    seedDemoIncidentsOnce(next);
    return withDemoOrders(next);
  });
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<PickupFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = ordersStore.getOrders();
      seedDemoIncidentsOnce(next);
      setOrders(withDemoOrders(next));
    };
    sync();
    const unsubOrders = ordersStore.subscribe(sync);
    const unsubReview = pickupReview.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubOrders();
      unsubReview();
    };
  }, []);

  const payFor = (order: OrderRow) =>
    computeOrderPayment(order, order.manualTotal ?? 0);

  const pickupStateOf = (order: OrderRow): PickupState => {
    const incident = pickupReview.getIncident(order.id);
    const status = incident?.status ?? "not_reviewed";
    if (status === "confirmed_unclaimed") return "confirmed";
    if (status === "excused") return "excused";
    if (status === "pending_review" || incident?.flaggedForReview)
      return "needs_review";
    return order.status?.toLowerCase() === "released"
      ? "ready"
      : "awaiting_release";
  };

  // Orders relevant to pickup: anything already released or completed, plus any
  // order that carries a preview incident (flagged / pending / confirmed).
  const pickupOrders = useMemo<OrderRow[]>(() => {
    void tick;
    return orders.filter((o) => {
      const status = o.status?.toLowerCase();
      const hasIncident = !!pickupReview.getIncident(o.id);
      return status === "released" || status === "completed" || hasIncident;
    });
  }, [orders, tick]);

  const stateById = useMemo(() => {
    const map = new Map<string, PickupState>();
    pickupOrders.forEach((o) => map.set(o.id, pickupStateOf(o)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupOrders, tick]);

  const counts = useMemo(() => {
    let ready = 0;
    let awaitingRelease = 0;
    let needsReview = 0;
    let confirmed = 0;
    pickupOrders.forEach((o) => {
      const s = stateById.get(o.id);
      if (s === "ready") ready += 1;
      else if (s === "awaiting_release") awaitingRelease += 1;
      else if (s === "needs_review") needsReview += 1;
      else if (s === "confirmed") confirmed += 1;
    });
    return { ready, awaitingRelease, needsReview, confirmed };
  }, [pickupOrders, stateById]);

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
      const aReady =
        stateById.get(a.id) === "ready" || stateById.get(a.id) === "needs_review";
      const bReady =
        stateById.get(b.id) === "ready" || stateById.get(b.id) === "needs_review";
      if (aReady !== bReady) return aReady ? -1 : 1;
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });
  }, [pickupOrders, filter, stateById, search, dateFrom, dateTo]);

  const handleFlag = (order: OrderRow) => {
    pickupReview.setIncident(order.id, {
      customerKey: order.customerEmail || order.customer,
      status: "pending_review",
      flaggedForReview: true,
      flaggedBy: myName,
    });
    toast.info("Flagged for review (preview).", {
      description:
        "Order moved to Pending Review. Only Admin can make the final decision.",
    });
  };

  const readyFor = (order: OrderRow) =>
    order.status?.toLowerCase() === "released" ? order.statusUpdatedAt : undefined;

  return (
    <Layout menuItems={menuItems} title="Pickup Monitoring" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-5">
          {/* Intro + preview badge */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-2xl text-sm text-slate-500">
              Track orders that are ready for pickup, still within their pickup
              window, or overdue and needing review.
            </p>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1D73EC] ring-1 ring-[#1D73EC]/20">
              <AlertTriangle className="h-3 w-3" />
              Preview workflow
            </span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Ready for Pickup"
              value={counts.ready}
              icon={PackageCheck}
              iconBg="bg-[#EAF3FF]"
              iconColor="text-[#1D73EC]"
              active={filter === "ready"}
              onClick={() =>
                setFilter((f) => (f === "ready" ? "all" : "ready"))
              }
            />
            <SummaryCard
              label="Overdue for Pickup"
              value={0}
              icon={CalendarClock}
              iconBg="bg-[#FFF5D6]"
              iconColor="text-[#B45309]"
              subtitle="Pickup deadline not configured yet"
            />
            <SummaryCard
              label="Needs Review"
              value={counts.needsReview}
              icon={Flag}
              iconBg="bg-[#FFF5D6]"
              iconColor="text-[#B45309]"
              active={filter === "needs_review"}
              onClick={() =>
                setFilter((f) => (f === "needs_review" ? "all" : "needs_review"))
              }
            />
            <SummaryCard
              label="Awaiting Release"
              value={counts.awaitingRelease}
              icon={Clock}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
              active={filter === "awaiting_release"}
              onClick={() =>
                setFilter((f) =>
                  f === "awaiting_release" ? "all" : "awaiting_release",
                )
              }
            />
          </div>

          {/* Filters */}
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

          {/* Table */}
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
                            Orders appear here once they are completed or marked
                            ready for pickup. Overdue tracking activates after the
                            pickup window policy is approved.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((order) => {
                      const payment = payFor(order);
                      const state = stateById.get(order.id) ?? "awaiting_release";
                      const readyAt = readyFor(order);
                      const deadline = pickupDeadlineInfo(
                        order,
                        payment.remaining > 0,
                      );
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
                                Not yet ready
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {deadline.kind === "configured" ? (
                              <span className="text-xs text-gray-700">
                                {formatPHDateTime(deadline.at)}
                              </span>
                            ) : deadline.kind === "pending" ? (
                              <span className="text-xs text-gray-500">
                                Pending approval
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                Not configured
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {state !== "needs_review" &&
                                state !== "confirmed" &&
                                state !== "excused" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlag(order);
                                    }}
                                    className="h-8 bg-white text-amber-700 border-2 border-amber-200 hover:bg-amber-600 hover:text-white"
                                  >
                                    <Flag className="h-3.5 w-3.5 mr-1.5" />
                                    Flag
                                  </Button>
                                )}
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
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {!isAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="h-3.5 w-3.5" />
              Staff can monitor pickups, flag orders, and add notes. Final
              incident decisions are made by Admin.
            </p>
          )}

          <p className="text-xs text-gray-400">
            <strong>Design preview.</strong>{" "}
            {isAdmin
              ? "Pickup deadlines, valid excuses, and penalty rules are still awaiting client approval."
              : "Pickup deadlines and penalty rules are still awaiting client approval."}{" "}
            Nothing on this page applies a real penalty, restriction, or
            notification, and no order is auto-marked overdue.
          </p>
        </div>
      </StaffTimeInGate>

      {/* Order details + pickup review */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto p-[26px]">
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

              <OrderPickupReview
                order={selected}
                fallbackTotal={selected.manualTotal ?? 0}
                reviewerName={myName}
                role={userRole}
                customerKey={selected.customerEmail || selected.customer}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
