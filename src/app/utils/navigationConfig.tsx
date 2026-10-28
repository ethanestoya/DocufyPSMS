// Sectioned navigation model for the EXISTING single sidebar.
// The sidebar stays one component; its items are grouped under section
// headings (MAIN / MANAGEMENT). The MANAGEMENT section contains a single
// expandable parent row (Management) whose children render inline underneath
// it inside this same sidebar — never in a second panel. Customers keep the
// legacy flat menu.
import React from "react";
import {
  LayoutDashboard,
  Package,
  CreditCard,
  ShoppingCart,
  Boxes,
  Briefcase,
  SlidersHorizontal,
  Clock,
} from "lucide-react";

export type NavChild = {
  label: string;
  path: string;
};

export type NavModule = {
  label: string;
  path: string;
  icon: React.ReactNode;
  children?: NavChild[];
};

export type NavSection = {
  key: string;
  label: string;
  items: NavModule[];
};

export const pathBase = (path: string) => path.split("?")[0];

export const childPathMatches = (
  child: NavChild,
  pathname: string,
  search: string,
): boolean => {
  const qIndex = child.path.indexOf("?");
  const base = qIndex === -1 ? child.path : child.path.slice(0, qIndex);
  const pathMatches = pathname === base || pathname.startsWith(`${base}/`);
  if (!pathMatches) return false;
  if (qIndex === -1) return true;
  // A query-specific child only matches its exact pathname + search.
  return pathname === base && search === child.path.slice(qIndex);
};

/**
 * Picks the most specific child matching the current location. Using the
 * LONGEST matching base path means a deeper route (e.g. a card-only detail page
 * like `/admin/orders/unclaimed/history`) still highlights its nearest parent
 * child ("Unclaimed Orders") rather than the shorter catch-all child
 * ("All Orders").
 */
export const resolveActiveChild = (
  children: NavChild[],
  pathname: string,
  search: string,
): NavChild | undefined => {
  let best: NavChild | undefined;
  let bestLen = -1;
  for (const child of children) {
    if (!childPathMatches(child, pathname, search)) continue;
    const base = pathBase(child.path);
    if (base.length > bestLen) {
      bestLen = base.length;
      best = child;
    }
  }
  return best;
};

export const findActiveModule = (
  modules: NavModule[],
  pathname: string,
  search: string,
): NavModule | undefined =>
  modules.find((module) => {
    if (module.children && module.children.length > 0) {
      return resolveActiveChild(module.children, pathname, search) !== undefined;
    }
    const base = pathBase(module.path);
    return pathname === base || pathname.startsWith(`${base}/`);
  });

export const flattenSections = (sections: NavSection[]): NavModule[] =>
  sections.flatMap((section) => section.items);

// ─── Admin modules ───────────────────────────────────────────────────────────
// MAIN (first-level, directly accessible — Orders and Payment Verification are
// frequently used, so they stay as direct destinations near the top).
const dashboard = {
  label: "Dashboard",
  path: "/admin/dashboard",
  icon: <LayoutDashboard className="w-5 h-5" />,
};

// Orders is now an expandable parent with three children: "All Orders" (the
// live queue), "Pickup Monitoring" (ready-for-pickup / overdue tracking) and
// "Unclaimed Orders" (the policy review workspace). All render inline in the
// same sidebar.
const orders = {
  label: "Orders",
  path: "/admin/orders",
  icon: <Package className="w-5 h-5" />,
  children: [
    { label: "All Orders", path: "/admin/orders" },
    { label: "Pickup Monitoring", path: "/admin/orders/pickup" },
    { label: "Unclaimed Orders", path: "/admin/orders/unclaimed" },
  ],
};

const paymentVerification = {
  label: "Payment Verification",
  path: "/admin/payment-verification",
  icon: <CreditCard className="w-5 h-5" />,
};

const walkIn = {
  label: "Walk-in Transactions",
  path: "/admin/walk-in",
  icon: <ShoppingCart className="w-5 h-5" />,
};

const inventory = {
  label: "Inventory",
  path: "/admin/inventory",
  icon: <Boxes className="w-5 h-5" />,
};

const jobBoard = {
  label: "Job Board",
  path: "/admin/job-board",
  icon: <Briefcase className="w-5 h-5" />,
};

// MANAGEMENT (expandable parent, children render inline in the same sidebar).
const management = {
  label: "Management",
  path: "/admin/staff",
  icon: <SlidersHorizontal className="w-5 h-5" />,
  children: [
    { label: "Staff Management", path: "/admin/staff" },
    { label: "Payment Methods", path: "/admin/payment-methods" },
    { label: "Pricing Management", path: "/admin/pricing" },
    { label: "Landing Page", path: "/admin/landing" },
    { label: "Terms & Privacy", path: "/admin/legal" },
    { label: "Audit Trail", path: "/admin/audit-trail" },
  ],
};

export const adminSections: NavSection[] = [
  {
    key: "main",
    label: "MAIN",
    items: [dashboard, orders, paymentVerification, walkIn, inventory, jobBoard],
  },
  { key: "management", label: "MANAGEMENT", items: [management] },
];

// ─── Staff modules (same structure; admin-only items are not exposed) ────────
const staffDashboard = {
  label: "Dashboard",
  path: "/staff/dashboard",
  icon: <LayoutDashboard className="w-5 h-5" />,
};

const staffOrders = {
  label: "Orders",
  path: "/staff/queue",
  icon: <Package className="w-5 h-5" />,
  children: [
    { label: "All Orders", path: "/staff/queue" },
    { label: "Pickup Monitoring", path: "/staff/queue/pickup" },
    { label: "Unclaimed Orders", path: "/staff/queue/unclaimed" },
  ],
};

const staffPaymentVerification = {
  label: "Payment Verification",
  path: "/staff/payment-verification",
  icon: <CreditCard className="w-5 h-5" />,
};

const staffWalkIn = {
  label: "Walk-in Transactions",
  path: "/staff/walk-in",
  icon: <ShoppingCart className="w-5 h-5" />,
};

const staffInventory = {
  label: "Inventory",
  path: "/staff/inventory",
  icon: <Boxes className="w-5 h-5" />,
};

// Clock-In & Timesheet is a direct top-level staff destination (no parent menu).
const staffTimesheet = {
  label: "Clock-In & Timesheet",
  path: "/staff/timesheet",
  icon: <Clock className="w-5 h-5" />,
};

export const staffSections: NavSection[] = [
  {
    key: "main",
    label: "MAIN",
    items: [
      staffDashboard,
      staffOrders,
      staffPaymentVerification,
      staffWalkIn,
      staffInventory,
      staffTimesheet,
    ],
  },
];
