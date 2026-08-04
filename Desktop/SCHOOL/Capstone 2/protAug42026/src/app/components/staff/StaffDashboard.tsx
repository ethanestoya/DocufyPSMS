import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  LayoutGrid,
  ShoppingCart,
  Package,
  Clock,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Boxes,
  LogIn,
  LogOut,
  FileText,
  Printer,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
// ── Single source of truth: ordersStore only (same store used by Orders page) ──
import { ordersStore } from "../../utils/ordersStore";
import type { OrderType } from "../../utils/ordersStore";
import AttendanceWidget from "../AttendanceWidget";
import { useAuth } from "../../contexts/AuthContext";

const menuItems = [
  {
    label: "Dashboard",
    path: "/staff/dashboard",
    icon: <LayoutGrid className="w-5 h-5" />,
  },
  {
    label: "Orders",
    path: "/staff/queue",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Walk-in Transactions",
    path: "/staff/walk-in",
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: "Payment Verification",
    path: "/staff/payment-verification",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: "Inventory",
    path: "/staff/inventory",
    icon: <Boxes className="w-5 h-5" />,
  },
];

// Avatar — identical to StaffQueueBoard
const Avatar = ({ name }: { name: string }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-cyan-100 text-cyan-700",
  ];

  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm ${colors[colorIndex]}`}
    >
      {initials}
    </div>
  );
};

// Status badge classes — identical to StaffQueueBoard
const getStatusBadgeClass = (status: OrderType["status"]) => {
  switch (status) {
    case "completed":  return "bg-white border-2 border-blue-200 text-blue-700";
    case "printing":   return "bg-white border-2 border-blue-200 text-blue-700";
    case "inQueue":    return "bg-white border-2 border-blue-200 text-blue-800";
    case "received":   return "bg-purple-50 text-purple-700 border-purple-200";
    case "onHold":     return "bg-orange-50 text-orange-700 border-orange-200";
    case "released":   return "bg-gray-50 text-gray-700 border-gray-200";
    case "canceled":   return "bg-white border-2 border-blue-200 text-red-500";
    default:           return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

// Status label — identical to StaffQueueBoard
const getStatusLabel = (status: OrderType["status"]) => {
  if (status === "inQueue") return "In Queue";
  if (status === "onHold")  return "On Hold";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Status icon — mirrors summary cards in StaffQueueBoard
const getStatusIcon = (status: string) => {
  switch (status) {
    case "received": return <FileText className="w-3.5 h-3.5 text-purple-600" />;
    case "inQueue":  return <Clock    className="w-3.5 h-3.5 text-blue-600"   />;
    case "printing": return <Printer  className="w-3.5 h-3.5 text-blue-600"   />;
    case "onHold":   return <AlertCircle className="w-3.5 h-3.5 text-orange-600" />;
    default:         return null;
  }
};

// Human-readable "time ago"
const timeAgo = (date?: Date): string => {
  if (!date) return "—";
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
};

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Single reactive state — ordersStore is the ONLY source of truth ──────
  const [allOrders, setAllOrders] = useState<OrderType[]>(() => ordersStore.getOrders());

  // Subscribe to ordersStore only — same store as the Orders page
  useEffect(() => {
    // Ensure we have the latest on mount
    setAllOrders(ordersStore.getOrders());

    const unsubscribe = ordersStore.subscribe(() => {
      setAllOrders(ordersStore.getOrders());
    });
    return unsubscribe;
  }, []);

  // ── KPI stats — computed directly from ordersStore (camelCase statuses) ──
  // These are guaranteed to match the Orders page counts exactly.
  const stats = useMemo(() => {
    const received  = allOrders.filter(o => o.status === "received").length;
    const inQueue   = allOrders.filter(o => o.status === "inQueue").length;
    const printing  = allOrders.filter(o => o.status === "printing").length;
    const completed = allOrders.filter(o => o.status === "completed").length;
    const released  = allOrders.filter(o => o.status === "released").length;
    const onHold    = allOrders.filter(o => o.status === "onHold").length;

    // inProgress = received + inQueue + printing  (matches "In Progress" KPI)
    const inProgress = received + inQueue + printing;
    // allCompleted = completed + released  (matches "Completed" KPI)
    const allCompleted = completed + released;
    // total = onHold + inProgress + allCompleted  (always equals sum of the 3 status KPIs)
    const total = onHold + inProgress + allCompleted;

    return { total, received, inQueue, printing, completed, released, onHold, inProgress, allCompleted };
  }, [allOrders]);

  // ── Active Orders table ───────────────────────────────────────────────────
  // Sorted NEWEST-FIRST by statusUpdatedAt (mirrors the Orders page sort).
  // Shows only non-finished, non-canceled orders (received/inQueue/printing/onHold).
  // Capped at 6 rows as a "top-of-queue" preview.
  const activeOrders = useMemo(() => {
    return [...allOrders]
      .sort((a, b) => {
        // Match Orders page: sort by statusUpdatedAt desc, fall back to submittedAt
        const aTime = (a.statusUpdatedAt ?? a.submittedAt).getTime();
        const bTime = (b.statusUpdatedAt ?? b.submittedAt).getTime();
        return bTime - aTime; // newest first
      })
      .filter(
        (o) =>
          o.status === "received" ||
          o.status === "inQueue"  ||
          o.status === "printing" ||
          o.status === "onHold"
      )
      .slice(0, 6);
  }, [allOrders]);

  return (
    <Layout menuItems={menuItems} title="Staff Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">

        {/* MAIN DASHBOARD CONTENT (Left) */}
        <div className="lg:col-span-9 space-y-6">

          <div className="mb-2">
            <h1 className="text-2xl font-bold text-slate-800">
              Welcome back, {user?.name?.split(' ')[0] || 'Staff'}!
            </h1>
            <p className="text-sm text-slate-500 font-medium">Operations overview for today</p>
          </div>

          {/* ── KPI Cards — all values from ordersStore ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                id: "kpi-tot",
                label: "Total Orders",
                // total = onHold + inProgress + allCompleted ← matches the 3 cards below
                val: stats.total,
                icon: Package,
                click: () => navigate("/staff/queue"),
                desc: `${stats.onHold} on hold · ${stats.inProgress} in progress`,
              },
              {
                id: "kpi-hld",
                label: "On Hold",
                val: stats.onHold,
                icon: AlertCircle,
                click: () => navigate("/staff/queue"),
                desc: "Needs action",
              },
              {
                id: "kpi-prg",
                label: "In Progress",
                // received + inQueue + printing
                val: stats.inProgress,
                icon: TrendingUp,
                click: () => navigate("/staff/queue"),
                desc: `${stats.printing} printing · ${stats.inQueue} queued`,
              },
              {
                id: "kpi-com",
                label: "Completed",
                // completed + released
                val: stats.allCompleted,
                icon: CheckCircle,
                click: () => navigate("/staff/queue"),
                desc: `${stats.released} released`,
              },
            ].map((kpi) => (
              <Card
                key={kpi.id}
                className="p-5 bg-white border border-slate-100 shadow-sm cursor-pointer hover:bg-[#2F6FD6] hover:text-white transition-all group"
                onClick={kpi.click}
              >
                <div className="flex justify-between items-start">
                  <p className="text-base font-bold text-slate-700 group-hover:text-white">
                    {kpi.label}
                  </p>
                  <kpi.icon className="w-5 h-5 text-[#2F6FD6] group-hover:text-white opacity-40" />
                </div>
                <p className="text-3xl font-bold text-slate-900 group-hover:text-white mt-2">
                  {kpi.val}
                </p>
                <p className="text-[11px] text-slate-400 group-hover:text-blue-100 font-medium uppercase mt-1">
                  {kpi.desc}
                </p>
              </Card>
            ))}
          </div>

          {/* ── Active Orders — real-time mirror of the Orders page ── */}
          <Card className="overflow-hidden border border-slate-100 shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Active Orders</h3>
                <p className="text-[10px] text-[#1D73EC] font-bold uppercase mt-0.5 tracking-widest">
                  Newest updates first · Live from Orders page
                </p>
              </div>

              {/* Mini status pills — counts derived from ordersStore (same as Orders page) */}
              <div className="hidden md:flex items-center gap-2 mr-4">
                {[
                  { key: "received", label: "Received", bg: "bg-purple-100", text: "text-purple-700", count: stats.received },
                  { key: "inQueue",  label: "In Queue", bg: "bg-amber-100",  text: "text-blue-800",   count: stats.inQueue  },
                  { key: "printing", label: "Printing", bg: "bg-blue-100",   text: "text-blue-700",   count: stats.printing },
                  { key: "onHold",   label: "On Hold",  bg: "bg-orange-100", text: "text-orange-700", count: stats.onHold   },
                ].map((pill) => (
                  <span
                    key={pill.key}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pill.bg} ${pill.text}`}
                  >
                    {getStatusIcon(pill.key)}
                    {pill.label}
                    <span className="ml-0.5 font-bold">{pill.count}</span>
                  </span>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() => navigate("/staff/queue")}
                className="text-xs font-bold border-[#1D73EC] text-[#1D73EC] hover:bg-[#1D73EC] hover:text-white cursor-pointer shrink-0"
              >
                View Full Queue
              </Button>
            </div>

            {/* Table — mirrors structure, columns, and badge classes of StaffQueueBoard */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Color Type</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {activeOrders.length > 0 ? (
                    activeOrders.map((order, index) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100"
                        onClick={() => navigate("/staff/queue")}
                      >
                        {/* Position — blue circle */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-[#1D73EC] text-white flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                        </td>

                        {/* Customer with Avatar */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Avatar name={order.customer} />
                            <div>
                              <p className="font-semibold text-sm text-[#1c1f26]">{order.customer}</p>
                              {order.notes && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <AlertCircle className="w-3 h-3 text-orange-500" />
                                  Has notes
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Order ID */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{order.id}</span>
                        </td>

                        {/* Color Type */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs font-medium border-gray-200 bg-gray-50">
                            {order.type}
                          </Badge>
                        </td>

                        {/* Status — same badge classes as StaffQueueBoard */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium capitalize border ${getStatusBadgeClass(order.status)}`}
                          >
                            {getStatusLabel(order.status)}
                          </Badge>
                        </td>

                        {/* Source — same badge classes as StaffQueueBoard */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${
                              order.orderSource === "online"
                                ? "bg-white border-2 border-blue-200 text-blue-700"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            }`}
                          >
                            {order.orderSource === "online" ? "Online" : "Walk-in"}
                          </Badge>
                        </td>

                        {/* Last Updated — mirrors Orders page "Last Updated" column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs text-gray-500 font-medium">
                            {timeAgo(order.statusUpdatedAt ?? order.submittedAt)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                          <Package className="w-10 h-10 mb-3 opacity-40" />
                          <p className="text-sm font-medium">No active orders</p>
                          <p className="text-xs mt-1">All caught up!</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            {activeOrders.length > 0 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">
                  Showing {activeOrders.length} most recently updated active order{activeOrders.length > 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => navigate("/staff/queue")}
                  className="text-xs font-bold text-[#1D73EC] hover:underline"
                >
                  See all {stats.received + stats.inQueue + stats.printing + stats.onHold} active →
                </button>
              </div>
            )}
          </Card>

          {/* Bottom Row: Staff Reminders & Shop Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-[#1D73EC] text-white shadow-lg border-none">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-3 tracking-tight">Shop Hours</h4>
                  <div className="space-y-2 text-sm text-white/95">
                    <p><strong>Mon-Fri:</strong> 8:00 AM - 6:00 PM</p>
                    <p><strong>Saturday:</strong> 9:00 AM - 4:00 PM</p>
                    <p><strong>Sunday:</strong> Closed</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[#1D73EC] text-white shadow-lg border-none">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-3 tracking-tight">Staff Reminders</h4>
                  <div className="space-y-2 text-sm text-white/95">
                    <p>• Check urgent orders first</p>
                    <p>• Update status after each stage</p>
                    <p>• Notify customers when ready</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* SIDEBAR CONTENT (Right) */}
        <div className="lg:col-span-3 flex flex-col pt-[68px]">
          {/* Attendance Section */}
          <div className="mb-6">
            <AttendanceWidget />
          </div>

          {/* Quick Actions Section */}
          <Card className="p-6 bg-white border border-slate-100 shadow-sm flex-1 flex flex-col">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-3 h-full justify-between">
              {[
                { id: "qa-que", label: "Manage Queue",    icon: LayoutGrid,  path: "/staff/queue" },
                { id: "qa-wal", label: "Walk-in Order",   icon: ShoppingCart, path: "/staff/walk-in" },
                { id: "qa-inv", label: "Check Inventory", icon: Boxes,        path: "/staff/inventory" },
                { id: "qa-pay", label: "Verify Payments", icon: CreditCard,   path: "/staff/payment-verification" },
              ].map((action) => (
                <button
                  key={action.id}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 border border-transparent rounded-xl hover:bg-[#2F6FD6] hover:text-white transition-all text-left group cursor-pointer"
                >
                  <div className="p-2 bg-white rounded-lg group-hover:bg-blue-500 transition-colors">
                    <action.icon className="w-5 h-5 text-[#2F6FD6] group-hover:text-white" />
                  </div>
                  <span className="font-bold text-sm text-slate-800 group-hover:text-white">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}