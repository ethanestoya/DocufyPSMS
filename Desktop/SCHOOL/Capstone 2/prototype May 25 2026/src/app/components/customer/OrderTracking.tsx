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
  PauseCircle,
  Calendar,
  File,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { FileAttachments } from "../ui/file-attachments";
import { dataStore } from "../../utils/dataStore";
import { generateInvoiceData, generateInvoiceHTML, InvoiceData } from "../../utils/invoiceUtils";

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
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewFileName, setPreviewFileName] = useState("");
  const [showColorBreakdown, setShowColorBreakdown] = useState(false);
  const [orderData, setOrderData] = useState(
    dataStore.getOrderById(orderId || ""),
  );
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

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

  const currentOrderStatus = orderData?.status || "Received";
  const holdReason = orderData?.holdReason;

  // Determine if order is completed or released
  const isOrderCompleted =
    currentOrderStatus === "Completed" ||
    currentOrderStatus === "Released";
  const isOnHold = currentOrderStatus === "On Hold";

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

  const handleViewFile = (fileName: string) => {
    setPreviewFileName(fileName);
    setShowFilePreview(true);
  };

  const handleDownloadFile = (fileName: string) => {
    const content = `[DocuFy PSMS - Palawan State University]\nFile: ${fileName}\nOrder ID: ${orderId}\n\nThis is a placeholder download for the submitted document.\nActual file content would be served from the server.`;
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

  // Attached files (mock data — in production these come from the server)
  const attachedFiles = [
    { name: "research-paper.pdf", size: "3.2 MB", type: "PDF" },
  ];

  return (
    <Layout
      menuItems={menuItems}
      title="Order Tracking"
      showBackButton
      backButtonPath="/customer/orders"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Order Tracking
          </h1>
          <p className="text-gray-500 mt-1">
            Track your print job status - Order {orderId}
          </p>
        </div>

        {/* On Hold Alert */}
        {isOnHold && holdReason && (
          <Card className="p-6 bg-white border-2 border-blue-300 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <PauseCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
                  Order On Hold
                  <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200">
                    Action Required
                  </Badge>
                </h3>
                <p className="text-sm text-amber-800 mb-3 leading-relaxed">
                  <strong>Reason:</strong> {holdReason}
                </p>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-gray-700">
                    <strong className="text-amber-900">
                      What to do:
                    </strong>{" "}
                    Please contact our staff or visit the shop
                    to resolve this issue. Your order will
                    resume processing once the issue is
                    addressed.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Current Status Banner */}
        <Card className="p-5 bg-white shadow-sm border-l-4 border-[#1D73EC]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2F7FF] flex items-center justify-center">
                {currentOrderStatus === "Printing" && (
                  <Printer className="w-5 h-5 text-[#1D73EC]" />
                )}
                {currentOrderStatus === "In Queue" && (
                  <Clock className="w-5 h-5 text-blue-600" />
                )}
                {currentOrderStatus === "Completed" && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
                {currentOrderStatus === "Released" && (
                  <PackageIcon className="w-5 h-5 text-gray-600" />
                )}
                {currentOrderStatus === "Received" && (
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                )}
                {currentOrderStatus === "On Hold" && (
                  <PauseCircle className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Current Status
                </p>
                <p className="font-bold text-gray-900 text-lg">
                  {currentOrderStatus}
                </p>
              </div>
            </div>
            <Badge
              className={
                currentOrderStatus === "Completed"
                  ? "bg-blue-100 text-blue-700"
                  : currentOrderStatus === "Released"
                    ? "bg-gray-100 text-gray-700"
                    : currentOrderStatus === "Printing"
                      ? "bg-blue-100 text-blue-700"
                      : currentOrderStatus === "In Queue"
                        ? "bg-blue-100 text-yellow-700"
                        : currentOrderStatus === "On Hold"
                          ? "bg-amber-100 text-blue-800"
                          : "bg-purple-100 text-purple-700"
              }
            >
              {currentOrderStatus}
            </Badge>
          </div>
        </Card>

        {/* Order Summary */}
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Order Details
          </h2>

          {/* Basic Information */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2F6FD6]" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600">Order ID</Label>
                <p className="font-semibold text-gray-900">{orderId}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Status</Label>
                <div className="mt-1">
                  <Badge
                    className={
                      currentOrderStatus === "Completed"
                        ? "bg-blue-100 text-blue-700"
                        : currentOrderStatus === "Released"
                          ? "bg-gray-100 text-gray-700"
                          : currentOrderStatus === "Printing"
                            ? "bg-blue-100 text-blue-700"
                            : currentOrderStatus === "In Queue"
                              ? "bg-blue-100 text-yellow-700"
                              : currentOrderStatus === "On Hold"
                                ? "bg-amber-100 text-blue-800"
                                : "bg-purple-100 text-purple-700"
                    }
                  >
                    {currentOrderStatus}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Order Date</Label>
                <p className="font-semibold text-gray-900">{orderData?.date || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Total Amount</Label>
                <p className="font-semibold text-[#2F6FD6] text-lg">{orderData?.total || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Printing Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#2F6FD6]" />
              Printing Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600">Paper Size</Label>
                <p className="text-sm font-medium text-gray-900">
                  {orderData?.paperSize === "a4" && "A4 (210 × 297 mm)"}
                  {orderData?.paperSize === "letter" && "Letter (8.5 × 11 in)"}
                  {orderData?.paperSize === "legal" && "Legal (8.5 × 14 in)"}
                  {orderData?.paperSize === "short" && "Short Bond (8.5 × 11 in)"}
                  {orderData?.paperSize === "long" && "Long Bond (8.5 × 13 in)"}
                  {orderData?.paperSize === "a5" && "A5 (148 × 210 mm)"}
                  {orderData?.paperSize === "a3" && "A3 (297 × 420 mm)"}
                  {!orderData?.paperSize && "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Orientation</Label>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {orderData?.orientation || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Number of Copies</Label>
                <p className="text-sm font-medium text-gray-900">{orderData?.copies || 0}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Two-Sided Printing</Label>
                <p className="text-sm font-medium text-gray-900">
                  {orderData?.twoSided === "yes" ? "Yes (Double-Sided)" : "No (Single-Sided)"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Pages per Sheet</Label>
                <p className="text-sm font-medium text-gray-900">
                  {orderData?.pagesPerSheet || "1"} page{orderData?.pagesPerSheet !== "1" ? "s" : ""} per sheet
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Color Mode</Label>
                <p className="text-sm font-medium text-gray-900">
                  {orderData?.colorMode === "bw" ? "Black & White" : orderData?.colorMode === "colored" ? "Colored" : orderData?.printType || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Page Range</Label>
                <p className="text-sm font-medium text-gray-900">
                  {orderData?.pageRange === "all" ? "All Pages" : orderData?.pageRange === "specific" && orderData?.specificPages ? `Pages: ${orderData.specificPages}` : "All Pages"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Total Pages</Label>
                <p className="text-sm font-medium text-gray-900">{orderData?.pages || 0} pages</p>
              </div>
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
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <File className="w-5 h-5 text-[#2F6FD6]" />
                Attached Files ({orderData.attachedFiles.length})
              </h3>
              <FileAttachments files={orderData.attachedFiles} orderId={orderId || ""} />
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="mt-6 p-5 bg-blue-50 border-2 border-[#2F6FD6] rounded-lg">
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
              <div className="pt-3 mt-2 border-t-2 border-[#2F6FD6] flex justify-between">
                <span className="text-lg font-bold text-gray-900">Grand Total</span>
                <span className="text-2xl font-bold text-[#2F6FD6]">{orderData?.total || "₱0.00"}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Method and Status */}
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Payment Method and Status
          </h2>

          <div className="space-y-4">
            {/* Payment Method */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-600 mb-2">
                Payment Method
              </p>
              <p className="text-base font-semibold text-gray-900">
                {orderData?.paymentMethod || "Not specified"}
              </p>
            </div>

            {/* Payment Status */}
            {orderData?.paymentMethod === "Cash" ? (
              <div className="flex items-center justify-between p-4 bg-white border-2 border-gray-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Cash on Pickup
                    </p>
                    <p className="text-sm text-gray-600">
                      Pay when you collect your order
                    </p>
                  </div>
                </div>
                <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                  Cash
                </Badge>
              </div>
            ) : orderData?.paymentVerified ? (
              <div className="flex items-center justify-between p-4 bg-white border-2 border-blue-300 rounded-lg">
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
              <div className="flex items-center justify-between p-4 bg-white border-2 border-yellow-300 rounded-lg">
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
        </Card>

        {/* Invoice Section - Only show when order is Completed */}
        {isOrderCompleted && invoiceData && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
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
                className="flex-1 border-[#2F6FD6] text-[#2F6FD6] hover:bg-white border-2 border-blue-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Invoice
              </Button>
              <Button
                onClick={handleDownloadInvoice}
                className="flex-1 bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Invoice
              </Button>
            </div>
          </Card>
        )}

        {/* Pickup Information - Only show when order is Completed */}
        {isOrderCompleted && (
          <Card className="p-6 bg-blue-50 border border-blue-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Pickup Information
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#1D73EC] mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Pick-Up Date
                  </p>
                  <p className="text-gray-700">
                    March 5, 2026 (Ready)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#1D73EC] mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Pick-Up Time
                  </p>
                  <p className="text-gray-700">
                    3:00 PM – 5:00 PM
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <PackageIcon className="w-5 h-5 text-[#1D73EC] mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Pickup Location
                  </p>
                  <p className="text-gray-700">
                    DocuFy PSMS · Room 4, TBI Building, Palawan
                    State University
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> Please bring a valid ID
                when picking up your order. Remaining balance (if
                any) can be paid at pickup.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* File Preview Dialog */}
      <Dialog
        open={showFilePreview}
        onOpenChange={setShowFilePreview}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1D73EC]" />
              File Preview
            </DialogTitle>
            <DialogDescription>
              Preview the submitted document for this order
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-[#F2F7FF] rounded-lg border border-blue-200 mb-4">
              <div className="w-12 h-12 bg-white rounded-lg border border-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#1D73EC]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {previewFileName}
                </p>
                <p className="text-xs text-gray-500">
                  Submitted document · Order {orderId}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">
                Document preview
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Full preview is available after staff processes
                the order.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    DocuFy
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
                      className={
                        invoiceData.status === "Completed"
                          ? "bg-blue-100 text-blue-700"
                          : invoiceData.status === "Released"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-blue-100 text-blue-700"
                      }
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
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Orientation:
                    </span>
                    <span className="text-gray-900 capitalize">
                      {invoiceData.orientation}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Two-Sided:
                    </span>
                    <span className="text-gray-900">
                      {invoiceData.twoSided}
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
                  <p>Thank you for choosing DocuFy!</p>
                  <p>
                    For inquiries, please contact us at
                    support@docufy.com
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
                const rate = colorPct > 50 ? "₱5.00" : colorPct > 0 ? "₱3.00" : "₱1.00";

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
                  <span className="font-medium">₱5.00 per page</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Low Color Pages (≤50%):</span>
                  <span className="font-medium">₱3.00 per page</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Black & White Pages:</span>
                  <span className="font-medium">₱1.00 per page</span>
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
    </Layout>
  );
}