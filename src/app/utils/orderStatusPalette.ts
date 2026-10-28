// Cohesive pastel color system for print-order statuses.
// bg   = soft pastel background (always shown, not just when selected)
// accent = stronger color used for icons, borders, selected ring
// label  = slightly stronger accent for descriptive/status text
// chip   = tinted background for the icon circle
// Classes are written as literal Tailwind strings so the scanner picks them up.

export type OrderStatusKey =
  | "all"
  | "inQueue"
  | "printing"
  | "completed"
  | "released"
  | "canceled"
  | "awaitingPayment";

export interface OrderStatusStyle {
  bg: string;
  accent: string;
  hover: string;
  hoverBg: string;
  chip: string;
  icon: string;
  label: string;
  badge: string;
}

export const ORDER_STATUS_STYLES: Record<OrderStatusKey, OrderStatusStyle> = {
  all: {
    bg: "bg-[#EAF3FF]",
    accent: "border-[#3B82F6]",
    hover: "hover:border-[#3B82F6]",
    hoverBg: "hover:bg-[#EAF3FF]",
    chip: "bg-[#3B82F6]/10",
    icon: "text-[#3B82F6]",
    label: "text-[#2563EB]",
    badge: "bg-[#EAF3FF] text-[#2563EB] border-[#3B82F6]/40",
  },
  inQueue: {
    bg: "bg-[#FFF5D6]",
    accent: "border-[#F59E0B]",
    hover: "hover:border-[#F59E0B]",
    hoverBg: "hover:bg-[#FFF5D6]",
    chip: "bg-[#F59E0B]/15",
    icon: "text-[#F59E0B]",
    label: "text-[#B45309]",
    badge: "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40",
  },
  printing: {
    bg: "bg-[#F0EAFE]",
    accent: "border-[#7C3AED]",
    hover: "hover:border-[#7C3AED]",
    hoverBg: "hover:bg-[#F0EAFE]",
    chip: "bg-[#7C3AED]/10",
    icon: "text-[#7C3AED]",
    label: "text-[#6D28D9]",
    badge: "bg-[#F0EAFE] text-[#6D28D9] border-[#7C3AED]/40",
  },
  completed: {
    bg: "bg-[#E8F7D8]",
    accent: "border-[#55A630]",
    hover: "hover:border-[#55A630]",
    hoverBg: "hover:bg-[#E8F7D8]",
    chip: "bg-[#55A630]/10",
    icon: "text-[#55A630]",
    label: "text-[#3B7A1E]",
    badge: "bg-[#E8F7D8] text-[#3B7A1E] border-[#55A630]/40",
  },
  released: {
    bg: "bg-[#E0F7F5]",
    accent: "border-[#159A9C]",
    hover: "hover:border-[#159A9C]",
    hoverBg: "hover:bg-[#E0F7F5]",
    chip: "bg-[#159A9C]/10",
    icon: "text-[#159A9C]",
    label: "text-[#0F766E]",
    badge: "bg-[#E0F7F5] text-[#0F766E] border-[#159A9C]/40",
  },
  canceled: {
    bg: "bg-[#FDE8E8]",
    accent: "border-[#DC2626]",
    hover: "hover:border-[#DC2626]",
    hoverBg: "hover:bg-[#FDE8E8]",
    chip: "bg-[#DC2626]/10",
    icon: "text-[#DC2626]",
    label: "text-[#B91C1C]",
    badge: "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40",
  },
  awaitingPayment: {
    bg: "bg-[#FEF3C7]",
    accent: "border-[#F59E0B]",
    hover: "hover:border-[#F59E0B]",
    hoverBg: "hover:bg-[#FEF3C7]",
    chip: "bg-[#F59E0B]/10",
    icon: "text-[#B45309]",
    label: "text-[#B45309]",
    badge: "bg-[#FEF3C7] text-[#B45309] border-[#F59E0B]/40",
  },
};

// Title-case customer/display strings (e.g. "Received", "In Queue") map to keys.
export const STATUS_DISPLAY_TO_KEY: Record<string, OrderStatusKey> = {
  "All Orders": "all",
  All: "all",
  "In Queue": "inQueue",
  Printing: "printing",
  Completed: "completed",
  Released: "released",
  Canceled: "canceled",
  "Awaiting Payment": "awaitingPayment",
  "Awaiting Verification": "awaitingPayment",
  // Legacy statuses folded into the new workflow
  Received: "all",
  "On Hold": "all",
};

export function getOrderStatusStyle(status?: string): OrderStatusStyle {
  if (!status) return ORDER_STATUS_STYLES.all;
  if (status in ORDER_STATUS_STYLES) return ORDER_STATUS_STYLES[status as OrderStatusKey];
  return ORDER_STATUS_STYLES[STATUS_DISPLAY_TO_KEY[status] ?? "all"];
}

// Pill/badge classes for order-status badges shown in lists, dialogs and customer pages.
export function getStatusBadgeClasses(status?: string): string {
  return getOrderStatusStyle(status).badge;
}

// Customer-facing status label: once a payment reference has been submitted the
// order is "Awaiting Verification" (payment sent, not yet confirmed by staff).
// Before any reference is submitted it stays "Awaiting Payment".
export function getCustomerStatusLabel(order?: {
  status?: string;
  paymentReferenceNumber?: string;
} | null): string {
  if (order?.status === "Awaiting Payment" && order.paymentReferenceNumber) {
    return "Awaiting Verification";
  }
  return order?.status ?? "";
}
