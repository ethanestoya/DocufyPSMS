import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Users,
  FileText,
  UserPlus,
  Briefcase,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  Settings,
  CheckCircle,
  Calendar,
  ArrowUpRight,
  Info,
  Eye,
  ShoppingCart,
  BarChart3,
  DollarSign,
  Truck,
  Clock,
  ArrowRight,
  ChevronRight,
  Minus,
  AlertTriangle,
  Layers,
  Palette,
  Copy,
  Printer,
  ShoppingBag,
  MoreHorizontal,
  Plus,
  Pencil,
  CircleOff,
  StickyNote,
  Image,
  Sunrise,
  Sunset,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { SummaryCard } from "../ui/summary-card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { dataStore, Order } from "../../utils/dataStore";
import { adminMenuItems } from "../../utils/adminMenuItems";
import { inventoryStore, InventoryItem } from "../../utils/inventoryStore";
import { pricingStore } from "../../utils/pricingStore";
import ShopStatusControl from "../shared/ShopStatusControl";
import CreateNotificationCard from "../shared/CreateNotificationCard";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";

// ─── helpers ──────────────────────────────────────────────────────────────────
const TABS = ["Overview", "Sales", "Services"] as const;
type Tab = (typeof TABS)[number];

const DATE_RANGES = [
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "this-quarter", label: "This Quarter" },
  { id: "this-year", label: "This Year" },
  { id: "all-time", label: "All Time" },
  { id: "custom", label: "Custom Range" },
] as const;

