import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Boxes,
  Users,
  FileText,
  UserPlus,
  Briefcase,
  TrendingUp,
  AlertCircle,
  Box,
  Clock,
  ChevronDown,
  Settings,
  CheckCircle,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { dataStore } from "../../utils/dataStore";
import AttendanceWidget from "../AttendanceWidget";
import { adminMenuItems } from "../../utils/adminMenuItems";

const fullYearLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const chartData = {
  Weekly: {
    sales: [
      { name: "sales-weekly-Mon", label: "Mon", sales: 450 },
      { name: "sales-weekly-Tue", label: "Tue", sales: 680 },
      { name: "sales-weekly-Wed", label: "Wed", sales: 520 },
      { name: "sales-weekly-Thu", label: "Thu", sales: 790 },
      { name: "sales-weekly-Fri", label: "Fri", sales: 920 },
      { name: "sales-weekly-Sat", label: "Sat", sales: 340 },
    ],
    orders: [
      { name: "orders-weekly-Mon", label: "Mon", orders: 12 },
      { name: "orders-weekly-Tue", label: "Tue", orders: 18 },
      { name: "orders-weekly-Wed", label: "Wed", orders: 15 },
      { name: "orders-weekly-Thu", label: "Thu", orders: 22 },
      { name: "orders-weekly-Fri", label: "Fri", orders: 28 },
      { name: "orders-weekly-Sat", label: "Sat", orders: 10 },
    ],
  },
  Yearly: {
    sales: fullYearLabels.slice(0, 6).map((m, i) => ({
      name: `sales-yearly-${m}`,
      label: m,
      sales: [4200, 5100, 4800, 6200, 5800, 7100][i],
    })),
    orders: fullYearLabels.slice(0, 6).map((m, i) => ({
      name: `orders-yearly-${m}`,
      label: m,
      orders: [110, 145, 130, 190, 175, 210][i],
    })),
  },
};

