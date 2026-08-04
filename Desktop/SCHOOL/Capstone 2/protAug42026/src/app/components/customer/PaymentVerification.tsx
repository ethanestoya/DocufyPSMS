import React, { useState, useEffect } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
} from "react-router";
import {
  LayoutDashboard,
  FileText,
  Upload,
  AlertCircle,
  Package,
  Briefcase,
  X,
  Image,
  Eye,
  Smartphone,
  CheckCircle2,
  ScanLine,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { dataStore } from "../../utils/dataStore";

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
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/customer/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
];

// Sample GCash QR Code (placeholder)
const GCASH_QR_CODE =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IndoaXRlIi8+PGcgZmlsbD0iYmxhY2siPjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgeD0iMjAiIHk9IjIwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiB4PSI0MCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjUwIiB5PSIyMCIvPjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgeD0iNjAiIHk9IjIwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiB4PSI4MCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjExMCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjE0MCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjE1MCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjE2MCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjE3MCIgeT0iMjAiLz48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHg9IjIwIiB5PSIzMCIvPjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgeD0iODAiIHk9IjMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiB4PSIxNDAiIHk9IjMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiB4PSIxNzAiIHk9IjMwIi8+PC9nPjwvc3ZnPg==";

export default function PaymentVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const [paymentMethod, setPaymentMethod] = useState<
    "gcash" | "cash"
  >("gcash"); // Only GCash or Cash on Pickup
  const [
    showPaymentMethodSelector,
    setShowPaymentMethodSelector,
  ] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [showImagePreview, setShowImagePreview] =
    useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Load payment method from navigation state or localStorage
  useEffect(() => {
    if (location.state?.paymentMethod) {
      setPaymentMethod(location.state.paymentMethod);
    } else if (orderId) {
      const savedOrder = localStorage.getItem(
        `order_${orderId}`,
      );
      if (savedOrder) {
        try {
          const orderData = JSON.parse(savedOrder);
          if (orderData.paymentMethod) {
            setPaymentMethod(orderData.paymentMethod);
          }
        } catch (error) {
          console.error("Error loading order data:", error);
        }
      }
    }
  }, [location.state, orderId]);

  // Simulate OCR scanning to extract reference number from image
  const scanReferenceNumber = async (file: File) => {
    setIsScanning(true);
    toast.info("Scanning image for reference number...");

    // Simulate OCR processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate a mock reference number (in production, use actual OCR)
    const mockReferenceNumber = `REF${Math.floor(100000000 + Math.random() * 900000000)}`;

    setReferenceNumber(mockReferenceNumber);
    setIsScanning(false);
    toast.success("Reference number detected and auto-filled!");
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    setFileError("");

    if (file) {
      // Validate file type - only images
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      if (!validTypes.includes(file.type)) {
        setFileError(
          "Please upload an image file only (JPG, PNG, GIF, or WebP)",
        );
        e.target.value = "";
        return;
      }

      setProofFile(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);

      // Auto-scan for reference number if digital payment (not cash)
      if (paymentMethod !== "cash") {
        await scanReferenceNumber(file);
      }
    }
  };

  const handleViewImage = () => {
    setShowImagePreview(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === "gcash") {
      if (!referenceNumber.trim()) {
        toast.error("Please enter a GCash reference number");
        return;
      }

      // Save the reference number to the order in dataStore
      // The payment will remain unverified until admin/staff manually verifies it
      const order = dataStore.getOrders().find((o) => o.id === orderId);
      if (order) {
        dataStore.updateOrder(orderId!, {
          paymentReferenceNumber: referenceNumber,
          paymentVerified: false,
          paymentProofUrl: imagePreviewUrl || undefined,
        });

        toast.success("Payment details submitted. Awaiting verification by staff.");
      }
    }

    // Show success dialog instead of navigating immediately
    setShowSuccessDialog(true);
  };

  return (
    <Layout
      menuItems={menuItems}
      title="Payment Verification"
      showBackButton
      backButtonPath="/customer/new-request"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Payment Verification
          </h1>
          <p className="text-gray-500 mt-1">
            Order ID: {orderId}
          </p>
        </div>

        {/* Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your order total requires payment verification
            before processing can begin.
          </AlertDescription>
        </Alert>

        {/* Payment Method Display/Selector */}
        <Card className="p-6 bg-white shadow-sm">
          {!showPaymentMethodSelector ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Selected Payment Method
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      paymentMethod === "gcash"
                        ? "bg-[#007DFF]"
                        : "bg-blue-600"
                    }`}
                  >
                    {paymentMethod === "gcash" && (
                      <Smartphone className="w-6 h-6 text-white" />
                    )}
                    {paymentMethod === "cash" && (
                      <Banknote className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {paymentMethod === "gcash" && "GCash"}
                      {paymentMethod === "cash" &&
                        "Cash on Pickup"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {paymentMethod === "gcash" &&
                        "Mobile wallet payment"}
                      {paymentMethod === "cash" &&
                        "Pay when you collect"}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  setShowPaymentMethodSelector(true)
                }
                className="border-[#2F6FD6] text-[#2F6FD6] hover:bg-white border-2 border-blue-200"
              >
                Change Payment Method
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Select Payment Method
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setShowPaymentMethodSelector(false)
                  }
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* GCash Button */}
                <button
                  onClick={() => {
                    setPaymentMethod("gcash");
                    setShowPaymentMethodSelector(false);
                    setReferenceNumber("");
                    setProofFile(null);
                    setImagePreviewUrl(null);
                  }}
                  className={`p-3 rounded-lg border-2 transition-all hover:shadow-sm ${
                    paymentMethod === "gcash"
                      ? "border-[#007DFF] bg-white border-2 border-blue-200"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        paymentMethod === "gcash"
                          ? "bg-[#007DFF]"
                          : "bg-gray-100"
                      }`}
                    >
                      <Smartphone
                        className={`w-5 h-5 ${
                          paymentMethod === "gcash"
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      />
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-xs font-semibold ${
                          paymentMethod === "gcash"
                            ? "text-[#007DFF]"
                            : "text-gray-900"
                        }`}
                      >
                        GCash
                      </p>
                      <p className="text-[9px] text-gray-500">
                        Mobile wallet
                      </p>
                    </div>
                    {paymentMethod === "gcash" && (
                      <CheckCircle2 className="w-4 h-4 text-[#007DFF]" />
                    )}
                  </div>
                </button>

                {/* Cash on Pickup Button */}
                <button
                  onClick={() => {
                    setPaymentMethod("cash");
                    setShowPaymentMethodSelector(false);
                    setReferenceNumber("");
                    setProofFile(null);
                    setImagePreviewUrl(null);
                  }}
                  className={`p-3 rounded-lg border-2 transition-all hover:shadow-sm ${
                    paymentMethod === "cash"
                      ? "border-blue-600 bg-white border-2 border-blue-200"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        paymentMethod === "cash"
                          ? "bg-blue-600"
                          : "bg-gray-100"
                      }`}
                    >
                      <Banknote
                        className={`w-5 h-5 ${
                          paymentMethod === "cash"
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      />
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-xs font-semibold ${
                          paymentMethod === "cash"
                            ? "text-blue-600"
                            : "text-gray-900"
                        }`}
                      >
                        Cash on Pickup
                      </p>
                      <p className="text-[9px] text-gray-500">
                        Pay on collect
                      </p>
                    </div>
                    {paymentMethod === "cash" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                </button>
              </div>
            </>
          )}
        </Card>

        {/* Payment Instructions - Show based on selected method */}
        {paymentMethod === "gcash" && (
          <Card className="p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              GCash Payment Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GCash QR Code */}
              <div className="space-y-4">
                <div className="p-4 bg-white border-2 border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="bg-[#007DFF] text-white px-3 py-1 rounded text-sm">
                      GCash
                    </span>
                    Scan to Pay
                  </h3>
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img
                      src={GCASH_QR_CODE}
                      alt="GCash QR Code"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    Scan this QR code with your GCash app to pay
                  </p>
                </div>
              </div>

              {/* GCash Account Details */}
              <div className="space-y-4">
                <div className="p-4 bg-white border-2 border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    GCash Account Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">
                        Account Name:
                      </span>
                      <p className="font-medium text-gray-900">
                        DocuFy Printing Services
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">
                        Mobile Number:
                      </span>
                      <p className="font-medium text-gray-900 font-mono">
                        0917 123 4567
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">
                        Payment Method:
                      </span>
                      <p className="font-medium text-gray-900">
                        GCash Mobile Wallet
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border-2 border-blue-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> After payment, upload
                    your screenshot and enter the reference
                    number below.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {paymentMethod === "cash" && (
          <Card className="p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Cash on Pickup Details
            </h2>
            <div className="p-6 bg-white border-2 border-blue-200 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Payment on Pickup
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">
                    You have selected to pay in cash when you
                    collect your order. Please ensure you have
                    the exact amount ready.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">
                        No advance payment required
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">
                        Pay the full amount when collecting your
                        order
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">
                        Please bring exact change if possible
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Reference Form - For digital payments (not cash) */}
        {paymentMethod !== "cash" && (
          <Card className="p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Submit Payment Reference
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reference">
                  Reference Number *
                </Label>
                <Input
                  id="reference"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) =>
                    setReferenceNumber(e.target.value)
                  }
                  placeholder="Enter payment reference number"
                  required
                />
                <p className="text-sm text-gray-500">
                  {paymentMethod === "gcash" &&
                    "Enter the reference number from your GCash receipt"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof">
                  Upload Proof of Payment (Screenshot or
                  Receipt)
                </Label>
                <p className="text-sm text-gray-500 mb-2">
                  Image files only (JPG, PNG, GIF, WebP)
                </p>

                {fileError && (
                  <div className="p-3 bg-white border-2 border-blue-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-900">
                        {fileError}
                      </p>
                    </div>
                    <button
                      onClick={() => setFileError("")}
                      className="text-red-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {!proofFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#2F6FD6] transition-colors">
                    <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-700 mb-4 font-medium">
                      Upload Payment Screenshot
                    </p>
                    <label className="inline-block cursor-pointer">
                      <span className="px-6 py-2 bg-[#2F6FD6] text-white rounded-lg hover:bg-[#2557b8] transition-colors font-medium inline-flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Choose Image File
                      </span>
                      <Input
                        id="proof"
                        type="file"
                        onChange={handleFileUpload}
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="p-4 bg-white border-2 border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Image className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {proofFile.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {(proofFile.size / 1024).toFixed(1)}{" "}
                            KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleViewImage}
                          className="text-[#2F6FD6] border-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <label className="cursor-pointer">
                          <span className="px-3 py-1 text-sm bg-white border border-[#2F6FD6] text-[#2F6FD6] rounded hover:bg-[#2F6FD6] hover:text-white transition-colors">
                            Change
                          </span>
                          <Input
                            type="file"
                            onChange={handleFileUpload}
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate("/customer/dashboard")
                  }
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#2F6FD6] hover:bg-[#2557b8]"
                >
                  Submit Reference
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Confirm Button for Cash Payment */}
        {paymentMethod === "cash" && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/customer/dashboard")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  navigate(`/customer/track/${orderId}`)
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Confirm Order
              </Button>
            </div>
          </Card>
        )}

        {/* Status Card */}
        <Card className="p-6 bg-yellow-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Waiting for Admin Verification
              </h3>
              <p className="text-sm text-gray-600">
                Once you submit your reference number, an
                administrator will verify your payment. You'll
                be notified when your order is approved and
                begins processing.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Image Preview Dialog */}
      <Dialog
        open={showImagePreview}
        onOpenChange={setShowImagePreview}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Payment Proof Preview</DialogTitle>
            <DialogDescription>
              {proofFile?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 overflow-auto max-h-[70vh]">
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="Payment Proof"
                className="w-full h-auto rounded-lg border border-gray-200"
              />
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowImagePreview(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          if (!open) {
            // If user closes dialog via X or clicking outside, redirect to order tracking
            navigate(`/customer/track/${orderId}`);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">
              Print Request Received!
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Your payment details have been submitted successfully. Please wait for staff verification before your order begins processing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button
              onClick={() => navigate(`/customer/track/${orderId}`)}
              className="w-full bg-[#2F6FD6] hover:bg-[#2557b8]"
            >
              See My Order
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/customer/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}