import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  Clock,
  Printer,
  Package as PackageIcon,
  Briefcase,
  Eye,
  AlertCircle,
  Calendar,
  File,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  X,
  ArrowLeft,
  MapPin,
  Info,
  AlertTriangle,
  Copy,
  Wallet,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { DetailSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { getOrderStatusStyle, getStatusBadgeClasses, getCustomerStatusLabel } from "../../utils/orderStatusPalette";
import { formatPHTime, formatPHDate, formatPHDateTime } from "../../utils/pht";
import { formatCurrency } from "../../utils/formatNumber";
import { PaymentDeadlineCountdown } from "../shared/PaymentDeadlineCountdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { FileAttachments } from "../ui/file-attachments";
import { dataStore } from "../../utils/dataStore";
import { notificationStore } from "../../utils/notificationStore";
import ShopStatusBanner from "../shared/ShopStatusBanner";
import { OrderReceiptDialog } from "../shared/OrderReceipt";
import { generateReceiptData } from "../../utils/invoiceUtils";
import { pricingStore, formatPrice, type PricingValues } from "../../utils/pricingStore";
import { landingContentStore, DEFAULT_MAP_EMBED } from "../../utils/landingContentStore";
import { computeOrderPayment, type OrderPaymentSummary } from "../shared/OrderPaymentSummary";
import { shopPhotosStore, type ShopPhoto } from "../../utils/shopPhotosStore";
import { useUnclaimedOffenses } from "../../utils/useUnclaimedOffenses";

const OFFENSE_WORDS: Record<number, string> = {
  1: "First",
  2: "Second",
  3: "Third",
  4: "Fourth",
  5: "Fifth",
  6: "Sixth",
  7: "Seventh",
  8: "Eighth",
  9: "Ninth",
  10: "Tenth",
};

/** "First" / "Second" / … for small ordinals; a numeric fallback beyond ten. */
function ordinalWord(n: number): string {
  return OFFENSE_WORDS[n] ?? `${n}th`;
}

/** "1 page" / "2 pages" — keeps the mobile copy grammatical at every count. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Bottom-sheet shell used by the mobile Order Tracking layout: a panel pinned to
 * the bottom of the screen with a grabber, an icon + title header, its own close
 * button, and a single scrolling body. The shared Dialog supplies the portal,
 * focus trap and Escape handling, so only the surface is restyled here.
 */
function MobileSheet({
  open,
  onOpenChange,
  icon,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // Focus the panel itself when the sheet opens (instead of the close button, as
  // Radix would), so the sheet announces its title and no focus ring lands on X.
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={panelRef}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          panelRef.current?.focus({ preventScroll: true });
        }}
        aria-describedby={undefined}
        className="fixed inset-x-0 bottom-0 left-0 top-auto z-50 flex max-h-[90vh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-[28px] rounded-b-none border-0 bg-white p-0 shadow-[0_-10px_40px_rgba(15,23,42,0.18)] outline-none data-[state=open]:slide-in-from-bottom-full data-[state=open]:duration-300 data-[state=closed]:slide-out-to-bottom-full data-[state=closed]:duration-200 sm:max-w-full [&>[data-slot=dialog-close]]:hidden"
      >
        <div className="flex flex-shrink-0 justify-center pb-1 pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        <div className="flex flex-shrink-0 items-start gap-3 px-4 pb-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#1668D9]">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-bold leading-tight text-slate-900">
              {title}
            </DialogTitle>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-7">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Tappable row in the mobile "Order Details" list; opens the matching sheet. */
function MobileDetailRow({
  icon,
  title,
  subtitle,
  onClick,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-[#C7DCFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-2 active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#1668D9]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {subtitle}
          </span>
        )}
      </span>
      {action ?? (
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" aria-hidden="true" />
      )}
    </button>
  );
}

/** Label above value, used in the sheet grids. */
function SheetField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

