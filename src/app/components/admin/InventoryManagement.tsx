import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  AlertTriangle,
  PackagePlus,
  PackageMinus,
  Pencil,
  Archive,
  RotateCcw,
  Plus,
  Search,
  Inbox,
  FileText,
  LayoutDashboard,
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Calendar,
  ChevronDown,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { adminMenuItems } from "../../utils/adminMenuItems";
import { useAuth } from "../../contexts/AuthContext";
import {
  inventoryStore,
  type InventoryItem,
  type StockMovement,
} from "../../utils/inventoryStore";
import { formatNumber } from "../../utils/formatNumber";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { SummaryCard } from "../ui/summary-card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CATEGORIES = [
  "Paper",
  "Ink",
  "Add-ons",
  "Vellum",
  "Sticker",
  "Photo paper",
  "Other",
];

// Print-material categories that carry a paper/material size (their stock shows
// up in the customer's paper size options). Price for Add-ons is the sell price.
const MATERIAL_CATEGORIES = ["Paper", "Vellum", "Sticker", "Photo paper"];

const UNIT_OPTIONS = ["ream", "piece", "box", "bottle", "pack", "roll"];

// Menu items + page title are configurable so the same full-featured inventory
// module can be served to both admin and staff (staff get identical access).
interface InventoryManagementProps {
  menuItems?: { label: string; path: string; icon: React.ReactNode }[];
  title?: string;
}

type StockDialogState =
  | { type: "in" | "out"; item: InventoryItem }
  | null;

// ─── Reports helpers ──────────────────────────────────────────────────────────
const REPORT_RANGES = [
  { id: "today", label: "Today" },
  { id: "this-week", label: "This Week" },
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
] as const;

