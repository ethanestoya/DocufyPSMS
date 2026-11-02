import React from "react";
import {
  LayoutGrid,
  ShoppingCart,
  Package,
  Clock,
  CreditCard,
  Boxes,
} from "lucide-react";
import AdminDashboard from "../admin/AdminDashboard";
import { useAuth } from "../../contexts/AuthContext";

const menuItems = [
  {
    label: "Dashboard",
    path: "/staff/dashboard",
    icon: <LayoutGrid className="w-5 h-5" />,
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

export default function StaffDashboard() {
  const { user } = useAuth();

  return (
    <AdminDashboard
      menuItems={menuItems}
      role="staff"
      userName={user?.name?.split(" ")[0]}
    />
  );
}