function parseTotal(order: Order): number {
  if (order.costBreakdown && typeof order.costBreakdown.total === "number")
    return order.costBreakdown.total;
  if (!order.total) return 0;
  const cleaned = String(order.total).replace(/[₱,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number): string {
  if (n >= 1000000) return `₱${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `₱${(n / 1000).toFixed(1)}K`;
  return fmt(n);
}

function fmtShortPlain(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-PH");
}

const MONTH_INDEX = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Comparable value for "Mon DD" chart keys so daily/weekly trends sort oldest→newest.
function sortByMonthDay(a: string, b: string): number {
  const pa = /^(\w+) (\d+)/.exec(a);
  const pb = /^(\w+) (\d+)/.exec(b);
  if (!pa || !pb) return 0;
  const ka = MONTH_INDEX.indexOf(pa[1]) * 100 + Number(pa[2]);
  const kb = MONTH_INDEX.indexOf(pb[1]) * 100 + Number(pb[2]);
  return ka - kb;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = todayStart.getTime() - dDate.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const timeStr = d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  if (diffDays < 7) return `${diffDays}d ago, ${timeStr}`;
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${timeStr}`;
}

function getDateRange(id: string, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  let end: Date;
  let label: string;

  switch (id) {
    case "last-month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      start = new Date(ly, lm, 1);
      end = new Date(ly, lm + 1, 0, 23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      start = new Date(y, qStart, 1);
      end = new Date(y, qStart + 3, 0, 23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
    case "this-year":
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
      label = `Jan 1, ${y} – Dec 31, ${y}`;
      break;
    case "all-time":
      start = new Date(2020, 0, 1);
      end = new Date(9999, 11, 31, 23, 59, 59, 999);
      label = "All Time";
      break;
    case "custom": {
      const s = customStart ? new Date(customStart) : new Date(y, m, 1);
      const e = customEnd ? new Date(customEnd + "T23:59:59") : new Date();
      start = s;
      end = e;
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
    default: {
      // this-month
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
  }
  return { start, end, label };
}

function getPrevPeriod(range: { start: Date; end: Date }) {
  const ms = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - ms - 86400000),
    end: new Date(range.start.getTime() - 1),
  };
}

function ordersInRange(orders: Order[], range: { start: Date; end: Date }): Order[] {
  return orders.filter((o) => {
    const d = new Date(o.createdAt || o.date);
    return !isNaN(d.getTime()) && d >= range.start && d <= range.end;
  });
}

function totalSales(orders: Order[]): number {
  return orders.reduce((s, o) => s + (o.status !== "Canceled" ? parseTotal(o) : 0), 0);
}

const SERVICE_NAMES = ["Black & White Printing", "Colored Printing", "Photocopy", "School Supplies", "Others"] as const;

function deriveService(order: Order): string {
  const pt = (order.printType || "").toLowerCase();
  const cm = (order.colorMode || "").toLowerCase();
  if (cm === "bw" || pt.includes("bw") || pt.includes("black")) return "Black & White Printing";
  if (cm === "color" || pt.includes("color") || pt.includes("coloured")) return "Colored Printing";
  if (pt.includes("photocopy") || pt.includes("photo")) return "Photocopy";
  if (order.addons && order.addons.length > 0) return "School Supplies";
  return "Others";
}

// ─── types for metrics ────────────────────────────────────────────────────────
interface DashboardMetrics {
  totalSales: number;
  totalOrders: number;
  walkInCount: number;
  activeCustomers: number;
  prevTotalSales: number;
  prevTotalOrders: number;
  prevWalkInCount: number;
  prevActiveCustomers: number;
  salesTrend: { name: string; sales: number }[];
  serviceStats: { name: string; count: number; revenue: number }[];
  paperStats: { name: string; count: number; total: number }[];
  recentOrders: Order[];
  // sales tab
  dailySales: { name: string; sales: number }[];
  weeklySales: { name: string; sales: number }[];
  monthlySales: { name: string; sales: number }[];
  highestMonth: { name: string; sales: number } | null;
  lowestMonth: { name: string; sales: number } | null;
  todaySales: { morning: { sales: number; orders: number }; afternoon: { sales: number; orders: number } };
}

function computeMetrics(orders: Order[], dateRange: { start: Date; end: Date }): DashboardMetrics {
  const filtered = ordersInRange(orders, dateRange);
  const prevRange = getPrevPeriod(dateRange);
  const prevFiltered = ordersInRange(orders, prevRange);

  const tSales = totalSales(filtered);
  const tOrders = filtered.length;
  const walkIns = filtered.filter((o) => o.orderSource === "walkin").length;
  const customers = new Set(filtered.filter((o) => o.customerEmail).map((o) => o.customerEmail)).size;

  const prevTSales = totalSales(prevFiltered);
  const prevTOrders = prevFiltered.length;
  const prevWalkIns = prevFiltered.filter((o) => o.orderSource === "walkin").length;
  const prevCustomers = new Set(prevFiltered.filter((o) => o.customerEmail).map((o) => o.customerEmail)).size;

  // sales trend: monthly aggregation over all orders
  const monthMap = new Map<string, number>();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (const o of orders) {
    if (o.status === "Canceled") continue;
    const d = new Date(o.createdAt || o.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) || 0) + parseTotal(o));
  }
  const sortedKeys = [...monthMap.keys()].sort();
  const last12 = sortedKeys.slice(-12);
  const salesTrend = last12.map((k) => {
    const [yr, mo] = k.split("-").map(Number);
    return { name: `${monthNames[mo]} ${yr}`, sales: monthMap.get(k) || 0 };
  });

  // service stats (within date range)
  const svcMap = new Map<string, { count: number; revenue: number }>();
  for (const o of filtered) {
    if (o.status === "Canceled") continue;
    const svc = deriveService(o);
    const prev = svcMap.get(svc) || { count: 0, revenue: 0 };
    prev.count += 1;
    prev.revenue += parseTotal(o);
    svcMap.set(svc, prev);
  }
  const serviceStats = SERVICE_NAMES.map((n) => ({
    name: n,
    count: svcMap.get(n)?.count || 0,
    revenue: svcMap.get(n)?.revenue || 0,
  })).sort((a, b) => b.revenue - a.revenue);

  // paper stats
  const paperMap = new Map<string, number>();
  for (const o of filtered) {
    const ps = o.paperSize || "Unknown";
    paperMap.set(ps, (paperMap.get(ps) || 0) + 1);
  }
  const paperTotal = [...paperMap.values()].reduce((a, b) => a + b, 0);
  const paperStats = [...paperMap.entries()]
    .map(([name, count]) => ({ name, count, total: paperTotal }))
    .sort((a, b) => b.count - a.count);

  // recent orders
  const recentOrders = [...filtered].sort((a, b) => {
    const da = new Date(a.createdAt || a.date).getTime();
    const db = new Date(b.createdAt || b.date).getTime();
    return db - da;
  }).slice(0, 8);

  // today's sales split into morning (before 12 PM) and afternoon (12 PM on).
  // Computed over ALL orders (not range-scoped) so "Today" is always real.
  const nowD = new Date();
  const todayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate());
  const todayEnd = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + 1);
  const todaySales = { morning: { sales: 0, orders: 0 }, afternoon: { sales: 0, orders: 0 } };
  for (const o of orders) {
    if (o.status === "Canceled") continue;
    const d = new Date(o.createdAt || o.date);
    if (isNaN(d.getTime())) continue;
    if (d < todayStart || d >= todayEnd) continue;
    const period = d.getHours() < 12 ? "morning" : "afternoon";
    todaySales[period].sales += parseTotal(o);
    todaySales[period].orders += 1;
  }

  // daily sales (ALL orders, not range-scoped — mirrors the Monthly trend so
  // the Daily view shows full history regardless of the selected date range)
  const dailyMap = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "Canceled") continue;
    const d = new Date(o.createdAt || o.date);
    if (isNaN(d.getTime())) continue;
    const key = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    dailyMap.set(key, (dailyMap.get(key) || 0) + parseTotal(o));
  }
  const dailySales = [...dailyMap.entries()]
    .map(([name, sales]) => ({ name, sales }))
    .sort((a, b) => sortByMonthDay(a.name, b.name));

  // weekly aggregation (ALL orders)
  const weeklyMap = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "Canceled") continue;
    const d = new Date(o.createdAt || o.date);
    if (isNaN(d.getTime())) continue;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    weeklyMap.set(key, (weeklyMap.get(key) || 0) + parseTotal(o));
  }
  const weeklySales = [...weeklyMap.entries()]
    .map(([name, sales]) => ({ name, sales }))
    .sort((a, b) => sortByMonthDay(a.name, b.name));

  // monthly aggregation (ALL orders, not range-scoped — mirrors the Overview
  // Sales Trend so the Monthly view shows a real multi-month trend regardless
  // of the selected date range)
  const monthlyMap = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "Canceled") continue;
    const d = new Date(o.createdAt || o.date);
    if (isNaN(d.getTime())) continue;
    const key = d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + parseTotal(o));
  }
  const monthlySales = [...monthlyMap.entries()]
    .map(([name, sales]) => ({ name, sales }))
    .sort((a, b) => {
      const pa = /^(\w+) (\d{4})$/.exec(a.name);
      const pb = /^(\w+) (\d{4})$/.exec(b.name);
      if (!pa || !pb) return 0;
      const keyA = `${pa[2]}-${MONTH_INDEX.indexOf(pa[1])}`;
      const keyB = `${pb[2]}-${MONTH_INDEX.indexOf(pb[1])}`;
      return keyA.localeCompare(keyB);
    });

  // highest / lowest months
  const monthEntries = monthlySales.filter((m) => m.sales > 0);
  const highestMonth = monthEntries.length > 0 ? monthEntries.reduce((a, b) => (a.sales > b.sales ? a : b)) : null;
  const lowestMonth = monthEntries.length > 0 ? monthEntries.reduce((a, b) => (a.sales < b.sales ? a : b)) : null;

  return {
    totalSales: tSales,
    totalOrders: tOrders,
    walkInCount: walkIns,
    activeCustomers: customers,
    prevTotalSales: prevTSales,
    prevTotalOrders: prevTOrders,
    prevWalkInCount: prevWalkIns,
    prevActiveCustomers: prevCustomers,
    salesTrend,
    serviceStats,
    paperStats,
    recentOrders,
    dailySales,
    weeklySales,
    monthlySales,
    highestMonth,
    lowestMonth,
    todaySales,
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────
function TrendText({ trend, label }: { trend: number; label: string }) {
  const isUp = trend >= 0;
  return (
    <>
      <span className={`text-xs font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
        {isUp ? "↗" : "↘"} {Math.abs(trend).toFixed(1)}%
      </span>
      <span className="truncate">{label}</span>
    </>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  actionLabel,
  headerRight,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  subtitle?: string;
  action?: () => void;
  actionLabel?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={`bg-white shadow-sm border border-slate-100 ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight ? (
          <div className="flex items-center gap-2">{headerRight}</div>
        ) : action && actionLabel ? (
          <button onClick={action} className="text-xs font-semibold text-[#2F6FD6] hover:underline flex items-center gap-1">
            {actionLabel} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      <div className={`px-5 pb-4 ${bodyClassName}`}>{children}</div>
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      <Icon className="w-10 h-10 mb-3 text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

// ─── Inventory Snapshot ───────────────────────────────────────────────────────
function InventorySnapshot({ items, navigate, className = "", inventoryPath = "/admin/inventory" }: { items: InventoryItem[]; navigate: ReturnType<typeof useNavigate>; className?: string; inventoryPath?: string }) {
  const activeItems = items.filter((i) => !i.archived);
  const lowStockItems = activeItems.filter((i) => inventoryStore.getInventoryStatus(i) === "low");
  const outOfStockItems = activeItems.filter((i) => inventoryStore.getInventoryStatus(i) === "out");
  const urgentItems = [...outOfStockItems, ...lowStockItems].slice(0, 5);

  return (
    <SectionCard
      title="Inventory Snapshot"
      subtitle="Quick visibility into stock levels"
      action={() => navigate(inventoryPath)}
      actionLabel="View Inventory"
      className={`${className} flex flex-col`}
      bodyClassName="flex-1 flex flex-col"
    >
      <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
        <div className="p-2.5 bg-gray-50 rounded-lg">
          <p className="text-[10px] sm:text-xs font-medium text-slate-500">Total Items</p>
          <p className="text-lg sm:text-2xl font-bold text-[#2F6FD6] mt-0.5 sm:mt-1">{activeItems.length}</p>
        </div>
        <div className="p-2.5 bg-gray-50 rounded-lg">
          <p className="text-[10px] sm:text-xs font-medium text-slate-500">Low Stock</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-0.5 sm:mt-1">{lowStockItems.length}</p>
        </div>
        <div className="p-2.5 bg-gray-50 rounded-lg">
          <p className="text-[10px] sm:text-xs font-medium text-slate-500">Out of Stock</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600 mt-0.5 sm:mt-1">{outOfStockItems.length}</p>
        </div>
      </div>

      {urgentItems.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 text-green-700 rounded-md">
          <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
          <p className="text-xs font-medium">All inventory levels are currently healthy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Needs Attention</p>
          {urgentItems.map((item) => {
            const isOut = inventoryStore.getInventoryStatus(item) === "out";
            return (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${isOut ? "text-red-500" : "text-amber-500"}`} />
                  <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${isOut ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                  {isOut ? "Out of Stock" : "Low Stock"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Fills remaining row height without growing the card */}
      <div className="mt-3 min-h-0 flex-1 flex flex-col">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Current Stock Levels</p>
        {activeItems.length === 0 ? (
          <p className="text-xs text-slate-500">No inventory items yet.</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
            {activeItems.map((item) => {
              const status = inventoryStore.getInventoryStatus(item);
              const pieces = inventoryStore.getItemPieces(item);
              const isPaper = item.category === "Paper";
              const statusBadge =
                status === "out" ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Out of Stock</span>
                ) : status === "low" ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Low Stock</span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">In Stock</span>
                );
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 shrink-0 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-700">
                      {item.currentStock} {item.unit}
                      {isPaper && <span className="text-[10px] text-slate-500 font-medium ml-0.5">({pieces.toLocaleString()} pcs)</span>}
                    </span>
                    {statusBadge}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Date Range Selector (Overview) ───────────────────────────────────────────
interface DateRangeSelectorProps {
  selectedLabel: string;
  rangeId: string;
  onSelect: (id: string) => void;
  customStart: string;
  customEnd: string;
  onCustomStart: (v: string) => void;
  onCustomEnd: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

function DateRangeSelector({ selectedLabel, rangeId, onSelect, customStart, customEnd, onCustomStart, onCustomEnd, open, setOpen }: DateRangeSelectorProps) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/70 rounded-xl text-sm font-medium text-slate-700 hover:border-[#2F6FD6] transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <Calendar className="w-4 h-4 text-[#2F6FD6]" />
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range.id}
                onClick={() => { onSelect(range.id); if (range.id !== "custom") setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${rangeId === range.id ? "bg-blue-50 text-[#2F6FD6] font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {range.label}
              </button>
            ))}
            {rangeId === "custom" && (
              <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                <DateRangeFilter
                  value={{ from: customStart, to: customEnd }}
                  onChange={(next) => {
                    onCustomStart(next.from);
                    onCustomEnd(next.to);
                  }}
                  fromLabel="From"
                  toLabel="To"
                  compact
                />
                <button onClick={() => setOpen(false)} className="w-full py-1.5 bg-[#2F6FD6] text-white rounded-lg text-xs font-semibold hover:bg-[#1e5bb8]">Apply</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ metrics, navigate, items, role = "admin", dateSelector }: { metrics: DashboardMetrics; navigate: ReturnType<typeof useNavigate>; items: InventoryItem[]; role?: "admin" | "staff"; dateSelector?: React.ReactNode }) {
  const {
    totalSales, totalOrders, walkInCount, activeCustomers,
    prevTotalSales, prevTotalOrders, prevWalkInCount, prevActiveCustomers,
    recentOrders,
  } = metrics;

  const salesTrendPct = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const ordersTrendPct = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0;
  const walkInTrendPct = prevWalkInCount > 0 ? ((walkInCount - prevWalkInCount) / prevWalkInCount) * 100 : 0;
  const customerTrendPct = prevActiveCustomers > 0 ? ((activeCustomers - prevActiveCustomers) / prevActiveCustomers) * 100 : 0;

  const ordersPath = role === "staff" ? "/staff/queue" : "/admin/orders";
  const inventoryPath = role === "staff" ? "/staff/inventory" : "/admin/inventory";

  return (
    <div className="space-y-5">
      {/* Tab header */}
      {(role === "admin" || dateSelector) && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {role === "admin" && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Overview</h2>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:ml-auto">
          {role === "admin" && <CreateNotificationCard />}
          {dateSelector}
        </div>
      </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 @min-[1040px]:grid-cols-4">
        <SummaryCard
          icon={DollarSign}
          label="Total Sales"
          value={fmtShort(totalSales)}
          subtitle={<TrendText trend={salesTrendPct} label="vs previous period" />}
        />
        <SummaryCard
          icon={Package}
          label="Total Orders"
          value={totalOrders.toLocaleString()}
          subtitle={<TrendText trend={ordersTrendPct} label="vs previous period" />}
        />
        <SummaryCard
          icon={ShoppingCart}
          label="Walk-in Transactions"
          value={walkInCount.toLocaleString()}
          subtitle={<TrendText trend={walkInTrendPct} label="vs previous period" />}
        />
        <SummaryCard
          icon={Users}
          label="Active Customers"
          value={activeCustomers.toLocaleString()}
          subtitle={<TrendText trend={customerTrendPct} label="vs previous period" />}
        />
      </div>

      {/* Shop Status Control */}
      <ShopStatusControl />

      {/* Recent Transactions + Inventory Snapshot */}
      <div className="grid grid-cols-1 @min-[900px]:grid-cols-3 gap-4 sm:gap-5">
        <SectionCard
          title="Recent Transactions"
          action={() => navigate(ordersPath)}
          actionLabel="View All"
          className="flex flex-col"
          bodyClassName="flex-1 flex flex-col"
        >
          {recentOrders.length === 0 ? (
            <EmptyState icon={Clock} message="No transactions yet" />
          ) : (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-3 flex-1">
                {recentOrders.slice(0, 6).map((o) => {
                  const isPaid = o.status !== "Awaiting Payment" && o.status !== "Canceled";
                  const isWalkIn = o.orderSource === "walkin";
                  return (
                    <div key={o.id} className="flex items-center gap-3 py-2 px-2 rounded-lg bg-slate-50/80 flex-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{o.id}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isWalkIn ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-[#2F6FD6]"}`}>
                            {isWalkIn ? "Walk-in" : "Print Order"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{o.customerName || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900">{fmt(parseTotal(o))}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isPaid ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto flex items-center justify-between px-2 py-2 border-t border-slate-100">
                <p className="text-xs text-slate-500">Showing {Math.min(recentOrders.length, 6)} recent</p>
                <p className="text-xs font-semibold text-slate-700">
                  Total {fmt(recentOrders.slice(0, 6).reduce((s, o) => s + parseTotal(o), 0))}
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <InventorySnapshot items={items} navigate={navigate} className="lg:col-span-2" inventoryPath={inventoryPath} />
      </div>
    </div>
  );
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────
function SalesTab({ metrics, navigate }: { metrics: DashboardMetrics; navigate: ReturnType<typeof useNavigate> }) {
  const { totalSales, totalOrders, prevTotalSales, prevTotalOrders, recentOrders, dailySales, weeklySales, monthlySales, todaySales } = metrics;
  const [salesView, setSalesView] = useState<"daily" | "weekly" | "monthly">("monthly");

  const chartData = salesView === "daily" ? dailySales : salesView === "weekly" ? weeklySales : monthlySales;

  const revenueTrendPct = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const ordersTrendPct = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0;
  const aov = totalOrders > 0 ? totalSales / totalOrders : 0;
  const prevAov = prevTotalOrders > 0 ? prevTotalSales / prevTotalOrders : 0;
  const aovTrendPct = prevAov > 0 ? ((aov - prevAov) / prevAov) * 100 : 0;

  const salesComparisonPct = prevTotalSales > 0 ? (totalSales / prevTotalSales) * 100 : 0;
  const salesDiff = totalSales - prevTotalSales;

  const dailyTotal = todaySales.morning.sales + todaySales.afternoon.sales;
  const morningShare = dailyTotal > 0 ? (todaySales.morning.sales / dailyTotal) * 100 : 0;
  const afternoonShare = dailyTotal > 0 ? (todaySales.afternoon.sales / dailyTotal) * 100 : 0;

  const recentSales = recentOrders.filter((o) => o.status !== "Canceled").slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Sales</h2>
        <p className="text-sm text-slate-500 mt-1">Sales performance and revenue overview.</p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 @min-[1040px]:grid-cols-4">
        <SummaryCard
          icon={DollarSign}
          label="Total Revenue"
          value={fmt(totalSales)}
          subtitle={<TrendText trend={revenueTrendPct} label="vs previous period" />}
        />
        <SummaryCard
          icon={Package}
          label="Total Orders"
          value={totalOrders.toLocaleString()}
          subtitle={<TrendText trend={ordersTrendPct} label="vs previous period" />}
        />
        <SummaryCard
          icon={ShoppingCart}
          label="Average Order Value"
          value={fmt(aov)}
          subtitle={<TrendText trend={aovTrendPct} label="vs previous period" />}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Sales Growth"
          value={`${revenueTrendPct >= 0 ? "+" : ""}${revenueTrendPct.toFixed(1)}%`}
          valueColor={revenueTrendPct >= 0 ? "text-green-600" : "text-red-500"}
          subtitle="vs previous period"
        />
      </div>

      {/* Sales Trend (wider) + Today's Sales */}
      <div className="grid grid-cols-1 @min-[900px]:grid-cols-3 gap-4 sm:gap-5">
        <SectionCard
          title="Sales Trend"
          subtitle="Revenue performance over time"
          className="lg:col-span-2"
          headerRight={
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              {(["daily", "weekly", "monthly"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSalesView(v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    salesView === v
                      ? "bg-white text-[#2F6FD6] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          }
        >
          {chartData.length === 0 ? (
            <EmptyState icon={TrendingUp} message="No sales data for this period" />
          ) : (
            <div className="h-52 lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2F6FD6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2F6FD6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} tickFormatter={(v: number) => fmtShortPlain(v)} />
                  <Tooltip formatter={(v: number) => [fmt(v), "Sales"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="sales" stroke="#2F6FD6" strokeWidth={2} fill="url(#salesGrad2)" dot={{ r: 3.5, fill: "#2F6FD6", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Today's Sales — Morning vs Afternoon */}
        <SectionCard title="Today's Sales" subtitle="Morning vs afternoon breakdown for today">
          {dailyTotal === 0 ? (
            <EmptyState icon={Sunrise} message="No sales recorded yet today" />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-sky-100/60 border border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-white text-[#2F6FD6] flex items-center justify-center shadow-sm">
                    <Sunrise className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Morning</p>
                    <p className="text-[11px] text-slate-500">Before 12:00 PM</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3">{fmt(todaySales.morning.sales)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{todaySales.morning.orders} {todaySales.morning.orders === 1 ? "order" : "orders"} · {morningShare.toFixed(0)}% of today</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100/60 border border-amber-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-white text-amber-600 flex items-center justify-center shadow-sm">
                    <Sunset className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Afternoon</p>
                    <p className="text-[11px] text-slate-500">12:00 PM onwards</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3">{fmt(todaySales.afternoon.sales)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{todaySales.afternoon.orders} {todaySales.afternoon.orders === 1 ? "order" : "orders"} · {afternoonShare.toFixed(0)}% of today</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 shrink-0">Morning</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#2F6FD6] transition-all" style={{ width: `${morningShare}%` }} />
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${afternoonShare}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-500 shrink-0">Afternoon</span>
              </div>
              <p className="text-xs text-slate-500">Total for today: <span className="font-semibold text-slate-700">{fmt(dailyTotal)}</span></p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Bottom: Sales Comparison + Recent Sales */}
      <div className="grid grid-cols-1 @min-[820px]:grid-cols-2 gap-4 sm:gap-5">
        {/* Sales Comparison */}
        <SectionCard title="Sales Comparison" subtitle="Current vs previous period">
          {totalSales === 0 && prevTotalSales === 0 ? (
            <EmptyState icon={BarChart3} message="No sales data available for comparison." />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-4">
                <div className="sm:flex-1">
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase sm:normal-case tracking-wide">This Period</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-lg sm:text-2xl font-bold text-slate-900">{fmtShort(totalSales)}</p>
                    {prevTotalSales > 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${revenueTrendPct >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {revenueTrendPct >= 0 ? "↗" : "↘"} {Math.abs(revenueTrendPct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="sm:flex-1">
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase sm:normal-case tracking-wide">Previous Period</p>
                  <p className="text-lg sm:text-2xl font-bold text-slate-500 mt-0.5">{fmtShort(prevTotalSales)}</p>
                </div>
              </div>
              {prevTotalSales > 0 && (
                <div className="w-full bg-slate-100 rounded-full h-2 sm:h-3 overflow-hidden">
                  <div className="bg-[#2F6FD6] h-full rounded-full transition-all" style={{ width: `${Math.min(salesComparisonPct, 100)}%` }} />
                </div>
              )}
              {salesDiff !== 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {salesDiff > 0
                    ? <>You earned <span className="font-semibold text-green-600">{fmt(salesDiff)}</span> more than the previous period.</>
                    : <>You earned <span className="font-semibold text-red-500">{fmt(Math.abs(salesDiff))}</span> less than the previous period.</>
                  }
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Recent Sales */}
        <SectionCard
          title="Recent Sales"
          subtitle="Latest sales in the selected period"
          action={() => navigate("/admin/orders")}
          actionLabel="View All"
        >
          {recentSales.length === 0 ? (
            <EmptyState icon={Clock} message="No sales in this period" />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Order</th>
                    <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Customer</th>
                    <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hidden md:table-cell">Service</th>
                    <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hidden md:table-cell">Payment</th>
                    <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden xl:table-cell">Date</th>
                    <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((o) => {
                    const method = o.paymentMethod || (o.orderSource === "walkin" ? "Cash" : "GCash");
                    return (
                      <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{o.id}</td>
                        <td className="py-2 px-3 text-slate-600 hidden sm:table-cell truncate max-w-[120px]">{o.customerName || "—"}</td>
                        <td className="py-2 px-3 text-slate-600 hidden md:table-cell whitespace-nowrap">{deriveService(o)}</td>
                        <td className="py-2 px-3 text-slate-600 hidden md:table-cell whitespace-nowrap">{method}</td>
                        <td className="py-2 px-3 text-slate-500 lg:hidden xl:table-cell whitespace-nowrap">{formatRelativeTime(o.createdAt || o.date)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">{fmt(parseTotal(o))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────
const SERVICES_RANGES = [
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "this-quarter", label: "This Quarter" },
  { id: "this-year", label: "This Year" },
  { id: "all-time", label: "All Time" },
] as const;
type ServicesRangeId = (typeof SERVICES_RANGES)[number]["id"];

const DONUT_COLORS = ["#1668D9", "#2F6FD6", "#7FB0F0", "#A8CBF5", "#D6E7FB"];

function serviceIcon(name: string, className = "w-4 h-4") {
  const n = name.toLowerCase();
  if (n.includes("color") || n.includes("vellum")) return <Palette className={className} />;
  if (n.includes("black")) return <FileText className={className} />;
  if (n.includes("sticker")) return <StickyNote className={className} />;
  if (n.includes("photo")) return <Image className={className} />;
  if (n.includes("school")) return <ShoppingBag className={className} />;
  if (n.includes("photocopy")) return <Copy className={className} />;
  return <Printer className={className} />;
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  );
}

// Read-only service catalog reflecting the REAL pricing store (no invented CRUD).
function buildServiceCatalog() {
  const matrix = pricingStore.getMatrix();
  const docText = matrix.document.text;
  const bwPrice = docText.bw.a4;
  const colorPrice = docText.full.a4;
  const vellumPrice = matrix.vellum.full.a4;
  const stickerPrice = matrix.sticker.full;
  const photoPrice = matrix.photo["4R"].price;
  return [
    {
      name: "Colored Printing",
      description: "High-quality color printing for documents and images.",
      priceLabel: `₱${colorPrice}.00 / page`,
      icon: <Palette className="w-4 h-4" />,
    },
    {
      name: "Black & White Printing",
      description: "Standard black and white printing.",
      priceLabel: `₱${bwPrice}.00 / page`,
      icon: <FileText className="w-4 h-4" />,
    },
    {
      name: "Vellum Printing",
      description: "Vellum paper printing for image-only designs.",
      priceLabel: `₱${vellumPrice}.00 / page`,
      icon: <Layers className="w-4 h-4" />,
    },
    {
      name: "Sticker Printing",
      description: "A4 sticker paper printing per sheet.",
      priceLabel: `₱${stickerPrice}.00 / sheet`,
      icon: <StickyNote className="w-4 h-4" />,
    },
    {
      name: "Photo Printing",
      description: "Clear and crisp photo printing in multiple sizes.",
      priceLabel: `₱${photoPrice}.00 / photo`,
      icon: <Image className="w-4 h-4" />,
    },
  ];
}

function ServicesTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [rangeId, setRangeId] = useState<ServicesRangeId>("this-month");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [orders, setOrders] = useState(dataStore.getOrders());

  useEffect(() => {
    const unsub = dataStore.subscribe(() => setOrders(dataStore.getOrders()));
    return () => unsub();
  }, []);

  const range = useMemo(() => getDateRange(rangeId), [rangeId]);

  // Service performance within the selected period (real derived order data).
  const serviceStats = useMemo(() => {
    const rangeOrders = ordersInRange(orders, range);
    const map = new Map<string, { count: number; revenue: number }>();
    for (const o of rangeOrders) {
      if (o.status === "Canceled") continue;
      const name = deriveService(o);
      const prev = map.get(name) || { count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += parseTotal(o);
      map.set(name, prev);
    }
    return SERVICE_NAMES.map((n) => ({
      name: n,
      count: map.get(n)?.count || 0,
      revenue: map.get(n)?.revenue || 0,
    }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [orders, range]);

  const totalOrders = serviceStats.reduce((s, x) => s + x.count, 0);
  const totalRevenue = serviceStats.reduce((s, x) => s + x.revenue, 0);
  const mostUsed = serviceStats.length > 0 ? serviceStats[0] : null;
  const topRevenue =
    serviceStats.length > 0
      ? [...serviceStats].sort((a, b) => b.revenue - a.revenue)[0]
      : null;
  const donutData = serviceStats.map((s) => ({ name: s.name, value: s.revenue }));
  const rangeLabel = SERVICES_RANGES.find((r) => r.id === rangeId)?.label || "This Month";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2F6FD6] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Services</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">Manage your services and track their performance.</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#2F6FD6] transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <Calendar className="w-4 h-4 text-[#2F6FD6]" />
            <span>{rangeLabel}</span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                {SERVICES_RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setRangeId(r.id); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${rangeId === r.id ? "bg-blue-50 text-[#2F6FD6] font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 @min-[1100px]:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Services"
          value={serviceStats.length}
          icon={Layers}
          subtitle="Active services"
        />
        <SummaryCard
          label="Most Used Service"
          value={mostUsed ? mostUsed.name : "—"}
          icon={Printer}
          subtitle={
            mostUsed
              ? `${totalOrders > 0 ? Math.round((mostUsed.count / totalOrders) * 100) : 0}% of total orders`
              : "No orders yet"
          }
        />
        <SummaryCard
          label="Top Revenue Service"
          value={topRevenue ? topRevenue.name : "—"}
          icon={TrendingUp}
          subtitle={topRevenue ? `${fmt(topRevenue.revenue)} revenue` : "No revenue yet"}
        />
        <SummaryCard
          label="Inactive Services"
          value={0}
          icon={CircleOff}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
          subtitle="Currently unavailable"
        />
      </div>

      {/* Service Performance + Revenue by Service */}
      <div className="grid grid-cols-1 @min-[900px]:grid-cols-3 gap-4">
        {/* Service Performance */}
        <Card className="lg:col-span-2 bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Service Performance</h3>
              <p className="text-xs text-slate-500 mt-0.5">Overview of your services for the selected period.</p>
            </div>
          </div>
          <div className="px-5 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    {["Service", "Orders", "Revenue", "Usage", "Status", "Actions"].map((h) => (
                      <th key={h} className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serviceStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center text-slate-500">
                          <Printer className="w-9 h-9 mb-2 text-slate-300" />
                          <p className="text-sm font-medium text-slate-500">No service activity in this period.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    serviceStats.map((s) => {
                      const pct = totalOrders > 0 ? (s.count / totalOrders) * 100 : 0;
                      return (
                        <tr key={s.name} className="group hover:bg-slate-50/70">
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2F6FD6] flex items-center justify-center shrink-0">
                                {serviceIcon(s.name)}
                              </div>
                              <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">{s.count}</td>
                          <td className="py-3 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">{fmt(s.revenue)}</td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2 min-w-[110px]">
                              <div className="w-[70px] h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                <div className="h-full bg-[#2F6FD6] rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <StatusBadge label="Active" />
                          </td>
                          <td className="py-3 pr-1 text-right">
                            <button
                              onClick={() => navigate("/admin/pricing")}
                              title={`Manage ${s.name} pricing`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#2F6FD6] hover:bg-blue-50 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Showing {serviceStats.length} services</p>
            <button
              onClick={() => navigate("/admin/pricing")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2F6FD6] hover:underline"
            >
              View detailed report <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>

        {/* Revenue by Service */}
        <Card className="lg:col-span-1 bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Revenue by Service</h3>
              <p className="text-xs text-slate-500 mt-0.5">Contribution to total revenue.</p>
            </div>
          </div>
          <div className="px-5 pb-4 flex-1 flex flex-col">
            {totalRevenue === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-8">
                <BarChart3 className="w-9 h-9 text-slate-300" />
                <p className="text-sm font-medium text-slate-500 mt-2">No revenue data yet.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div className="relative w-44 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={82}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number | string) => [fmt(Number(value) || 0), "Revenue"]}
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(15,23,42,0.08)", fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-xl font-semibold text-slate-900">{fmt(totalRevenue)}</p>
                      <p className="text-[11px] font-medium text-slate-500">Total Revenue</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  {serviceStats.map((s, i) => {
                    const pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
                    return (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-600 truncate">{s.name}</span>
                            <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">{fmt(s.revenue)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{pct.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-auto pt-5 flex justify-end">
                  <button
                    onClick={() => navigate("/admin/pricing")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2F6FD6] hover:underline"
                  >
                    View detailed report <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Manage Services */}
      <Card className="bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Manage Services</h3>
            <p className="text-xs text-slate-500 mt-0.5">Add, edit, or update your services, pricing, and availability.</p>
          </div>
          <button
            onClick={() => navigate("/admin/pricing")}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-white border-2 border-blue-200 text-sm font-semibold text-[#1668D9] hover:bg-[#1668D9] hover:text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>
        <div className="px-5 pb-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                {["Service", "Description", "Price", "Status", "Actions"].map((h) => (
                  <th key={h} className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buildServiceCatalog().map((s) => (
                <tr key={s.name} className="group hover:bg-slate-50/70">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2F6FD6] flex items-center justify-center shrink-0">
                        {s.icon}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-sm text-slate-500 max-w-[260px]">{s.description}</td>
                  <td className="py-3 pr-3 text-sm font-medium text-slate-700 whitespace-nowrap">{s.priceLabel}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    <StatusBadge label="Active" />
                  </td>
                  <td className="py-3 pr-1">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate("/admin/pricing")}
                        title={`Edit ${s.name}`}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-[#2F6FD6] hover:text-[#2F6FD6] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => navigate("/admin/pricing")}
                        title="More options"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#2F6FD6] hover:bg-blue-50 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface AdminDashboardProps {
  menuItems?: any[];
  role?: "admin" | "staff";
  userName?: string;
}

export default function AdminDashboard({
  menuItems = adminMenuItems,
  role = "admin",
  userName,
}: AdminDashboardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [dateRangeId, setDateRangeId] = useState("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [orders, setOrders] = useState(dataStore.getOrders());
  const [inventoryItems, setInventoryItems] = useState(inventoryStore.getActiveItems());

  const dateRange = useMemo(() => getDateRange(dateRangeId, customStart, customEnd), [dateRangeId, customStart, customEnd]);

  useEffect(() => {
    const unsubOrders = dataStore.subscribe(() => setOrders(dataStore.getOrders()));
    const unsubInv = inventoryStore.subscribe(() => setInventoryItems(inventoryStore.getActiveItems()));
    return () => { unsubOrders(); unsubInv(); };
  }, []);

  const metrics = useMemo(() => computeMetrics(orders, dateRange), [orders, dateRange]);

  const selectedRangeLabel = DATE_RANGES.find((r) => r.id === dateRangeId)?.label || "This Month";

  const overviewDateSelector = (
    <DateRangeSelector
      selectedLabel={selectedRangeLabel}
      rangeId={dateRangeId}
      onSelect={setDateRangeId}
      customStart={customStart}
      customEnd={customEnd}
      onCustomStart={setCustomStart}
      onCustomEnd={setCustomEnd}
      open={dateDropdownOpen}
      setOpen={setDateDropdownOpen}
    />
  );

  return (
    <Layout menuItems={menuItems} title={role === "admin" ? "Admin Dashboard" : "Staff Dashboard"}>
      <div className="space-y-5 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
            <p className="text-sm text-slate-500 mt-1">Welcome back, {userName || "admin"}! Here's what's happening with Docufy today.</p>
          </div>
          {role === "staff" && overviewDateSelector}
        </div>

        {/* Tabs (admin only — staff get a single Overview page) */}
        {role === "admin" && (
        <div className="border-b border-slate-200">
          <div className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? "border-[#2F6FD6] text-[#2F6FD6]" : "border-transparent text-slate-500 hover:text-slate-600"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Tab content */}
        {role === "admin" ? (
          <>
            {activeTab === "Overview" && <OverviewTab metrics={metrics} navigate={navigate} items={inventoryItems} dateSelector={overviewDateSelector} />}
            {activeTab === "Sales" && <SalesTab metrics={metrics} navigate={navigate} />}
            {activeTab === "Services" && <ServicesTab navigate={navigate} />}
          </>
        ) : (
          <OverviewTab metrics={metrics} navigate={navigate} items={inventoryItems} role="staff" />
        )}
      </div>
    </Layout>
  );
}
