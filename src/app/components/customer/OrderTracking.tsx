import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  Clock,
  Printer,
  Package as PackageIcon,
  Briefcase,
  Download,
  Eye,
  AlertCircle,
  Calendar,
  File,
  ShoppingCart,
  ChevronDown,
  X,
  ArrowLeft,
  MapPin,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
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
import { generateInvoiceData, generateInvoiceHTML, InvoiceData } from "../../utils/invoiceUtils";
import { pricingStore, formatPrice, type PricingValues } from "../../utils/pricingStore";
import { pickupReview } from "../../utils/pickupReview";
import { landingContentStore, DEFAULT_MAP_EMBED } from "../../utils/landingContentStore";
import { computeOrderPayment } from "../shared/OrderPaymentSummary";
import { shopPhotosStore, type ShopPhoto } from "../../utils/shopPhotosStore";

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
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [showInvoice, setShowInvoice] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showInvoiceSection, setShowInvoiceSection] = useState(false);
  const [showColorBreakdown, setShowColorBreakdown] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [orderData, setOrderData] = useState(
    dataStore.getOrderById(orderId || ""),
  );
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [pricing, setPricing] = useState<PricingValues>(pricingStore.getPricing());
  const [shopContent, setShopContent] = useState(() => landingContentStore.getContent());
  const [shopLocationOpen, setShopLocationOpen] = useState(false);
  const [showShopPhotos, setShowShopPhotos] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [shopPhotos, setShopPhotos] = useState<ShopPhoto[]>(() => shopPhotosStore.getPhotos());
  // PREVIEW — customer explanation/response for a pickup issue (in-memory only).
  const [explanationText, setExplanationText] = useState("");
  const [, setPickupTick] = useState(0);

  useEffect(() => {
    return pickupReview.subscribe(() => setPickupTick((t) => t + 1));
  }, []);

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
      const updatedOrder = dataStore.getOrderById(orderId || "");
      setOrderData(updatedOrder);
      // Regenerate invoice data when order changes
      if (updatedOrder && (updatedOrder.status === 'Completed' || updatedOrder.status === 'Released')) {
        try {
          setInvoiceData(generateInvoiceData(updatedOrder));
        } catch (error) {
          console.error('Error generating invoice data:', error);
        }
      }
    });
    return unsubscribe;
  }, [orderId]);

  // Generate invoice data when component mounts or order completes
  useEffect(() => {
    if (orderData && (orderData.status === 'Completed' || orderData.status === 'Released')) {
      try {
        setInvoiceData(generateInvoiceData(orderData));
      } catch (error) {
        console.error('Error generating invoice data:', error);
      }
    }
  }, [orderData?.status]);

  const currentOrderStatus = orderData?.status || "Awaiting Payment";
  const statusStyle = getOrderStatusStyle(currentOrderStatus);
  const currentOrderLabel = getCustomerStatusLabel(orderData);
  const holdReason = orderData?.holdReason;
  const canCancelOrder = ["In Queue", "Awaiting Payment"].includes(currentOrderStatus);

  // Determine if order is completed or released
  const isOrderCompleted =
    currentOrderStatus === "Completed" ||
    currentOrderStatus === "Released";
  const isAwaitingPayment = currentOrderStatus === "Awaiting Payment";

  // PREVIEW — the pickup-issue response area appears only once Admin has flagged
  // this order for review, or when the customer has already submitted an
  // explanation. It is never shown for orders with no pickup issue.
  const pickupIncident = pickupReview.getIncident(orderId || "");
  const showPickupResponse =
    isOrderCompleted &&
    (pickupIncident?.status === "pending_review" ||
      !!pickupIncident?.customerExplanation);

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

  const pickupRemaining = orderData
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
      }).remaining
    : 0;

  const isUnclaimed = pickupIncident?.status === "confirmed_unclaimed";
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

  const pickupNote = isUnclaimed
    ? "This order was recorded as unclaimed and is no longer available for collection. Please contact the shop if you need assistance."
    : currentOrderStatus === "Released"
      ? "This order has already been collected. Thank you for choosing Docufy."
      : pickupRemaining > 0
        ? `Bring a valid ID and your order reference when collecting. A remaining balance of ${formatCurrency(pickupRemaining)} can be paid at the shop.`
        : "Bring a valid ID and your order reference when collecting your order during shop hours.";

  const handleSubmitExplanation = () => {
    if (!orderId || !explanationText.trim()) return;
    pickupReview.setCustomerExplanation(orderId, explanationText.trim());
    toast.info("Explanation submitted (preview).", {
      description:
        "This is a design preview — your response was not saved to the server.",
    });
    setExplanationText("");
  };

  const handleDownloadInvoice = () => {
    if (!invoiceData) {
      toast.error("Invoice data is not available");
      return;
    }

    // Generate invoice content using dynamic data
    const invoiceContent = generateInvoiceHTML(invoiceData);

    const blob = new Blob([invoiceContent], {
      type: "text/html",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${orderId}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Invoice downloaded successfully!");
  };

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

  return (
    <Layout
      menuItems={menuItems}
      title="Order Tracking"
      showBackButton
      backButtonPath="/customer/orders"
      hideMobileBackButton
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <ShopStatusBanner />

        {/* Mobile back button (under the header) */}
        <button
          type="button"
          onClick={() => navigate("/customer/orders")}
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D73EC]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Order Tracking
          </h1>
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
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[#1D73EC]">
                  <MapPin className="h-5 w-5" />
                </span>
                <h2 className="truncate text-xl font-semibold text-gray-900">
                  Pickup Information
                </h2>
              </div>
              <Badge variant="outline" className={`border text-xs font-semibold ${pickupStatus.className}`}>
                {pickupStatus.label}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-blue-100 bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-[#1D73EC]" />
                  Pickup Date
                </div>
                <p className="mt-1 break-words text-base font-semibold text-gray-900">
                  {pickupDate || "Not available"}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border border-blue-100 bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <Clock className="h-4 w-4 flex-shrink-0 text-[#1D73EC]" />
                  Pickup Time
                </div>
                <p className="mt-1 break-words text-base font-semibold text-gray-900">
                  {pickupTime || "Not available"}
                </p>
              </div>
            </div>

            <div className="mt-3 min-w-0 rounded-lg border border-blue-100 bg-white p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <PackageIcon className="h-4 w-4 flex-shrink-0 text-[#1D73EC]" />
                Pickup Location
              </div>
              <p className="mt-1 hidden break-words text-sm font-medium text-gray-800 sm:block">
                {pickupLocation || "Docufy Printing Services"}
              </p>
              <button
                type="button"
                onClick={() => setShopLocationOpen(true)}
                className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl bg-[#1D73EC] px-4 text-sm font-semibold text-white transition-all hover:bg-[#1D73EC]/90 active:scale-[0.97] sm:hidden"
              >
                <MapPin className="h-4 w-4" />
                View Shop Location
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-blue-100 border-l-4 border-l-[#1D73EC] bg-white p-3">
              <p className="flex items-start gap-2 text-sm text-gray-600">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1D73EC]" />
                <span>{pickupNote}</span>
              </p>
            </div>
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
                      {addon.name} <span className="text-gray-400">× {addon.quantity}</span>
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

        {/* Invoice Section - Only show when order is Completed */}
        {isOrderCompleted && invoiceData && (
          <Card className="p-6 bg-white shadow-sm gap-0">
            <button
              type="button"
              onClick={() => setShowInvoiceSection((isOpen) => !isOpen)}
              aria-expanded={showInvoiceSection}
              className="flex w-full items-center justify-between text-left sm:hidden"
            >
              <span className="text-xl font-semibold text-gray-900">Invoice</span>
              <ChevronDown className={`h-5 w-5 text-[#2F6FD6] transition-transform duration-200 ${showInvoiceSection ? "rotate-180" : ""}`} />
            </button>
            <div className={`${showInvoiceSection ? "block" : "hidden"} sm:block`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="hidden text-xl font-semibold text-gray-900 sm:block">
                Invoice
              </h2>
              <Badge className="bg-blue-100 text-blue-700">
                {invoiceData.invoiceNumber}
              </Badge>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-[#2F6FD6]" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    Invoice-{invoiceData.orderId}.html
                  </p>
                  <p className="text-sm text-gray-600">
                    Generated on {invoiceData.date}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Invoice Date</p>
                  <p className="font-medium text-gray-900">
                    {invoiceData.date}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Amount</p>
                  <p className="font-medium text-[#2F6FD6]">
                    {invoiceData.totalAmount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowInvoice(true)}
                className="flex-1 border-[#2F6FD6] text-[#2F6FD6] hover:bg-white hover:text-[#2F6FD6] border-2 border-blue-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Invoice
              </Button>
              <Button
                onClick={handleDownloadInvoice}
                className="flex-1 bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Invoice
              </Button>
            </div>
            </div>
          </Card>
        )}

        {/* Pickup Issue Response (PREVIEW workflow) — shown only for orders
            flagged for review. In-memory preview; nothing is saved. */}
        {showPickupResponse && (
          <Card className="p-6 bg-white border border-[#1D73EC]/20">
            <div className="flex flex-wrap items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#1D73EC]" />
              <h2 className="text-lg font-semibold text-gray-900">
                Pickup Issue Response
              </h2>
              <span className="rounded-md bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1D73EC] ring-1 ring-[#1D73EC]/20">
                Preview
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              This order was flagged for a pickup review. You can explain what
              happened below. Admin reviews your response before making a final
              decision.
            </p>

            {pickupIncident?.customerExplanation ? (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Your submitted explanation
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {pickupIncident.customerExplanation}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Textarea
                  rows={3}
                  value={explanationText}
                  onChange={(e) => setExplanationText(e.target.value)}
                  placeholder="e.g. I was out of town and couldn't collect the order on time."
                />
                <Button
                  onClick={handleSubmitExplanation}
                  disabled={!explanationText.trim()}
                  className="bg-[#1D73EC] text-white hover:bg-[#10316B] disabled:opacity-40"
                >
                  Submit Explanation
                </Button>
              </div>
            )}

            <p className="mt-3 text-xs text-gray-500">
              Preview only — the pickup policy and valid excuses are still
              awaiting client approval, so this response is not saved.
            </p>
          </Card>
        )}
      </div>

      {/* Invoice Preview Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Invoice Preview - {invoiceData?.orderId || orderId}
            </DialogTitle>
            <DialogDescription>
              View and download invoice for order {invoiceData?.orderId || orderId}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] p-6 bg-white">
            {invoiceData ? (
              <>
                {/* Invoice Header */}
                <div className="text-center mb-8 border-b-2 border-[#2F6FD6] pb-6">
                  <h1 className="text-3xl font-bold text-[#2F6FD6]">
                    Docufy
                  </h1>
                  <p className="text-gray-600">Printing Services</p>
                  <p className="text-sm text-gray-500">
                    Room 4, Palawan State University - Main Campus,
                    TBI Building, Puerto Princesa City, 5300 Palawan
                  </p>
                </div>

                <h2 className="text-2xl font-bold text-[#2F6FD6] mb-6">
                  INVOICE
                </h2>

                <div className="mb-6 space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Invoice Number:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Order ID:
                    </span>
                    <span className="text-gray-900">{invoiceData.orderId}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Date:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.date}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Customer:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Payment Method:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Status:
                    </span>
                    <Badge
                      className={`border ${getStatusBadgeClasses(invoiceData.status)}`}
                    >
                      {invoiceData.status}
                    </Badge>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-[#2F6FD6] mt-8 mb-4">
                  Order Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Document:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.fileName}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Total Pages:
                    </span>
                    <span className="text-gray-900">{invoiceData.totalPages} pages</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Copies:
                    </span>
                    <span className="text-gray-900">{invoiceData.copies}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Color Mode:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.colorMode}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Paper Size:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.paperSizeDisplay}
                    </span>
                  </div>
                  {invoiceData.notes && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-semibold text-gray-600">
                        Special Instructions:
                      </span>
                      <span className="text-gray-900">
                        {invoiceData.notes}
                      </span>
                    </div>
                  )}
                </div>

                {/* Add-ons Section */}
                {invoiceData.addons.length > 0 && (
                  <>
                    <h3 className="text-xl font-bold text-[#2F6FD6] mt-8 mb-4">
                      Add-ons
                    </h3>
                    <div className="space-y-3">
                      {invoiceData.addons.map((addon, index) => (
                        <div key={index} className="flex justify-between py-2 border-b">
                          <span className="font-semibold text-gray-600">
                            {addon.name} × {addon.quantity}:
                          </span>
                          <span className="text-gray-900">
                            ₱{addon.subtotal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between py-3 border-t-2 border-[#2F6FD6]">
                        <span className="font-bold text-gray-900">
                          Add-ons Subtotal:
                        </span>
                        <span className="font-bold text-gray-900">
                          ₱{invoiceData.costBreakdown.addonsCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Cost Breakdown */}
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-xl font-bold text-[#2F6FD6] mb-4">
                    Cost Breakdown
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span className="font-semibold text-gray-600">
                        Printing Cost ({invoiceData.totalPages} pages × {invoiceData.copies} copies):
                      </span>
                      <span className="text-gray-900">
                        ₱{invoiceData.costBreakdown.printingCost.toFixed(2)}
                      </span>
                    </div>
                    {invoiceData.addons.length > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="font-semibold text-gray-600">
                          Add-ons:
                        </span>
                        <span className="text-gray-900">
                          ₱{invoiceData.costBreakdown.addonsCost.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t-2 border-[#2F6FD6]">
                  <div className="text-right">
                    <p className="text-3xl font-bold text-[#2F6FD6]">
                      Total: {invoiceData.totalAmount}
                    </p>
                  </div>
                </div>

                <div className="mt-12 text-center text-sm text-gray-600">
                  <p>Thank you for choosing Docufy!</p>
                  <p>
                    For inquiries, please contact us at
                    printwithdocufy@gmail.com
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Invoice data is not available</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowInvoice(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <MapPin className="h-5 w-5 text-[#1D73EC]" /> Shop Location
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
                className="flex items-center gap-2 text-sm font-medium text-[#1D73EC] transition-colors hover:text-[#155bb8]"
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
                        className="h-24 w-full rounded-lg border border-gray-200 object-cover transition-all hover:ring-2 hover:ring-[#1D73EC]"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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