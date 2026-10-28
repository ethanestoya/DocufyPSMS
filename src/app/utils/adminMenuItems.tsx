// Shared admin sidebar menu items — import this in every admin page
// so the navigation stays consistent whenever items are added/removed.
import React from "react";
import {
  LayoutDashboard,
  CreditCard,
  QrCode,
  Package,
  Boxes,
  Users,
  Briefcase,
  ShoppingCart,
  BadgeDollarSign,
  MonitorPlay,
  ScrollText,
  History,
} from "lucide-react";

export const adminMenuItems = [
  {
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Walk-in Transactions",
    path: "/admin/walk-in",
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: "Payment Verification",
    path: "/admin/payment-verification",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: "Payment Methods",
    path: "/admin/payment-methods",
    icon: <QrCode className="w-5 h-5" />,
  },
  {
    label: "Orders",
    path: "/admin/orders",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Inventory",
    path: "/admin/inventory",
    icon: <Boxes className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/admin/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    label: "Staff Management",
    path: "/admin/staff",
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: "Pricing Management",
    path: "/admin/pricing",
    icon: <BadgeDollarSign className="w-5 h-5" />,
  },
  {
    label: "Landing Page",
    path: "/admin/landing",
    icon: <MonitorPlay className="w-5 h-5" />,
  },
  {
    label: "Terms & Privacy",
    path: "/admin/legal",
    icon: <ScrollText className="w-5 h-5" />,
  },
  {
    label: "Audit Trail",
    path: "/admin/audit-trail",
    icon: <History className="w-5 h-5" />,
  },
];
