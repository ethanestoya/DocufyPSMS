import React, { useState, useEffect } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
  useBlocker,
} from "react-router";
import {
  LayoutDashboard,
  FileText,
  Upload,
  AlertCircle,
  XCircle,
  Package,
  Briefcase,
  X,
  Image,
  Smartphone,
  CheckCircle2,
  Banknote,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { DetailSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { FieldError, describedBy } from "../ui/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { dataStore, type Order as DataStoreOrder } from "../../utils/dataStore";
import { notificationStore } from "../../utils/notificationStore";
import { useAuth } from "../../contexts/AuthContext";
import { showDbError } from "../../../lib/db/errors";
import { submitPayment } from "../../../lib/db/paymentsRepo";
import {
  BUCKETS,
  uploadObjectAndGetPath,
} from "../../../lib/db/storage";
import { formatCurrency } from "../../utils/formatNumber";
import { formatPHDateTime } from "../../utils/pht";
import { PaymentDeadlineCountdown } from "../shared/PaymentDeadlineCountdown";
import {
  clearPrintDraft,
} from "../shared/PrintTransaction";
import {
  paymentMethodsStore,
  type PaymentMethodType,
} from "../../utils/paymentMethodsStore";
import PaymentMethodQRPanel from "../shared/PaymentMethodQR";
import { CashOnPickupAcknowledgement } from "../shared/CashOnPickupAcknowledgement";
import Tesseract from "tesseract.js";

let ocrWorkerPromise: Promise<Tesseract.Worker> | null = null;

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker("eng");
  }
  return ocrWorkerPromise;
}

// Preprocess an uploaded image so OCR can read light-gray / low-contrast text.
// Upscales, converts to grayscale, and boosts contrast / darkens so faint text
// (e.g. GCash "Ref No." labels in light gray) becomes clearly readable black.
async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const contrast = 1.7;
  const brightness = -35;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const adjusted = (gray - 128) * contrast + 128 + brightness;
    const v = Math.max(0, Math.min(255, adjusted));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Extract a GCash-style reference number from the OCR text. Prefers the digits
// shown after a "Ref No." / "Reference Number" label (spanning line breaks);
// only falls back to a standalone digit run when no label is found, and even
// then only for a plausible reference length so random numbers are ignored.
function extractReferenceNumber(text: string): string {
  const labelMatch = text.match(
    /(?:Ref\.?\s*No\.?|Reference\s*Number)\s*[:.\-\s\n]*([0-9][0-9\s,.\-]*)/i,
  );
  if (labelMatch) {
    const ref = labelMatch[1].replace(/[^\d]/g, "");
    if (ref.length >= 6) return ref.slice(0, 20);
  }

  // Fallback: find standalone digit groups and prefer one near 13 digits
  // (typical GCash reference) so phone numbers / random groups are avoided.
  const candidates: string[] = [];
  for (const m of text.matchAll(/(?:^|[^\d])(\d[\d\s,.\-]{5,19})(?:[^\d]|$)/g)) {
    const digits = m[1].replace(/[^\d]/g, "");
    if (digits.length >= 6 && digits.length <= 20) {
      candidates.push(digits);
    }
  }
  if (candidates.length) {
    candidates.sort(
      (a, b) =>
        Math.abs(a.length - 13) - Math.abs(b.length - 13) ||
        b.length - a.length,
    );
    return candidates[0].slice(0, 20);
  }
  return "";
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
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/customer/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
];