function reportRange(id: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  let end: Date;
  let label: string;

  switch (id) {
    case "today":
      start = new Date(y, m, now.getDate());
      end = new Date(y, m, now.getDate(), 23, 59, 59, 999);
      label = now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
      break;
    case "this-week": {
      const wStart = new Date(now);
      wStart.setDate(now.getDate() - now.getDay());
      start = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate());
      end = now;
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
    case "last-month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      start = new Date(ly, lm, 1);
      end = new Date(ly, lm + 1, 0, 23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
    case "custom": {
      const s = customStart ? new Date(customStart) : new Date(y, m, 1);
      const e = customEnd ? new Date(customEnd + "T23:59:59") : now;
      start = s;
      end = e;
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
    }
    default:
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      label = `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
      break;
  }
  return { start, end, label };
}

function recentRangeStart(): Date {
  const now = new Date();
  const range = reportRange("this-month");
  return range.start;
}

function fmtQty(value: number): string {
  return formatNumber(value, value % 1 !== 0 ? 2 : 0);
}

function fmtMovementDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtMovementDateOnly(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function ReportSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 bg-white border border-slate-100 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function InventoryReports() {
  const [rangeId, setRangeId] = useState("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");

  const [items, setItems] = useState<InventoryItem[]>(inventoryStore.getActiveItems());
  const [movements, setMovements] = useState<StockMovement[]>(inventoryStore.getMovements());

  useEffect(() => {
    const refresh = () => {
      setItems(inventoryStore.getActiveItems());
      setMovements(inventoryStore.getMovements());
    };
    refresh();
    const unsub = inventoryStore.subscribe(refresh);
    return unsub;
  }, []);

  const range = useMemo(
    () => reportRange(rangeId, customStart, customEnd),
    [rangeId, customStart, customEnd]
  );

  const inRange = (movement: StockMovement) => {
    const d = new Date(movement.createdAt);
    return d >= range.start && d <= range.end;
  };

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [items]);

  const itemOptions = useMemo(() => {
    const filtered = categoryFilter === "all" ? items : items.filter((i) => i.category === categoryFilter);
    return filtered.map((i) => i.id);
  }, [items, categoryFilter]);

  // Scope movements by filters (category + item) and date range
  const itemById = (id: string) => items.find((i) => i.id === id);

  const scopedMovements = useMemo(() => {
    const filteredItems = itemFilter !== "all" ? [itemFilter] : itemOptions;
    if (categoryFilter === "all" && itemFilter === "all") {
      return movements.filter(inRange);
    }
    const union = new Set<string>();
    if (categoryFilter !== "all") {
      items.filter((i) => i.category === categoryFilter).forEach((i) => union.add(i.id));
    }
    if (itemFilter !== "all") union.add(itemFilter);
    // If only category filter, use all items of that category; if only item filter, that item
    const allowedIds = itemFilter !== "all" ? [itemFilter] : Array.from(union);
    return movements.filter((mv) => allowedIds.includes(mv.itemId) && inRange(mv));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, range, categoryFilter, itemFilter, itemOptions]);

  const scopedIn = scopedMovements.filter((m) => m.type === "in");
  const scopedOut = scopedMovements.filter((m) => m.type === "out");

  const totalStockIn = scopedIn.reduce((s, m) => s + m.quantity, 0);
  const totalStockOut = scopedOut.reduce((s, m) => s + m.quantity, 0);

  const activeItems = items.filter((i) => !i.archived);
  const lowStockItems = activeItems.filter((i) => i.currentStock > 0 && i.currentStock <= i.minimumStock);
  const outOfStockItems = activeItems.filter((i) => i.currentStock === 0);

  // Most used materials (consumption by item, from scoped-out movements)
  const usageMap = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const mv of scopedOut) {
      const prev = map.get(mv.itemId) || { name: mv.itemName, qty: 0 };
      prev.qty += mv.quantity;
      map.set(mv.itemId, prev);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedOut]);

  const totalUsage = usageMap.reduce((s, u) => s + u.qty, 0);

  // Stock movement over time (by day) for the bar chart
  const movementChart = useMemo(() => {
    const map = new Map<string, { label: string; in: number; out: number }>();
    for (const mv of scopedMovements) {
      const d = new Date(mv.createdAt);
      const key = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      const entry = map.get(key) || { label: key, in: 0, out: 0 };
      if (mv.type === "in") entry.in += mv.quantity;
      else entry.out += mv.quantity;
      map.set(key, entry);
    }
    const entries = [...map.entries()];
    entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return entries.slice(-14).map(([, v]) => v);
  }, [scopedMovements]);

  const currentReportItems = useMemo(() => {
    let list = activeItems;
    if (categoryFilter !== "all") list = list.filter((i) => i.category === categoryFilter);
    if (itemFilter !== "all") list = list.filter((i) => i.id === itemFilter);
    return list;
  }, [activeItems, categoryFilter, itemFilter]);

  const alerts = [...outOfStockItems, ...lowStockItems];

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventory Reports</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {categoryFilter !== "all" && (
            <ZoomSafeDropdown
              label="Category filter"
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="All Categories"
              className="min-w-[140px]"
              options={categories.map((c) => ({ value: c, label: c === "all" ? "All Categories" : c }))}
            />
          )}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-[#2F6FD6] transition-colors shadow-sm"
            >
              <Calendar className="w-4 h-4 text-[#2F6FD6]" />
              <span>{REPORT_RANGES.find((r) => r.id === rangeId)?.label}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                  {REPORT_RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setRangeId(r.id); if (r.id !== "custom") setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${rangeId === r.id ? "bg-blue-50 text-[#2F6FD6] font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                  {rangeId === "custom" && (
                    <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                      <DateRangeFilter
                        value={{ from: customStart, to: customEnd }}
                        onChange={(next) => {
                          setCustomStart(next.from);
                          setCustomEnd(next.to);
                        }}
                        fromLabel="From"
                        toLabel="To"
                        compact
                      />
                      <button onClick={() => setDropdownOpen(false)} className="w-full py-1.5 bg-[#2F6FD6] text-white rounded-lg text-xs font-semibold hover:bg-[#1e5bb8]">Apply</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <ZoomSafeDropdown
            label="Category filter"
            value={categoryFilter}
            onChange={(v) => { setCategoryFilter(v); if (v === "all") setItemFilter("all"); }}
            placeholder="All Categories"
            className="min-w-[150px]"
            options={categories.map((c) => ({ value: c, label: c === "all" ? "All Categories" : c }))}
          />
          <ZoomSafeDropdown
            label="Item filter"
            value={itemFilter}
            onChange={setItemFilter}
            placeholder="All Items"
            className="min-w-[160px]"
            options={[
              { value: "all", label: "All Items" },
              ...(categoryFilter === "all" ? items : items.filter((i) => i.category === categoryFilter)).map((i) => ({ value: i.id, label: i.name })),
            ]}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 @min-[1000px]:grid-cols-5 gap-3 sm:gap-4">
        <SummaryCard icon={Boxes} label="Total Items" value={activeItems.length} iconBg="bg-blue-100" iconColor="text-[#2F6FD6]" />
        <SummaryCard icon={AlertTriangle} label="Low Stock" value={lowStockItems.length} iconBg="bg-amber-100" iconColor="text-amber-600" valueColor="text-amber-600" />
        <SummaryCard icon={PackageMinus} label="Out of Stock" value={outOfStockItems.length} iconBg="bg-red-100" iconColor="text-red-600" valueColor="text-red-600" />
        <SummaryCard icon={ArrowDownToLine} label="Stock In" value={fmtQty(totalStockIn)} iconBg="bg-green-100" iconColor="text-green-600" valueColor="text-green-600" />
        <SummaryCard icon={ArrowUpFromLine} label="Stock Out" value={fmtQty(totalStockOut)} iconBg="bg-blue-100" iconColor="text-[#2F6FD6]" valueColor="text-[#2F6FD6]" />
      </div>

      {/* Most Used Materials + Stock Movement */}
      <div className="grid grid-cols-1 @min-[820px]:grid-cols-2 gap-6">
        <ReportSection title="Most Used Materials" subtitle="Consumption during the selected period">
          {usageMap.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-500">
              <TrendingUp className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No material usage recorded for this period.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {usageMap.slice(0, 8).map((u, i) => {
                const pct = totalUsage > 0 ? (u.qty / totalUsage) * 100 : 0;
                const item = itemById(u.id);
                return (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#2F6FD6]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-500">{fmtQty(u.qty)} {item?.unit || "units"}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 shrink-0">{pct.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </ReportSection>

        <ReportSection title="Stock Movement" subtitle="Stock In vs Stock Out over time">
          {movementChart.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-500">
              <BarChart3 className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No stock movement data for this period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={movementChart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="in" name="Stock In" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="out" name="Stock Out" fill="#2F6FD6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Stock In</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#2F6FD6] inline-block" /> Stock Out</span>
          </div>
        </ReportSection>
      </div>

      {/* Inventory Alerts */}
      <ReportSection title="Inventory Alerts" subtitle="Items that require attention">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-700">All inventory levels are currently healthy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 8).map((item) => {
              const isOut = item.currentStock <= 0;
              return (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${isOut ? "text-red-500" : "text-amber-500"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {fmtQty(item.currentStock)} {item.unit}(s) remaining · Min: {fmtQty(item.minimumStock)} {item.unit}(s)
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${isOut ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {isOut ? "Out of Stock" : item.currentStock <= item.minimumStock ? "Critical" : "Low Stock"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ReportSection>

      {/* Histories */}
      <div className="grid grid-cols-1 @min-[820px]:grid-cols-2 gap-6">
        <ReportSection title="Stock-In History" subtitle="Items added during the selected period">
          {scopedIn.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No stock-in records for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Item</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase text-right">Qty</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedIn.slice(0, 20).map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtMovementDateOnly(m.createdAt)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{m.itemName}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 font-semibold whitespace-nowrap">+{fmtQty(m.quantity)} {m.unit}</td>
                      <td className="px-4 py-2.5 text-slate-500">{m.reason || m.person || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>

        <ReportSection title="Stock-Out History" subtitle="Items removed/consumed during the selected period">
          {scopedOut.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No stock-out records for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Item</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase text-right">Qty</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedOut.slice(0, 20).map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtMovementDateOnly(m.createdAt)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{m.itemName}</td>
                      <td className="px-4 py-2.5 text-right text-[#2F6FD6] font-semibold whitespace-nowrap">-{fmtQty(m.quantity)} {m.unit}</td>
                      <td className="px-4 py-2.5 text-slate-500">{m.reason || m.person || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>
      </div>

      {/* Current Inventory Report */}
      <ReportSection title="Current Inventory Report">
        {currentReportItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No inventory items match the current filters.</p>
) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Item</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Category</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Unit</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase text-right">Current Stock</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase text-right">Min Stock</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentReportItems.map((item) => {
                  const isOut = item.currentStock <= 0;
                  const isLow = item.currentStock > 0 && item.currentStock <= item.minimumStock;
                  return (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{item.category}</td>
                      <td className="px-4 py-2.5 text-slate-500 capitalize">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {fmtQty(item.currentStock)}
                        {item.category === "Paper" && (
                          <span className="ml-1 text-[10px] font-medium text-slate-500">
                            ({formatNumber(inventoryStore.getItemPieces(item), 0)} pcs)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{fmtQty(item.minimumStock)}</td>
                      <td className="px-4 py-2.5">
                        {isOut && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>}
                        {isLow && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low Stock</span>}
                        {!isOut && !isLow && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">In Stock</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>
    </div>
  );
}

export default function InventoryManagement({
  menuItems = adminMenuItems,
  title = "Inventory Management",
}: InventoryManagementProps) {
  const { user } = useAuth();
  const [view, setView] = useState<"overview" | "reports">("overview");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  // Table pagination
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [stockDialog, setStockDialog] = useState<StockDialogState>(null);
  const [confirmType, setConfirmType] = useState<
    "save" | "stockIn" | "stockOut" | "archive" | "restore" | null
  >(null);
  const [archiveTarget, setArchiveTarget] = useState<InventoryItem | null>(null);

  // Add / edit form state
  const [form, setForm] = useState({
    name: "",
    category: "Paper",
    brand: "",
    unit: "ream",
    currentStock: 0,
    minimumStock: 0,
    paperSize: "",
    price: 0,
  });

  // Stock dialog state
  const [stockQty, setStockQty] = useState<number>(1);
  const [stockNote, setStockNote] = useState("");

  const loadItems = () => {
    setItems(
      showArchived
        ? inventoryStore.getArchivedItems()
        : inventoryStore.getActiveItems(),
    );
  };

  useEffect(() => {
    loadItems();
    const unsubscribe = inventoryStore.subscribe(loadItems);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const lowStockCount = inventoryStore.getLowStockItems().length;
  const paperItems = inventoryStore.getPaperItems();
  const papersLeftReams = paperItems.reduce(
    (sum, item) => sum + item.currentStock,
    0,
  );
  const papersLeftPieces = paperItems.reduce(
    (sum, item) => sum + inventoryStore.getItemPieces(item),
    0,
  );

  const hydrating = useHydrating();

  const filteredItems = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.brand || "").toLowerCase().includes(q)
    );
  });


  // Pagination derived values
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = filteredItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // Jump back to page 1 when the result set changes (search / source toggle)
  useEffect(() => {
    setPage(1);
  }, [search, showArchived, filteredItems.length]);

  const openAdd = () => {
    setForm({
      name: "",
      category: "Paper",
      brand: "",
      unit: "ream",
      currentStock: 0,
      minimumStock: 0,
      paperSize: "",
      price: 0,
    });
    setShowAddDialog(true);
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      name: item.name,
      category: item.category,
      brand: item.brand || "",
      unit: item.unit,
      currentStock: item.currentStock,
      minimumStock: item.minimumStock,
      paperSize: item.paperSize || "",
      price: item.price || 0,
    });
    setEditItem(item);
  };

  const openStock = (type: "in" | "out", item: InventoryItem) => {
    setStockQty(1);
    setStockNote("");
    setStockDialog({ type, item });
  };

  const saveItem = async () => {
    if (!form.name.trim()) {
      toast.error("Item name is required.");
      return;
    }
    const currentStock = Math.max(0, Number(form.currentStock) || 0);
    const minimumStock = Math.max(0, Number(form.minimumStock) || 0);
    const price =
      form.category === "Add-ons" ? Math.max(0, Number(form.price) || 0) : 0;
    const paperSize = MATERIAL_CATEGORIES.includes(form.category)
      ? form.paperSize.trim()
      : "";
    const pcsPerUnit =
      form.category === "Paper"
        ? form.unit === "ream"
          ? 500
          : editItem?.pcsPerUnit || 1
        : undefined;

    if (editItem) {
      inventoryStore.updateItem(editItem.id, {
        name: form.name.trim(),
        category: form.category,
        brand: form.brand.trim(),
        unit: form.unit || "piece",
        currentStock,
        minimumStock,
        price,
        paperSize,
        pcsPerUnit,
      });
      toast.success("Item updated successfully.");
    } else {
      // addItem is async — the store applies locally, inserts to Supabase and
      // adopts the server-assigned id. Callers with aliases (down-payment type)
      // pass an explicit id; otherwise the store mints one.
      await inventoryStore.addItem({
        name: form.name.trim(),
        category: form.category,
        brand: form.brand.trim(),
        unit: form.unit || "piece",
        currentStock,
        minimumStock,
        price,
        paperSize,
        pcsPerUnit,
      });
      toast.success("Item added to inventory.");
    }

    setShowAddDialog(false);
    setEditItem(null);
  };

  const submitStock = () => {
    if (!stockDialog) return;
    const { type, item } = stockDialog;
    const qty = Math.floor(Number(stockQty)) || 0;

    if (qty <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }

    if (type === "in") {
      inventoryStore.stockIn(item.id, qty, {
        reason: stockNote.trim() || "Restock",
        person: user?.name,
      });
      toast.success(
        `Stocked in ${qty} ${item.unit}(s) to ${item.name}.`,
      );
    } else {
      const result = inventoryStore.stockOut(item.id, qty, {
        reason: stockNote.trim() || "Usage",
        person: user?.name,
      });
      if (result.success) {
        toast.success(`Stocked out ${qty} ${item.unit}(s) from ${item.name}.`);
      } else {
        toast.error(result.message);
      }
    }

    setStockDialog(null);
  };

  const toggleArchive = (item: InventoryItem) => {
    if (item.archived) {
      inventoryStore.unarchiveItem(item.id);
      toast.success(`${item.name} restored.`);
    } else {
      inventoryStore.archiveItem(item.id);
      toast.success(`${item.name} archived.`);
    }
  };

  const statusBadge = (item: InventoryItem) => {
    if (item.currentStock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (item.currentStock <= item.minimumStock) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          <AlertTriangle className="w-3 h-3" /> Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        In Stock
      </span>
    );
  };

  const lowStockItems = inventoryStore.getLowStockItems();

  return (
    <Layout menuItems={menuItems} title={title || "Inventory Management"}>
      <div className="space-y-6">
        {/* Module Navigation */}
        <div className="border-b border-slate-200">
          <div className="flex gap-0 -mb-px">
            <button
              onClick={() => setView("overview")}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${view === "overview" ? "border-[#2F6FD6] text-[#2F6FD6]" : "border-transparent text-slate-500 hover:text-slate-600"}`}
            >
              Inventory Overview
            </button>
            <button
              onClick={() => setView("reports")}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${view === "reports" ? "border-[#2F6FD6] text-[#2F6FD6]" : "border-transparent text-slate-500 hover:text-slate-600"}`}
            >
              Reports
            </button>
          </div>
        </div>

        {view === "reports" && <InventoryReports />}

        {view === "overview" && (
        <>
        {/* Low Stock Banner */}
        {lowStockItems.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Low Stock Alert
                </p>
                <p className="text-xs text-amber-700">
                  {lowStockItems.length} item
                  {lowStockItems.length > 1 ? "s" : ""} at or below the minimum
                  reorder level. Consider restocking.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {lowStockItems.slice(0, 4).map((item) => (
                <Badge
                  key={item.id}
                  className="bg-white text-amber-800 border border-amber-300"
                >
                  {item.name}: {item.currentStock} {item.unit}
                </Badge>
              ))}
              {lowStockItems.length > 4 && (
                <Badge className="bg-white text-amber-800 border border-amber-300">
                  +{lowStockItems.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 @min-[1000px]:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard
            icon={FileText}
            label="Papers Left"
            value={`${formatNumber(papersLeftPieces, 0)} pcs`}
            subtitle={`${formatNumber(papersLeftReams, 2)} reams`}
            iconBg="bg-blue-100"
            iconColor="text-[#2F6FD6]"
          />
          <SummaryCard
            icon={Boxes}
            label="Total Items"
            value={inventoryStore.getActiveItems().length}
            iconBg="bg-blue-100"
            iconColor="text-[#2F6FD6]"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Low Stock"
            value={lowStockCount}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            valueColor="text-amber-600"
          />
          <SummaryCard
            icon={Inbox}
            label="Out of Stock"
            value={inventoryStore.getOutOfStockItems().length}
            iconBg="bg-red-100"
            iconColor="text-red-600"
            valueColor="text-red-600"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="group relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
            <Input
              aria-label="Search inventory items"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setShowArchived(false)}
              className={!showArchived
                ? "bg-[#2F6FD6] text-white hover:bg-[#2557b8] rounded-md shadow-md shadow-[#2F6FD6]/25"
                : "bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white rounded-md"}
            >
              Active
            </Button>
            <Button
              type="button"
              onClick={() => setShowArchived(true)}
              className={showArchived
                ? "bg-[#2F6FD6] text-white hover:bg-[#2557b8] rounded-md shadow-md shadow-[#2F6FD6]/25"
                : "bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white rounded-md"}
            >
              Archived
            </Button>
            <Button
              onClick={openAdd}
              className="bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>
        </div>

        {/* Items Table */}
        <Card className="bg-white border border-slate-100 shadow-sm overflow-hidden">
          {hydrating ? (
            // The local mirror paints first and the server rows replace it, so an
            // empty list is ambiguous. The skeleton claims the loading case and
            // leaves the empty state meaning what it says.
            <TableSkeleton columns={6} />
          ) : filteredItems.length === 0 ? (
            <div className="p-10 text-center">
              <Boxes className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-600">
                {showArchived
                  ? "No archived items."
                  : "No inventory items yet. Add your first item."}
              </p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                      Item
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                      Category
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                      Unit
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                      Stock
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                      Min Stock
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">
                          {item.name}
                        </p>
                        {item.brand && (
                          <p className="text-xs text-slate-500">{item.brand}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline">{item.category}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600 capitalize">
                        {item.unit}
                      </td>
                      <td className="px-5 py-3">
                        {item.category === "Paper" && item.pcsPerUnit ? (
                          <>
                            <span className="font-bold text-slate-900">
                              {formatNumber(
                                inventoryStore.getItemPieces(item),
                                0,
                              )}
                            </span>
                            <span className="ml-1 text-xs text-slate-500">
                              pcs ({formatNumber(item.currentStock, 2)}{" "}
                              {item.unit}s)
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {formatNumber(item.currentStock, 2)}
                          </span>
                        )}
                        {item.currentStock <= item.minimumStock && (
                          <span className="ml-1 text-amber-600">
                            <AlertTriangle className="inline h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {item.minimumStock}
                      </td>
                      <td className="px-5 py-3">{statusBadge(item)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Stock In"
                            className="border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-700"
                            onClick={() => openStock("in", item)}
                          >
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Stock Out"
                            className="border-2 border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500"
                            onClick={() => openStock("out", item)}
                          >
                            <PackageMinus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Edit"
                            className="border-2 border-[#2F6FD6]/30 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:border-[#2F6FD6]"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title={item.archived ? "Restore" : "Archive"}
                            className="border-2 border-[#2F6FD6]/30 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:border-[#2F6FD6]"
                            onClick={() => { setArchiveTarget(item); setConfirmType(item.archived ? "restore" : "archive"); }}
                          >
                            {item.archived ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="bg-white text-slate-600 border border-gray-200 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6] disabled:opacity-40 disabled:pointer-events-none rounded-md px-3 h-9"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#2F6FD6] text-white hover:bg-[#2557b8] rounded-md shadow-sm shadow-[#2F6FD6]/30 h-9 w-9"
                  >
                    {page}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page === pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="bg-white text-slate-600 border border-gray-200 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6] disabled:opacity-40 disabled:pointer-events-none rounded-md px-3 h-9"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
            </>
          )}
        </Card>
        </>
        )}
      </div>

      {/* Add / Edit Item Dialog */}
      <Dialog open={showAddDialog || editItem !== null} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              {editItem ? "Edit Item" : "Add New Item"}
            </DialogTitle>
            <DialogDescription>
              {editItem
                ? "Update the details of this inventory item."
                : "Add a new supply or consumable item."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Item / Supply Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Bond Paper (A4)"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm({ ...form, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Brand (optional)</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="e.g. Epson"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Unit</Label>
                <Select
                  value={form.unit}
                  onValueChange={(value) => setForm({ ...form, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u} className="capitalize">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {MATERIAL_CATEGORIES.includes(form.category) ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Paper / Material Size</Label>
                  <Select
                    value={form.paperSize}
                    onValueChange={(value) => setForm({ ...form, paperSize: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="folio">Folio</SelectItem>
                      <SelectItem value="a3">A3</SelectItem>
                      <SelectItem value="2R">2R</SelectItem>
                      <SelectItem value="3R">3R</SelectItem>
                      <SelectItem value="4R">4R</SelectItem>
                      <SelectItem value="5R">5R</SelectItem>
                      <SelectItem value="6R">6R</SelectItem>
                      <SelectItem value="A4photo">A4 (Photo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : form.category === "Add-ons" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sell Price (₱)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Current Stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Minimum Stock / Reorder Level
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.minimumStock}
                  onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditItem(null);
              }}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              onClick={() => setConfirmType("save")}
              className="bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
            >
              {editItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save / Add Item Confirmation */}
      {confirmType === "save" && editItem && (
        <ConfirmationDialog
          open
          onOpenChange={() => setConfirmType(null)}
          onConfirm={saveItem}
          loadingText="Saving..."
          title="Save Changes?"
          description={`Save "${form.name.trim()}" with ${Math.max(0, Number(form.currentStock) || 0)} ${form.unit}(s) in stock?`}
          confirmLabel="Save Changes"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
      {confirmType === "save" && !editItem && (
        <ConfirmationDialog
          open
          onOpenChange={() => setConfirmType(null)}
          onConfirm={saveItem}
          loadingText="Adding..."
          title="Add Item?"
          description={`Add "${form.name.trim()}" with ${Math.max(0, Number(form.currentStock) || 0)} ${form.unit}(s) in stock?`}
          confirmLabel="Add Item"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Stock In / Out Dialog */}
      <Dialog open={stockDialog !== null} onOpenChange={(open) => { if (!open) setStockDialog(null); }}>
        <DialogContent className="max-w-md bg-white">
          {stockDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  {stockDialog.type === "in" ? "Stock In" : "Stock Out"} —{" "}
                  {stockDialog.item.name}
                </DialogTitle>
                <DialogDescription>
                  {stockDialog.type === "in" ? "Add stock." : "Deduct stock."}
                </DialogDescription>
              </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-600">
                Current stock:{" "}
                <span className="font-bold text-slate-900">
                  {stockDialog?.item.category === "Paper" &&
                  stockDialog?.item.pcsPerUnit
                    ? `${formatNumber(
                        inventoryStore.getItemPieces(stockDialog?.item),
                        0,
                      )} pcs (${formatNumber(
                        stockDialog?.item.currentStock,
                        2,
                      )} ${stockDialog?.item.unit}s)`
                    : `${formatNumber(
                        stockDialog?.item.currentStock,
                        2,
                      )} ${stockDialog?.item.unit}(s)`}
                </span>
              </p>
              <p className="text-slate-500">
                Minimum stock: {stockDialog?.item.minimumStock}{" "}
                {stockDialog?.item.unit}(s)
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Quantity to {stockDialog?.type === "in" ? "add" : "deduct"}
              </Label>
              <Input
                type="number"
                min="1"
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Note (optional)</Label>
              <Input
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                placeholder={
                  stockDialog?.type === "in"
                    ? "e.g. Restocked from supplier"
                    : "e.g. Used for customer order"
                }
              />
            </div>
          </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setStockDialog(null)}>
                  Cancel
                </Button>
                <Button
                  data-primary-action
                  onClick={() => setConfirmType(stockDialog.type === "in" ? "stockIn" : "stockOut")}
                  className={
                    stockDialog.type === "in"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
                  }
                >
                  {stockDialog.type === "in" ? "Stock In" : "Stock Out"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock In Confirmation */}
      {confirmType === "stockIn" && stockDialog && (
        <ConfirmationDialog
          open
          onOpenChange={() => setConfirmType(null)}
          onConfirm={submitStock}
          loadingText="Stocking In..."
          title="Stock In Item?"
          description={`Add ${Math.floor(Number(stockQty)) || 0} ${stockDialog.item.unit}(s) to "${stockDialog.item.name}"?`}
          confirmLabel="Stock In"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
      {confirmType === "stockOut" && stockDialog && (
        <ConfirmationDialog
          open
          onOpenChange={() => setConfirmType(null)}
          onConfirm={submitStock}
          loadingText="Stocking Out..."
          title="Stock Out Item?"
          description={`Deduct ${Math.floor(Number(stockQty)) || 0} ${stockDialog.item.unit}(s) from "${stockDialog.item.name}"? This is logged as a stock-out.`}
          confirmLabel="Stock Out"
          cancelLabel="Go Back"
          destructive
        />
      )}

      {/* Archive / Restore Confirmation */}
      {confirmType === "archive" && archiveTarget && (
        <ConfirmationDialog
          open
          onOpenChange={() => { setConfirmType(null); setArchiveTarget(null); }}
          onConfirm={() => { toggleArchive(archiveTarget); setArchiveTarget(null); }}
          title="Archive Item?"
          description={`Archive "${archiveTarget.name}"? It leaves active inventory and stops counting toward orders.`}
          confirmLabel="Archive"
          cancelLabel="Keep Item"
          destructive
        />
      )}
      {confirmType === "restore" && archiveTarget && (
        <ConfirmationDialog
          open
          onOpenChange={() => { setConfirmType(null); setArchiveTarget(null); }}
          onConfirm={() => { toggleArchive(archiveTarget); setArchiveTarget(null); }}
          title="Restore Item?"
          description={`Restore "${archiveTarget.name}" to active inventory?`}
          confirmLabel="Restore"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
    </Layout>
  );
}