const menuItems = [
  {
    label: "Dashboard",
    path: "/customer/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Print Request",
    path: "/customer/new-request",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "My Orders",
    path: "/customer/orders",
    icon: <PackageIcon className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/customer/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
];

export default function OrderTracking() {
  const hydrating = useHydrating();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showColorBreakdown, setShowColorBreakdown] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [orderData, setOrderData] = useState(
    dataStore.getOrderById(orderId || ""),
  );  const [pricing, setPricing] = useState<PricingValues>(pricingStore.getPricing());
  const [shopContent, setShopContent] = useState(() => landingContentStore.getContent());
  const [shopLocationOpen, setShopLocationOpen] = useState(false);
  const [showShopPhotos, setShowShopPhotos] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [unclaimedDialogOpen, setUnclaimedDialogOpen] = useState(false);
  // Which bottom sheet the mobile Order Details list has open.
  const [activeSheet, setActiveSheet] = useState<
    "printing" | "payment" | "cost" | null
  >(null);
  const [shopPhotos, setShopPhotos] = useState<ShopPhoto[]>(() => shopPhotosStore.getPhotos());

  useEffect(() => {
    const load = () => setShopContent(landingContentStore.getContent());
    const unsubscribe = landingContentStore.subscribe(load);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const load = () => setShopPhotos(shopPhotosStore.getPhotos());
    const unsubscribe = shopPhotosStore.subscribe(load);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const load = () => setPricing(pricingStore.getPricing());
    const unsubscribe = pricingStore.subscribe(load);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setOrderData(dataStore.getOrderById(orderId || ""));
    });
    return unsubscribe;
  }, [orderId]);

  // Poll so admin/staff status & payment changes appear live without a manual
  // refresh (realtime delivery is not reliable for the customer session).
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await dataStore.refreshFromBackend();
      } catch {
        // keep stale data on failure
      }
      const next = dataStore.getOrderById(orderId || "");
      if (next) setOrderData(next);
    };

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(refresh, 8000);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderId]);

  const currentOrderStatus = orderData?.status || "Awaiting Payment";
  const statusStyle = getOrderStatusStyle(currentOrderStatus);
  const currentOrderLabel = getCustomerStatusLabel(orderData);
  const holdReason = orderData?.holdReason;
  const canCancelOrder = ["In Queue", "Awaiting Payment"].includes(currentOrderStatus);

  // The receipt is available for EVERY order (any status, incl. Canceled) —
  // built fresh from the stored order on each render.
  const receiptData = useMemo(
    () => (orderData ? generateReceiptData(orderData) : null),
    [orderData],
  );

  // Determine if order is completed or released
  const isOrderCompleted =
    currentOrderStatus === "Completed" ||
    currentOrderStatus === "Released";
  const isAwaitingPayment = currentOrderStatus === "Awaiting Payment";

  // Derived unclaimed-offense state for this order's customer (shared source of
  // truth — recomputed from the authoritative order data + status timeline,
  // never stored). The record for THIS order tells us whether it went unclaimed.
  const { summary: unclaimedSummary } = useUnclaimedOffenses(orderData?.customerEmail);
  const isUnclaimed =
    unclaimedSummary?.records.some((r) => r.orderId === (orderId || "")) ?? false;

  // ── Pickup information — real data only. The pickup date/time come from the
  // order timeline (when it last changed status), the location from the
  // admin-configured shop content, and the status from the order + the
  // pickup-incident preview state — nothing here is hardcoded.
  const orderTotalNumber = (() => {
    if (orderData?.costBreakdown?.total != null) return orderData.costBreakdown.total;
    const raw: unknown = orderData?.total;
    if (typeof raw === "number") return raw;
    const parsed = parseFloat(String(raw ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  })();

  const paymentSummary: OrderPaymentSummary = orderData
    ? computeOrderPayment({
        total: orderTotalNumber,
        costBreakdown: orderData.costBreakdown,
        paymentVerified: orderData.paymentVerified,
        downPaymentRequired: orderData.downPaymentRequired,
        downPaymentVerified: orderData.downPaymentVerified,
        downPaymentAmount: orderData.downPaymentAmount,
        fullPaymentRequired: orderData.fullPaymentRequired,
        fullPaymentVerified: orderData.fullPaymentVerified,
        fullPaymentAmount: orderData.fullPaymentAmount,
      })
    : {
        total: 0,
        amountPaid: 0,
        remaining: 0,
        status: "Payment Due",
        fullPaymentRequired: false,
        downPaymentRequired: false,
      };

  const pickupRemaining = paymentSummary.remaining;

  const pickupStatus = isUnclaimed
    ? { label: "Unclaimed", className: "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40" }
    : currentOrderStatus === "Released"
      ? { label: "Picked Up", className: "bg-[#E0F7F5] text-[#0F766E] border-[#159A9C]/40" }
      : { label: "Ready for Pickup", className: "bg-[#E8F7D8] text-[#3B7A1E] border-[#55A630]/40" };

  const pickupTimelineInstant =
    orderData?.statusUpdatedAt ?? orderData?.lastUpdatedAt ?? orderData?.createdAt;
  const pickupDate = pickupTimelineInstant
    ? formatPHDate(pickupTimelineInstant, "long")
    : "";
  const pickupTime = pickupTimelineInstant
    ? formatPHTime(pickupTimelineInstant)
    : "";
  const pickupLocation = (shopContent.locationLines || [])
    .filter(Boolean)
    .join(", ");

  const UNCLAIMED_MESSAGE =
    "This order was recorded as unclaimed and is no longer available for collection. Please contact the shop if you need assistance.";

  const pickupNote = isUnclaimed
    ? UNCLAIMED_MESSAGE
    : currentOrderStatus === "Released"
      ? "This order has already been collected. Thank you for choosing Docufy."
      : pickupRemaining > 0
        ? `Bring a valid ID and your order reference when collecting. A remaining balance of ${formatCurrency(pickupRemaining)} can be paid at the shop.`
        : "Bring a valid ID and your order reference when collecting your order during shop hours.";

  // Offense label — the rank of THIS order among the customer's unclaimed
  // orders (chronological), never hardcoded: a first unclaimed order reads
  // "First Offense", a repeat reads "Second Offense", etc. Left blank when the
  // rank cannot be resolved from the derived data.
  const unclaimedOffenseLabel = (() => {
    if (!isUnclaimed || !unclaimedSummary) return "";
    const rank = unclaimedSummary.records.findIndex(
      (r) => r.orderId === (orderId || ""),
    );
    return rank >= 0 ? `${ordinalWord(rank + 1)} Offense` : "";
  })();

  const handleDownloadFile = (fileName: string) => {
    const content = `[Docufy PSMS - Palawan State University]\nFile: ${fileName}\nOrder ID: ${orderId}\n\nThis is a placeholder download for the submitted document.\nActual file content would be served from the server.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Downloading ${fileName}...`);
  };

  const handleCancelOrder = () => {
    if (!orderId || !cancellationReason.trim()) return;

    dataStore.updateOrder(orderId, {
      status: "Canceled",
      cancellationReason: cancellationReason.trim(),
    });

    notificationStore.addNotification(
      "order",
      "Order Canceled by Customer",
      `Order #${orderData?.displayId ?? orderId} was canceled by the customer.`,
      { clickable: true, relatedOrderId: orderId, recipientRole: "admin" },
    );
    notificationStore.addNotification(
      "order",
      "Order Canceled by Customer",
      `Order #${orderData?.displayId ?? orderId} was canceled by the customer.`,
      { clickable: true, relatedOrderId: orderId, recipientRole: "staff" },
    );

    setShowCancelDialog(false);
    setCancellationReason("");
    toast.success("Order has been canceled successfully.");
  };

  const attachedFiles = orderData?.attachedFiles || [];

  const getFileOption = (file: any, key: string, fallback: any) =>
    file?.[key] ?? orderData?.[key as keyof typeof orderData] ?? fallback;

  const formatPaperSize = (val: any): string => {
    if (!val || val === "N/A") return "N/A";
    if (val === "a4") return "A4";
    if (val === "a3") return "A3";
    if (val === "a5") return "A5";
    if (val === "letter") return "Letter";
    if (val === "legal") return "Legal";
    if (val === "short") return "Short";
    if (val === "long") return "Long";
    if (val === "folio") return "Folio";
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  };

  // Per-file labels shared by the mobile rows and sheet (the desktop block below
  // keeps its own inline copies untouched).
  const colorModeLabel = (file: any): string => {
    const mode = getFileOption(file, "colorMode", "");
    if (mode === "bw") return "Black & White";
    if (mode === "colored") return "Colored";
    return orderData?.printType || "N/A";
  };

  const pageRangeLabel = (file: any): string => {
    if (getFileOption(file, "pageRange", "all") !== "all") {
      const specific = getFileOption(file, "specificPages", "");
      if (specific) return `Pages: ${specific}`;
    }
    return "All Pages";
  };

  // ── Mobile view ───────────────────────────────────────────────────────────
  const displayOrderId = orderData?.displayId || orderId || "";
  const placedInstant = orderData?.createdAt || orderData?.date;
  const mobileFileCount = attachedFiles.length;
  const mobileTotalPages =
    attachedFiles.reduce(
      (sum, file) => sum + (Number(getFileOption(file, "pageCount", 0)) || 0),
      0,
    ) || (orderData?.pages ?? 0);
  const mobileCopies = orderData?.copies || 1;
  const paymentMethodLabel =
    orderData?.paymentMethod === "Cash"
      ? "Cash on Pickup"
      : orderData?.paymentMethod || "Not specified";

  const addonsTotal = (orderData?.addons || []).reduce(
    (sum, addon) => sum + addon.price * addon.quantity,
    0,
  );
  const printingCost = Math.max(orderTotalNumber - addonsTotal, 0);

  // One short word for the status card's PAYMENT cell — the full story lives in
  // the payment sheet, and a long label there wraps the whole meta row.
  const paymentMetaLabel = (() => {
    if (paymentSummary.status === "Paid") return "Paid";
    if (paymentSummary.status === "Partially Paid") return "50% Paid";
    if (orderData?.paymentReferenceNumber) return "Pending";
    return "Unpaid";
  })();

  const paymentMetaPaid = paymentSummary.status !== "Payment Due";

  // The mobile payment sheet's headline state + explanation, derived from the
  // same stored flags the desktop card reads — nothing invented.
  const mobilePaymentState = (() => {
    if (!orderData) {
      return { title: "Not available", note: "", verified: false };
    }
    if (orderData.status === "Canceled") {
      return {
        title: "Canceled",
        note: "This order was canceled, so no payment is collected.",
        verified: false,
      };
    }
    if (orderData.paymentMethod === "Cash") {
      return orderData.paymentVerified
        ? {
            title: "Paid at the Shop",
            note: "Payment confirmed — order is being processed.",
            verified: true,
          }
        : {
            title: "Awaiting Payment at Shop",
            note: `Pay ${formatPrice(
              paymentSummary.total,
            )} in cash at the shop before the deadline.`,
            verified: false,
          };
    }
    if (orderData.downPaymentRequired || orderData.downPaymentVerified) {
      const down = orderData.downPaymentAmount || 0;
      const balance = Math.max(paymentSummary.total - down, 0);
      return orderData.downPaymentVerified
        ? {
            title: "Down Payment Verified",
            note: `${formatPrice(down)} (50% down) paid via ${paymentMethodLabel} — ${formatPrice(
              balance,
            )} balance due on pickup.`,
            verified: true,
          }
        : {
            title: "Awaiting Down Payment",
            note: `Pay at least ${formatPrice(
              down,
            )} (50% down) via ${paymentMethodLabel} before printing — balance due on pickup.`,
            verified: false,
          };
    }
    if (orderData.paymentVerified) {
      return {
        title: "Paid",
        note: `Payment verified via ${paymentMethodLabel}.`,
        verified: true,
      };
    }
    return {
      title: "Pending Verification",
      note: "Your payment is being verified by admin or staff.",
      verified: false,
    };
  })();

  /** Icon for the mobile status card, in the status palette's own color. */
  const statusIconNode = (cls: string) => {
    switch (currentOrderStatus) {
      case "Printing":
        return <Printer className={cls} />;
      case "In Queue":
        return <Clock className={cls} />;
      case "Completed":
        return <CheckCircle className={cls} />;
      case "Released":
        return <PackageIcon className={cls} />;
      case "Canceled":
        return <X className={cls} />;
      default:
        return <Clock className={cls} />;
    }
  };

  const sheetSubtitleFiles = `${plural(mobileFileCount, "file")} · ${plural(
    mobileTotalPages,
    "page",
  )} · ${plural(mobileCopies, "copy", "copies")} each`;

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(displayOrderId);
      toast.success("Order ID copied");
    } catch {
      toast.error("Couldn't copy the order ID");
    }
  };

  return (
    <Layout
      menuItems={menuItems}
      title="Order Tracking"
      showBackButton
      backButtonPath="/customer/orders"
      hideMobileBackButton
    >
      {hydrating ? (
        <div className="mx-auto max-w-4xl">
          <DetailSkeleton blocks={3} label="Loading your order" />
        </div>
      ) : (
      <div className="max-w-4xl mx-auto space-y-4">
        <ShopStatusBanner />

        {/* ── MOBILE ─────────────────────────────────────────────────────────
            Phone layout: one status card, an unclaimed/payment notice, the
            pickup panel, then a tappable "Order Details" list whose rows open
            bottom sheets. The stacked desktop cards below only render from md. */}
        <div className="space-y-4 md:hidden">
          <button
            type="button"
            onClick={() => navigate("/customer/orders")}
            aria-label="Go back"
            className="-ml-1 inline-flex items-center gap-1.5 rounded-lg py-1 text-[15px] font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>

          <header>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900">
              Order Tracking
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Track your print job status · Order{" "}
              <span className="font-semibold text-slate-700 whitespace-nowrap">
                {displayOrderId}
              </span>
            </p>
          </header>

          {/* Current status + total/payment/placed, in one card. */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
            <div className={`border-l-4 p-4 ${statusStyle.accent}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-[#FBFDFF] py-1 pl-2.5 pr-1">
                  <span className="truncate font-mono text-[11px] font-semibold tracking-tight text-slate-600">
                    {displayOrderId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    aria-label="Copy order ID"
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isUnclaimed && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#F0D9AE] bg-[#FFF6E6] px-2.5 py-1 text-[11px] font-semibold text-[#92610C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" aria-hidden="true" />
                    Unclaimed
                  </span>
                )}
              </div>

              <div className="mt-3.5 flex items-center gap-3">
                <span
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${statusStyle.bg}`}
                >
                  {statusIconNode(`h-6 w-6 ${statusStyle.icon}`)}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                    Current Status
                  </p>
                  <p
                    className={`truncate text-[26px] font-bold leading-tight ${statusStyle.label}`}
                  >
                    {currentOrderLabel}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-3 border-t border-slate-100 pt-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                    Total
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold text-slate-900">
                    {formatPrice(orderTotalNumber)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                    Payment
                  </p>
                  <p
                    className={`mt-0.5 text-[15px] font-bold ${
                      paymentMetaPaid ? "text-[#3B7A1E]" : "text-slate-900"
                    }`}
                  >
                    {paymentMetaLabel}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                    Placed
                  </p>
                  <p className="mt-0.5 text-[13px] font-bold text-slate-900">
                    {placedInstant ? formatPHDate(placedInstant, "short") : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {placedInstant ? formatPHTime(placedInstant) : ""}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Awaiting payment: the deadline lives here so it isn't lost now that
              the desktop amber card is hidden on phones. */}
          {isAwaitingPayment && (
            <section className="rounded-2xl border border-[#F3D9A4] bg-[#FFF9EE] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FDEBC8]">
                  <Clock className="h-4 w-4 text-[#B45309]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#8A5007]">
                    {orderData?.cancellationReason === "Payment Deadline Expired"
                      ? "Payment deadline expired"
                      : "Payment needed before printing"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#8A5007]">
                    {holdReason ||
                      (orderData?.paymentMethod === "Cash"
                        ? "Pay in cash at the shop to confirm this order."
                        : "Your online payment is pending verification.")}
                  </p>
                  {orderData?.paymentMethod === "Cash" &&
                    orderData?.paymentDeadline && (
                      <div className="mt-2 rounded-xl border border-[#F3D9A4] bg-white/70 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#92610C]">
                          Pay before
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold text-[#8A5007]">
                          {formatPHDateTime(orderData.paymentDeadline)}
                        </p>
                        <div className="mt-1">
                          <PaymentDeadlineCountdown
                            deadline={orderData.paymentDeadline}
                          />
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </section>
          )}

          {/* Unclaimed order notice */}
          {isUnclaimed && (
            <button
              type="button"
              onClick={() => setUnclaimedDialogOpen(true)}
              aria-haspopup="dialog"
              className="flex w-full flex-col gap-2 rounded-2xl border border-[#F3D9A4] bg-[#FFF9EE] p-4 text-left transition-colors hover:bg-[#FFF4E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FDEBC8]">
                  <AlertTriangle className="h-5 w-5 text-[#B45309]" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-[#8A5007]">
                    Unclaimed Order
                  </span>
                  {unclaimedOffenseLabel && (
                    <span className="rounded border border-[#E3C08A] bg-[#FDF1DC] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#A16207]">
                      {unclaimedOffenseLabel}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="h-5 w-5 flex-shrink-0 text-[#B45309]"
                  aria-hidden="true"
                />
              </span>
              <span className="text-xs leading-relaxed text-[#8A5007]">
                {UNCLAIMED_MESSAGE}
              </span>
            </button>
          )}

          {/* Pickup information */}
          {isOrderCompleted && (
            <section className="rounded-2xl border border-[#DCE9FB] bg-[#F5F9FF] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1668D9] shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                  <MapPin className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Pickup Information
                </h2>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-[#DCE9FB] bg-white">
                <div className="grid grid-cols-2 divide-x divide-[#E8EFFA]">
                  <div className="min-w-0 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                      Pickup Date
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {pickupDate || "Not available"}
                    </p>
                  </div>
                  <div className="min-w-0 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                      Pickup Time
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {pickupTime || "Not available"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-[#E8EFFA] p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                    <MapPin className="h-3 w-3 text-[#1668D9]" aria-hidden="true" />
                    Pickup Location
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug text-slate-700">
                    {pickupLocation || "Docufy Printing Services"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShopLocationOpen(true)}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1668D9] text-sm font-semibold text-white transition-colors hover:bg-[#10316B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                <MapPin className="h-4 w-4" />
                View Shop Location
              </button>

              {!isUnclaimed && pickupRemaining > 0 && (
                <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
                  A remaining balance of {formatPrice(pickupRemaining)} is
                  collected at the shop.
                </p>
              )}
            </section>
          )}

          {/* Order details — tap a row to open its sheet. */}
          <section className="space-y-2.5">
            <div className="flex items-end justify-between px-0.5">
              <h2 className="text-lg font-bold text-slate-900">Order Details</h2>
              <span className="text-[11px] text-slate-400">Tap to view</span>
            </div>

            <MobileDetailRow
              icon={<Printer className="h-5 w-5" />}
              title="Printing Details"
              subtitle={sheetSubtitleFiles}
              onClick={() => setActiveSheet("printing")}
            />
            <MobileDetailRow
              icon={<Wallet className="h-5 w-5" />}
              title="Payment Method and Status"
              subtitle={`${paymentMethodLabel} · ${paymentMetaLabel}`}
              onClick={() => setActiveSheet("payment")}
            />
            <MobileDetailRow
              icon={<FileText className="h-5 w-5" />}
              title="Cost Breakdown"
              subtitle={`${formatPrice(orderTotalNumber)} total`}
              onClick={() => setActiveSheet("cost")}
            />

            {orderData && receiptData && (
              <button
                type="button"
                onClick={() => setShowReceipt(true)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-[#C7DCFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#1668D9]">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">
                    Order Receipt
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-500">
                    {receiptData.receiptNumber}
                  </span>
                  <span className="block text-[11px] font-semibold leading-4 text-slate-600">
                    {formatPrice(receiptData.total)}
                  </span>
                </span>
                <span className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#CDE0FA] bg-[#F4F8FF] px-3 text-xs font-semibold text-[#1668D9] transition-colors group-hover:border-[#1668D9] group-hover:bg-[#1668D9] group-hover:text-white">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  View Receipt
                </span>
              </button>
            )}
          </section>

          <p className="px-1 pb-1 text-center text-[11px] leading-relaxed text-slate-400">
            Status and pickup details are updated by Docufy Printing Services.
          </p>

          {/* ── Bottom sheets ─────────────────────────────────────────────── */}
          <MobileSheet
            open={activeSheet === "printing"}
            onOpenChange={(open) => setActiveSheet(open ? "printing" : null)}
            icon={<Printer className="h-5 w-5" />}
            title="Printing Details"
            subtitle={sheetSubtitleFiles}
          >
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F7F9FC] p-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Order Date
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-slate-900">
                  {placedInstant ? formatPHDate(placedInstant, "short") : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Order Time
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-slate-900">
                  {placedInstant ? formatPHTime(placedInstant) : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Total Pages
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-slate-900">
                  {plural(mobileTotalPages, "page")}
                </p>
              </div>
            </div>

            <div className="mb-2 mt-4 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Files</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                {mobileFileCount}
              </span>
            </div>
            <div className="space-y-2.5">
              {attachedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#1668D9]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800">
                      {file.name}
                    </p>
                    <span className="flex-shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                      {(file.name.split(".").pop() || file.type || "")
                        .toString()
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <SheetField
                      label="Paper Size"
                      value={formatPaperSize(
                        getFileOption(file, "paperSize", "N/A"),
                      )}
                    />
                    <SheetField
                      label="Number of Copies"
                      value={getFileOption(file, "copies", 0)}
                    />
                    <SheetField
                      label="Color Mode"
                      value={colorModeLabel(file)}
                    />
                    <SheetField
                      label="Page Range"
                      value={pageRangeLabel(file)}
                    />
                    <SheetField
                      label="Total Pages"
                      value={plural(
                        Number(
                          getFileOption(
                            file,
                            "pageCount",
                            orderData?.pages || 0,
                          ),
                        ) || 0,
                        "page",
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            {mobileFileCount > 0 && (
              <>
                <div className="mb-2 mt-4 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    Attached Files
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {mobileFileCount}
                  </span>
                </div>
                <FileAttachments
                  files={attachedFiles}
                  orderId={orderId || ""}
                  showView
                  showDownload
                  labelledActions
                />
              </>
            )}

            {orderData?.notes && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold text-slate-600">
                  Additional Notes
                </p>
                <p className="whitespace-pre-wrap rounded-xl bg-[#F7F9FC] p-3 text-[13px] leading-relaxed text-slate-700">
                  {orderData.notes}
                </p>
              </>
            )}

            {orderData?.colorMode === "colored" && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#DCE9FB] bg-[#F5F9FF] p-3">
                <Info className="h-4 w-4 flex-shrink-0 text-[#1668D9]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">
                    Document Analysis
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {orderData?.pages || 0} pages · Mixed (Color &amp; B&amp;W)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    setShowColorBreakdown(true);
                  }}
                  className="flex-shrink-0 text-[11px] font-semibold text-[#1668D9] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
                >
                  View Page Color Breakdown
                </button>
              </div>
            )}
          </MobileSheet>

          <MobileSheet
            open={activeSheet === "payment"}
            onOpenChange={(open) => setActiveSheet(open ? "payment" : null)}
            icon={<Wallet className="h-5 w-5" />}
            title="Payment Method and Status"
            subtitle={`${paymentMethodLabel} · ${paymentMetaLabel}`}
          >
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                Payment Method
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Wallet className="h-4 w-4 text-[#1668D9]" aria-hidden="true" />
                {paymentMethodLabel}
              </p>
            </div>

            <div
              className={`mt-2.5 rounded-xl border p-3 ${
                mobilePaymentState.verified
                  ? "border-[#C7E7CC] bg-[#F3FBF4]"
                  : "border-[#F3D9A4] bg-[#FFF9EE]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {mobilePaymentState.verified ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#3B7A1E]" />
                ) : (
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#B45309]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {mobilePaymentState.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    {mobilePaymentState.note}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    mobilePaymentState.verified
                      ? "border-[#C7E7CC] bg-white text-[#3B7A1E]"
                      : "border-[#F3D9A4] bg-white text-[#A16207]"
                  }`}
                >
                  {mobilePaymentState.verified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-[#F7F9FC] p-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Total
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-[#1668D9]">
                  {formatPrice(paymentSummary.total)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Paid
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-slate-900">
                  {formatPrice(paymentSummary.amountPaid)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Balance
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-slate-900">
                  {formatPrice(paymentSummary.remaining)}
                </p>
              </div>
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold text-slate-600">
              Order
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3">
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5" /> Order ID
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-900">
                  {displayOrderId}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> Placed
                </span>
                <span className="text-[11px] font-semibold text-slate-900">
                  {placedInstant ? formatPHDateTime(placedInstant) : "—"}
                </span>
              </div>
            </div>
          </MobileSheet>

          <MobileSheet
            open={activeSheet === "cost"}
            onOpenChange={(open) => setActiveSheet(open ? "cost" : null)}
            icon={<FileText className="h-5 w-5" />}
            title="Cost Breakdown"
            subtitle={`${formatPrice(orderTotalNumber)} total`}
          >
            <div className="rounded-xl border border-slate-200 p-3.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">
                  Printing cost ({plural(orderData?.pages || 0, "page")} ×{" "}
                  {plural(orderData?.copies || 0, "copy", "copies")})
                </span>
                <span className="font-semibold text-slate-900">
                  {formatPrice(printingCost)}
                </span>
              </div>
              {(orderData?.addons?.length || 0) > 0 && (
                <>
                  {orderData!.addons!.map((addon, index) => (
                    <div
                      key={`${addon.name}-${index}`}
                      className="mt-2 flex justify-between gap-3"
                    >
                      <span className="min-w-0 text-slate-600">
                        {addon.name}{" "}
                        <span className="text-slate-400">× {addon.quantity}</span>
                      </span>
                      <span className="flex-shrink-0 font-medium text-slate-900">
                        {formatPrice(addon.price * addon.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between gap-3 border-t border-slate-100 pt-2">
                    <span className="text-slate-600">Add-ons subtotal</span>
                    <span className="font-semibold text-slate-900">
                      {formatPrice(addonsTotal)}
                    </span>
                  </div>
                </>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <span className="text-sm font-bold text-slate-900">
                  Grand Total
                </span>
                <span className="text-lg font-bold text-[#1668D9]">
                  {formatPrice(orderTotalNumber)}
                </span>
              </div>
            </div>

            {canCancelOrder && (
              <button
                type="button"
                onClick={() => {
                  setActiveSheet(null);
                  setCancellationReason("");
                  setShowCancelDialog(true);
                }}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-white text-sm font-semibold text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
              >
                Cancel Order
              </button>
            )}
          </MobileSheet>
        </div>

        {/* ── DESKTOP / TABLET ─────────────────────────────────────────────── */}
        <div className="hidden space-y-4 md:block">

        {/* Mobile back button (under the header) */}
        <button
          type="button"
          onClick={() => navigate("/customer/orders")}
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">
            Order Tracking
          </h2>
          <p className="text-gray-500 mt-1">
            Track your print job status - Order {orderId}
          </p>
        </div>

{/* Current Status Banner (payment details merged in) */}
        {isAwaitingPayment && (
          <Card className="p-6 bg-white border-2 border-amber-300 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700/80 mb-1">
                  Current Status
                </p>
                <h3 className="text-2xl font-bold text-amber-900 mb-2 flex items-center gap-2">
                  {orderData?.cancellationReason === "Payment Deadline Expired"
                    ? "Awaiting Payment — Cancelled (Expired)"
                    : currentOrderLabel || "Awaiting Payment"}
                </h3>
                <p className="text-base text-amber-800 mb-3 leading-relaxed">
                  <strong>Details:</strong>{" "}
                  {holdReason ||
                    (orderData?.paymentMethod === "Cash"
                      ? "Pay in cash at the shop to confirm this order."
                      : "Your online payment is pending verification.")}
                </p>
                {orderData?.paymentMethod === "Cash" &&
                  orderData?.paymentDeadline && (
                    <div className="bg-white rounded-lg p-3 border border-amber-200 mb-3">
                      <p className="text-sm text-gray-700">
                        <strong className="text-amber-900">
                          Payment deadline:
                        </strong>{" "}
                        <span className="font-mono text-base text-amber-900">
                          {formatPHDateTime(orderData.paymentDeadline)}
                        </span>
                        <span className="ml-2 inline-block">
                          <PaymentDeadlineCountdown
                            deadline={orderData.paymentDeadline}
                          />
                        </span>
                      </p>
                    </div>
                  )}
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-sm text-gray-700">
                    <strong className="text-amber-900">What to do:</strong>{" "}
                    {orderData?.paymentMethod === "Cash"
                      ? "Visit the shop and pay this amount before the deadline. The staff will confirm your payment and your order will be added to the print queue automatically."
                      : "Once Admin or Staff verifies your payment, your order will be added to the print queue automatically. You can track its progress here."}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Current Status Banner (skipped for Awaiting Payment — the amber
            card above already shows the current status) */}
        {!isAwaitingPayment && (
        <Card className={`p-5 bg-white shadow-sm border-l-4 ${statusStyle.accent}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-10 h-10 rounded-full ${statusStyle.bg} flex items-center justify-center flex-shrink-0`}>
              {currentOrderStatus === "Printing" && (
                <Printer className={`w-5 h-5 ${statusStyle.icon}`} />
              )}
              {currentOrderStatus === "In Queue" && (
                <Clock className={`w-5 h-5 ${statusStyle.icon}`} />
              )}
              {currentOrderStatus === "Completed" && (
                <CheckCircle className={`w-5 h-5 ${statusStyle.icon}`} />
              )}
              {currentOrderStatus === "Released" && (
                <PackageIcon className={`w-5 h-5 ${statusStyle.icon}`} />
              )}
              {currentOrderStatus === "Canceled" && (
                <X className={`w-5 h-5 ${statusStyle.icon}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-500 font-medium">
                  Current Status
                </p>
                {isUnclaimed && (
                  <Badge
                    variant="outline"
                    className="border text-xs font-semibold bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40"
                  >
                    Unclaimed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900 text-2xl">
                  {currentOrderLabel}
                </p>
              </div>
            </div>
          </div>
        </Card>
        )}

        {/* Pickup Information — shown above Order Details once the order is in
            the pickup phase (Completed = ready, Released = collected). */}
        {isOrderCompleted && (
          <Card className="gap-0 p-4 sm:p-6 bg-blue-50 border border-blue-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[#1668D9]">
                  <MapPin className="h-5 w-5" />
                </span>
                <h2 className="truncate text-xl font-semibold text-gray-900">
                  Pickup Information
                </h2>
              </div>
              {!isUnclaimed && (
                <Badge variant="outline" className={`border text-xs font-semibold ${pickupStatus.className}`}>
                  {pickupStatus.label}
                </Badge>
              )}
            </div>

            <div className="mt-4 min-w-0 overflow-hidden rounded-lg border border-blue-100 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="min-w-0 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <Calendar className="h-4 w-4 flex-shrink-0 text-[#1668D9]" />
                    Pickup Date
                  </div>
                  <p className="mt-1 break-words text-base font-semibold text-gray-900">
                    {pickupDate || "Not available"}
                  </p>
                </div>
                <div className="min-w-0 border-t border-blue-100 p-3 sm:border-l sm:border-t-0">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <Clock className="h-4 w-4 flex-shrink-0 text-[#1668D9]" />
                    Pickup Time
                  </div>
                  <p className="mt-1 break-words text-base font-semibold text-gray-900">
                    {pickupTime || "Not available"}
                  </p>
                </div>
              </div>

              <div className="min-w-0 border-t border-blue-100 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <PackageIcon className="h-4 w-4 flex-shrink-0 text-[#1668D9]" />
                  Pickup Location
                </div>
                <p className="mt-1 hidden break-words text-sm font-medium text-gray-800 sm:block">
                  {pickupLocation || "Docufy Printing Services"}
                </p>
                <button
                  type="button"
                  onClick={() => setShopLocationOpen(true)}
                  className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl bg-[#1668D9] px-4 text-sm font-semibold text-white transition-all hover:bg-[#1668D9]/90 active:scale-[0.97] sm:hidden"
                >
                  <MapPin className="h-4 w-4" />
                  View Shop Location
                </button>
              </div>
            </div>

            {isUnclaimed ? (
              <>
                {/* Mobile: compact, clickable unclaimed warning — the full
                    message opens in a floating dialog. Desktop keeps the
                    existing inline warning presentation below. */}
                <button
                  type="button"
                  onClick={() => setUnclaimedDialogOpen(true)}
                  aria-haspopup="dialog"
                  aria-label="Unclaimed Order — view details"
                  className="mt-3 flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 sm:hidden"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-amber-900">
                      Unclaimed Order
                    </span>
                    {unclaimedOffenseLabel && (
                      <span className="mt-0.5 block text-xs font-medium text-amber-700">
                        {unclaimedOffenseLabel}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    className="h-5 w-5 flex-shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                </button>

                {/* Desktop: inline warning using the same amber container
                    styling as the mobile compact warning. */}
                <div className="mt-3 hidden rounded-lg border border-amber-200 bg-amber-50 p-3 sm:block">
                  <p className="flex items-start gap-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                    <span>{pickupNote}</span>
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-lg border border-blue-100 border-l-4 border-l-[#1668D9] bg-white p-3">
                <p className="flex items-start gap-2 text-sm text-gray-600">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1668D9]" />
                  <span>{pickupNote}</span>
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Order Summary */}
        <Card className="p-4 sm:p-6 bg-white shadow-sm gap-0">
          <button
            type="button"
            onClick={() => setShowOrderDetails((isOpen) => !isOpen)}
            aria-expanded={showOrderDetails}
            className="flex w-full items-center justify-between text-left sm:hidden"
          >
            <span className="text-xl font-semibold text-gray-900">Order Details</span>
            <ChevronDown className={`h-5 w-5 text-[#2F6FD6] transition-transform duration-200 ${showOrderDetails ? "rotate-180" : ""}`} />
          </button>
          <h2 className="mb-2 hidden text-xl font-semibold text-gray-900 sm:block">
            Order Details
          </h2>
          <div className={`${showOrderDetails ? "block" : "hidden"} sm:block`}>

          <div className="mb-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600">Order ID</Label>
                <p className="font-semibold text-gray-900">{orderId}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Status</Label>
                <div className="mt-1">
                  <Badge
                    className={`border ${getStatusBadgeClasses(currentOrderStatus)}`}
                  >
                    {currentOrderLabel}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Order Date</Label>
                <p className="font-semibold text-gray-900">{orderData?.date ? formatPHDate(orderData.date, "short") : "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Total Amount</Label>
                <p className="font-semibold text-[#2F6FD6] text-lg">{orderData?.total || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Order Time</Label>
                <p className="font-semibold text-gray-900">
                  {orderData?.date ? formatPHTime(orderData.createdAt || orderData.date) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Printing Details */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#2F6FD6]" />
              Printing Details
            </h3>
            <div className="space-y-3">
              {attachedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="rounded-lg border border-blue-200 bg-white p-3">
                  <div className="mb-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{file.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Paper Size</Label>
                <p className="text-sm font-medium text-gray-900">{formatPaperSize(getFileOption(file, "paperSize", "N/A"))}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Number of Copies</Label>
                <p className="text-sm font-medium text-gray-900">{getFileOption(file, "copies", 0)}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Color Mode</Label>
                <p className="text-sm font-medium text-gray-900">
                  {getFileOption(file, "colorMode", orderData?.printType || "N/A") === "bw" ? "Black & White" : getFileOption(file, "colorMode", "") === "colored" ? "Colored" : orderData?.printType || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Page Range</Label>
                <p className="text-sm font-medium text-gray-900">
                  {getFileOption(file, "pageRange", "all") === "all" ? "All Pages" : getFileOption(file, "specificPages", "") ? `Pages: ${getFileOption(file, "specificPages", "")}` : "All Pages"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Total Pages</Label>
                <p className="text-sm font-medium text-gray-900">{getFileOption(file, "pageCount", orderData?.pages || 0)} pages</p>
              </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Analysis - Only show if we have color analysis data */}
          {orderData?.colorMode === "colored" && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-md font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Document Analysis
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <Label className="text-xs text-blue-700">Total Pages</Label>
                  <p className="text-sm font-medium text-gray-900">{orderData?.pages || 0}</p>
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Color Detection</Label>
                  <p className="text-sm font-medium text-gray-900">Mixed (Color & B&W)</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColorBreakdown(true)}
                className="w-full border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Page Color Breakdown
              </Button>
            </div>
          )}

          {/* Additional Notes */}
          {orderData?.notes && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="text-xs text-blue-600 font-semibold uppercase tracking-wider">
                Additional Notes
              </Label>
              <p className="text-sm text-gray-900 mt-2 whitespace-pre-wrap">
                {orderData.notes}
              </p>
            </div>
          )}

          {/* Add-ons */}
          {orderData?.addons && orderData.addons.length > 0 && (
            <div className="mb-6 p-4 bg-white border-2 border-blue-300 rounded-lg">
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Add-ons
              </h3>
              <div className="space-y-2">
                {orderData.addons.map((addon, index) => (
                  <div key={index} className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">
                      {addon.name} <span className="text-gray-500">× {addon.quantity}</span>
                    </span>
                    <span className="font-semibold text-gray-900">
                      ₱{(addon.price * addon.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="pt-3 mt-2 border-t-2 border-blue-200 flex justify-between font-bold text-gray-900">
                  <span>Add-ons Subtotal:</span>
                  <span className="text-blue-700">
                    ₱{orderData.addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Attached Files */}
          {orderData?.attachedFiles && orderData.attachedFiles.length > 0 && (
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <File className="w-5 h-5 text-[#2F6FD6]" />
                Attached Files ({orderData.attachedFiles.length})
              </h3>
              <FileAttachments
                files={orderData.attachedFiles}
                orderId={orderId || ""}
              />
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="mt-6 p-5 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Printing Cost ({orderData?.pages || 0} pages × {orderData?.copies || 0} copies)</span>
                <span className="font-medium text-gray-900">
                  {orderData?.addons && orderData.addons.length > 0
                    ? `₱${(parseFloat(orderData.total.replace('₱', '')) - orderData.addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0)).toFixed(2)}`
                    : orderData?.total || "₱0.00"}
                </span>
              </div>
              {orderData?.addons && orderData.addons.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Add-ons</span>
                  <span className="font-medium text-gray-900">
                    ₱{orderData.addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="pt-3 mt-2 border-t-2 border-gray-200 flex justify-between">
                <span className="text-lg font-bold text-gray-900">Grand Total</span>
                <span className="text-2xl font-bold text-[#2F6FD6]">{orderData?.total || "₱0.00"}</span>
              </div>
            </div>

            {canCancelOrder && (
              <div className="mt-5 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCancellationReason("");
                    setShowCancelDialog(true);
                  }}
                  className="w-full bg-white border-2 border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                >
                  Cancel Order
                </Button>
              </div>
            )}
          </div>
          </div>
        </Card>

        {/* Payment Method and Status */}
        <Card className="p-6 bg-white shadow-sm gap-0">
          <button
            type="button"
            onClick={() => setShowPaymentDetails((isOpen) => !isOpen)}
            aria-expanded={showPaymentDetails}
            className="flex w-full items-center justify-between text-left sm:hidden"
          >
            <span className="text-xl font-semibold text-gray-900">Payment Method and Status</span>
            <ChevronDown className={`h-5 w-5 text-[#2F6FD6] transition-transform duration-200 ${showPaymentDetails ? "rotate-180" : ""}`} />
          </button>
          <h2 className="mb-3 hidden text-xl font-semibold text-gray-900 sm:block">
            Payment Method and Status
          </h2>

          <div className={`p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4 ${showPaymentDetails ? "block" : "hidden"} sm:block`}>
            {/* Payment Method */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Payment Method
              </p>
              <p className="text-base font-semibold text-gray-900">
                {orderData?.paymentMethod === "Cash" ? "Cash on Pickup" : orderData?.paymentMethod || "Not specified"}
              </p>
            </div>

            {/* Payment Status */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-600 mb-2">
                Payment Status
              </p>
              {orderData?.paymentMethod === "Cash" ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {orderData?.paymentVerified ? "Paid at the Shop" : "Awaiting Payment at Shop"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {orderData?.paymentVerified
                          ? "Payment confirmed — order is being processed"
                          : `Pay ₱${orderData?.total ? orderData.total.replace("₱", "") : "0.00"} in cash at the shop before the deadline`}
                      </p>
                    </div>
                  </div>
                  <Badge className={orderData?.paymentVerified ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"}>
                    {orderData?.paymentVerified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              ) : orderData?.status === "Canceled" ? (
                <p className="font-medium text-gray-900">Canceled</p>
              ) : orderData?.downPaymentRequired || orderData?.downPaymentVerified ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {orderData?.downPaymentVerified ? (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-600" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {orderData?.downPaymentVerified
                          ? "Down Payment Verified"
                          : "Awaiting Down Payment"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {(() => {
                          const downAmt = orderData?.downPaymentAmount || 0;
                          const totalAmt = orderData?.total
                            ? parseFloat(String(orderData.total).replace(/[₱,]/g, ""))
                            : 0;
                          const balance = totalAmt - downAmt;
                          const isCash = (orderData?.paymentMethod || "") === "Cash";
                          const methodLabel = isCash
                            ? "in cash at the shop"
                            : `via ${orderData?.paymentMethod || "online"}`;
                          return orderData?.downPaymentVerified
                            ? `${formatCurrency(downAmt)} (50% down) paid ${methodLabel} — balance of ${formatCurrency(balance)} due on pickup.`
                            : isCash
                              ? `Pay at least ${formatCurrency(downAmt)} (50% down) in cash at the shop before your order can be printed — balance due on pickup.`
                              : `Pay at least ${formatCurrency(downAmt)} (50% down) ${methodLabel} before printing — balance due on pickup.`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <Badge className={orderData?.downPaymentVerified ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"}>
                    {orderData?.downPaymentVerified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              ) : orderData?.paymentVerified ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        Verified
                      </p>
                      <p className="text-sm text-gray-600">
                        Payment has been verified by admin
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                    Verified
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        Pending Verification
                      </p>
                      <p className="text-sm text-gray-600">
                        Your payment is being verified by admin/staff
                      </p>
                      {orderData?.paymentReferenceNumber && (
                        <p className="text-xs text-gray-500 mt-1">
                          Reference: {orderData.paymentReferenceNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                    Pending
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Order Receipt — available for every order, any status */}
        {orderData && receiptData && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Order Receipt
              </h2>
              <Badge className="bg-blue-100 text-blue-700">
                {receiptData.receiptNumber}
              </Badge>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-[#2F6FD6]" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    Receipt-{receiptData.receiptNumber}.html
                  </p>
                  <p className="text-sm text-gray-600">
                    Order date {receiptData.orderDate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Total</p>
                  <p className="font-medium text-[#2F6FD6]">
                    {formatCurrency(receiptData.total)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Payment</p>
                  <p className="font-medium text-gray-900">
                    {receiptData.payment.statusLabel}
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowReceipt(true)}
              className="w-full border-[#2F6FD6] text-[#2F6FD6] hover:bg-white hover:text-[#2F6FD6] border-2 border-blue-200"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Receipt
            </Button>
          </Card>
        )}

        </div>
      </div>
      )}

      {/* Order Receipt Dialog */}
      <OrderReceiptDialog
        open={showReceipt}
        onOpenChange={setShowReceipt}
        data={receiptData}
      />

      {/* Color Page Breakdown Dialog */}
      <Dialog open={showColorBreakdown} onOpenChange={setShowColorBreakdown}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#2F6FD6]" />
              Page Color Breakdown - Order {orderId}
            </DialogTitle>
            <DialogDescription>
              Detailed color analysis for each page in your document
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] p-4">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                This analysis shows the color intensity detected on each page of your document.
                Pages with more than 50% color are charged at a higher rate.
              </p>
            </div>

            {/* Mock color breakdown data - in production this would come from order data */}
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3 p-3 bg-gray-100 rounded-lg font-semibold text-sm">
                <div>Page</div>
                <div>Type</div>
                <div>Color %</div>
                <div>Rate</div>
              </div>

              {/* Sample data - replace with actual color analysis from order */}
              {Array.from({ length: orderData?.pages || 25 }, (_, i) => {
                const pageNum = i + 1;
                const isColor = Math.random() > 0.6;
                const colorPct = isColor ? Math.floor(Math.random() * 70) + 15 : 0;
                const rate = colorPct > 50 ? formatPrice(pricing.colorHigh) : colorPct > 0 ? formatPrice(pricing.colorLow) : formatPrice(pricing.bw);

                return (
                  <div
                    key={pageNum}
                    className="grid grid-cols-4 gap-3 p-3 border-b border-gray-200 text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium">Page {pageNum}</div>
                    <div>
                      <Badge
                        className={
                          colorPct === 0
                            ? "bg-gray-100 text-gray-700"
                            : colorPct > 50
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }
                      >
                        {colorPct === 0 ? "B&W" : "Color"}
                      </Badge>
                    </div>
                    <div className="font-medium">{colorPct}%</div>
                    <div className="text-[#2F6FD6] font-semibold">{rate}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-4 bg-blue-50 border-2 border-[#2F6FD6] rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Pricing Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">High Color Pages (&gt;50%):</span>
                  <span className="font-medium">{formatPrice(pricing.colorHigh)} per page</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Low Color Pages (≤50%):</span>
                  <span className="font-medium">{formatPrice(pricing.colorLow)} per page</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Black & White Pages:</span>
                  <span className="font-medium">{formatPrice(pricing.bw)} per page</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowColorBreakdown(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <DialogTitle className="text-xl">Cancel Order</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason for Cancellation <span className="text-red-500">*</span></Label>
              <Textarea
                id="cancel-reason"
                placeholder="Please state the reason for cancellation..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900">
              Keep Order
            </Button>
            <Button
              onClick={handleCancelOrder}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!cancellationReason.trim()}
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shop Location Dialog */}
      <Dialog open={shopLocationOpen} onOpenChange={setShopLocationOpen}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#1668D9]" /> Shop Location
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {shopContent.locationLines?.[0] ||
              "Palawan State University - Main Campus, Puerto Princesa City, Palawan"}
          </p>
          <div className="overflow-hidden rounded-xl border-2 border-blue-100">
            <iframe
              title="Docufy Printing Services - Shop Location"
              src={shopContent.mapEmbedUrl || DEFAULT_MAP_EMBED}
              className="h-72 w-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          {shopPhotos.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowShopPhotos((open) => !open)}
                className="flex items-center gap-2 text-sm font-medium text-[#1668D9] transition-colors hover:text-[#155bb8]"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    showShopPhotos ? "rotate-180" : ""
                  }`}
                />
                {showShopPhotos ? "Hide Shop Photos" : "View Shop Photos"}
              </button>
              {showShopPhotos && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {shopPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightboxPhoto(photo.dataUrl)}
                      className="cursor-pointer"
                    >
                      <img
                        src={photo.dataUrl}
                        alt="Shop location"
                        className="h-24 w-full rounded-lg border border-gray-200 object-cover transition-all hover:ring-2 hover:ring-[#1668D9]"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unclaimed Order Warning Dialog (opened from the mobile compact warning) */}
      <Dialog open={unclaimedDialogOpen} onOpenChange={setUnclaimedDialogOpen}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-md"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
              </span>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-lg text-amber-900">
                  Unclaimed Order
                </DialogTitle>
                {unclaimedOffenseLabel && (
                  <p className="mt-0.5 text-xs font-medium text-amber-700">
                    {unclaimedOffenseLabel}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-gray-600">{UNCLAIMED_MESSAGE}</p>

          <DialogFooter>
            <Button
              onClick={() => setUnclaimedDialogOpen(false)}
              className="w-full border-transparent bg-[#1668D9] text-white hover:bg-[#10316B] sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightboxPhoto && (
        <Dialog open onOpenChange={() => setLightboxPhoto(null)}>
          <DialogContent className="sm:max-w-2xl p-0 bg-black border-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxPhoto}
              alt="Shop location full view"
              className="max-h-[80vh] w-full object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}