export default function PaymentVerification() {
  const hydrating = useHydrating();
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const { user } = useAuth();
  const goToNewRequest = () => {
    clearPrintDraft();
    navigate("/customer/new-request");
  };
  const [paymentMethod, setPaymentMethod] = useState<
    string
  >(""); // method name or "cash"
  const [onlineMethods, setOnlineMethods] = useState<
    PaymentMethodType[]
  >([]);
  const [
    showPaymentMethodSelector,
    setShowPaymentMethodSelector,
  ] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [detectedReference, setDetectedReference] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  // Down-payment orders: how much the customer pays now — Partial pays the 50%
  // down payment, Full pays the whole total up front.
  const [paymentChoice, setPaymentChoice] = useState<"partial" | "full">("partial");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  // Inline validation: an invalid submit must leave a visible reason on the
  // field itself, not only a toast that disappears.
  const [referenceError, setReferenceError] = useState("");
  const [proofError, setProofError] = useState("");
  const [showImagePreview, setShowImagePreview] =
    useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  // Submitting the reference writes the order + proof + notifications, so the
  // confirm dialog needs a real pending state instead of vanishing instantly.
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cashAcknowledged, setCashAcknowledged] = useState(false);
  // Live view of the actual order (payment deadline, amounts, required payment).
  const [order, setOrder] = useState<DataStoreOrder | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const load = () => setOrder(dataStore.getOrderById(orderId!) || null);
    load();
    const unsubscribe = dataStore.subscribe(load);
    return unsubscribe;
  }, [orderId]);

  // Order rows are now created in Supabase at checkout for every flow (this
  // uuid is the real order id), so the loaded order is authoritative.
  const displayOrder = order;

  const isOnline = paymentMethod !== "" && paymentMethod !== "cash";

  // Guard against leaving the payment verification step so an accidental
  // navigation doesn't discard the entered reference / proof. Released once the
  // payment has been submitted (success dialog is up) and for already-canceled
  // orders or an in-flight cancel confirmation, so the intentional
  // post-submit / cancel navigation and the canceled page never prompt. Cash
  // on Pickup has nothing to submit, so it is kept prompt-free.
  const paymentBlocker = useBlocker(
    isOnline &&
      !showSuccessDialog &&
      !showCancelConfirm &&
      order?.status !== "Canceled" &&
      !!displayOrder,
  );

  // Derive the amount the customer pays from the Partial/Full choice (50% down
  // payment vs whole total) for down-payment orders, then keep amountPaid in
  // sync so submit/verification use the right figure.
  useEffect(() => {
    if (!displayOrder) return;
    const total = parseFloat((displayOrder.total || "₱0").replace(/[₱,]/g, ""));
    // Partial only lowers the amount for down-payment tier orders; full tier
    // and online none-tier orders always pay the full total up front.
    const required =
      displayOrder.downPaymentRequired && paymentChoice === "partial"
        ? (displayOrder.downPaymentAmount ?? total * 0.5)
        : (displayOrder.fullPaymentAmount ?? total);
    setAmountPaid(required.toFixed(2));
  }, [displayOrder, paymentChoice]);

  const selectedMethod = isOnline
    ? paymentMethodsStore.findByName(paymentMethod)
    : undefined;
  const methodUnavailable =
    isOnline && !onlineMethods.some((m) => m.name === paymentMethod);
  const isGcash = paymentMethod.toLowerCase() === "gcash";

  // Live online payment methods that admin manages
  useEffect(() => {
    const loadMethods = () =>
      setOnlineMethods(paymentMethodsStore.getPaymentMethods());
    loadMethods();
    const unsubscribe = paymentMethodsStore.subscribe(loadMethods);
    return unsubscribe;
  }, []);

  // Load payment method from navigation state or the persisted order
  useEffect(() => {
    if (location.state?.paymentMethod) {
      setPaymentMethod(location.state.paymentMethod);
    } else if (orderId) {
      const saved = dataStore.getOrderById(orderId)?.paymentMethod;
      if (saved) setPaymentMethod(saved);
    }
  }, [location.state, orderId]);

  // Default to the first available online method if none chosen yet
  useEffect(() => {
    if (!paymentMethod && onlineMethods.length > 0) {
      setPaymentMethod(onlineMethods[0].name);
    }
  }, [onlineMethods, paymentMethod]);

  // OCR scan to extract the GCash reference number from the uploaded image.
  // The image is preprocessed (grayscale + contrast boost) so light-gray
  // "Ref No." / "Reference Number" labels are readable, then the digits after
  // the label are extracted even when the number wraps across two lines.
  const scanReferenceNumber = async (file: File) => {
    setIsScanning(true);
    toast.info("Scanning image for reference number...");
    try {
      const worker = await getOcrWorker();
      const canvas = await preprocessImage(file);
      const result = await worker.recognize(canvas);
      const text = result.data.text;

      let ref = extractReferenceNumber(text);

      // Cap length defensively (GCash references are ~13 digits).
      ref = ref.slice(0, 20);

      if (ref.length >= 6) {
        // Suggest, never silently overwrite what the customer already typed —
        // OCR mis-reads a digit often enough that replacing a correct reference
        // with a wrong one blocks staff verification (F31).
        if (referenceNumber.trim()) {
          setDetectedReference(ref);
          toast.info(
            "A reference number was found in the image. Review it and use it if it matches.",
          );
        } else {
          setReferenceNumber(ref);
          setDetectedReference("");
          setReferenceError("");
          toast.success("Reference number detected. Please review it before submitting.");
        }
      } else {
        toast.error(
          "Could not detect a reference number. Please enter it manually.",
        );
      }
    } catch (err) {
      console.error("OCR failed:", err);
      toast.error(
        "Could not read the image. Please enter the reference number manually.",
      );
    } finally {
      setIsScanning(false);
    }
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
      setProofError("");
      // Create preview URL
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);

      // Auto-scan for reference number ONLY for GCash payments
      if (isGcash) {
        await scanReferenceNumber(file);
      }
    }
  };

  const handleViewImage = () => {
    setShowImagePreview(true);
  };

  const handleRemoveFile = () => {
    setProofFile(null);
    setImagePreviewUrl(null);
    setReferenceNumber("");
    setDetectedReference("");
    setFileError("");
    setProofError("");
  };

  // Validate the online payment form: mark the field that needs fixing, show the
  // reason under it, and move focus there. A toast alone leaves the form looking
  // untouched once it disappears.
  const validatePaymentForm = () => {
    const methodName = selectedMethod?.name || "payment";
    const nextReferenceError = !referenceNumber.trim()
      ? `Enter the ${methodName} reference number from your receipt.`
      : "";
    const nextProofError = !proofFile
      ? "Upload a screenshot or receipt showing this payment."
      : "";

    setReferenceError(nextReferenceError);
    setProofError(nextProofError);

    const firstInvalid = nextReferenceError
      ? document.getElementById("reference")
      : nextProofError
        ? document.getElementById("proof-field")
        : null;
    firstInvalid?.focus();

    return !nextReferenceError && !nextProofError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
    if (paymentMethod !== "cash") {
      if (!validatePaymentForm()) {
        return;
      }

      const paid = parseFloat(amountPaid);
      if (isNaN(paid) || paid <= 0) {
        toast.error("Payment amount is not available yet. Please try again.");
        return;
      }

      const existingOrder = dataStore.getOrderById(orderId!);

      // Sync the down/full requirement flags to the Partial/Full choice so
      // staff/admin see the correct payment type: Partial keeps the 50% down
      // (balance at pickup), Full becomes a regular fully-paid online order.
      const flexTotal = parseFloat(
        String(displayOrder?.total || "₱0").replace(/[₱,]/g, "") || "0",
      );
      const flexDown = !!displayOrder?.downPaymentRequired;
      const downSync = flexDown
        ? paymentChoice === "partial"
          ? {
              downPaymentRequired: true as const,
              downPaymentAmount:
                displayOrder.downPaymentAmount ?? flexTotal * 0.5,
              downPaymentVerified: false,
              fullPaymentRequired: false,
              fullPaymentAmount: undefined,
            }
          : {
              downPaymentRequired: false,
              downPaymentAmount: undefined,
              downPaymentVerified: false,
              fullPaymentRequired: true as const,
              fullPaymentAmount: flexTotal,
            }
        : null;

      try {
        // Upload the proof to Supabase Storage, then record a PENDING payment
        // row (the source of truth staff/admin verify on).
        const proofStoragePath = proofFile
          ? await uploadObjectAndGetPath({
              bucket: BUCKETS.paymentProofs,
              folder: `${user?.id ?? "anonymous"}/proofs/${orderId}`,
              file: proofFile,
              fileName: proofFile.name,
            })
          : null;

        await submitPayment({
          orderId: orderId!,
          methodId: selectedMethod?.id ?? null,
          methodName: selectedMethod?.name ?? paymentMethod,
          amount: paid,
          referenceNumber,
          proofStoragePath,
          submittedBy: user?.id ?? null,
        });

        // Clear the checkout deadline (the order now waits on staff
        // verification — it must not auto-expire) and persist the down/full
        // choice + amount paid on the order row.
        await dataStore.updateOrder(orderId!, {
          paymentDeadline: undefined,
          paymentAmountPaid: paid,
          ...(downSync || {}),
        });
      } catch (err) {
        showDbError("submitting your payment", err);
        return;
      }

      if (existingOrder) {
        notificationStore.addNotification(
          "order",
          "New Order — Payment Verification Pending",
          `New order #${existingOrder.displayId ?? orderId} from the customer is awaiting ${paymentMethod} payment verification. Received reference: ${referenceNumber}.`,
          { clickable: true, relatedOrderId: orderId, recipientRole: "admin" },
        );
        notificationStore.addNotification(
          "order",
          "New Order — Payment Verification Pending",
          `New order #${existingOrder.displayId ?? orderId} from the customer is awaiting ${paymentMethod} payment verification. Received reference: ${referenceNumber}.`,
          { clickable: true, relatedOrderId: orderId, recipientRole: "staff" },
        );
      }

      toast.success("Payment details submitted. Awaiting verification by staff.");
    }

    // The submitted order no longer needs its checkout draft — clearing it
    // prevents a later "New Print Request" from being redirected back to
    // this payment verification page.
    clearPrintDraft();

    // Show success dialog instead of navigating immediately
    setShowSuccessDialog(true);
    } finally {
      setSubmitting(false);
    }
  };

  const selectMethod = (value: string) => {
    setPaymentMethod(value);
    setShowPaymentMethodSelector(false);
    setReferenceNumber("");
    setProofFile(null);
    setImagePreviewUrl(null);
    setPaymentChoice("partial");
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    const reason = "Canceled by customer before payment.";
    const existingOrder = dataStore.getOrderById(orderId);
    try {
      await dataStore.updateOrder(orderId, {
        status: "Canceled",
        cancellationReason: reason,
      });
    } catch (err) {
      showDbError("canceling the order", err);
      return;
    }
    notificationStore.addNotification(
      "order",
      "Order Canceled by Customer",
      `Order #${existingOrder?.displayId ?? orderId} was canceled by the customer before payment verification.`,
      { clickable: true, relatedOrderId: orderId, recipientRole: "admin" },
    );
    notificationStore.addNotification(
      "order",
      "Order Canceled by Customer",
      `Order #${existingOrder?.displayId ?? orderId} was canceled by the customer before payment verification.`,
      { clickable: true, relatedOrderId: orderId, recipientRole: "staff" },
    );
    setShowCancelConfirm(false);
    toast.success("Order has been canceled.");
    goToNewRequest();
  };

  // A canceled order no longer has a payment to verify — show a canceled state
  // instead of the payment form so the page never reads as "Awaiting Payment".
  if (order?.status === "Canceled") {
    return (
      <Layout
        menuItems={menuItems}
        title="Payment Verification"
        showBackButton
        backButtonPath="/customer/orders"
        hideMobileBackButton
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <div>
            <h2 className="text-3xl font-semibold text-gray-900">
              Payment Verification
            </h2>
            <p className="text-gray-500 mt-1">
              Order ID: {displayOrder?.displayId ?? orderId}
            </p>
          </div>
          <Card className="p-6 bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">
                  This order has been canceled
                </h3>
                <p className="text-sm text-red-700">
                  Order #{displayOrder?.displayId ?? orderId} was canceled before payment was
                  verified, so there is no payment to confirm. The order will
                  no longer be processed.
                  {order.cancellationReason
                    ? ` Reason: ${order.cancellationReason}`
                    : ""}
                </p>
              </div>
            </div>
          </Card>
          <div className="flex gap-3">
            <Button
onClick={goToNewRequest}
            className="flex-1 bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
          >
            New Print Request
          </Button>
            <Button
              variant="outline"
              onClick={goToNewRequest}
              className="flex-1"
            >
              Back to Print Request
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      menuItems={menuItems}
      title="Payment Verification"
      showBackButton
      backButtonPath="/customer/new-request"
      hideMobileBackButton
    >
      {hydrating && (
        <div className="mx-auto max-w-3xl">
          <DetailSkeleton blocks={3} label="Loading your order" />
        </div>
      )}
      <div className={hydrating ? "hidden" : "max-w-3xl mx-auto space-y-4"}>
        {/* Back to previous step (returns to the resumed print request) */}
        <button
          type="button"
          onClick={() =>
            navigate("/customer/new-request", {
              state: { fromPaymentVerification: true },
            })
          }
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="hidden md:block">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate("/customer/new-request", {
                state: { fromPaymentVerification: true },
              })
            }
            className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>

        {/* Header */}
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">
            Payment Verification
          </h2>
          <p className="text-gray-500 mt-1">
            Order ID: {displayOrder?.displayId ?? orderId}
          </p>
        </div>

        {/* ONE status card instead of three stacked boxes saying the same
            thing. The heading states what the customer has to do now: before a
            reference is sent nobody is waiting on an administrator, so
            "Waiting for Admin Verification" was simply wrong (F21). */}
        {isOnline && (
          <Card
            className={`p-6 border ${
              displayOrder?.paymentReferenceNumber
                ? "bg-yellow-50 border-blue-200"
                : "bg-blue-50/60 border-blue-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {displayOrder?.paymentReferenceNumber
                    ? "Waiting for Admin Verification"
                    : "Submit your payment reference"}
                </h3>
                <p className="text-sm text-gray-600">
                  {displayOrder?.paymentReferenceNumber
                    ? "We've received your reference. An administrator will verify the payment, and your order joins the queue once it's approved."
                    : "Send the reference number and a screenshot of the receipt below. An administrator verifies the payment, and your order joins the queue once it's approved."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Payment Method Display/Selector */}
        <Card className="p-6 bg-white shadow-sm">
          {!showPaymentMethodSelector ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Selected Payment Method
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isOnline
                        ? "bg-[#007DFF]"
                        : "bg-blue-600"
                    }`}
                  >
                    {isOnline ? (
                      <Smartphone className="w-6 h-6 text-white" />
                    ) : (
                      <Banknote className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {isOnline
                        ? paymentMethod
                        : "Cash on Pickup"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isOnline
                        ? "Mobile wallet payment"
                        : "Pay when you collect"}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  setShowPaymentMethodSelector(true)
                }
                className="border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white border-2 border-[#2F6FD6] transition-colors w-full sm:w-auto"
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
                {/* Online Payment Options (managed by admin) */}
                {onlineMethods.map((method) => {
                  const isSelected = paymentMethod === method.name;
                  return (
                    <button
                      key={method.id}
                      onClick={() => selectMethod(method.name)}
                      className={`p-3 rounded-lg border-2 transition-all hover:shadow-sm ${
                        isSelected
                          ? "border-[#007DFF] bg-white border-2 border-blue-200"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected
                              ? "bg-[#007DFF]"
                              : "bg-gray-100"
                          }`}
                        >
                          <Smartphone
                            className={`w-5 h-5 ${
                              isSelected
                                ? "text-white"
                                : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div className="text-center">
                          <p
                            className={`text-xs font-semibold ${
                              isSelected
                                ? "text-[#007DFF]"
                                : "text-gray-900"
                            }`}
                          >
                            {method.name}
                          </p>
                          <p className="text-[9px] text-gray-500">
                            Mobile wallet
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#007DFF]" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Cash on Pickup Button */}
                <button
                  onClick={() => selectMethod("cash")}
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
        {isOnline && (
          <Card className="p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {paymentMethod} Payment Details
            </h2>

            {methodUnavailable ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                This payment method is no longer available. Please
                change your payment method above and submit a new
                payment.
              </div>
            ) : selectedMethod ? (
              <PaymentMethodQRPanel method={selectedMethod} />
            ) : null}
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
                    Pay at the Shop before Printing
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Your order will only be printed once you pay in cash at the
                    shop. Please bring the amount below and have the staff
                    confirm your payment.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">
                        Amount to pay:{" "}
                        <strong>
                          {displayOrder?.downPaymentRequired
                            ? formatCurrency(displayOrder.downPaymentAmount || 0)
                            : displayOrder?.total || formatCurrency(0)}
                        </strong>
                        {displayOrder?.downPaymentRequired && (
                          <span className="text-gray-500">
                            {" "}
                            (50% down payment —{" "}
                            {formatCurrency(
                              parseFloat(
                                (displayOrder.total || "₱0")
                                  .replace("₱", "")
                                  .replace(",", ""),
                              ) - (displayOrder.downPaymentAmount || 0),
                            )}{" "}
                            balance on pickup)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">
                        Payment deadline:{" "}
                        <span className="font-mono font-semibold">
                          {displayOrder?.paymentDeadline
                            ? formatPHDateTime(displayOrder.paymentDeadline)
                            : "to be announced"}
                        </span>{" "}
                        {displayOrder?.paymentDeadline && (
                          <PaymentDeadlineCountdown
                            deadline={displayOrder.paymentDeadline}
                          />
                        )}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700">
                        Unpaid orders are auto-cancelled once the deadline
                        passes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <CashOnPickupAcknowledgement
                checked={cashAcknowledged}
                onChange={setCashAcknowledged}
              />
            </div>
          </Card>
        )}

        {/* Reference Form - For digital payments (not cash) */}
        {isOnline && (
          <Card className="p-6 bg-white shadow-sm gap-0">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Submit Payment Reference
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (paymentMethod !== "cash" && !validatePaymentForm()) {
                  return;
                }
                setShowSubmitConfirm(true);
              }}
              className="space-y-6"
            >
              {displayOrder?.downPaymentRequired && (
                <div className="space-y-2">
                  <Label htmlFor="payment-choice">
                    Payment Amount *
                  </Label>
                  <Select
                    value={paymentChoice}
                    onValueChange={(value) =>
                      setPaymentChoice(value as "partial" | "full")
                    }
                  >
                    <SelectTrigger id="payment-choice" className="w-full">
                      <SelectValue placeholder="Select how much to pay" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="partial">
                        Partial Payment —{" "}
                        {formatCurrency(
                          displayOrder.downPaymentAmount ||
                            parseFloat(
                              (displayOrder.total || "₱0").replace("₱", "").replace(",", ""),
                            ) * 0.5,
                        )}{" "}
                        (50% down)
                      </SelectItem>
                      <SelectItem value="full">
                        Full Payment —{" "}
                        {formatCurrency(
                          parseFloat(
                            (displayOrder.total || "₱0").replace("₱", "").replace(",", ""),
                          ) || 0,
                        )}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {paymentChoice === "full" ? (
                    <p className="text-sm text-gray-500">
                      Paying the full amount now — no balance due on pickup.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      You're required to pay a 50% down payment of{" "}
                      {formatCurrency(displayOrder.downPaymentAmount || 0)}. The remaining
                      balance of{" "}
                      {formatCurrency(
                        parseFloat(
                          (displayOrder.total || "₱0").replace("₱", "").replace(",", ""),
                        ) - (displayOrder.downPaymentAmount || 0),
                      )}{" "}
                      will be due on pickup.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reference">
                  Reference Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="reference"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => {
                    setReferenceNumber(e.target.value);
                    if (referenceError) setReferenceError("");
                  }}
                  placeholder="e.g. G123456789"
                  aria-invalid={!!referenceError || undefined}
                  aria-describedby={describedBy(
                    "reference-help",
                    referenceError && "reference-error",
                  )}
                  aria-required="true"
                  required
                />
                <p id="reference-help" className="text-sm text-gray-500">
                  Enter the reference number from your{" "}
                  {selectedMethod?.name || "payment"} receipt
                </p>
                <FieldError id="reference-error" message={referenceError} />
                {detectedReference && detectedReference !== referenceNumber && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1668D9]/25 bg-[#F2F7FF] px-3 py-2">
                    <span className="text-xs text-gray-700">
                      Found in your image:{" "}
                      <span className="font-mono font-semibold text-gray-900">
                        {detectedReference}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceNumber(detectedReference);
                        setDetectedReference("");
                        setReferenceError("");
                      }}
                      className="inline-flex min-h-6 items-center rounded-md border border-[#1668D9]/30 bg-white px-2 py-0.5 text-xs font-semibold text-[#1668D9] hover:bg-[#1668D9] hover:text-white"
                    >
                      Use detected reference
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetectedReference("")}
                      className="inline-flex min-h-6 items-center px-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Keep mine
                    </button>
                  </div>
                )}
                {isScanning && (
                  <p className="text-sm text-[#2F6FD6] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning image for the reference number...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof">
                  Upload Proof of Payment (Screenshot or
                  Receipt) <span className="text-red-500">*</span>
                </Label>
                <p id="proof-help" className="text-sm text-gray-500 mb-2">
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
                  <div
                    id="proof-field"
                    tabIndex={-1}
                    aria-describedby={describedBy(
                      "proof-help",
                      proofError && "proof-error",
                    )}
                    className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:border-[#2F6FD6] ${
                      proofError
                        ? "border-[#B42318] bg-[#FEF3F2]"
                        : "border-gray-300 hover:border-[#2F6FD6]"
                    }`}
                  >
                    <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-700 mb-4 font-medium">
                      Upload Payment Screenshot
                    </p>
                    <label className="inline-block cursor-pointer">
                      <span className="px-6 py-2 bg-white text-[#2F6FD6] rounded-lg border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md font-medium inline-flex items-center gap-2">
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
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Image className="w-5 h-5 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 break-words">
                            {proofFile.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {(proofFile.size / 1024).toFixed(1)}{" "}
                            KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleViewImage}
                          className="px-3 py-1 text-sm bg-white border border-[#2F6FD6] text-[#2F6FD6] rounded hover:bg-[#2F6FD6] hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          View
                        </button>
                        <label className="cursor-pointer">
                          <span className="px-3 py-1 text-sm bg-white border border-[#2F6FD6] text-[#2F6FD6] rounded hover:bg-[#2F6FD6] hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                            Change
                          </span>
                          <Input
                            type="file"
                            onChange={handleFileUpload}
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          title="Remove file"
                          className="p-1.5 text-red-500 rounded hover:bg-red-500 hover:text-white transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <FieldError id="proof-error" message={proofError} />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full h-11 sm:flex-1 sm:h-9 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Cancel Order
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  loadingText="Submitting..."
className="w-full h-11 sm:flex-1 sm:h-9 bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white hover:-translate-y-0.5 hover:shadow-md"
                >
                  Submit Reference
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Cash on Pickup — no online confirmation; order is confirmed at the shop */}
        {paymentMethod === "cash" && (
          <Card className="p-6 bg-white shadow-sm">
            <p className="text-sm text-gray-700 mb-1">
              You've chosen <strong>Cash on Pickup</strong>. There is nothing to
              submit online — your order is only confirmed when you pay in cash
              at the shop.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/customer/dashboard")}
                className="w-full h-11 sm:flex-1 sm:h-9"
              >
                Dashboard
              </Button>
              <Button
                onClick={() => navigate(`/customer/track/${orderId}`)}
                className="w-full h-11 sm:flex-1 sm:h-9 bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B]"
              >
                Track Order
              </Button>
            </div>
          </Card>
        )}
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
            // If user closes dialog via X or clicking outside, redirect to new print request
            goToNewRequest();
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
              {paymentMethod === "cash"
                ? "Your order has been placed. Pay in cash at the shop before the payment deadline to confirm it."
                : "Your payment details have been submitted successfully. Please wait for staff verification before your order begins processing."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button
              onClick={goToNewRequest}
              className="w-full h-11 bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B]"
            >
              New Print Request
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

      {/* Submit Payment Confirmation */}
      {showSubmitConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowSubmitConfirm}
          onConfirm={async () => {
            await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
            setShowSubmitConfirm(false);
          }}
          closeOnConfirm={false}
          loadingText={paymentMethod === "cash" ? "Confirming..." : "Submitting..."}
          title="Submit Payment for Verification?"
          description={
            paymentMethod === "cash"
              ? "Your Cash on Pickup order cannot be confirmed online — visit the shop to pay in cash before the payment deadline. The staff will confirm your payment and queue your order."
              : `Submit a payment of ₱${amountPaid || "0.00"} with reference ${referenceNumber.trim() || "number"}${imagePreviewUrl ? " and payment proof" : ""} for ${selectedMethod?.name || "online"} payment for order ${displayOrder?.displayId ?? orderId}? Once submitted, your payment will be queued for admin/staff verification and the order will not print until approved.`
          }
          confirmLabel={paymentMethod === "cash" ? "Confirm Order" : "Submit Reference"}
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Cancel Order Confirmation */}
      {showCancelConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowCancelConfirm}
          onConfirm={handleCancelOrder}
          title="Cancel Order?"
          description={
            order
              ? `Are you sure you want to cancel order #${displayOrder?.displayId ?? orderId}? This will permanently cancel the order and it can no longer be processed.`
              : `This order has not been submitted yet — canceling will just discard the unsent request. It will not be recorded and will not appear in your orders.`
          }
          confirmLabel="Cancel Order"
          cancelLabel="Keep Order"
          destructive
        />
      )}

      {/* Leave payment verification confirmation */}
      {paymentBlocker && paymentBlocker.state === "blocked" && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open && paymentBlocker.state === "blocked") paymentBlocker.reset();
          }}
          onConfirm={() => paymentBlocker.proceed()}
          title="Leave payment verification?"
          description="You haven't finished submitting your payment yet. Leaving now means your entered reference details and proof will be lost — you can come back and submit again from My Orders."
          confirmLabel="Leave Page"
          cancelLabel="Stay Here"
          destructive={false}
        />
      )}
    </Layout>
  );
}