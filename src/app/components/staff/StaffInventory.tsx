import React from "react";
import {
  LayoutDashboard,
  Clock,
  Package,
  ShoppingCart,
  CreditCard,
  Boxes,
} from "lucide-react";
import InventoryManagement from "../admin/InventoryManagement";

const staffMenuItems = [
  {
    label: "Dashboard",
    path: "/staff/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Clock-In & Timesheet",
    path: "/staff/timesheet",
    icon: <Clock className="w-5 h-5" />,
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
    label: "Orders",
    path: "/staff/queue",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Inventory",
    path: "/staff/inventory",
    icon: <Boxes className="w-5 h-5" />,
  },
];

// Staff now get the SAME full inventory module as admin (add/edit/archive,
// stock in/out, papers left, low-stock alerts, and reports). This reuses the
// shared admin InventoryManagement component with the staff sidebar menu.
export default function StaffInventory() {
  return <InventoryManagement menuItems={staffMenuItems} title="Inventory" />;
}