// Staff data - matches the data structure from Staff.tsx
const staffData = [
  { id: "EMP-001", status: "Active" },
  { id: "EMP-002", status: "Active" },
  { id: "EMP-003", status: "Active" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [salesTimeframe, setSalesTimeframe] = useState<"Weekly" | "Yearly">("Weekly");
  const [ordersTimeframe, setOrdersTimeframe] = useState<"Weekly" | "Yearly">("Weekly");
  const [stats, setStats] = useState(dataStore.getOrderStats());
  const [lowStock, setLowStock] = useState(dataStore.getLowStockItems());
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [activeStaffCount] = useState(
    staffData.filter(staff => staff.status === "Active").length
  );

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setStats(dataStore.getOrderStats());
      setLowStock(dataStore.getLowStockItems());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <Layout menuItems={adminMenuItems} title="Admin Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">
        {/* MAIN DASHBOARD CONTENT (Left) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Top Row: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                id: "kpi-total",
                label: "Total Orders",
                val: stats.total,
                icon: Package,
                click: () => navigate("/admin/orders"),
                // total = onHold + inProgress + allCompleted — matches sum of the 3 status cards below
                desc: `${stats.onHold} on hold · ${stats.inProgress} in progress`,
              },
              {
                id: "kpi-hold",
                label: "On Hold",
                val: stats.onHold,
                icon: AlertCircle,
                click: () => navigate("/admin/orders"),
                desc: "Needs action",
              },
              {
                id: "kpi-progress",
                label: "In Progress",
                // received + inQueue + printing
                val: stats.inProgress,
                icon: TrendingUp,
                click: () => navigate("/admin/orders"),
                desc: `${stats.printing} printing · ${stats.inQueue} queued`,
              },
              {
                id: "kpi-completed",
                label: "Completed",
                // completed + released — all finished orders
                val: stats.allCompleted,
                icon: CheckCircle,
                click: () => navigate("/admin/orders"),
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

          {/* Middle Row: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 bg-white shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  Sales Trend
                </h3>
                <select
                  value={salesTimeframe}
                  onChange={(e) =>
                    setSalesTimeframe(e.target.value as any)
                  }
                  className="text-xs font-bold text-[#2F6FD6] bg-blue-50 rounded px-2 py-1 outline-none"
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Yearly">Monthly</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={chartData[salesTimeframe].sales}
                  key={`sales-chart-${salesTimeframe}`}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={true}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#2F6FD6"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#2F6FD6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5 bg-white shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  Order Volume
                </h3>
                <select
                  value={ordersTimeframe}
                  onChange={(e) =>
                    setOrdersTimeframe(e.target.value as any)
                  }
                  className="text-xs font-bold text-[#2F6FD6] bg-blue-50 rounded px-2 py-1 outline-none"
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Yearly">Monthly</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData[ordersTimeframe].orders}
                  key={`orders-chart-${ordersTimeframe}`}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  <Tooltip cursor={{ fill: "#f9fafb" }} />
                  <Bar
                    dataKey="orders"
                    fill="#2F6FD6"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Bottom Row: System Overview */}
          <Card className="p-6 bg-white shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              System Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: "Revenue",
                  val: "₱18.5K",
                  sub: "Monthly total",
                },
                {
                  label: "Active Staff",
                  val: activeStaffCount.toString(),
                  sub: "Currently on duty",
                },
                {
                  label: "Accounts",
                  val: "124",
                  sub: "Total customers",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-5 bg-slate-50 border border-slate-100 rounded-xl"
                >
                  <p className="text-xs text-slate-500 font-bold uppercase">
                    {item.label}
                  </p>
                  <p className="text-3xl font-bold text-[#2F6FD6] mt-2">
                    {item.val}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase">
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
            {/* Low Stock Alert Banner */}
            {lowStock.length > 0 && (
              <button
                onClick={() => setShowLowStockModal(true)}
                className="mt-5 w-full flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <Boxes className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      Low Stock Alert
                    </p>
                    <p className="text-xs text-amber-600 font-medium">
                      {lowStock.length} item{lowStock.length > 1 ? "s" : ""} below reorder level
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-full">
                  View Details
                </span>
              </button>
            )}
          </Card>
        </div>

        {/* SIDEBAR CONTENT (Right) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Attendance Section */}
          <AttendanceWidget />

          {/* Quick Actions Section */}
          <Card className="p-6 bg-white border border-slate-100 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              {[
                {
                  id: "qa-pay",
                  label: "Verify Payments",
                  icon: CreditCard,
                  path: "/admin/payment-verification",
                },
                {
                  id: "qa-ord",
                  label: "View Orders",
                  icon: Package,
                  path: "/admin/orders",
                },
                {
                  id: "qa-inv",
                  label: "Check Inventory",
                  icon: Box,
                  path: "/admin/inventory",
                },
              ].map((action) => (
                <button
                  key={action.id}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 border border-transparent rounded-xl hover:bg-[#2F6FD6] hover:text-white transition-all text-left group"
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

      {/* Low Stock Dialog */}
      <Dialog
        open={showLowStockModal}
        onOpenChange={setShowLowStockModal}
      >
        <DialogContent className="max-w-2xl bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-[#2F6FD6]" /> Low
              Stock Alerts
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {lowStock.length === 0 ? (
              <p className="text-center py-4 text-base font-bold text-slate-600">
                All items are well-stocked!
              </p>
            ) : (
              lowStock.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <h4 className="text-base font-bold text-slate-800">
                      {item.name}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 uppercase">
                      {item.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-red-500">
                      {item.quantity} {item.unit}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Stock Left
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLowStockModal(false)}
              className="font-bold"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowLowStockModal(false);
                navigate("/admin/inventory");
              }}
              className="bg-[#2F6FD6] text-white font-bold"
            >
              Manage Inventory
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}