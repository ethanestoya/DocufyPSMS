// PREVIEW PAGE — "Unclaimed Orders".
//
// Dedicated Admin/Staff workspace for reviewing pickup incidents: orders flagged
// or waiting on a decision (Pending Review), customer explanations awaiting an
// Admin decision (Excuse Requests), confirmed unclaimed orders, and the
// resulting per-customer advance-payment restrictions.
//
// Like the rest of the penalty workflow preview, everything here reads/writes
// the IN-MEMORY preview store (utils/pickupReview.ts). No penalty, restriction,
// notification, or database write ever happens — the controls are presentational
// so the client can review the design before the policy is approved.
//
// Roles: Admin makes every final decision (Confirm / Excuse / arrangement /
// Remove Restriction). Staff can view and flag/annotate, but the final-decision
// controls are Admin-only (enforced inside OrderPickupReview).

import React, { useEffect, useMemo, useState } from "react";
import {
  PackageX,
  Clock,
  MessageSquare,
  ShieldAlert,
  Search,
  Eye,
  Lock,
  Trash2,
  AlertTriangle,
  ClipboardList,
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
import { Textarea } from "../ui/textarea";
import { SummaryCard } from "../ui/summary-card";
import { DateRangeFilter } from "../ui/date-range-filter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { formatPHDate, formatPHTime, formatPHDateTime } from "../../utils/pht";
import { formatCurrency } from "../../utils/formatNumber";
import { getStatusBadgeClasses } from "../../utils/orderStatusPalette";
import { computeOrderPayment } from "./OrderPaymentSummary";
import OrderPickupReview from "./OrderPickupReview";
import {
  pickupReview,
  INCIDENT_STATUS_LABELS,
  PAYMENT_ARRANGEMENT_LABELS,
  type IncidentReviewStatus,
  type PickupIncident,
} from "../../utils/pickupReview";

type OrderRow = ReturnType<typeof ordersStore.getOrders>[number];

interface UnclaimedOrdersProps {
  menuItems: Array<{ label: string; path: string; icon: React.ReactNode }>;
  userRole: "admin" | "staff";
}

type ReviewTab = "pending" | "excuse" | "confirmed" | "restrictions";

interface JoinedIncident {
  order: OrderRow;
  incident: PickupIncident;
}

const TAB_LABELS: Record<ReviewTab, string> = {
  pending: "Pending Review",
  excuse: "Excuse Requests",
  confirmed: "Confirmed Unclaimed",
  restrictions: "Customer Restrictions",
};

const STATUS_LABELS: Record<string, string> = {
  inQueue: "In Queue",
  printing: "Printing",
  completed: "Completed",
  released: "Ready for Pickup",
  canceled: "Canceled",
  awaitingPayment: "Awaiting Payment",
};

const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;

function incidentBadgeClasses(status: IncidentReviewStatus): string {
  switch (status) {
    case "confirmed_unclaimed":
      return "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40";
    case "pending_review":
      return "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40";
    case "excused":
      return "bg-[#E0F7F5] text-[#0F766E] border-[#159A9C]/40";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export default function UnclaimedOrders({
  menuItems,
  userRole,
}: UnclaimedOrdersProps) {
  const { user } = useAuth();
  const myName = user?.name || "Staff";
  const isAdmin = userRole === "admin";

  const [orders, setOrders] = useState<OrderRow[]>(() => {
    const next = ordersStore.getOrders();
    seedDemoIncidentsOnce(next);
    return withDemoOrders(next);
  });
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<ReviewTab>("pending");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selected, setSelected] = useState<JoinedIncident | null>(null);
  const [restrictionKey, setRestrictionKey] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState("");

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

  const ordersById = useMemo(() => {
    const map = new Map<string, OrderRow>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  // Live preview incidents joined to their orders. `tick` is a dependency so a
  // review action taken here (or in Order Details) recomputes immediately.
  const joined = useMemo<JoinedIncident[]>(() => {
    void tick;
    return pickupReview
      .getAllIncidents()
      .map((incident) => {
        const order = ordersById.get(incident.orderId);
        return order ? { order, incident } : null;
      })
      .filter((row): row is JoinedIncident => row !== null);
  }, [ordersById, tick]);

  const pendingRows = useMemo(
    () => joined.filter((r) => r.incident.status === "pending_review"),
    [joined],
  );
  const excuseRows = useMemo(
    () =>
      joined.filter(
        (r) =>
          !!r.incident.customerExplanation &&
          r.incident.status !== "confirmed_unclaimed" &&
          r.incident.status !== "excused",
      ),
    [joined],
  );
  const confirmedRows = useMemo(
    () => joined.filter((r) => r.incident.status === "confirmed_unclaimed"),
    [joined],
  );

  const restrictionRows = useMemo(() => {
    void tick;
    return pickupReview
      .getAllRestrictions()
      .filter((entry) => entry.restriction.active)
      .map((entry) => {
        const match = joined.find(
          (r) =>
            (r.incident.customerKey ||
              r.order.customerEmail ||
              r.order.customer) === entry.customerKey,
        );
        return {
          ...entry,
          name: match?.order.customer,
          email: match?.order.customerEmail,
          confirmedCount: pickupReview.getConfirmedCount(entry.customerKey),
        };
      });
  }, [joined, tick]);

  const applyFilters = (rows: JoinedIncident[]): JoinedIncident[] => {
    let filtered = [...rows].sort(
      (a, b) => b.order.submittedAt.getTime() - a.order.submittedAt.getTime(),
    );
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((r) =>
        `${r.order.customer} ${r.order.displayId ?? r.order.id} ${
          r.order.customerEmail ?? ""
        }`
          .toLowerCase()
          .includes(q),
      );
    }
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`).getTime();
      filtered = filtered.filter(
        (r) => r.order.submittedAt.getTime() >= from,
      );
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`).getTime();
      filtered = filtered.filter((r) => r.order.submittedAt.getTime() <= to);
    }
    return filtered;
  };

  const tabCounts: Record<ReviewTab, number> = {
    pending: pendingRows.length,
    excuse: excuseRows.length,
    confirmed: confirmedRows.length,
    restrictions: restrictionRows.length,
  };

  const tableRows =
    tab === "pending"
      ? applyFilters(pendingRows)
      : tab === "excuse"
        ? applyFilters(excuseRows)
        : tab === "confirmed"
          ? applyFilters(confirmedRows)
          : [];

  const selectedRestriction = restrictionKey
    ? pickupReview.getRestriction(restrictionKey)
    : null;

  const handleRemoveRestriction = () => {
    if (!restrictionKey) return;
    pickupReview.setRestriction(restrictionKey, {
      active: false,
      arrangement: selectedRestriction?.arrangement ?? null,
      reason:
        removeReason.trim() || "Restriction removed after payment settlement",
      updatedBy: myName,
    });
    toast.info("Restriction removed (preview).", {
      description: "Previous incidents stay in the history. Nothing was saved.",
    });
    setRemoveOpen(false);
    setRemoveReason("");
    setRestrictionKey(null);
  };

  const emptyCopy: Record<ReviewTab, { title: string; body: string }> = {
    pending: {
      title: "No incidents pending review",
      body: "Orders flagged for review from Order Details will appear here for an Admin decision.",
    },
    excuse: {
      title: "No excuse requests",
      body: "Customer explanations submitted from Order Tracking will appear here for review.",
    },
    confirmed: {
      title: "No confirmed unclaimed orders",
      body: "Orders Admin has confirmed as unclaimed will be listed here.",
    },
    restrictions: {
      title: "No active customer restrictions",
      body: "When a second unclaimed order is confirmed and Admin sets an advance-payment arrangement, the restriction will show here.",
    },
  };

  return (
    <Layout menuItems={menuItems} title="Unclaimed Orders" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-5">
          {/* Intro + preview badge */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-2xl text-sm text-slate-500">
              Review overdue and unclaimed pickup orders, decide on customer
              excuse requests, and manage payment restrictions.
            </p>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1D73EC] ring-1 ring-[#1D73EC]/20">
              <AlertTriangle className="h-3 w-3" />
              Preview workflow
            </span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Overdue for Pickup"
              value={0}
              icon={Clock}
              iconBg="bg-[#FFF5D6]"
              iconColor="text-[#B45309]"
              subtitle="Pickup deadline not configured yet"
            />
            <SummaryCard
              label="Excuse Requests"
              value={excuseRows.length}
              icon={MessageSquare}
              iconBg="bg-[#FFF5D6]"
              iconColor="text-[#B45309]"
              active={tab === "excuse"}
              onClick={() => setTab("excuse")}
            />
            <SummaryCard
              label="Confirmed Unclaimed"
              value={confirmedRows.length}
              icon={PackageX}
              iconBg="bg-[#FDE8E8]"
              iconColor="text-[#B91C1C]"
              active={tab === "confirmed"}
              onClick={() => setTab("confirmed")}
            />
          </div>

          {/* Tabs */}
          <Card className="p-3 border border-slate-100 shadow-sm shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(TAB_LABELS) as ReviewTab[]).map((key) => {
                const active = tab === key;
                return (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTab(key)}
                    className={
                      active
                        ? "h-8 rounded-lg border-2 border-[#2F6FD6] bg-[#2F6FD6] text-white hover:bg-[#2557b8] hover:text-white"
                        : "h-8 rounded-lg border border-gray-200 bg-white text-slate-600 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6]"
                    }
                  >
                    {TAB_LABELS[key]}
                    <span
                      className={`ml-1.5 rounded-full px-1.5 text-[11px] font-semibold ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tabCounts[key]}
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Incidents appear here after they are flagged or reviewed from an
              order&apos;s details. Pickup deadlines, valid excuses, and the
              restriction duration are still pending client approval.
            </p>
          </Card>

          {/* Filters */}
          <Card className="p-4 border border-slate-100 shadow-sm shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Search
                </Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    aria-label="Search unclaimed orders"
                    placeholder="Search customer or order ID..."
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
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              {tab === "restrictions" ? (
                <table className="w-full">
                  <thead className="bg-[#F2F7FF] border-b border-[#1D73EC]/10">
                    <tr>
                      {[
                        "Customer",
                        "Confirmed Orders",
                        "Restriction",
                        "Reason",
                        "Updated",
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
                    {restrictionRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-14">
                          <div className="flex flex-col items-center text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1D73EC] ring-1 ring-[#1D73EC]/15">
                              <ShieldAlert className="h-6 w-6" />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-gray-800">
                              {emptyCopy.restrictions.title}
                            </p>
                            <p className="mt-1 max-w-md text-xs text-gray-500">
                              {emptyCopy.restrictions.body}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      restrictionRows.map((row) => (
                        <tr
                          key={row.customerKey}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setRestrictionKey(row.customerKey)}
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {row.name || row.customerKey}
                            </div>
                            <div className="text-xs text-gray-500">
                              {row.email || row.customerKey}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40"
                            >
                              {row.confirmedCount} confirmed
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {row.restriction.arrangement ? (
                              <span className="text-sm font-medium text-amber-700">
                                {PAYMENT_ARRANGEMENT_LABELS[
                                  row.restriction.arrangement
                                ]}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">
                                None set
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[16rem]">
                            <span className="text-sm text-gray-600">
                              {row.restriction.reason || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500">
                              {row.restriction.updatedAt
                                ? formatPHDateTime(row.restriction.updatedAt)
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRestrictionKey(row.customerKey);
                              }}
                              className="h-8 bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead className="bg-[#F2F7FF] border-b border-[#1D73EC]/10">
                    <tr>
                      {[
                        "Customer",
                        "Order Status",
                        "Incident Status",
                        "Payment & Balance",
                        "Last Update",
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
                        <td colSpan={6} className="px-4 py-14">
                          <div className="flex flex-col items-center text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1D73EC] ring-1 ring-[#1D73EC]/15">
                              <ClipboardList className="h-6 w-6" />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-gray-800">
                              {emptyCopy[tab].title}
                            </p>
                            <p className="mt-1 max-w-md text-xs text-gray-500">
                              {emptyCopy[tab].body}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      tableRows.map(({ order, incident }) => {
                        const payment = computeOrderPayment(
                          order,
                          order.manualTotal ?? 0,
                        );
                        const status: IncidentReviewStatus =
                          incident.status ?? "not_reviewed";
                        const updated = incident.reviewedAt
                          ? new Date(incident.reviewedAt)
                          : order.statusUpdatedAt ?? order.submittedAt;
                        return (
                          <tr
                            key={order.id}
                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setSelected({ order, incident })}
                          >
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">
                                {order.customer}
                              </div>
                              <div className="font-mono text-xs text-gray-500">
                                {order.displayId ?? order.id}
                              </div>
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
                                className={`text-xs font-semibold ${incidentBadgeClasses(
                                  status,
                                )}`}
                              >
                                {INCIDENT_STATUS_LABELS[status]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
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
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-gray-500">
                                {order.statusUpdatedAt
                                  ? formatPHDate(order.statusUpdatedAt)
                                  : formatPHDate(order.submittedAt)}
                              </div>
                              <div className="text-xs text-gray-400">
                                {order.statusUpdatedAt
                                  ? formatPHTime(order.statusUpdatedAt)
                                  : formatPHTime(order.submittedAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected({ order, incident });
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
              )}
            </div>
          </Card>

          {!isAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="h-3.5 w-3.5" />
              Final incident decisions are made by Admin. Staff can flag orders
              and add notes for review.
            </p>
          )}

          <p className="text-xs text-gray-400">
            <strong>Design preview.</strong> The pickup window, valid excuses,
            and penalty/advance-payment rules are still awaiting client
            approval, so nothing on this page applies a real penalty,
            restriction, or notification.
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
                        {selected.order.customer}
                      </DialogTitle>
                      <span className="font-mono text-sm text-gray-500">
                        {selected.order.displayId ?? selected.order.id}
                      </span>
                    </div>
                    <DialogDescription className="mt-1 text-sm text-gray-500">
                      Submitted on {formatPHDate(selected.order.submittedAt)} ·{" "}
                      {formatPHTime(selected.order.submittedAt)}
                    </DialogDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${getStatusBadgeClasses(
                      selected.order.status,
                    )}`}
                  >
                    {statusLabel(selected.order.status)}
                  </Badge>
                </div>
              </DialogHeader>

              <OrderPickupReview
                order={selected.order}
                fallbackTotal={selected.order.manualTotal ?? 0}
                reviewerName={myName}
                role={userRole}
                customerKey={
                  selected.order.customerEmail || selected.order.customer
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Restriction detail + remove (Admin only) */}
      <Dialog
        open={!!restrictionKey && !removeOpen}
        onOpenChange={(open) => {
          if (!open) setRestrictionKey(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              Customer Restriction
            </DialogTitle>
            <DialogDescription>
              Advance-payment arrangement applied after repeated confirmed
              unclaimed orders (preview). Duration and removal rules are pending
              client approval.
            </DialogDescription>
          </DialogHeader>
          {selectedRestriction && (
            <div className="space-y-3 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs font-semibold bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40"
                >
                  {selectedRestriction.active ? "Active" : "Removed"}
                </Badge>
                {selectedRestriction.arrangement && (
                  <span className="text-sm font-medium text-amber-700">
                    {PAYMENT_ARRANGEMENT_LABELS[
                      selectedRestriction.arrangement
                    ]}
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                {selectedRestriction.reason || "No reason recorded."}
              </div>
              <p className="text-xs text-gray-500">
                {selectedRestriction.updatedAt
                  ? `Updated ${
                      selectedRestriction.updatedBy
                        ? `${selectedRestriction.updatedBy} · `
                        : ""
                    }${formatPHDateTime(selectedRestriction.updatedAt)}`
                  : ""}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRestrictionKey(null)}
              className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
            >
              Close
            </Button>
            {isAdmin && selectedRestriction?.active && (
              <Button
                onClick={() => setRemoveOpen(true)}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Remove Restriction
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove restriction confirm (Admin only, reason required) */}
      <Dialog
        open={removeOpen}
        onOpenChange={(open) => {
          setRemoveOpen(open);
          if (!open) setRemoveReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <DialogTitle className="text-xl text-[#10316B]">
                Remove Restriction?
              </DialogTitle>
            </div>
            <DialogDescription>
              The proposed policy requires the outstanding payment to be settled
              first. Previous incidents stay in the history after removal. Only
              Admin may remove a restriction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="urRemoveReason">Reason *</Label>
            <Textarea
              id="urRemoveReason"
              rows={2}
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="e.g. Outstanding balance settled in full at the shop."
            />
          </div>
          <div className="rounded-lg border border-[#1D73EC]/20 bg-[#F2F7FF] p-3 text-sm text-[#10316B]">
            Preview only — real customer eligibility is unchanged.
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoveOpen(false)}
              className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
            >
              Go Back
            </Button>
            <Button
              onClick={handleRemoveRestriction}
              disabled={!removeReason.trim()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Remove Restriction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
