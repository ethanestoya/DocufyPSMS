// Sectioned navigation model for the EXISTING single sidebar. Items are
// grouped by the job they belong to (WORK / TEAM / SETTINGS) rather than by
// department, so the heading carries the grouping and no heading repeats a
// row. Orders is the only expandable parent — the only genuine hierarchy.
// Walk-in Transactions is deliberately NOT a row: it is a create action and
// lives pinned under the brand instead. Customers keep the legacy flat menu.
import React from "react";
import {
  LayoutDashboard,
  Package,
  CreditCard,
  Boxes,
  Briefcase,
  Users,
  Tag,
  QrCode,
  LayoutTemplate,
  ShieldCheck,
  History,
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
// WORK — the daily loop: look at the numbers, move orders, verify payments,
// keep stock.
const dashboard = {
  label: "Dashboard",
  path: "/admin/dashboard",
  icon: <LayoutDashboard className="w-5 h-5" />,
};

// Orders is the one expandable parent: "All Orders" (the live queue),
// "Pickup Monitoring" and "Unclaimed Orders" render inline underneath it.
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

const inventory = {
  label: "Inventory",
  path: "/admin/inventory",
  icon: <Boxes className="w-5 h-5" />,
};

// TEAM — the people side. Attendance is part of Staff Management (the old
// /admin/attendance route redirects there), so it is not a row of its own.
const staffManagement = {
  label: "Staff Management",
  path: "/admin/staff",
  icon: <Users className="w-5 h-5" />,
};

const jobBoard = {
  label: "Job Board",
  path: "/admin/job-board",
  icon: <Briefcase className="w-5 h-5" />,
};

// SETTINGS — everything that changes how the shop behaves for customers.
const pricing = {
  label: "Pricing Management",
  path: "/admin/pricing",
  icon: <Tag className="w-5 h-5" />,
};

const paymentMethods = {
  label: "Payment Methods",
  path: "/admin/payment-methods",
  icon: <QrCode className="w-5 h-5" />,
};

const landingPage = {
  label: "Landing Page",
  path: "/admin/landing",
  icon: <LayoutTemplate className="w-5 h-5" />,
};

const termsPrivacy = {
  label: "Terms & Privacy",
  path: "/admin/legal",
  icon: <ShieldCheck className="w-5 h-5" />,
};

const auditTrail = {
  label: "Audit Trail",
  path: "/admin/audit-trail",
  icon: <History className="w-5 h-5" />,
};

export const adminSections: NavSection[] = [
  {
    key: "work",
    label: "WORK",
    items: [dashboard, orders, paymentVerification, inventory],
  },
  {
    key: "team",
    label: "TEAM",
    items: [staffManagement, jobBoard],
  },
  {
    key: "settings",
    label: "SETTINGS",
    items: [pricing, paymentMethods, landingPage, termsPrivacy, auditTrail],
  },
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
    key: "work",
    label: "WORK",
    items: [
      staffDashboard,
      staffOrders,
      staffPaymentVerification,
      staffInventory,
      staffTimesheet,
    ],
  },
];
