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
  ShoppingCart,
  BarChart3,
  DollarSign,
  Truck,
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
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { CardSkeleton, DetailSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { DateRangeFilter } from "../ui/date-range-filter";
import { SummaryCard } from "../ui/summary-card";
import {
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
// Sales used to be a third tab, but it led with its own four KPI cards and
// repeated figures Overview already showed. Its two charts live on Overview
// now, so there is one place to look for a number instead of two.
const TABS = ["Overview", "Services"] as const;
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
}

function computeMetrics(orders: Order[], dateRange: { start: Date; end: Date }): DashboardMetrics {
  const filtered = ordersInRange(orders, dateRange);
  const prevRange = getPrevPeriod(dateRange);
  const prevFiltered = ordersInRange(orders, prevRange);

  return {
    totalSales: totalSales(filtered),
    totalOrders: filtered.length,
    walkInCount: filtered.filter((o) => o.orderSource === "walkin").length,
    activeCustomers: new Set(filtered.filter((o) => o.customerEmail).map((o) => o.customerEmail)).size,
    prevTotalSales: totalSales(prevFiltered),
    prevTotalOrders: prevFiltered.length,
    prevWalkInCount: prevFiltered.filter((o) => o.orderSource === "walkin").length,
    prevActiveCustomers: new Set(prevFiltered.filter((o) => o.customerEmail).map((o) => o.customerEmail)).size,
  };
}

// ─── sales trend (one date range, no granularity switch) ──────────────────────
type TrendUnit = "day" | "week" | "month";
interface TrendSeries {
  points: { name: string; sales: number }[];
  unit: TrendUnit;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function bucketStart(date: Date, unit: TrendUnit): Date {
  const copy = startOfDay(date);
  if (unit === "week") copy.setDate(copy.getDate() - copy.getDay());
  else if (unit === "month") copy.setDate(1);
  return copy;
}

// Local-time key. `toISOString()` would shift the date for any zone east of
// UTC, so two sales on the same local day could land in different buckets.
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function trendLabel(date: Date, unit: TrendUnit): string {
  return date.toLocaleDateString(
    "en-PH",
    unit === "month" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" },
  );
}

/** `2026-11-02` → local midnight, instead of `new Date()`'s UTC parse. */
function parseDayKey(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A preset page range → the two `YYYY-MM-DD` boxes the picker shows. */
function toTrendRange(range: { start: Date; end: Date }): { from: string; to: string } {
  const now = new Date();
  const end = range.end.getTime() > now.getTime() ? now : range.end;
  return { from: isoDay(range.start), to: isoDay(end) };
}

/**
 * Revenue inside an arbitrary window, split into buckets.
 *
 * The bucket width follows the window instead of asking the operator to pick
 * it: up to a month reads as days, up to half a year as weeks, and anything
 * longer rolls up to months. Buckets with no sales are kept at zero so a quiet
 * stretch is a visible dip rather than a gap in the line.
 *
 * The window is clipped to the present — the current month's `end` is still in
 * the future, and drawing the rest of it would draw sales that have not
 * happened.
 */
function buildTrendSeries(orders: Order[], range: { start: Date; end: Date }): TrendSeries {
  const start = startOfDay(range.start);
  const end = new Date(Math.min(range.end.getTime(), Date.now()));
  const spanDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const unit: TrendUnit = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";
  const points: { name: string; sales: number }[] = [];
  if (spanDays < 1) return { points, unit };

  const sums = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "Canceled") continue;
    const at = new Date(order.createdAt || order.date);
    if (isNaN(at.getTime()) || at < start || at > end) continue;
    const key = dayKey(bucketStart(at, unit));
    sums.set(key, (sums.get(key) || 0) + parseTotal(order));
  }

  const last = bucketStart(end, unit);
  const cursor = bucketStart(start, unit);
  while (cursor.getTime() <= last.getTime()) {
    points.push({ name: trendLabel(cursor, unit), sales: sums.get(dayKey(cursor)) || 0 });
    if (unit === "day") cursor.setDate(cursor.getDate() + 1);
    else if (unit === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return { points, unit };
}

// ─── sub-components ───────────────────────────────────────────────────────────
function TrendText({ trend, label }: { trend: number; label: string }) {
  // A 0.0% change is not an increase — colouring it green claims a gain that
  // did not happen. Flat reads neutral.
  const isFlat = Math.abs(trend) < 0.05;
  const isUp = trend > 0;
  return (
    <>
      <span
        className={`text-[13px] font-semibold ${
          isFlat ? "text-slate-500" : isUp ? "text-green-600" : "text-red-500"
        }`}
      >
        {isFlat ? "No change" : `${isUp ? "↗" : "↘"} ${Math.abs(trend).toFixed(1)}%`}
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
    <Card className={`gap-0 bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight ? (
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">{headerRight}</div>
        ) : action && actionLabel ? (
          <Button variant="link" size="sm" onClick={action} className="h-auto shrink-0 gap-1 px-0 text-[13px] font-semibold">
            {actionLabel} <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </div>
      <div className={`px-5 pb-5 ${bodyClassName}`}>{children}</div>
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
// Three numbers plus the items that need a decision. The full stock list used to
// sit here too, but "View Inventory" already opens the page that lists every
// item with its stock, unit and status, so repeating it only made the dashboard
// longer.
function InventorySnapshot({
  items,
  navigate,
  inventoryPath = "/admin/inventory",
  rail = false,
}: {
  items: InventoryItem[];
  navigate: ReturnType<typeof useNavigate>;
  inventoryPath?: string;
  // `rail` is the narrow column beside the sales chart: one figure per row,
  // stretched to the chart's height. Without it the three figures sit in a row.
  rail?: boolean;
}) {
  const activeItems = items.filter((i) => !i.archived);
  const lowStockItems = activeItems.filter((i) => inventoryStore.getInventoryStatus(i) === "low");
  const outOfStockItems = activeItems.filter((i) => inventoryStore.getInventoryStatus(i) === "out");
  const urgentItems = [...outOfStockItems, ...lowStockItems].slice(0, 4);
  const needsAttention = lowStockItems.length + outOfStockItems.length;

  // One source of figures for both layouts, so they can never disagree.
  const stats = [
    { label: "Total Items", value: activeItems.length, color: "text-[#2F6FD6]" },
    {
      label: "Low Stock",
      value: lowStockItems.length,
      color: lowStockItems.length > 0 ? "text-amber-600" : "text-slate-800",
    },
    {
      label: "Out of Stock",
      value: outOfStockItems.length,
      color: outOfStockItems.length > 0 ? "text-red-600" : "text-slate-800",
    },
  ];

  return (
    <SectionCard
      title="Inventory Snapshot"
      className={rail ? "h-full" : ""}
      bodyClassName={rail ? "flex min-h-0 flex-1 flex-col" : ""}
      headerRight={
        <>
          {needsAttention === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
              <CheckCircle className="w-3 h-3 shrink-0 text-green-600" />
              All levels healthy
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {needsAttention} need{needsAttention === 1 ? "s" : ""} attention
            </span>
          )}
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate(inventoryPath)}
            className="ml-auto h-auto shrink-0 gap-1 px-0 text-[13px] font-semibold sm:ml-0"
          >
            View Inventory <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </>
      }
    >
      {rail ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-1 items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/70 px-3.5 py-2.5"
            >
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl">
              <p className="text-[11px] font-medium text-slate-500 sm:text-xs">{stat.label}</p>
              <p className={`text-xl sm:text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {urgentItems.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500">Needs Attention</p>
          {urgentItems.map((item) => {
            const isOut = inventoryStore.getInventoryStatus(item) === "out";
            return (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80">
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
                <Button variant="primary" size="sm" onClick={() => setOpen(false)} className="w-full">Apply</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
const TREND_SUBTITLE: Record<TrendUnit, string> = {
  day: "Revenue per day in the selected range",
  week: "Revenue per week in the selected range",
  month: "Revenue per month in the selected range",
};

function OverviewTab({
  metrics,
  navigate,
  items,
  orders,
  role = "admin",
  trend,
  trendRange,
  onTrendRangeChange,
}: {
  metrics: DashboardMetrics;
  navigate: ReturnType<typeof useNavigate>;
  items: InventoryItem[];
  orders: Order[];
  role?: "admin" | "staff";
  trend: TrendSeries;
  trendRange: { from: string; to: string };
  onTrendRangeChange: (next: { from: string; to: string }) => void;
}) {
  const {
    totalSales, totalOrders, walkInCount, activeCustomers,
    prevTotalSales, prevTotalOrders, prevWalkInCount, prevActiveCustomers,
  } = metrics;

  const salesTrendPct = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const ordersTrendPct = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0;
  const walkInTrendPct = prevWalkInCount > 0 ? ((walkInCount - prevWalkInCount) / prevWalkInCount) * 100 : 0;
  const customerTrendPct = prevActiveCustomers > 0 ? ((activeCustomers - prevActiveCustomers) / prevActiveCustomers) * 100 : 0;

  const inventoryPath = role === "staff" ? "/staff/inventory" : "/admin/inventory";

  return (
    <div className="space-y-5">
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

      {/* Trend and inventory share one row on desktop: the chart takes two
          thirds, the inventory figures the remaining third. Staff have no
          sales chart, so their inventory card keeps the full width. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
        {role === "admin" && (
          <div className="min-w-0 lg:col-span-2">
            <SectionCard
              title="Sales Trend"
              subtitle={TREND_SUBTITLE[trend.unit]}
              headerRight={
                <div className="w-full sm:w-[260px]">
                  <DateRangeFilter trigger value={trendRange} onChange={onTrendRangeChange} />
                </div>
              }
            >
              {trend.points.every((point) => point.sales === 0) ? (
                // Same height as the chart so an empty range leaves a card that
                // still holds the page together instead of collapsing to a line.
                <div className="flex h-[260px] items-center justify-center sm:h-[340px]">
                  <EmptyState icon={TrendingUp} message="No sales in this range" />
                </div>
              ) : (
                <div className="h-[260px] sm:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend.points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
          </div>
        )}

        <div className={`min-w-0 ${role === "admin" ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <InventorySnapshot
            items={items}
            navigate={navigate}
            inventoryPath={inventoryPath}
            rail={role === "admin"}
          />
        </div>
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
          <p className="text-sm text-slate-500 mt-1.5">Performance and catalogue for the selected period.</p>
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
          valueClassName="text-lg font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl break-words"
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
          valueClassName="text-lg font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl break-words"
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
              <p className="text-xs text-slate-500 mt-0.5">Orders and revenue per service.</p>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate("/admin/pricing")}
                              title={`Manage ${s.name} pricing`}
                              className="text-slate-400"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
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
            <Button variant="link" size="sm" onClick={() => navigate("/admin/pricing")} className="h-auto gap-1 px-0 text-xs font-semibold">
              View detailed report <ArrowRight className="w-3.5 h-3.5" />
            </Button>
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
                  <Button variant="link" size="sm" onClick={() => navigate("/admin/pricing")} className="h-auto gap-1 px-0 text-xs font-semibold">
                    View detailed report <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
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
          </div>
          <Button variant="primary" onClick={() => navigate("/admin/pricing")}>
            <Plus className="w-4 h-4" /> Add Service
          </Button>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/admin/pricing")}
                        title={`Edit ${s.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/admin/pricing")}
                        title="More options"
                        className="text-slate-400"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
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
  const hydrating = useHydrating();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [dateRangeId, setDateRangeId] = useState("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [orders, setOrders] = useState(dataStore.getOrders());
  const [inventoryItems, setInventoryItems] = useState(inventoryStore.getActiveItems());

  const dateRange = useMemo(() => getDateRange(dateRangeId, customStart, customEnd), [dateRangeId, customStart, customEnd]);

  // The chart has its own window so the operator can look at a week of sales
  // without changing the period every KPI above it is measured over. Picking a
  // new page range re-seeds it, since the two are meant to start together.
  const [trendRange, setTrendRange] = useState(() => toTrendRange(dateRange));
  useEffect(() => {
    setTrendRange(toTrendRange(dateRange));
  }, [dateRange]);

  const trend = useMemo(() => {
    const from = parseDayKey(trendRange.from);
    const to = parseDayKey(trendRange.to);
    const start = from ?? dateRange.start;
    let end = to ?? dateRange.end;
    if (to) end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    if (end.getTime() < start.getTime()) end = start;
    return buildTrendSeries(orders, { start, end });
  }, [orders, trendRange, dateRange]);

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
            <p className="text-sm text-slate-500 mt-1">Welcome back, {userName || "admin"}.</p>
          </div>
          {/* The date range belongs to Overview — Services carries its own picker. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {role === "admin" && activeTab === "Overview" && <CreateNotificationCard />}
            <div className="flex flex-wrap items-center gap-2.5">
              {(role === "staff" || activeTab === "Overview") && overviewDateSelector}
              {/* The shop's state reads like a chat presence dot at every
                  width — a full card here cost ~92px of the first screen. */}
              {(role === "staff" || activeTab === "Overview") && <ShopStatusControl />}
            </div>
          </div>
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
        {hydrating ? (
          <div className="space-y-4">
            <CardSkeleton cards={4} columns={3} label="Loading dashboard" />
            <DetailSkeleton blocks={2} />
          </div>
        ) : role === "admin" ? (
          <>
            {activeTab === "Overview" && (
              <OverviewTab
                metrics={metrics}
                navigate={navigate}
                items={inventoryItems}
                orders={orders}
                trend={trend}
                trendRange={trendRange}
                onTrendRangeChange={setTrendRange}
              />
            )}
            {activeTab === "Services" && <ServicesTab navigate={navigate} />}
          </>
        ) : (
          <OverviewTab
            metrics={metrics}
            navigate={navigate}
            items={inventoryItems}
            orders={orders}
            role="staff"
            trend={trend}
            trendRange={trendRange}
            onTrendRangeChange={setTrendRange}
          />
        )}
      </div>
    </Layout>
  );
}
