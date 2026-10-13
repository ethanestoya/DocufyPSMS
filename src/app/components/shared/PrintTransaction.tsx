import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useBlocker } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Settings,
  FileCheck,
  CheckCircle,
  Package,
  Briefcase,
  AlertCircle,
  X,
  Smartphone,
  Banknote,
  ShoppingCart,
  Plus,
  Minus,
  CreditCard,
  Info,
  ChevronDown,
  QrCode,
  Bell,
  User,
  LayoutGrid,
  Clock,
  Boxes,
  Check,
  Copy,
  Calculator,
  WifiOff,
  CalendarClock,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { UnclaimedOrderWarning } from "./UnclaimedOrderWarning";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { ZoomSafeDropdown, ZoomSafeActionDropdown } from "../ui/zoom-safe-dropdown";
import { Textarea } from "../ui/textarea";
import { formatCurrency } from "../../utils/formatNumber";
import { todayPHTKey } from "../../utils/pht";
import { formatPHTime } from "../../utils/pht";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { useAuth } from "../../contexts/AuthContext";
import { dataStore, type OrderUploadProgress } from "../../utils/dataStore";
import { showDbError } from "../../../lib/db/errors";
import {
  analyzeDocument,
  isSupportedImageName,
  type ColorAnalysis,
} from "../../utils/colorAnalysis";
import { inventoryStore } from "../../utils/inventoryStore";
import { notificationStore } from "../../utils/notificationStore";
import {
  paymentMethodsStore,
  type PaymentMethodType,
} from "../../utils/paymentMethodsStore";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  pricingStore,
  formatPrice,
  getPriceFromMatrix,
  mapPaperSizeKey,
  CONTENT_TYPE_LABELS,
  PHOTO_SIZE_LABELS,
  type ContentType,
  type ServiceType,
  type PhotoSizeKey,
  type PricingValues,
  type ColorTier,
} from "../../utils/pricingStore";
import PaymentMethodQRPanel from "./PaymentMethodQR";
import { CashOnPickupAcknowledgement } from "./CashOnPickupAcknowledgement";
import PaymentRestrictionNotice from "./PaymentRestrictionNotice";
import { pickupReview } from "../../utils/pickupReview";
import LegalPolicyDialog from "./LegalPolicyDialog";
import {
  shopStatusStore,
  type ShopStatusState,
} from "../../utils/shopStatusStore";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
]);

const FILE_UPLOAD_ACCEPT = [
  ...ALLOWED_MIME_TYPES,
  ...ALLOWED_EXTENSIONS,
].join(",");

const SUPPORTED_FORMATS_LABEL =
  "PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, GIF, WEBP, BMP";

const COLOR_MODE_OPTIONS = [
  { value: "bw", label: "Black & White" },
  { value: "colored", label: "Colored" },
];

const COLOR_MODE_LABELS: Record<string, string> = {
  bw: "Black & White",
  colored: "Colored",
};

const WALKIN_CUSTOMER_TYPE_LABELS: Record<"printing" | "photocopy", string> = {
  printing: "Walk-in Printing",
  photocopy: "Photocopy",
};

const staffMenuItems = [
  { label: "Dashboard", path: "/staff/dashboard", icon: <LayoutGrid className="w-5 h-5" /> },
  { label: "Clock-In & Timesheet", path: "/staff/timesheet", icon: <Clock className="w-5 h-5" /> },
  { label: "Walk-in Transactions", path: "/staff/walk-in", icon: <ShoppingCart className="w-5 h-5" /> },
  { label: "Payment Verification", path: "/staff/payment-verification", icon: <CreditCard className="w-5 h-5" /> },
  { label: "Orders", path: "/staff/queue", icon: <Package className="w-5 h-5" /> },
  { label: "Inventory", path: "/staff/inventory", icon: <Boxes className="w-5 h-5" /> },
  { label: "Notifications", path: "/staff/notifications", icon: <Bell className="w-5 h-5" /> },
];

const customerMenuItems = [
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

function scrollPageToTop() {
  window.scrollTo(0, 0);
  document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
}

function isImageFile(file: File): boolean {
  return isSupportedImageName(file.name);
}

type FileData = {
  id: string;
  file: File;
  fileName: string;
  pageCount: number;
  colorAnalysis: ColorAnalysis | null;
  contentType: ContentType;
  printType: "" | "document" | "vellum" | "sticker" | "photo";
  paperSize: string;
  copies: number;
  colorMode: string;
  pagesPerSheet: string;
  orientation: string;
  pageRange: string;
  specificPages: string;
  twoSided: string;
  margins: string;
  scale: string;
  customScale: number;
  notes: string;
  photoSize: PhotoSizeKey;
  photoQty: number;
};

interface PrintTransactionProps {
  mode: "customer" | "walkin";
  userRole?: "admin" | "staff";
}

// Draft + pending-order persistence so an online payment order is only pushed to
// the system once the customer actually submits their payment reference, and so
// returning to the print request resumes where they left off.
const PRINT_DRAFT_KEY = "docufy_print_draft";
const PENDING_ORDER_KEY = "docufy_pending_online_order";

type PrintDraft = {
  orderId?: string;
  files: Array<{
    id: string;
    fileName: string;
    pageCount: number;
    contentType: ContentType;
    printType: FileData["printType"];
    paperSize: string;
    copies: number;
    colorMode: string;
    pagesPerSheet: string;
    orientation: string;
    pageRange: string;
    specificPages: string;
    twoSided: string;
    margins: string;
    scale: string;
    customScale: number;
    notes: string;
    photoSize: PhotoSizeKey;
    photoQty: number;
  }>;
  selectedAddons: { [key: string]: number };
  serviceType: ServiceType;
  paymentMethod: string;
  currentStep: number;
  cashAcknowledged?: boolean;
};

function savePrintDraft(draft: PrintDraft) {
  sessionStorage.setItem(PRINT_DRAFT_KEY, JSON.stringify(draft));
}

function readPrintDraft(): PrintDraft | null {
  try {
    const raw = sessionStorage.getItem(PRINT_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as PrintDraft) : null;
  } catch {
    return null;
  }
}

export function clearPrintDraft() {
  sessionStorage.removeItem(PRINT_DRAFT_KEY);
}

function savePendingOrder(payload: Record<string, unknown>) {
  sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(payload));
}

function readPendingOrder():
  | (Record<string, unknown> & { id: string })
  | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> & { id?: string };
    return parsed.id ? (parsed as Record<string, unknown> & { id: string }) : null;
  } catch {
    return null;
  }
}

export function clearPendingOrder() {
  sessionStorage.removeItem(PENDING_ORDER_KEY);
}

function NumberStepper({
  value,
  min = 1,
  max = 999,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const valueRef = useRef<number>(value);
  const pressTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    return () => {
      if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
      if (repeatTimer.current !== null) window.clearInterval(repeatTimer.current);
    };
  }, []);

  const apply = (next: number) => {
    const safe = Math.min(max, Math.max(min, Math.round(next) || min));
    valueRef.current = safe;
    setDraft(String(safe));
    onCommit(safe);
  };

  const step = (dir: 1 | -1) => apply((valueRef.current || min) + dir);

  const clearTimers = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  // Tap = single step; hold the button to keep stepping after a short delay.
  const press = (dir: 1 | -1) => {
    pressTimer.current = window.setTimeout(() => {
      repeatTimer.current = window.setInterval(() => step(dir), 120);
    }, 420);
  };

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed) || parsed < min || parsed > max) apply(min);
    else apply(parsed);
  };

  return (
    <div className="flex h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-input-background px-1.5 transition-[color,box-shadow] focus-within:border-[#2F6FD6] focus-within:ring-[3px] focus-within:ring-[#2F6FD6]/30">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => step(-1)}
        onPointerDown={(e) => {
          e.preventDefault();
          press(-1);
        }}
        onPointerUp={clearTimers}
        onPointerLeave={clearTimers}
        onPointerCancel={clearTimers}
        disabled={valueRef.current <= min}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <Input
        type="number"
        min={min}
        max={max}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitDraft();
        }}
        className="h-full w-12 shrink-0 flex-1 rounded-none border-0 bg-transparent p-0 text-center text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase"
        onClick={() => step(1)}
        onPointerDown={(e) => {
          e.preventDefault();
          press(1);
        }}
        onPointerUp={clearTimers}
        onPointerLeave={clearTimers}
        onPointerCancel={clearTimers}
        disabled={valueRef.current >= max}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PrintTransaction({ mode, userRole }: PrintTransactionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isWalkin = mode === "walkin";
  const role = userRole || "staff";

  const [currentStep, setCurrentStep] = useState(1);
  const [fileError, setFileError] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showNonPdfDialog, setShowNonPdfDialog] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showColorPricing, setShowColorPricing] = useState(false);
  const [breakdownFileId, setBreakdownFileId] = useState<string | null>(null);
  const [analysisFileId, setAnalysisFileId] = useState<string | null>(null);
  const [analysisShowAll, setAnalysisShowAll] = useState(false);
  const [pricing, setPricing] = useState<PricingValues>(pricingStore.getPricing());
  const downPaymentThreshold = pricing.downPaymentThreshold;
  const fullPaymentThreshold = pricing.fullPaymentThreshold;

  const [shopStatus, setShopStatus] = useState<ShopStatusState>(() =>
    shopStatusStore.getState(),
  );
  useEffect(() => {
    const unsub = shopStatusStore.subscribe(() =>
      setShopStatus(shopStatusStore.getState()),
    );
    return unsub;
  }, []);
  const shopPaused = shopStatus.status !== "open";

  // Classify the upfront-payment requirement for a given order total.
  //   none  → below the down-payment threshold (no upfront payment)
  //   down  → 50% down payment required (downPaymentThreshold..fullPaymentThreshold)
  //   full  → FULL payment required, no 50% option (≥ fullPaymentThreshold)
  const paymentRequirementFor = (total: number): "full" | "down" | "none" => {
    if (total >= fullPaymentThreshold) return "full";
    if (total >= downPaymentThreshold) return "down";
    return "none";
  };
  useEffect(() => {
    const load = () => setPricing(pricingStore.getPricing());
    return pricingStore.subscribe(load);
  }, []);
  const [files, setFiles] = useState<FileData[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>("document");

  // Walk-in customer info
  const [customerType, setCustomerType] = useState<"printing" | "photocopy">("printing");
  const isPhotocopy = isWalkin && customerType === "photocopy";
  const photocopyPaperLabel = (code: string) =>
    availablePaperSizes.find((s) => s.name === code)?.displayName || code.toUpperCase();

  // Photocopy (walk-in only): basic options + manual staff pricing
  const [photocopyPaperSize, setPhotocopyPaperSize] = useState("a4");
  const [photocopyCopies, setPhotocopyCopies] = useState(1);
  const [photocopyColorMode, setPhotocopyColorMode] = useState<"bw" | "colored">("bw");
  const [photocopyManualPrice, setPhotocopyManualPrice] = useState("");
  const photocopyPrice = photocopyManualPrice.trim() === "" ? 1 : Math.max(1, Math.round(Number(photocopyManualPrice) || 1));

  // Payment (customer only)
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashAcknowledged, setCashAcknowledged] = useState(false);
  const [onlineMethods, setOnlineMethods] = useState<PaymentMethodType[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);

  // Down-payment tier (customer, orders ₱50–99): all payment options stay
  // available here — the Partial/Full amount choice happens later on the
  // payment verification page, not in this select-payment-method menu.

  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<{
    [key: string]: number;
  }>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPlaceOrderConfirm, setShowPlaceOrderConfirm] = useState(false);
  const [showLegalPolicy, setShowLegalPolicy] = useState(false);
  const [legalPolicyTab, setLegalPolicyTab] = useState<"terms" | "privacy">("terms");
  const [showProceedConfirm, setShowProceedConfirm] = useState(false);
  const [showCancelConfirmDialog, setShowCancelConfirmDialog] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [step2FileIndex, setStep2FileIndex] = useState(0);
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const submittedDisplayId = submittedOrderId
    ? dataStore.getOrderById(submittedOrderId)?.displayId ?? submittedOrderId
    : "";
  // Set synchronously the moment an order is placed (before any navigate) so
  // the useBlocker below can't fire from a stale submittedOrderId render while
  // the intentional jump to Payment Verification is in flight, and so a
  // dismissed success dialog can never re-place the same order.
  const orderSubmittedRef = useRef(false);
  // Placing-state for the submit buttons: set synchronously before the awaited
  // order-write (file uploads + DB round trips) so a rapid double-click can
  // never double-fire, and mirrored into state so the UI can show a spinner.
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const submittingRef = useRef(false);
  // Live upload progress for the submitting state. Throttled to whole-percent
  // changes (XHR fires onprogress very frequently) to avoid re-render churn.
  const [uploadProgress, setUploadProgress] = useState<OrderUploadProgress | null>(null);
  const lastUploadPercentRef = useRef(-1);
  const lastUploadFileIndexRef = useRef(0);
  const [availablePaperSizes, setAvailablePaperSizes] = useState<
    Array<{
      id: string;
      name: string;
      displayName: string;
      inStock: boolean;
    }>
  >([]);
  const [availableAddons, setAvailableAddons] = useState<
    Array<{
      id: string;
      name: string;
      price: number;
      inStock: boolean;
      unit: string;
      category: string;
      description: string;
    }>
  >([]);

  useEffect(() => {
    const load = () => {
      setAvailablePaperSizes(inventoryStore.getPaperSizeOptions());
      setAvailableAddons(inventoryStore.getAddons());
    };
    load();
    const unsubscribe = inventoryStore.subscribe(load);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (availablePaperSizes.length > 0) {
      if (!availablePaperSizes.some((s) => s.name === photocopyPaperSize)) {
        setPhotocopyPaperSize(availablePaperSizes[0].name);
      }
    } else {
      // No paper/material stock in inventory — nothing to select.
      setPhotocopyPaperSize("");
    }
  }, [availablePaperSizes]);

  useEffect(() => {
    const loadMethods = () =>
      setOnlineMethods(paymentMethodsStore.getPaymentMethods());
    loadMethods();
    const unsubscribe = paymentMethodsStore.subscribe(loadMethods);
    return unsubscribe;
  }, []);

  // Resume ONLY a SUBMITTED online payment order — the customer has already
  // reached the payment verification page, so the draft (which carries an
  // orderId) is restored so they can finish submitting their reference. Any
  // mid-form backup (no orderId) is discarded: leaving the print request
  // before reaching payment verification resets the form to zero.
  const [isResumed, setIsResumed] = useState(false);
  useEffect(() => {
    if (isWalkin) return;
    const draft = readPrintDraft();
    if (!draft) return;
    if (!draft.orderId || !draft.paymentMethod) {
      clearPrintDraft();
      return;
    }
    const restoredFiles: FileData[] = draft.files.map((f) => ({
      id: f.id,
      file: new File([], f.fileName),
      fileName: f.fileName,
      pageCount: f.pageCount,
      colorAnalysis: null,
      contentType: f.contentType,
      printType: f.printType,
      paperSize: f.paperSize,
      copies: f.copies,
      colorMode: f.colorMode,
      pagesPerSheet: f.pagesPerSheet,
      orientation: f.orientation,
      pageRange: f.pageRange,
      specificPages: f.specificPages,
      twoSided: f.twoSided,
      margins: f.margins,
      scale: f.scale,
      customScale: f.customScale,
      notes: f.notes,
      photoSize: f.photoSize,
      photoQty: f.photoQty,
    }));
    setFiles(restoredFiles);
    setSelectedAddons(draft.selectedAddons || {});
    setServiceType(draft.serviceType || "document");
    setPaymentMethod(draft.paymentMethod || "");
    if (draft.paymentMethod) {
      setSubmittedOrderId(draft.orderId || "");
      // The order was already placed (held pending until reference submit), so
      // the leave-guard must stay inactive for this whole resumed request.
      orderSubmittedRef.current = true;
    }
    setCashAcknowledged(draft.cashAcknowledged || false);
    // Bring the customer back to the payment step for the submitted order.
    setCurrentStep(draft.currentStep || 4);
    setIsResumed(true);

    // The in-page "Go Back" button in payment verification passes
    // fromPaymentVerification:true so the order can instead be reviewed/edited
    // without jumping away.
    if (!location.state?.fromPaymentVerification) {
      navigate(`/customer/payment/${draft.orderId}`, {
        replace: true,
        state: { paymentMethod: draft.paymentMethod, showSuccessAfter: true },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While files are uploaded but the order has NOT reached payment verification
  // yet, block navigating away so we can ask for confirmation. Confirming
  // leaves and discards the request (mid-form progress is never backed up, so
  // the form resets to zero on the next visit); cancelling keeps the customer
  // on the page. Passed as a FUNCTION (not a boolean) because useBlocker only
  // re-reads its argument when a navigation is attempted — the boolean form
  // bakes in the value from the last render, so the synchronous
  // orderSubmittedRef.current flip right before the intentional jump to Payment
  // Verification never got seen and the leave prompt fired anyway.
  const shouldBlockLeavePrintRequest = useCallback(
    () =>
      !isWalkin &&
      !orderSubmittedRef.current &&
      files.length > 0,
    [isWalkin, files.length, orderSubmittedRef],
  );
  const blocker = useBlocker(shouldBlockLeavePrintRequest);

  const selectedMethod = onlineMethods.find(
    (m) => m.name === paymentMethod,
  );
  const isOnline = paymentMethod !== "" && paymentMethod !== "cash";
  const isGcash = isOnline && paymentMethod.toLowerCase() === "gcash";

  const viewMethodQR = (name: string) => {
    setPaymentMethod(name);
    setShowQRModal(true);
  };

  const noteTemplates = [
    "Please staple per set",
    "Front page color only",
    "Please arrange pages in order",
    "Bind on left side",
  ];

  const processUploadedFiles = async (filesToProcess: File[]) => {
    setIsProcessingFile(true);

    try {
      for (const file of filesToProcess) {
        const fileId = Math.random().toString(36).substr(2, 9);

        setFiles((prev) => [
          ...prev,
          {
            id: fileId,
            file,
            fileName: file.name,
            pageCount: 1,
            colorAnalysis: null,
            contentType: isImageFile(file) ? "imageOnly" : "text",
            printType: "",
            paperSize: availablePaperSizes.length > 0 ? availablePaperSizes[0].name : "",
            copies: 1,
            colorMode: "bw",
            pagesPerSheet: "1",
            orientation: "portrait",
            pageRange: "all",
            specificPages: "",
            twoSided: "no",
            margins: "default",
            scale: "default",
            customScale: 100,
            notes: "",
            photoSize: "2R",
            photoQty: Math.max(
              1,
              pricingStore.getMatrix().photo["2R"]?.minQty ?? 6,
            ),
          },
        ]);

        // The row is on screen immediately; the real analysis then fills in the
        // page count + per-page color percentages. A failed analysis leaves the
        // row at 1 page / no color data rather than blocking the whole upload.
        setAnalyzingFileId(fileId);
        try {
          const analyzed = await analyzeDocument(file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    pageCount: analyzed.pageCount,
                    colorAnalysis: analyzed.analysis,
                  }
                : f,
            ),
          );
        } catch (error) {
          console.error("Color analysis failed for", file.name, error);
        } finally {
          setAnalyzingFileId(null);
        }
      }
    } catch (error) {
      setFileError("Error processing files. Please try again.");
      console.error(error);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setFileError("");

    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesToProcess = Array.from(selectedFiles);

    for (const file of filesToProcess) {
      const fileType = file.type;
      const fileExtension = "." + file.name.toLowerCase().split(".").pop();

      const isValidType =
        ALLOWED_MIME_TYPES.has(fileType) || ALLOWED_EXTENSIONS.has(fileExtension);

      if (!isValidType) {
        setFileError(
          `Unsupported file format in "${file.name}". Please upload PDF, DOC, DOCX, XLS, XLSX, or image files only.`,
        );
        return;
      }
    }

    const clearInput = () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Non-PDF files confirm the preferred PDF format before they are accepted.
    if (filesToProcess.some((f) => f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"))) {
      setPendingUpload(filesToProcess);
      setShowNonPdfDialog(true);
      return;
    }

    try {
      await processUploadedFiles(filesToProcess);
    } finally {
      clearInput();
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const updateFileOption = (
    fileId: string,
    field: keyof Omit<FileData, "id" | "file" | "fileName" | "pageCount">,
    value: any,
  ) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, [field]: value } : f)),
    );
  };

  const calculateFileTotal = (fileData: FileData) => {
    if (fileData.printType === "photo") {
      const matrix = pricingStore.getMatrix();
      const size = matrix.photo[fileData.photoSize];
      return (size ? size.price : 0) * Math.max(1, fileData.photoQty);
    }

    const { pageCount, copies, pagesPerSheet } = fileData;
    const validCopies = Math.max(1, copies);

    const perPage = shadeRateFor(fileData);

    let baseTotal = perPage * pageCount * validCopies;

    const pagesPerSheetNum = parseInt(pagesPerSheet);
    if (pagesPerSheetNum > 1) {
      baseTotal = baseTotal / pagesPerSheetNum;
    }

    return Math.max(0, baseTotal);
  };

  const matrixRatesFor = (fileData: FileData) => {
    const matrix = pricingStore.getMatrix();
    const svc = (fileData.printType as ServiceType) || serviceType;
    const sizeKey = mapPaperSizeKey(fileData.paperSize);
    const ctype = fileData.contentType;
    const rate = (colorTier: ColorTier) =>
      getPriceFromMatrix(matrix, svc, {
        contentType: ctype,
        colorTier,
        sizeKey,
      });
    return { bw: rate("bw"), partial: rate("partial"), full: rate("full") };
  };

  const colorTierPctFor = (fileData: FileData) => {
    if (fileData.colorMode === "bw") return 0;
    const analysis = fileData.colorAnalysis;
    if (analysis && analysis.colorPages.length > 0) {
      const sum = analysis.colorPages.reduce(
        (acc, p) => acc + (analysis.colorPercentages[p] ?? 0),
        0,
      );
      const avg = sum / analysis.colorPages.length;
      return avg <= 50 ? 50 : avg <= 75 ? 75 : 100;
    }
    return 100;
  };

  const midColorRate = (rates: { bw: number; partial: number; full: number }) =>
    Math.round((rates.partial + rates.full) / 2);

  const shadeRateFor = (fileData: FileData, pct?: number) => {
    const rates = matrixRatesFor(fileData);
    const tier = pct ?? colorTierPctFor(fileData);
    if (tier <= 0) return rates.bw;
    if (tier <= 50) return rates.partial;
    if (tier <= 75) return midColorRate(rates);
    return rates.full;
  };

  const calculateTotal = () => {
    const filesTotal = files.reduce(
      (sum, file) => sum + calculateFileTotal(file),
      0,
    );
    const addonsTotal = Object.entries(selectedAddons).reduce(
      (sum, [addonId, qty]) => {
        const addon = availableAddons.find((a) => a.id === addonId);
        return sum + (addon ? addon.price * qty : 0);
      },
      0,
    );
    return filesTotal + addonsTotal;
  };

  // HIGH-VALUE ORDERS: at/above the full payment threshold, Cash on Pickup is
  // NOT selectable for customers — they must pay online so the full amount is
  // verified before the order is queued.
  const checkoutTotal = calculateTotal();
  const flowTier = paymentRequirementFor(checkoutTotal);
  const isDownTier = flowTier === "down";
  const isFullTier = flowTier === "full";
  // Down-payment tier = 50% down minimum regardless of payment method. Cash
  // customers choose down/full on the "Down Payment Method" page; customers
  // paying online choose Partial (50%) vs Full on the payment verification
  // page. Full tier = full payment required (no 50% option).
  const requiresDownPayment = isDownTier;
  const requiresFullPayment = isFullTier;
  const downPaymentValue = checkoutTotal * 0.5;
  // Low-value Cash on Pickup orders (under the down-payment threshold) skip the
  // upfront payment hold entirely: they are auto-queued at checkout and the cash
  // is collected at the shop when the order is picked up.
  const isLowValueCash = !isOnline && flowTier === "none";

  // Cash on Pickup is unavailable ONLY for full-payment tier orders
  // (≥ fullPaymentThreshold → online only). Down-payment tier orders keep
  // every option selectable: cash gets a 50% down payment, and online methods
  // default to a down payment with the full option available on the next page.
  const cashDisabled = isFullTier;

  // No in-stock paper means document/vellum/sticker files can't be printed at all.
  const hasPaperStock = availablePaperSizes.some((s) => s.inStock);

  // No in-stock photo paper means photo files can't be printed at all.
  const hasPhotoPaperStock = availablePaperSizes.some(
    (s) =>
      s.inStock &&
      (["2R", "3R", "4R", "5R", "6R", "A4photo"] as string[]).includes(s.name),
  );

  // Keep the payment method consistent when the order must be paid online.
  useEffect(() => {
    if (cashDisabled && paymentMethod === "cash") {
      setPaymentMethod("");
    }
  }, [cashDisabled, paymentMethod]);

  const validatePhotoMinQty = (): boolean => {
    for (const f of files) {
      if (f.printType === "photo") {
        const matrix = pricingStore.getMatrix();
        const item = matrix.photo[f.photoSize];
        const minQty = item ? item.minQty : 0;
        if (minQty > 0 && f.photoQty < minQty) {
          toast.error(
            `${PHOTO_SIZE_LABELS[f.photoSize]} photos (${f.fileName}) require a minimum of ${minQty} pcs.`,
          );
          return false;
        }
      }
    }
    return true;
  };

  const resetForm = () => {
    setFiles([]);
    setSelectedAddons({});
    setServiceType("document");
    setPaymentMethod("");
    setCashAcknowledged(false);
    setCustomerType("printing");
    setPhotocopyPaperSize("a4");
    setPhotocopyCopies(1);
    setPhotocopyColorMode("bw");
    setPhotocopyManualPrice("");
    setSubmittedOrderId("");
    orderSubmittedRef.current = false;
    submittingRef.current = false;
    setIsSubmittingOrder(false);
    setUploadProgress(null);
    lastUploadPercentRef.current = -1;
    lastUploadFileIndexRef.current = 0;
    setCurrentStep(1);
  };

  const handleProceedToQueue = async () => {
    if (submittingRef.current) return;
    const now = new Date();

    const hasPaperInStock = availablePaperSizes.some((s) => s.inStock);

    if (isPhotocopy) {
      if (!hasPaperInStock) {
        toast.error(
          "No paper stock available for printing right now. Please check back later or contact the shop.",
        );
        return;
      }
      const manualPrice = photocopyPrice;
      const paperLabel = photocopyPaperLabel(photocopyPaperSize);
      const colorLabel = photocopyColorMode === "bw" ? "Black & White" : "Colored";
      const newOrder = {
        customer: "Walk-in Customer",
        customerType: "photocopy" as const,
        pages: photocopyCopies,
        type: "Photocopy",
        notes: `Photocopy - ${photocopyCopies} ${photocopyCopies === 1 ? "copy" : "copies"} ${paperLabel} (${colorLabel})`,
        status: "In Queue" as const,
        time: formatPHTime(now),
        paperSize: photocopyPaperSize,
        copies: photocopyCopies,
        submittedAt: now,
        paymentVerified: true,
        orderSource: "walkin" as const,
        colorMode: photocopyColorMode,
        manualTotal: manualPrice,
        costBreakdown: { printingCost: manualPrice, addonsCost: 0, total: manualPrice },
        expectedPaperUsage: [{ size: photocopyPaperSize, sheets: photocopyCopies }],
        paperDeductedOnCreate: false,
      };
      submittingRef.current = true;
      setIsSubmittingOrder(true);
      const created = await dataStore
        .addOrder({ ...newOrder, actorId: user?.id }, reportUploadProgress)
        .catch((err) => {
          showDbError("adding the walk-in order", err);
          return null;
        });
      if (!created) {
        submittingRef.current = false;
        setIsSubmittingOrder(false);
        setUploadProgress(null);
        lastUploadPercentRef.current = -1;
    lastUploadFileIndexRef.current = 0;
        return;
      }
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Photocopy sent to queue!</span>
          <span className="text-sm">Order ID: {created.displayId ?? created.id}</span>
          <span className="text-sm">Total: {formatCurrency(manualPrice)}</span>
        </div>,
        { duration: 5000 }
      );
      resetForm();
      return;
    }

    const total = calculateTotal();
    let filesTotal = 0;
    for (const f of files) filesTotal += calculateFileTotal(f);
    let transactionId = "";

    if (!validatePhotoMinQty()) return;

    if (files.length > 0 && files.some((f) => f.printType !== "photo") && !hasPaperInStock) {
      toast.error(
        "No paper stock available for printing right now. Please check back later or contact the shop.",
      );
      return;
    }

    if (files.length > 0 && files.some((f) => f.printType === "photo") && !hasPhotoPaperStock) {
      toast.error(
        "No photo paper in stock for photo printing right now. Please check back later or contact the shop.",
      );
      return;
    }

    if (files.length > 0) {
      const totalPages = files.reduce((sum, f) => sum + f.pageCount * f.copies, 0);
      const hasColor = files.some((f) => f.colorMode !== "bw");
      const hasPhoto = files.some((f) => f.printType === "photo");
      const firstPhoto = files.find((f) => f.printType === "photo");

      const newOrder = {
        customer: "Walk-in Customer",
        customerType,
        pages: totalPages > 0 ? totalPages : firstPhoto ? firstPhoto.photoQty : 0,
        type: hasPhoto ? "Photo" : hasColor ? "Colored" : "B&W",
        notes: hasPhoto
          ? `Walk-in photo print - ${files.filter((f) => f.printType === "photo").map((f) => `${f.photoQty} pc(s) ${PHOTO_SIZE_LABELS[f.photoSize]}`).join(", ")}`
          : `Walk-in transaction - ${files.length} file(s)`,
        status: "In Queue" as const,
        time: formatPHTime(now),
        paperSize: firstPhoto
          ? firstPhoto.photoSize === "2R" ? "2R" : firstPhoto.photoSize === "A4photo" ? "A4" : firstPhoto.photoSize
          : files[0]?.paperSize === "a4" ? "A4" : files[0]?.paperSize === "legal" ? "Legal" : "A4",
        copies: firstPhoto ? firstPhoto.photoQty : 1,
        submittedAt: now,
        paymentVerified: true,
        orderSource: "walkin" as const,
        costBreakdown: { printingCost: filesTotal, addonsCost: total - filesTotal, total },
        margins: files[0]?.margins || "default",
        scale: files[0]?.scale || "default",
        customScale: files[0]?.customScale || 100,
        downPaymentRequired: false,
        downPaymentVerified: false,
        attachedFiles: files.map((f) => ({
          name: f.fileName,
          size: `${(f.file.size / 1024 / 1024).toFixed(2)} MB`,
          type: f.file.type.toUpperCase().includes("PDF") ? "PDF" :
                f.file.type.toUpperCase().includes("WORD") || f.file.type.toUpperCase().includes("DOCUMENT") ? "Document" :
                f.file.type.toUpperCase().includes("POWERPOINT") || f.file.type.toUpperCase().includes("PRESENTATION") ? "PowerPoint" :
                f.file.type.toUpperCase().includes("EXCEL") || f.file.type.toUpperCase().includes("SPREADSHEET") ? "Excel" :
                f.file.type.toUpperCase().includes("IMAGE") ? "Image" : "Document",
          url: URL.createObjectURL(f.file),
          uploadedAt: now.toISOString(),
          file: f.file,
          mimeType: f.file.type,
          sizeBytes: f.file.size,
          contentType: f.contentType,
          printType: f.printType,
          photoSize: f.photoSize,
          photoQuantity: f.photoQty,
          notes: f.notes,
          paperSize: f.paperSize,
          orientation: f.orientation,
          copies: f.copies,
          twoSided: f.twoSided,
          pagesPerSheet: f.pagesPerSheet,
          colorMode: f.colorMode,
          pageRange: f.pageRange,
          specificPages: f.specificPages,
          margins: f.margins,
          scale: f.scale,
          customScale: f.customScale,
          pageCount: f.pageCount,
        })),
        expectedPaperUsage: (() => {
          const map: Record<string, number> = {};
          files.forEach((f) => {
            if (f.printType === "photo") return;
            const pps = parseInt(f.pagesPerSheet || "1", 10) || 1;
            const sheets = Math.ceil(f.pageCount / pps) * (f.copies || 1);
            const size = f.paperSize || "a4";
            map[size] = (map[size] || 0) + sheets;
          });
          return Object.entries(map).map(([size, sheets]) => ({ size, sheets }));
        })(),
        paperDeductedOnCreate: false,
      };

      submittingRef.current = true;
      setIsSubmittingOrder(true);
      const created = await dataStore
        .addOrder({ ...newOrder, actorId: user?.id }, reportUploadProgress)
        .catch((err) => {
          showDbError("adding the walk-in order", err);
          return null;
        });
      if (!created) {
        submittingRef.current = false;
        setIsSubmittingOrder(false);
        setUploadProgress(null);
        lastUploadPercentRef.current = -1;
    lastUploadFileIndexRef.current = 0;
        return;
      }
      transactionId = created.displayId ?? created.id;
    }

    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Walk-in order sent to queue!</span>
        <span className="text-sm">Order ID: {transactionId}</span>
        <span className="text-sm">Total: {formatCurrency(total)}</span>
      </div>,
      { duration: 5000 }
    );

    resetForm();
  };

  // Throttled progress reporter for the submit flow. XHR fires `onprogress` very
  // frequently, so only re-render when the whole percentage (or the active file)
  // changes.
  const reportUploadProgress = (p: OrderUploadProgress) => {
    if (
      p.percent === lastUploadPercentRef.current &&
      p.fileIndex === lastUploadFileIndexRef.current
    ) {
      return;
    }
    lastUploadPercentRef.current = p.percent;
    lastUploadFileIndexRef.current = p.fileIndex;
    lastUploadFileIndexRef.current = p.fileIndex;
    setUploadProgress(p);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (submittedOrderId || orderSubmittedRef.current) {
      toast.error(
        "This order has already been placed. Track it under My Orders to see its status.",
      );
      return;
    }

    if (!paymentMethod) {
      toast.error(
        "Please select a payment method before placing your order.",
      );
      return;
    }

    if (!isOnline && paymentMethod === "cash" && !cashAcknowledged) {
      toast.error(
        "Please confirm the Cash on Pickup acknowledgment before placing your order.",
      );
      return;
    }

    if (!isWalkin && paymentMethod === "cash" && cashDisabled) {
      toast.error(
        `Cash on Pickup is not available for orders ₱${fullPaymentThreshold.toLocaleString()} and above. Please pay online via one of the available payment methods.`,
      );
      return;
    }

    if (
      files.some((f) => f.printType !== "photo") &&
      !availablePaperSizes.some((s) => s.inStock)
    ) {
      toast.error(
        "No paper stock available for printing right now. Please check back later or contact the shop.",
      );
      return;
    }

    if (
      files.some((f) => f.printType === "photo") &&
      !hasPhotoPaperStock
    ) {
      toast.error(
        "No photo paper in stock for photo printing right now. Please check back later or contact the shop.",
      );
      return;
    }

    const total = calculateTotal();
    let filesTotal = 0;
    for (const f of files) filesTotal += calculateFileTotal(f);
    const methodLabel = isOnline ? paymentMethod : "Cash";

    if (!validatePhotoMinQty()) return;

    const totalPages = files.reduce(
      (sum, f) => sum + f.pageCount * f.copies,
      0,
    );
    const hasColor = files.some((f) => f.colorMode !== "bw");

    const requiresDownPayment = flowTier === "down";
    const requiresFullPayment = flowTier === "full";
    const downPaymentAmount = requiresDownPayment ? total * 0.5 : 0;

    // Payment confirmation/verification deadline from the admin-editable order
    // rules (seconds; 0 = no auto-expiry). Cash = pay at the shop, online =
    // submit reference + staff verification. Low-value cash orders get no
    // deadline because they are already in the queue. Pending client confirmation.
    const deadlineWindowSeconds = isOnline
      ? pricing.onlinePaymentVerificationWindowSeconds
      : pricing.cashPickupPaymentWindowSeconds;
    const paymentDeadline =
      !isLowValueCash && deadlineWindowSeconds > 0
        ? new Date(Date.now() + deadlineWindowSeconds * 1000).toISOString()
        : undefined;

    const newOrder = {
      customerId: user?.email || "customer@example.com",
      customerName: user?.name || "Customer",
      customerEmail: user?.email || "customer@example.com",
      // Low-value Cash on Pickup orders are auto-queued at checkout (the shop
      // prints them first and collects the cash on pickup); every other customer
      // order first passes payment confirmation/verification (staff confirm cash
      // at the shop, or verify an online submission) before the print queue.
      status: isLowValueCash ? ("In Queue" as const) : ("Awaiting Payment" as const),
      paymentDeadline,
      holdReason: isLowValueCash
        ? `Cash on Pickup: pay ₱${Math.round(total)} at the shop when picking up this order. This order is already in the print queue.`
        : isOnline
          ? requiresFullPayment
            ? `${methodLabel} full payment of ₱${Math.round(total)} is pending verification. Your order will be queued once the full payment is verified.`
            : requiresDownPayment
              ? `${methodLabel} down payment of ₱${Math.round(downPaymentAmount)} (50% of total ₱${Math.round(total)}) is pending verification. Your order will be queued once the down payment is verified.`
              : `${methodLabel} payment of ₱${Math.round(total)} is pending verification. Your order will be queued once the payment is verified.`
          : `Cash on Pickup: pay ₱${Math.round(total)}${requiresFullPayment ? " (full payment)" : requiresDownPayment ? ` (down payment of ₱${Math.round(downPaymentAmount)} — 50% of the total)` : ""} at the shop before your payment deadline to confirm this order.`,
      total: `₱${Math.round(total)}`,
      costBreakdown: {
        printingCost: filesTotal,
        addonsCost: total - filesTotal,
        total,
      },
      date: todayPHTKey(),
      paperSize:
        files[0]?.paperSize === "a4"
          ? "A4"
          : files[0]?.paperSize === "short"
            ? "Short"
            : files[0]?.paperSize === "long"
              ? "Long"
              : files[0]?.paperSize === "folio"
                ? "Folio"
                : files[0]?.paperSize === "legal"
                  ? "Legal"
                  : files[0]?.paperSize === "a3"
                    ? "A3"
                    : "A4",
      printType: hasColor ? "Colored" : "Black & White",
      copies:
        files.reduce((sum, f) => sum + f.copies, 0) /
        files.length,
      paymentMethod: isOnline ? methodLabel : "Cash",
      fileName: files[0]?.fileName || "document.pdf",
      pages: totalPages,
      attachedFiles: files.map((f) => ({
        name: f.fileName,
        size: `${(f.file.size / 1024 / 1024).toFixed(2)} MB`,
        type: f.file.type.toUpperCase().includes("PDF")
          ? "PDF"
          : "Document",
        url: URL.createObjectURL(f.file),
        uploadedAt: new Date().toISOString(),
        file: f.file,
        mimeType: f.file.type,
        sizeBytes: f.file.size,
        contentType: f.contentType,
        printType: f.printType,
        photoSize: f.photoSize,
        photoQuantity: f.photoQty,
        notes: f.notes,
        paperSize: f.paperSize,
        orientation: f.orientation,
        copies: f.copies,
        twoSided: f.twoSided,
        pagesPerSheet: f.pagesPerSheet,
        colorMode: f.colorMode,
        pageRange: f.pageRange,
        specificPages: f.specificPages,
        margins: f.margins,
        scale: f.scale,
        customScale: f.customScale,
        pageCount: f.pageCount,
      })),
      orientation: files[0]?.orientation || "Portrait",
      twoSided: files[0]?.twoSided || "no",
      pagesPerSheet: files[0]?.pagesPerSheet || "1",
      margins: files[0]?.margins || "default",
      scale: files[0]?.scale || "default",
      customScale: files[0]?.customScale || 100,
      colorMode: hasColor ? "color" : "bw",
      pageRange: files[0]?.pageRange || "all",
      notes:
        files
          .map((f) => f.notes)
          .filter((n) => n)
          .join("; ") || "",
      addons: Object.entries(selectedAddons)
        .filter(([_, qty]) => qty > 0)
        .map(([addonId, qty]) => {
          const addon = availableAddons.find((a) => a.id === addonId);
          return {
            name: addon?.name || "",
            quantity: qty,
            price: addon?.price || 0,
          };
        }),
      orderSource: "online" as const,
      downPaymentRequired: requiresDownPayment,
      downPaymentAmount: requiresDownPayment ? downPaymentAmount : undefined,
      downPaymentVerified: false,
      fullPaymentRequired: requiresFullPayment,
      fullPaymentAmount: requiresFullPayment ? total : undefined,
      fullPaymentVerified: false,
      expectedPaperUsage: (() => {
        const map: Record<string, number> = {};
        files.forEach((f) => {
          if (f.printType === "photo") return;
          const pps = parseInt(f.pagesPerSheet || "1", 10) || 1;
          const sheets = Math.ceil(f.pageCount / pps) * (f.copies || 1);
          const size = f.paperSize || "a4";
          map[size] = (map[size] || 0) + sheets;
        });
        return Object.entries(map).map(([size, sheets]) => ({ size, sheets }));
      })(),
      paperDeductedOnCreate: false,
    };

    // The order row is created in Supabase here for EVERY customer flow (status
    // is already correct: In Queue for low-value cash, Awaiting Payment for
    // everything else). Online / down-payment orders then navigate to the
    // payment / down-payment-method pages where the customer chooses how to pay
    // and (online) submits their reference — backing out leaves an awaiting-
    // payment order that auto-expires after its payment deadline.
    let created: Awaited<ReturnType<typeof dataStore.addOrder>>;
    submittingRef.current = true;
    setIsSubmittingOrder(true);
    try {
      created = await dataStore.addOrder({ ...newOrder, actorId: user?.id }, reportUploadProgress);
    } catch (err) {
      submittingRef.current = false;
      setIsSubmittingOrder(false);
      setUploadProgress(null);
      lastUploadPercentRef.current = -1;
    lastUploadFileIndexRef.current = 0;
      showDbError("placing your order", err);
      return;
    }
    const orderId = created.id;
    const displayId = created.displayId ?? orderId;

    // ONLINE payment orders and DOWN-PAYMENT-tier orders route to their payment
    // decision page immediately (the order already exists — the customer just
    // hasn't paid yet). Backing out leaves the awaiting-payment order in place,
    // subject to its payment deadline.
    if (isOnline || isDownTier) {
      const orderData = {
        orderId,
        total,
        paymentMethod: methodLabel,
        timestamp: new Date().toISOString(),
        downPaymentRequired: requiresDownPayment,
        downPaymentAmount: requiresDownPayment ? downPaymentAmount : undefined,
        fullPaymentRequired: requiresFullPayment,
        fullPaymentAmount: requiresFullPayment ? total : undefined,
      };
      localStorage.setItem(`order_${orderId}`, JSON.stringify(orderData));

      savePendingOrder(newOrder as unknown as Record<string, unknown>);
      savePrintDraft({
        orderId,
        files: files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          pageCount: f.pageCount,
          contentType: f.contentType,
          printType: f.printType,
          paperSize: f.paperSize,
          copies: f.copies,
          colorMode: f.colorMode,
          pagesPerSheet: f.pagesPerSheet,
          orientation: f.orientation,
          pageRange: f.pageRange,
          specificPages: f.specificPages,
          twoSided: f.twoSided,
          margins: f.margins,
          scale: f.scale,
          customScale: f.customScale,
          notes: f.notes,
          photoSize: f.photoSize,
          photoQty: f.photoQty,
        })),
        selectedAddons,
        serviceType,
        paymentMethod,
        currentStep,
      });

      setSubmittedOrderId(orderId);
      orderSubmittedRef.current = true;

      // Every down-payment-tier order (₱50–99), regardless of the method picked
      // at checkout, goes to the Down Payment Method page where the customer
      // chooses Pay At The Shop (→ order tracking, staff verifies the down
      // payment at the shop) or Pay Online (→ Payment Verification, normal
      // online verification).
      if (flowTier === "down") {
        navigate(`/customer/payment-method/${orderId}`, {
          state: {
            paymentMethod: methodLabel,
            total,
          },
        });
      } else {
        navigate(`/customer/payment/${orderId}`, {
          state: {
            paymentMethod: methodLabel,
            total,
            showSuccessAfter: true,
          },
        });
      }
      return;
    }

    const notifTitle = isLowValueCash
      ? "New Order — In Queue (Cash on Pickup)"
      : requiresFullPayment
        ? "New Order — Full Payment Required"
        : requiresDownPayment
          ? "New Order — Down Payment Required"
          : "New Order — Awaiting Cash Payment";
    const notifMsg = isLowValueCash
      ? `New order #${displayId} from ${user?.email || "customer"} is already IN THE PRINT QUEUE — ₱${Math.round(total)} (Cash on Pickup) to be collected at the shop on pickup.`
      : requiresFullPayment
        ? `New order #${displayId} from ${user?.email || "customer"} is awaiting FULL payment verification — ₱${Math.round(total)} (100% of total) required before the order can be printed.`
        : requiresDownPayment
          ? `New order #${displayId} from ${user?.email || "customer"} is awaiting down payment verification — ₱${Math.round(downPaymentAmount)} required (50% of total ₱${Math.round(total)}).`
          : `New order #${displayId} from ${user?.email || "customer"}. ${files.length} file(s), ${totalPages} pages total — Cash on Pickup, awaiting payment of ₱${Math.round(total)} at the shop.`;

    notificationStore.addNotification("order", notifTitle, notifMsg, {
      clickable: true,
      relatedOrderId: orderId,
      recipientRole: "admin",
    });

    notificationStore.addNotification("order", notifTitle, notifMsg, {
      clickable: true,
      relatedOrderId: orderId,
      recipientRole: "staff",
    });

    const orderData = {
      orderId,
      total,
      paymentMethod: methodLabel,
      timestamp: new Date().toISOString(),
      downPaymentRequired: requiresDownPayment,
      downPaymentAmount: requiresDownPayment ? downPaymentAmount : undefined,
      fullPaymentRequired: requiresFullPayment,
      fullPaymentAmount: requiresFullPayment ? total : undefined,
    };
    localStorage.setItem(
      `order_${orderId}`,
      JSON.stringify(orderData),
    );

    setSubmittedOrderId(orderId);
    orderSubmittedRef.current = true;
    clearPrintDraft();
    submittingRef.current = false;
    setIsSubmittingOrder(false);
    setUploadProgress(null);
    lastUploadPercentRef.current = -1;
    lastUploadFileIndexRef.current = 0;
    setShowSuccessModal(true);
  };

  const handleCancelOrder = () => {
    setShowCancelConfirmDialog(true);
  };

  const confirmCancelOrder = () => {
    resetForm();
    setShowCancelConfirmDialog(false);
    toast.info("Walk-in transaction cancelled");
  };

  const steps = isWalkin && customerType === "photocopy"
    ? [
        { number: 1, title: "Photocopy Options", icon: Copy },
        { number: 2, title: "Review & Complete", icon: CheckCircle },
      ]
    : isWalkin
    ? [
        { number: 1, title: "Customer & Files", icon: Upload },
        { number: 2, title: "Print Options", icon: Settings },
        { number: 3, title: "Add-ons", icon: ShoppingCart },
        { number: 4, title: "Review & Complete", icon: CheckCircle },
      ]
    : [
        { number: 1, title: "Upload Document", icon: Upload },
        { number: 2, title: "Print Options", icon: Settings },
        { number: 3, title: "Add-ons", icon: ShoppingCart },
        { number: 4, title: "Summary", icon: CheckCircle },
      ];

  const menuItems = isWalkin
    ? role === "admin"
      ? adminMenuItems
      : staffMenuItems
    : customerMenuItems;
  const dashboardPath = isWalkin
    ? role === "admin"
      ? "/admin/dashboard"
      : "/staff/dashboard"
    : "/customer/dashboard";
  const title = isWalkin ? "Walk-in Transactions" : "Print Request";

  const content = (
    <div className={isWalkin ? "max-w-4xl mx-auto space-y-8" : "max-w-4xl mx-auto space-y-2 sm:space-y-3"}>
      {!isWalkin && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D73EC]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}
      {/* First confirmed-unclaimed order warning (preview only) */}
      {!isWalkin && <UnclaimedOrderWarning customerKey={user?.email} />}
      {!isWalkin && isResumed && submittedOrderId && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3 min-w-0">
            <Clock className="w-5 h-5 text-[#2F6FD6] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">
                Resuming your print request
              </p>
              <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5">
                You left this request at Payment Verification before submitting your reference. Your order has not been finalized yet — continue where you left off.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/customer/payment/${submittedOrderId}`, {
                state: { paymentMethod, showSuccessAfter: true },
              })
            }
            className="shrink-0 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white transition-all text-sm h-10 sm:h-11"
          >
            Go to Payment Verification
          </Button>
        </div>
      )}
      {/* Step Indicator */}
      <Card className={isWalkin ? "p-6 bg-white shadow-sm" : "p-4 sm:p-6 bg-white shadow-sm"}>
        <div className={isWalkin ? "flex items-center justify-between" : "flex items-center justify-center w-full"}>
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className={isWalkin ? "flex flex-col items-center" : "flex flex-1 flex-col items-center justify-center min-w-0"}>
                <div
                  className={
                    isWalkin
                      ? `w-12 h-12 rounded-full flex items-center justify-center ${
                          currentStep >= step.number
                            ? "bg-[#2F6FD6] text-white"
                            : "bg-gray-200 text-gray-500"
                        }`
                      : `w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-colors duration-200 ${
                          currentStep >= step.number
                            ? "bg-[#2F6FD6] text-white shadow-sm"
                            : "bg-gray-200 text-gray-500"
                        }`
                  }
                >
                  <step.icon className={isWalkin ? "w-6 h-6" : "w-5 h-5 sm:w-6 sm:h-6"} />
                </div>
                <p
                  className={
                    isWalkin
                      ? `mt-2 text-sm font-medium ${
                          currentStep >= step.number ? "text-gray-900" : "text-gray-500"
                        }`
                      : `mt-2 text-[10px] font-medium leading-tight text-center sm:text-sm ${
                          currentStep >= step.number
                            ? "text-gray-900"
                            : "text-gray-500"
                        }`
                  }
                >
                  {isWalkin ? (
                    step.title
                  ) : (
                    <>
                      <span className="sm:hidden">{step.title.split(" ")[0]}</span>
                      <span className="hidden sm:inline">{step.title}</span>
                    </>
                  )}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={isWalkin ? "flex-1 h-1 mx-4" : "flex-shrink-0 px-1 sm:px-3"}>
                  <div
                    className={
                      isWalkin
                        ? `h-1 ${currentStep > step.number ? "bg-[#2F6FD6]" : "bg-gray-200"}`
                        : `h-1 w-5 sm:w-12 rounded-full ${
                            currentStep > step.number
                              ? "bg-[#2F6FD6]"
                              : "bg-gray-200"
                          }`
                    }
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <Card className="p-4 sm:p-8 bg-white shadow-sm">
        {/* STEP 1 */}
        {currentStep === 1 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isWalkin
                ? "Step 1: Customer Information & Upload Files"
                : "Step 1: Upload Documents"}
            </h2>

            {isWalkin && (
              <>
                {/* Customer Type Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Customer Type</Label>
                  <ZoomSafeDropdown
                    value={customerType}
                    onChange={(v) => setCustomerType(v as "printing" | "photocopy")}
                    triggerClassName="h-10"
                    placeholder="Select customer type"
                    options={[
                      { value: "printing", label: "Walk-in Printing" },
                      { value: "photocopy", label: "Photocopy" },
                    ]}
                  />
                  <p className="text-xs text-slate-500">
                    Choose "Walk-in Printing" for print jobs and "Photocopy" for photocopies. This is recorded so the transaction history stays accurate.
                  </p>
                </div>
              </>
            )}

            {isPhotocopy ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">
                    Photocopy transactions don't need an uploaded file. Set the paper size, number of copies, and color mode below — the price is entered manually on the next step.
                  </p>
                </div>

                <div className="space-y-4 @min-[640px]:grid @min-[640px]:grid-cols-2 @min-[640px]:gap-4 @min-[640px]:space-y-0">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Paper Size</Label>
                  <ZoomSafeDropdown
                    value={photocopyPaperSize}
                    onChange={setPhotocopyPaperSize}
                    placeholder="Select paper size"
                    options={
                      availablePaperSizes.length > 0
                        ? availablePaperSizes.map((size) => ({
                            value: size.name,
                            label: size.displayName + (size.inStock ? "" : " (Out of Stock)"),
                            disabled: !size.inStock,
                          }))
                        : [{ value: "", label: "No paper stock available", disabled: true }]
                    }
                    triggerClassName="h-10"
                  />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Number of Copies</Label>
                    <NumberStepper
                      min={1}
                      max={999}
                      value={photocopyCopies}
                      onCommit={(n) => setPhotocopyCopies(n)}
                    />
                  </div>
                </div>

<div className="space-y-2">
                  <Label className="text-sm font-medium">Color Mode</Label>
                  <ZoomSafeDropdown
                    value={photocopyColorMode}
                    onChange={(v) => setPhotocopyColorMode(v as "bw" | "colored")}
                    placeholder="Select color mode"
                    options={[
                      { value: "bw", label: "Black & White" },
                      { value: "colored", label: "Colored" },
                    ]}
                    triggerClassName="h-10"
                  />
                </div>

                <p className="text-xs text-slate-500">
                  Paper used ({photocopyCopies} {photocopyCopies === 1 ? "sheet" : "sheets"} of {photocopyPaperLabel(photocopyPaperSize)}) is tracked against inventory automatically.
                </p>
              </div>
            ) : (
              <>
            {fileError && (
              <div className="p-4 bg-white border-2 border-blue-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    {fileError}
                  </p>
                </div>
                <button
                  onClick={() => setFileError("")}
                  className="text-red-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-3">
                {files.map((fileData, index) => (
                  <div
                    key={fileData.id}
                    className="p-4 rounded-lg border-2 bg-white border-gray-300"
                  >
                    <div className="flex items-start gap-3">
                      <FileCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {index + 1}. {fileData.fileName}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {fileData.pageCount}{" "}
                              {fileData.pageCount === 1 ? "page" : "pages"}{" "}
                              detected
                            </p>
                            {analyzingFileId === fileData.id && (
                              <div className="mt-2 flex items-center gap-2">
                                <Spinner size="xs" className="text-blue-700" />
                                <p className="text-sm text-blue-700 font-medium">
                                  Analyzing document...
                                </p>
                              </div>
                            )}
                            {fileData.colorAnalysis && analyzingFileId !== fileData.id && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs text-blue-700 font-medium">
                                  ✓ Analysis complete
                                  {fileData.colorAnalysis.estimated && (
                                    <span className="ml-1 text-[10px] font-normal text-gray-400">
                                      (estimated)
                                    </span>
                                  )}
                                </p>
                                {fileData.colorAnalysis.colorPages.length > 0 ? (
                                  <p className="text-xs text-gray-600">
                                    Color detected on{" "}
                                    {fileData.colorAnalysis.colorPages.length}{" "}
                                    page
                                    {fileData.colorAnalysis.colorPages.length !== 1 ? "s" : ""}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-600">
                                    No color detected (Black &amp; White)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileData.id)}
                            className="text-red-400 hover:bg-red-500 hover:text-white border-2 border-red-200 hover:border-red-500 transition-all"
                            disabled={analyzingFileId === fileData.id}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center hover:border-[#2F6FD6] transition-colors">
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-700 mb-2 font-medium">
                {files.length === 0
                  ? isWalkin
                    ? "Upload Document"
                    : "Upload Your First Document"
                  : "Add More Files"}
              </p>
              <p className="text-sm text-gray-500 mb-2">
                Supported formats: {SUPPORTED_FORMATS_LABEL}
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 max-w-lg mx-auto">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700 text-left">
                    <strong>Preferred Format: PDF</strong>
                    <br />
                    Docufy will not take responsibility for
                    any formatting errors or issues with Word
                    (.docx), Excel (.xlsx), or other
                    non-PDF files.
                  </p>
                </div>
              </div>

              <label className="inline-block cursor-pointer">
                <span className="px-6 py-3 bg-white text-[#2F6FD6] rounded-lg border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md font-medium inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {files.length === 0 ? "Choose File" : "Add More Files"}
                </span>
                <Input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept={FILE_UPLOAD_ACCEPT}
                  className="hidden"
                  disabled={isProcessingFile}
                  multiple
                />
              </label>

              {isProcessingFile && (
                <p className="text-sm text-gray-600 mt-4">Processing file...</p>
              )}
            </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {currentStep === 2 && !isPhotocopy && (
          <div className="space-y-5 sm:space-y-6">
            {/* Step title */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2F6FD6]">
                Step 2 of 4
              </p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Choose Print Options
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Set the printing details for each file.
              </p>
            </div>

            {files.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Please upload at least one file in Step 1 to
                  configure print options.
                </p>
              </div>
            ) : (
              (() => {
                const activeIndex = Math.min(step2FileIndex, files.length - 1);
                const hasMultiple = files.length > 1;
                return (
                  <>
                    {/* File navigation — dropdown to pick which uploaded file to configure */}
                    {hasMultiple && (
                      <div className="w-full sm:max-w-md">
                        <Label className="mb-1.5 block text-sm font-medium">
                          Editing file
                        </Label>
                        <ZoomSafeDropdown
                          value={String(activeIndex)}
                          onChange={(value) =>
                            setStep2FileIndex(
                              Math.min(files.length - 1, Math.max(0, Number(value))),
                            )
                          }
                          triggerClassName="h-10"
                          placeholder="Select a file"
                          options={files.map((f, i) => ({
                            value: String(i),
                            label: `File ${i + 1}: ${f.fileName}`,
                          }))}
                        />
                      </div>
                    )}

                    {files.map((fileData, index) => {
                      const isActive = index === activeIndex;
                      return (
                        <div
                          key={fileData.id}
                          className={`${isActive ? "block" : "hidden"} space-y-5 sm:space-y-6`}
                          aria-hidden={!isActive}
                        >
                          {/* File information */}
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F2F7FF]">
                              <FileText className="h-5 w-5 text-[#2F6FD6]" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {fileData.fileName}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {fileData.pageCount} pages detected
                              </p>
                            </div>
                          </div>

                          {/* Document Analysis (opens window) */}
                          {fileData.colorAnalysis && (
                            <button
                              type="button"
                              onClick={() => {
                                setAnalysisFileId(fileData.id);
                                setAnalysisShowAll(false);
                              }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                            >
                              <AlertCircle className="h-4 w-4 shrink-0 text-[#2F6FD6]" />
                              Document Analysis
                            </button>
                          )}

                          {/* Print Type selection */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">Print Type</h3>
                            <p className="mb-3 mt-0.5 text-xs text-gray-500">
                              Pick what type of printing this file needs. Print settings unlock
                              once a type is selected.
                            </p>
                            <div className="grid grid-cols-2 gap-2 @min-[720px]:grid-cols-4 @min-[720px]:gap-3">
                              {(["document", "vellum", "sticker", "photo"] as const).map((pt) => {
                                const selected = fileData.printType === pt;
                                const label =
                                  pt === "document"
                                    ? "Plain Paper"
                                    : pt === "vellum"
                                      ? "Vellum"
                                      : pt === "sticker"
                                        ? "Sticker"
                                        : "Photo Paper";
                                return (
                                  <button
                                    type="button"
                                    key={pt}
                                    onClick={() =>
                                      updateFileOption(
                                        fileData.id,
                                        "printType",
                                        selected ? "" : pt,
                                      )
                                    }
                                    aria-pressed={selected}
                                    className={`relative flex items-center justify-center rounded-xl border p-3 transition-all duration-150 active:scale-[0.98] ${
                                      selected
                                        ? "border-[#2F6FD6] bg-[#F2F7FF]"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                                  >
                                    {selected && (
                                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#2F6FD6]">
                                        <Check className="h-3 w-3 text-white" />
                                      </span>
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        selected ? "text-[#2F6FD6]" : "text-gray-900"
                                      }`}
                                    >
                                      {label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                  {fileData.printType ? (
                    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:space-y-6 sm:p-5">
                      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                        <Settings className="h-4 w-4 text-[#2F6FD6]" />
                        <h3 className="text-sm font-semibold text-gray-900">Print Settings</h3>
                      </div>
                      {fileData.printType === "photo" ? (
                        <div className="space-y-4">
                          {!hasPhotoPaperStock && (
                            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                              No photo paper in stock
                            </span>
                          )}
                          <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3 sm:gap-4 items-start">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Photo Size</Label>
                          <ZoomSafeDropdown
                            value={fileData.photoSize}
                            onChange={(value) => {
                              updateFileOption(fileData.id, "photoSize", value);
                              const item = pricingStore.getMatrix().photo[value as PhotoSizeKey];
                              const minQty = item ? Math.max(1, item.minQty) : 1;
                              if (fileData.photoQty < minQty) {
                                updateFileOption(fileData.id, "photoQty", minQty);
                              }
                            }}
                            placeholder="Select photo size"
                            options={(["2R", "3R", "4R", "5R", "6R", "A4photo"] as PhotoSizeKey[]).map((s) => ({
                              value: s,
                              label: PHOTO_SIZE_LABELS[s],
                            }))}
                            triggerClassName="h-10"
                          />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Quantity</Label>
                              {(() => {
                                const item = pricingStore.getMatrix().photo[fileData.photoSize];
                                const minQty = item ? Math.max(1, item.minQty) : 1;
                                return (
                                  <>
                                    <NumberStepper
                                      min={minQty}
                                      value={fileData.photoQty}
                                      onCommit={(n) => updateFileOption(fileData.id, "photoQty", n)}
                                    />
                                    <p className="text-xs text-gray-500">
                                      {minQty > 0 ? `Minimum order: ${minQty} ${minQty === 1 ? "pc" : "pcs"}. ` : ""}Price: {formatPrice(item?.price || 0)} each.
                                    </p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="pt-3 mt-3 border-t border-gray-300">
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                              <span className="text-sm font-medium text-gray-700">
                                Subtotal for this file:
                              </span>
                              <span className="shrink-0 whitespace-nowrap text-lg font-semibold text-[#2F6FD6]">
                                {formatCurrency(calculateFileTotal(fileData))}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-4 @min-[640px]:grid @min-[640px]:grid-cols-2 @min-[640px]:gap-4 @min-[640px]:space-y-0 @min-[960px]:grid-cols-3">
                            <div className="flex items-center justify-between gap-3 @min-[640px]:block @min-[640px]:space-y-2">
                              <Label className="text-sm font-medium shrink-0">Paper Size</Label>
                              <div className="w-[55%] shrink-0 @min-[640px]:w-full">
<ZoomSafeDropdown
                            value={fileData.paperSize}
                            onChange={(value) => updateFileOption(fileData.id, "paperSize", value)}
                            placeholder="Select paper size"
                            options={
                              availablePaperSizes.length > 0
                                ? availablePaperSizes.map((size) => ({
                                    value: size.name,
                                    label: size.displayName + (size.inStock ? "" : " (Out of Stock)"),
                                    disabled: !size.inStock,
                                  }))
                                : [{ value: "", label: "No paper stock available", disabled: true }]
                            }
                            triggerClassName="h-10"
                          />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 @min-[640px]:block @min-[640px]:space-y-2">
                              <Label className="text-sm font-medium shrink-0">Number of Copies</Label>
                              <div className="w-[55%] shrink-0 @min-[640px]:w-full">
                                <NumberStepper
                                  min={1}
                                  value={fileData.copies}
                                  onCommit={(n) => updateFileOption(fileData.id, "copies", n)}
                                />
                              </div>
                            </div>
                            <div className="@min-[640px]:col-span-2 @min-[960px]:col-span-1">
                              <div className="flex items-center justify-between gap-3 @min-[640px]:block @min-[640px]:space-y-2">
                                <Label className="text-sm font-medium shrink-0">Page Range</Label>
                                <div className="w-[55%] shrink-0 @min-[640px]:w-full">
                                  <ZoomSafeDropdown
                                    value={fileData.pageRange}
                                    onChange={(value) =>
                                      updateFileOption(fileData.id, "pageRange", value)
                                    }
                                    placeholder="All Pages"
                                    triggerClassName="h-10"
                                    options={[
                                      { value: "all", label: "All Pages" },
                                      { value: "odd", label: "Odd Pages Only" },
                                      { value: "even", label: "Even Pages Only" },
                                      { value: "specific", label: "Specific Pages" },
                                    ]}
                                  />
                                </div>
                              </div>
                              {fileData.pageRange === "specific" && (
                                <Input
                                  placeholder="e.g., 1-5, 8, 11-13"
                                  value={fileData.specificPages}
                                  onChange={(e) =>
                                    updateFileOption(fileData.id, "specificPages", e.target.value)
                                  }
                                  className="h-10 mt-2 sm:mt-2"
                                />
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Color Mode</Label>
                            <ZoomSafeDropdown
                              value={fileData.colorMode}
                              onChange={(value) =>
                                updateFileOption(fileData.id, "colorMode", value)
                              }
                              triggerClassName="h-10"
                              placeholder={COLOR_MODE_LABELS[fileData.colorMode] || "Select color mode"}
                              options={COLOR_MODE_OPTIONS.map((option) => ({
                                value: option.value,
                                label: option.label,
                              }))}
                            />
                            {hasPaperStock && (
                              <>
                                <p className="text-xs text-gray-500">
                                  {fileData.colorMode === "bw"
                                    ? `${formatPrice(matrixRatesFor(fileData).bw)} per page — all pages printed in grayscale`
                                    : "The document analyzer prices each page by its detected color percentage."}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBreakdownFileId(fileData.id);
                                    setShowColorPricing(true);
                                  }}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                                >
                                  <Info className="h-4 w-4 shrink-0 text-[#2F6FD6]" />
                                  See Pricing Breakdown
                                </button>
                              </>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                              <Label className="text-sm font-medium">Additional Notes (Optional)</Label>
                              <span className="text-xs text-gray-500">
                                {fileData.notes.length}/100
                              </span>
                            </div>
                            <Textarea
                              value={fileData.notes}
                              onChange={(e) =>
                                updateFileOption(fileData.id, "notes", e.target.value)
                              }
                              placeholder="Add any special instructions for this specific file..."
                              rows={3}
                              className="text-sm"
                              maxLength={100}
                            />
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Quick templates:</p>
                              <ZoomSafeActionDropdown
                                onSelect={(template) => {
                                  const currentNotes = fileData.notes;
                                  const newNotes = currentNotes
                                    ? `${currentNotes}\n${template}`
                                    : template;
                                  updateFileOption(fileData.id, "notes", newNotes.slice(0, 100));
                                }}
                                triggerClassName="sm:hidden"
                                className="sm:hidden"
                                placeholder="Choose a template"
                                options={noteTemplates.map((template) => ({
                                  value: template,
                                  label: template,
                                }))}
                              />
                              <div className="hidden sm:flex flex-wrap gap-2">
                                {noteTemplates.map((template) => (
                                  <button
                                    key={template}
                                    type="button"
                                    onClick={() => {
                                      const currentNotes = fileData.notes;
                                      const newNotes = currentNotes
                                        ? `${currentNotes}\n${template}`
                                        : template;
                                      updateFileOption(fileData.id, "notes", newNotes.slice(0, 100));
                                    }}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors"
                                  >
                                    + {template}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {hasPaperStock && (
                            <div className="pt-3 mt-3 border-t border-gray-300">
                              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                <span className="text-sm font-medium text-gray-700">Subtotal for this file:</span>
                                <span className="shrink-0 whitespace-nowrap text-lg font-semibold text-[#2F6FD6]">
                                  {formatCurrency(calculateFileTotal(fileData))}
                                </span>
                              </div>
                            </div>
                          )}

                          {files.length > 1 && (
                            <div className="pt-3 mt-3 border-t border-gray-200">
                              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentSettings = {
                                      printType: fileData.printType,
                                      paperSize: fileData.paperSize,
                                      orientation: fileData.orientation,
                                      copies: fileData.copies,
                                      twoSided: fileData.twoSided,
                                      pagesPerSheet: fileData.pagesPerSheet,
                                      colorMode: fileData.colorMode,
                                      pageRange: fileData.pageRange,
                                      specificPages: fileData.specificPages,
                                      margins: fileData.margins,
                                      scale: fileData.scale,
                                      customScale: fileData.customScale,
                                    };
                                    setFiles(files.map((f) => {
                                      if (f.id === fileData.id) return f;
                                      return { ...f, ...currentSettings };
                                    }));
                                    toast.success("Print settings applied to all files");
                                  }}
                                  className="w-full border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white font-medium sm:flex-1"
                                >
                                  <Settings className="w-4 h-4 mr-2" />
                                  Apply Settings to All Files
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                      <Settings className="mx-auto mb-2 h-5 w-5 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700">Print Settings</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Select a print type first to customize options.
                      </p>
                    </div>
                  )}
                  </div>
                  );
                })}
                </>
              );
            })())}
          </div>
        )}

        {/* STEP 3 */}
        {currentStep === 3 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-[#2F6FD6]" />
              Step 3: Add-ons (Optional)
            </h2>

            <div className="p-4 bg-white border-2 border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Need additional supplies?
              </p>
            </div>

            {availableAddons.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-gray-500" />
                <p className="text-sm font-medium text-gray-700">
                  No add-ons are currently available.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  You can continue without adding extras to your order.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 @min-[700px]:grid-cols-2 gap-4">
                {availableAddons.map((addon) => {
                  const quantity = selectedAddons[addon.id] || 0;
                  return (
                    <Card key={addon.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 mb-3">
                        <div className="min-w-[10rem] flex-1">
                          <h3 className="font-semibold text-gray-900">{addon.name}</h3>
                          <p className="text-xs text-gray-600 mt-1">{addon.description}</p>
                          <p className="text-sm font-bold text-[#2F6FD6] mt-2">
                            ₱{addon.price} / {addon.unit}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                          {addon.category}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]: Math.max(0, (prev[addon.id] || 0) - 1),
                            }));
                          }}
                          disabled={quantity === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>

                        <Input
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]: Math.max(0, value),
                            }));
                          }}
                          className="w-20 shrink-0 text-center text-lg font-bold"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]: (prev[addon.id] || 0) + 1,
                            }));
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>

                        {quantity > 0 && (
<span className="ml-auto shrink-0 whitespace-nowrap text-sm font-semibold text-blue-600">
    ₱{Math.round(addon.price * quantity)}
  </span>
)}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

            {Object.keys(selectedAddons).some((key) => selectedAddons[key] > 0) && (
              <Card className="p-4 bg-white border-2 border-blue-200 border-2 border-blue-300">
                <h3 className="font-bold text-gray-900 mb-3">Selected Add-ons</h3>
                <div className="space-y-2">
                  {Object.entries(selectedAddons)
                    .filter(([_, qty]) => qty > 0)
                    .map(([addonId, qty]) => {
                      const addon = availableAddons.find((a) => a.id === addonId);
                      if (!addon) return null;
                      return (
                        <div key={addonId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                          <span className="text-gray-700">
                            {addon.name} × {qty}
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900">
                            ₱{Math.round(addon.price * qty)}
                          </span>
                        </div>
                      );
                    })}
                  <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-bold">
                    <span>Add-ons Total:</span>
                    <span className="text-blue-700">
                      {formatCurrency(
                        Object.entries(selectedAddons).reduce(
                          (sum, [addonId, qty]) => {
                            const addon = availableAddons.find((a) => a.id === addonId);
                            return sum + (addon ? addon.price * qty : 0);
                          },
                          0,
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* STEP 4 */}
        {(currentStep === 4 || (isPhotocopy && currentStep === 2)) && (
          isWalkin ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {isPhotocopy ? "Step 2: Review & Complete Transaction" : "Step 4: Review & Complete Transaction"}
              </h2>

              <Card className="p-5 bg-blue-50">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Customer Information
                </h3>
                <div className="text-sm text-gray-700">
                  <p>
                    <strong>Type:</strong>{" "}
                    {WALKIN_CUSTOMER_TYPE_LABELS[customerType]}
                  </p>
                </div>
              </Card>

              {isPhotocopy ? (
                <>
                  <Card className="p-5 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Photocopy Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Paper Size</p>
                        <p className="font-medium text-gray-900">
                          {photocopyPaperLabel(photocopyPaperSize)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Copies</p>
                        <p className="font-medium text-gray-900">{photocopyCopies}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Color Mode</p>
                        <p className="font-medium text-gray-900">
                          {photocopyColorMode === "bw" ? "Black & White" : "Colored"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Paper Usage</p>
                        <p className="font-medium text-gray-900">
                          {photocopyCopies} {photocopyCopies === 1 ? "sheet" : "sheets"}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5 bg-white border-2 border-blue-200">
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-[#2F6FD6]" />
                      Manual Price (Staff-Entered)
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Enter the price computed by the staff/technician for this photocopy in whole pesos (₱1 minimum). This overrides automatic pricing so the sale is recorded accurately. Leave blank and it defaults to ₱1.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-900">₱</span>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        placeholder="1"
                        value={photocopyManualPrice}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setPhotocopyManualPrice("");
                            return;
                          }
                          const n = parseInt(raw, 10);
                          if (isNaN(n)) return;
                          setPhotocopyManualPrice(String(n < 1 ? 1 : n));
                        }}
                        onBlur={() => {
                          if (photocopyManualPrice.trim() === "") setPhotocopyManualPrice("1");
                        }}
                        className="h-11 text-base font-semibold"
                      />
                    </div>
                  </Card>

                  <div className="p-6 bg-[#2F6FD6] text-white rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="text-lg">Total to Collect</p>
                      <p className="text-3xl font-semibold shrink-0 whitespace-nowrap">{formatCurrency(photocopyPrice)}</p>
                    </div>
                    {photocopyManualPrice.trim() === "" && (
                      <p className="text-xs text-white/80 mt-2">
                        Blank price will be recorded as ₱1.00.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
              {files.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    Print Jobs ({files.length} file{files.length !== 1 ? "s" : ""})
                  </h3>
                  {files.map((fileData, index) => (
                    <Card key={fileData.id} className="p-5 bg-gray-50">
                      <div className="font-semibold text-gray-900 mb-1 pb-2 border-b border-gray-300 truncate">
                        File {index + 1}: {fileData.fileName}
                      </div>
                      <p className="text-xs font-medium text-[#2F6FD6] mb-3">
                        Print Type:{" "}
                        {fileData.printType === "photo"
                          ? "Photo Paper"
                          : fileData.printType === "vellum"
                            ? "Vellum"
                            : fileData.printType === "sticker"
                              ? "Sticker"
                              : "Plain Paper"}
                      </p>
                      {fileData.printType === "photo" ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Photo Size</p>
                            <p className="font-medium text-gray-900">
                              {PHOTO_SIZE_LABELS[fileData.photoSize]}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Quantity</p>
                            <p className="font-medium text-gray-900">{fileData.photoQty} pcs</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Price each</p>
                            <p className="font-medium text-gray-900">
                              {formatPrice(pricingStore.getMatrix().photo[fileData.photoSize]?.price ?? 0)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Pages</p>
                            <p className="font-medium text-gray-900">{fileData.pageCount} pages</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Copies</p>
                            <p className="font-medium text-gray-900">{fileData.copies}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Paper Size</p>
                            <p className="font-medium text-gray-900 capitalize">{fileData.paperSize}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Color Mode</p>
                            <p className="font-medium text-gray-900">
                              {fileData.colorMode === "bw"
                                ? "Black & White"
                                : COLOR_MODE_LABELS[fileData.colorMode] || "Colored"}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                        <span className="shrink-0 whitespace-nowrap font-semibold text-[#2F6FD6]">
                          {formatCurrency(calculateFileTotal(fileData))}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {Object.keys(selectedAddons).some((key) => selectedAddons[key] > 0) && (
                <Card className="p-5 bg-white border-2 border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Add-ons</h3>
                  <div className="space-y-2">
                    {Object.entries(selectedAddons)
                      .filter(([_, qty]) => qty > 0)
                      .map(([addonId, qty]) => {
                        const addon = availableAddons.find((a) => a.id === addonId);
                        if (!addon) return null;
                        return (
                          <div key={addonId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                            <span className="text-gray-700">
                              {addon.name} × {qty}
                            </span>
                            <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900">
                              ₱{(addon.price * qty).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              )}

              <div className="p-6 bg-[#2F6FD6] text-white rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-lg">Total Amount</p>
                  <p className="text-3xl font-semibold shrink-0 whitespace-nowrap">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>
                </>
              )}

              <div className="p-5 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-blue-900 mb-1 flex items-center gap-2">
                      Walk-in Payment
                    </h4>
                    <p className="text-sm text-blue-800">
                      Payment will be collected immediately upon transaction completion. The order will be processed right away and payment is verified automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Step 4: Order Summary
              </h2>

              <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden sm:border-0 sm:bg-transparent">
                <button
                  type="button"
                  onClick={() => setShowOrderSummary((isOpen) => !isOpen)}
                  aria-expanded={showOrderSummary}
                  className="flex w-full items-center justify-between text-left px-3 py-2.5 sm:hidden"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {showOrderSummary ? "Hide Order Summary" : "See Order Summary"}
                  </span>
                  <ChevronDown className={`h-5 w-5 text-[#2F6FD6] transition-transform duration-300 ${showOrderSummary ? "rotate-180" : ""}`} />
                </button>

                <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out sm:block ${showOrderSummary ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden sm:contents">
                    <div className="px-3 pb-3 sm:p-0">
                      <div className="space-y-4">
                        <div className="text-sm text-gray-600 mb-4">
                          <strong>Total Files:</strong> {files.length}
                        </div>

                {files.map((fileData, index) => (
                  <Card key={fileData.id} className="p-3 sm:p-5 bg-gray-50">
                    <div className="font-semibold text-gray-900 mb-0.5 pb-1 border-b border-gray-300 truncate">
                      File {index + 1}: {fileData.fileName}
                    </div>
                    <p className="text-xs font-medium text-[#2F6FD6] mb-1.5 sm:mb-2">
                      Print Type:{" "}
                      {fileData.printType === "photo"
                        ? "Photo Paper"
                        : fileData.printType === "vellum"
                          ? "Vellum"
                          : fileData.printType === "sticker"
                            ? "Sticker"
                            : "Plain Paper"}
                    </p>
                    {fileData.printType === "photo" ? (
                      <div className="grid grid-cols-1 @min-[560px]:grid-cols-2 gap-2 sm:gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Photo Size</p>
                          <p className="font-medium text-gray-900">
                            {PHOTO_SIZE_LABELS[fileData.photoSize]}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Quantity</p>
                          <p className="font-medium text-gray-900">
                            {fileData.photoQty} pcs
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Price each</p>
                          <p className="font-medium text-gray-900">
                            {formatPrice(pricingStore.getMatrix().photo[fileData.photoSize]?.price ?? 0)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 @min-[560px]:grid-cols-2 gap-2 sm:gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Pages</p>
                          <p className="font-medium text-gray-900">
                            {fileData.pageCount} pages
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Page Range</p>
                          <p className="font-medium text-gray-900">
                            {fileData.pageRange === "all"
                              ? "All Pages"
                              : `Pages: ${fileData.specificPages}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Paper Size</p>
                          <p className="font-medium text-gray-900">
                            {fileData.paperSize === "a4" && "A4"}
                            {fileData.paperSize === "letter" && "Letter"}
                            {fileData.paperSize === "legal" && "Legal"}
                            {fileData.paperSize === "short" && "Short Bond"}
                            {fileData.paperSize === "long" && "Long Bond"}
                            {fileData.paperSize === "folio" && "Folio"}
                            {fileData.paperSize === "a5" && "A5"}
                            {fileData.paperSize === "a3" && "A3"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Copies</p>
                          <p className="font-medium text-gray-900">{fileData.copies}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Color Mode</p>
                          <p className="font-medium text-gray-900">
                            {COLOR_MODE_LABELS[fileData.colorMode] || "Black & White"}
                          </p>
                        </div>
                        {fileData.colorMode !== "bw" && fileData.colorAnalysis && (
                          <div className="col-span-2">
                            <p className="text-gray-600">
                              Color Breakdown
                              {fileData.colorAnalysis.estimated && (
                                <span className="ml-1 text-[10px] text-gray-400">
                                  (estimated)
                                </span>
                              )}
                            </p>
                            <div className="font-medium text-gray-900 text-xs space-y-0.5">
                              {(() => {
                                const buckets: Array<{ label: string; pct: number; count: number }> = [
                                  { label: "25-50%", pct: 50, count: 0 },
                                  { label: "51-75%", pct: 75, count: 0 },
                                  { label: "76-100%", pct: 100, count: 0 },
                                ];
                                fileData.colorAnalysis.colorPages.forEach((p) => {
                                  const pct = fileData.colorAnalysis!.colorPercentages[p] ?? 0;
                                  const bucket =
                                    pct <= 50
                                      ? buckets[0]
                                      : pct <= 75
                                        ? buckets[1]
                                        : buckets[2];
                                  bucket.count += 1;
                                });
                                const bwCount = fileData.colorAnalysis.bwPages.length;
                                return (
                                  <>
                                    {buckets.map((bucket) =>
                                      bucket.count > 0 ? (
                                        <span key={bucket.label} className="block">
                                          {formatPrice(shadeRateFor(fileData, bucket.pct))}/page ×{" "}
                                          {bucket.count} page{bucket.count !== 1 ? "s" : ""} (
                                          {bucket.label} color)
                                        </span>
                                      ) : null,
                                    )}
                                    {bwCount > 0 && (
                                      <span className="block">
                                        {formatPrice(shadeRateFor(fileData, 0))}/page × {bwCount} B&amp;W page
                                        {bwCount !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                        {fileData.notes && (
                          <div className="col-span-2 mt-2">
                            <p className="text-gray-600">Special Instructions</p>
                            <p className="font-medium text-gray-900 text-xs whitespace-pre-wrap bg-white p-2 rounded border border-gray-200 mt-1">
                              {fileData.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-300 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                      <span className="shrink-0 whitespace-nowrap font-semibold text-[#2F6FD6]">
                        {formatCurrency(calculateFileTotal(fileData))}
                      </span>
                    </div>
                  </Card>
                ))}

                {Object.keys(selectedAddons).some((key) => selectedAddons[key] > 0) && (
                  <Card className="p-5 bg-white border-2 border-blue-200 border-2 border-blue-300">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                      Add-ons
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(selectedAddons)
                        .filter(([_, qty]) => qty > 0)
                        .map(([addonId, qty]) => {
                          const addon = availableAddons.find((a) => a.id === addonId);
                          if (!addon) return null;
                          return (
                            <div key={addonId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                              <span className="text-gray-700">
                                {addon.name} × {qty}
                              </span>
                              <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900">
                                ₱{Math.round(addon.price * qty)}
                              </span>
                            </div>
                          );
                        })}
                      <div className="border-t border-blue-200 pt-2 mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 font-bold">
                        <span>Add-ons Subtotal:</span>
                        <span className="shrink-0 whitespace-nowrap text-blue-700">
                          {formatCurrency(
                            Object.entries(selectedAddons).reduce(
                              (sum, [addonId, qty]) => {
                                const addon = availableAddons.find((a) => a.id === addonId);
                                return sum + (addon ? addon.price * qty : 0);
                              },
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden sm:border-0 sm:bg-transparent">
                <button
                  type="button"
                  onClick={() => setShowPaymentOptions((isOpen) => !isOpen)}
                  aria-expanded={showPaymentOptions}
                  className="flex w-full items-center justify-between text-left px-3 py-2.5 sm:hidden"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    Select Payment Method
                  </span>
                  <ChevronDown className={`h-5 w-5 text-[#2F6FD6] transition-transform duration-300 ${showPaymentOptions ? "rotate-180" : ""}`} />
                </button>

                <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out sm:block ${showPaymentOptions ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden sm:contents">
                    <div className="px-3 pb-3 sm:p-0">
                  <h3 className="hidden text-lg font-semibold text-gray-900 sm:mb-6 sm:block">
                    Select Payment Method
                  </h3>
                  <RadioGroup className="mt-3 sm:mt-0" value={paymentMethod} onValueChange={setPaymentMethod}>
                    <div className="grid grid-cols-1 gap-3 @min-[720px]:grid-cols-2 @min-[720px]:gap-4">
                      {onlineMethods.map((method) => {
  return (
    <div
      key={method.id}
      className={`relative overflow-hidden flex items-center space-x-3 p-4 border-2 rounded-lg transition-all ${
        paymentMethod === method.name
          ? "border-[#2F6FD6] bg-white cursor-pointer active:scale-[0.98]"
          : "border-gray-200 hover:border-gray-300 cursor-pointer active:scale-[0.98]"
      }`}
      onClick={() => setPaymentMethod(method.name)}
    >
      {paymentMethod === method.name && (
        <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
      )}
      <RadioGroupItem value={method.name} id={`pm-${method.id}`} />
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
          <Smartphone className="w-5 h-5 text-[#2F6FD6]" />
        </div>
        <div className="min-w-[8rem] flex-1">
          <Label htmlFor={`pm-${method.id}`} className="font-semibold cursor-pointer text-gray-900">
            {method.name}
          </Label>
          <p className="text-xs text-gray-500">
            Pay via {method.name} mobile wallet
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            viewMethodQR(method.name);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-[#1D73EC] hover:text-[#10316B] shrink-0"
        >
          <QrCode className="w-3.5 h-3.5" />
          View QR
        </button>
      </div>
    </div>
  );
})}

                      <div
                        className={`relative overflow-hidden flex items-center space-x-3 p-4 border-2 rounded-lg transition-all ${
                          cashDisabled
                            ? "border-dashed border-gray-200 bg-gray-50 cursor-not-allowed opacity-70"
                            : paymentMethod === "cash"
                              ? "border-[#2F6FD6] bg-white cursor-pointer active:scale-[0.98]"
                              : "border-gray-200 hover:border-gray-300 cursor-pointer active:scale-[0.98]"
                        }`}
                        onClick={
                          cashDisabled
                            ? undefined
                            : () => setPaymentMethod("cash")
                        }
                        title={
                          cashDisabled
                            ? `Cash on Pickup is not available for orders ₱${fullPaymentThreshold.toLocaleString()} and above`
                            : undefined
                        }
                      >
                        {paymentMethod === "cash" && (
                          <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
                        )}
                        <RadioGroupItem value="cash" id="cash" disabled={cashDisabled} />
                        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-[#73bbff] rounded-lg flex items-center justify-center shrink-0">
                            <Banknote className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="min-w-[8rem] flex-1">
                            <Label htmlFor="cash" className={`font-semibold cursor-pointer ${cashDisabled ? "text-gray-500" : "text-gray-900"}`}>
                              Cash on Pickup
                            </Label>
                            {cashDisabled ? (
                              <p className="text-xs text-amber-600 font-medium">
                                {`Not available for orders ₱${fullPaymentThreshold.toLocaleString()} and above`}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Pay when you collect your order
                              </p>
                            )}
                          </div>
                          {cashDisabled && (
                            <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </RadioGroup>

                  {!isWalkin &&
                    (() => {
                      // PREVIEW — show the proposed advance-payment restriction
                      // notice only when a session preview restriction exists for
                      // this customer. It does NOT change cashDisabled/enforcement.
                      const restriction = pickupReview.getRestriction(
                        user?.email || "",
                      );
                      if (!restriction.active) return null;
                      return (
                        <div className="mt-4">
                          <PaymentRestrictionNotice
                            preview
                            reason={restriction.reason}
                            duration={undefined}
                          />
                        </div>
                      );
                    })()}

                  {isOnline && (
                    <div className="mt-6">
                      <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <strong>Note:</strong>{" "}
                        {isDownTier ? (
                          <>After placing your order you'll choose how to
                        pay on the Down Payment Method page, then upload
                        your {paymentMethod} payment receipt on Payment
                        Verification.</>
                        ) : (
                          <>You will be
                        redirected to payment verification after
                        placing your order. Please upload your{" "}
                        {paymentMethod} payment receipt there.</>
                        )}
                      </p>
                      {!isGcash && (
                        <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3 mt-2">
                          <strong>Auto-detection:</strong> the{" "}
                          reference number is only auto-detected from
                          the payment screenshot for GCash payments.
                          For {paymentMethod} you will enter it
                          manually.
                        </p>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>

              {!isWalkin && paymentMethod === "cash" && (
                <CashOnPickupAcknowledgement
                  checked={cashAcknowledged}
                  onChange={setCashAcknowledged}
                />
              )}

              {(() => {
                const total = calculateTotal();
                const requirement = paymentRequirementFor(total);
                // Down-payment minimum (₱X of total ₱Y) applies to ALL down-tier
                // orders — cash customers pay at the shop, online customers pick
                // Partial (50%) vs Full on the payment verification page.
                if (requirement === "down") {
                  const downDue = total * 0.5;
                  const cashFlow = paymentMethod === "cash" || paymentMethod === "";
                  return (
                    <div className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-400 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-2">
                            Down Payment Required
                            <span className="text-[10px] sm:text-xs font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                              50% Minimum
                            </span>
                          </h4>
                          <p className="text-sm text-amber-800 leading-relaxed">
                            <span className="sm:hidden">
                              Orders of{" "}
                              <strong>₱{downPaymentThreshold.toFixed(0)} or more</strong> require a{" "}
                              <strong>50% down</strong> of{" "}
                              <strong>{formatCurrency(downDue)}</strong> before printing; the
                              rest on pickup.
                            </span>
                            <span className="hidden sm:inline">
                              Orders totaling{" "}
                              <strong>₱{downPaymentThreshold.toFixed(2)} or more</strong> require at
                              least a <strong>50% down payment</strong> of{" "}
                              <strong>{formatCurrency(downDue)}</strong> before printing begins
                              (remaining <strong>{formatCurrency(total - downDue)}</strong> due on
                              pickup).{" "}
                              {cashFlow ? (
                                <>Pay it at the shop when you collect the order.</>
                              ) : (
                                <>
                                  Choose <strong>Partial (50%)</strong> or{" "}
                                  <strong>Full</strong> payment on the payment
                                  verification page.
                                </>
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              <div className="p-4 sm:p-6 bg-[#2F6FD6] text-white rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-lg">Total Amount</p>
                  <p className="text-3xl font-semibold shrink-0 whitespace-nowrap">
                    {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-2 text-center">
                By placing your order, you agree to our{" "}
                <button
                  type="button"
                  className="underline text-[#1D73EC] hover:text-[#10316B]"
                  onClick={() => {
                    setLegalPolicyTab("terms");
                    setShowLegalPolicy(true);
                  }}
                >
                  Terms &amp; Conditions
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className="underline text-[#1D73EC] hover:text-[#10316B]"
                  onClick={() => {
                    setLegalPolicyTab("privacy");
                    setShowLegalPolicy(true);
                  }}
                >
                  Privacy Policy
                </button>
                .
              </p>
            </div>
          )
        )}

        {/* Upload progress — shown above the action bar while files upload */}
        {isSubmittingOrder && uploadProgress && uploadProgress.percent < 100 && (
          <div className="mt-4 space-y-1.5">
            {/* A bare moving bar doesn't say WHAT is happening; naming the file
                and the counts makes a long upload legible instead of a hang. */}
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-blue-800">
              <span className="truncate">
                Uploading {uploadProgress.fileName}
                {uploadProgress.fileCount > 1
                  ? ` (file ${uploadProgress.fileIndex} of ${uploadProgress.fileCount})`
                  : ""}
              </span>
              <span className="shrink-0 tabular-nums">
                {Math.round(uploadProgress.percent)}%
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
              role="progressbar"
              aria-valuenow={Math.round(uploadProgress.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Uploading ${uploadProgress.fileName}`}
            >
              <div
                className="h-full rounded-full bg-[#2F6FD6] transition-[width] duration-150 ease-linear"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        {isWalkin && (currentStep === 4 || (isPhotocopy && currentStep === 2)) ? (
          <div className="mt-6">
            {shopPaused && (
              <div className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-3">
                Docufy is currently paused — new orders are on hold until the shop reopens.
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 pt-4 border-t border-gray-100 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:justify-between @min-[640px]:gap-4">
              {/* Secondary: Back + Cancel Order */}
              <div className="grid grid-cols-2 gap-2 @min-[640px]:w-auto @min-[640px]:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep > 1) {
                      const prev = isPhotocopy ? 1 : currentStep - 1;
                      setCurrentStep(prev);
                      scrollPageToTop();
                    } else {
                      navigate(dashboardPath);
                    }
                  }}
                  className="w-full py-2.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  className="w-full py-2.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all"
                >
                  Cancel Order
                </button>
              </div>
              {/* Primary: Proceed to In Queue */}
              <button
                type="button"
                onClick={() => setShowProceedConfirm(true)}
                disabled={shopPaused || isSubmittingOrder || (isPhotocopy ? false : files.length === 0)}
                className="w-full py-3 bg-blue-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-[#2557b8] disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98] transition-all @min-[640px]:w-auto @min-[640px]:min-w-[180px] @min-[640px]:px-6"
              >
                {isSubmittingOrder ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadProgress && uploadProgress.percent < 100
                      ? `Uploading… ${uploadProgress.percent}%`
                      : "Placing order…"}
                  </span>
                ) : (
                  "Proceed to In Queue"
                )}
              </button>
            </div>
          </div>
        ) : (
        <div className={isWalkin ? "flex items-center justify-between mt-8 pt-6 border-t" : "sticky bottom-0 -mx-4 mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur @min-[640px]:flex-row @min-[640px]:flex-wrap @min-[640px]:items-center @min-[640px]:justify-between @min-[640px]:gap-4 sm:static sm:mx-0 sm:mt-1 sm:border-t sm:px-0 sm:py-0 sm:pt-6 sm:bg-transparent sm:backdrop-blur-none"}>
          <Button
            variant="outline"
            className={`bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900 ${isWalkin ? "" : "w-full @min-[640px]:w-auto @min-[640px]:min-w-[155px] h-12 @min-[640px]:h-11 px-6 text-base font-medium"}`}
            onClick={() => {
              if (currentStep > 1) {
                const prev = currentStep - 1;
                setCurrentStep(prev);
                scrollPageToTop();
              } else {
                navigate(dashboardPath);
              }
            }}
          >
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {shopPaused && !isWalkin && (
            <div className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:w-auto">
              Docufy is currently paused — new orders are on hold until the shop reopens.
            </div>
          )}

          <div className={`flex flex-col-reverse w-full gap-2 ${isWalkin ? "sm:flex-row sm:gap-3 sm:w-auto" : "@min-[640px]:flex-row @min-[640px]:gap-3 @min-[640px]:w-auto"}`}>
            {currentStep < 4 ? (
              <Button
                className={isWalkin
                  ? "bg-[#2F6FD6] text-white hover:bg-[#2557b8] disabled:bg-gray-400 disabled:cursor-not-allowed"
                  : "w-full @min-[640px]:w-auto @min-[640px]:min-w-[155px] h-12 @min-[640px]:h-11 px-6 text-base font-medium bg-[#2F6FD6] text-white hover:bg-[#2557b8] disabled:bg-gray-400 disabled:cursor-not-allowed"}
                onClick={() => {
                  const nextStep = currentStep + 1;
                  setCurrentStep(nextStep);
                  scrollPageToTop();
                }}
                disabled={
                  (currentStep === 1 && !isPhotocopy && files.length === 0) ||
                  (currentStep === 2 && !isPhotocopy && (files.length === 0 || !files.every((f) => f.printType))) ||
                  (currentStep === 2 && !isPhotocopy && !hasPaperStock && files.some((f) => f.printType !== "photo")) ||
                  (currentStep === 2 && !isPhotocopy && !hasPhotoPaperStock && files.some((f) => f.printType === "photo")) ||
                  (currentStep === 2 && isPhotocopy && !hasPaperStock) ||
                  analyzingFileId !== null
                }
              >
                {currentStep === 2 && !isWalkin
                  ? "Continue"
                  : analyzingFileId
                    ? "Analyzing..."
                    : isPhotocopy
                      ? "Review & Complete"
                      : "Next Step"}
              </Button>
            ) : (
              <>
                {isWalkin && (
                  <Button
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-50"
                    onClick={handleCancelOrder}
                  >
                    Cancel Order
                  </Button>
                )}
                <Button
                  className={isWalkin
                    ? "bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
                    : "w-full @min-[640px]:w-auto @min-[640px]:min-w-[155px] h-12 @min-[640px]:h-11 px-6 text-base font-medium bg-[#2F6FD6] text-white hover:bg-[#2557b8] disabled:bg-gray-400"}
                  onClick={() => {
                    if (isWalkin) {
                      setShowProceedConfirm(true);
                    } else if (isDownTier) {
                      handleSubmit();
                    } else {
                      setShowPlaceOrderConfirm(true);
                    }
                  }}
                  disabled={shopPaused || isSubmittingOrder || (isWalkin ? (isPhotocopy ? false : files.length === 0) : files.length === 0 || !paymentMethod || (paymentMethod === "cash" && !cashAcknowledged))}
                >
                  {isSubmittingOrder ? (
                    uploadProgress && uploadProgress.percent < 100 ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {uploadProgress.fileCount > 1
                          ? `Uploading ${uploadProgress.fileName} (${uploadProgress.fileIndex}/${uploadProgress.fileCount})… ${uploadProgress.percent}%`
                          : `Uploading ${uploadProgress.fileName}… ${uploadProgress.percent}%`}
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Placing order…
                      </>
                    )
                  ) : isWalkin
                    ? "Proceed to In Queue"
                    : isDownTier
                      ? "Proceed to Down Payment Method"
                      : isOnline
                        ? "Go to Payment Verification"
                        : "Place Order"}
                </Button>
              </>
            )}
          </div>
        </div>
        )}
      </Card>
    </div>
  );

  return (
    <Layout menuItems={menuItems} title={title} showBackButton hideMobileBackButton>
      {!isWalkin && shopPaused ? (
        /* New print requests are locked while the shop is paused or on
           scheduled close — only existing orders / the queue continue. */
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border-2 bg-white shadow-sm p-6 sm:p-10 text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                shopStatus.status === "paused"
                  ? "bg-amber-100"
                  : "bg-gray-200"
              }`}
            >
              {shopStatus.status === "paused" ? (
                <WifiOff className="w-8 h-8 text-amber-600" />
              ) : (
                <CalendarClock className="w-8 h-8 text-gray-600" />
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {shopStatus.status === "paused"
                ? "Docufy is currently paused"
                : "Docufy is on scheduled close"}
            </h1>
            <p
              className={`text-sm mt-2 leading-relaxed ${
                shopStatus.status === "paused"
                  ? "text-amber-800"
                  : "text-gray-600"
              }`}
            >
              {shopStatus.status === "paused"
                ? (
                  <>
                    {shopStatus.reason && (
                      <span className="block">Reason: {shopStatus.reason}</span>
                    )}
                    {shopStatus.eta && (
                      <span className="block">
                        Estimated return: around {shopStatus.eta}
                      </span>
                    )}
                    New print requests can't be placed right now. Existing orders
                    are safe and will resume once we reopen.
                  </>
                )
                : "The shop is currently closed (weekend / holiday schedule). New print requests will be accepted again once we reopen."}
            </p>
            <Button
              onClick={() => navigate(dashboardPath)}
              className="mt-6 h-11 px-6 bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      ) : isWalkin ? (
        <StaffTimeInGate>{content}</StaffTimeInGate>
      ) : content}

      {/* Pricing Breakdown Modal */}
      <Dialog open={showColorPricing} onOpenChange={setShowColorPricing}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-5">
            <DialogTitle>Pricing Breakdown</DialogTitle>
            <DialogDescription>
              See how this file is priced by print type and color tier.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 grow overflow-y-auto px-6 pb-6">
          {(() => {
            const bFile = files.find((f) => f.id === breakdownFileId) || null;
            if (!bFile) {
              return (
                <p className="text-sm text-gray-500">
                  Select a print type and configure this file to see its pricing
                  breakdown.
                </p>
              );
            }
            const bCType = bFile.contentType;
            const typeLabel =
              bFile.printType === "photo"
                ? "Photo Paper"
                : bFile.printType === "vellum"
                  ? "Vellum"
                  : bFile.printType === "sticker"
                    ? "Sticker"
                    : "Plain Paper";

            if (bFile.printType === "photo") {
              const size = pricingStore.getMatrix().photo[bFile.photoSize];
              return (
                <>
                  <div className="rounded-lg border border-blue-200 bg-[#F2F7FF] p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-medium text-gray-900">Print type</span>
                      <span className="font-medium text-[#2F6FD6]">Photo Paper</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">Photo size</span>
                      <span className="text-gray-900">
                        {PHOTO_SIZE_LABELS[bFile.photoSize]}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">Quantity</span>
                      <span className="text-gray-900">{bFile.photoQty} pcs</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">Price each</span>
                      <span className="text-gray-900">{formatPrice(size ? size.price : 0)}</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-2 border-t border-blue-200">
                      <span className="font-medium text-gray-900">Subtotal</span>
                      <span className="font-medium text-[#2F6FD6]">
                        {formatCurrency(calculateFileTotal(bFile))}
                      </span>
                    </div>
                  </div>
                </>
              );
            }

            return (
              <>
                <div className="rounded-lg border border-blue-200 bg-[#F2F7FF] p-3 text-sm mb-2">
                  <div className="flex justify-between gap-4">
                    <span className="font-medium text-gray-900">Print type</span>
                    <span className="font-medium text-[#2F6FD6]">{typeLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Paper size</span>
                    <span className="text-gray-900">
                      {bFile.paperSize.charAt(0).toUpperCase() + bFile.paperSize.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Content type</span>
                    <span className="text-gray-900">{CONTENT_TYPE_LABELS[bCType]}</span>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-blue-200 bg-[#F2F7FF] p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>Black and white page</span>
                    <strong>{formatPrice(shadeRateFor(bFile, 0))}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Partially colored page (25-50%)</span>
                    <strong>{formatPrice(shadeRateFor(bFile, 50))}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Colored page (51-75%)</span>
                    <strong>{formatPrice(shadeRateFor(bFile, 75))}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Fully colored page (76-100%)</span>
                    <strong>{formatPrice(shadeRateFor(bFile, 100))}</strong>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  The document analyzer picks the color tier based on the detected color
                  percentage. Paper size, copies, and page range are applied to the final total.
                </p>
              </>
            );
          })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Analysis Modal */}
      <Dialog
        open={analysisFileId !== null}
        onOpenChange={(open) => {
          if (!open) setAnalysisFileId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-5">
            <DialogTitle>Document Analysis</DialogTitle>
            <DialogDescription>
              Page-by-page color breakdown for your uploaded file.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 grow overflow-y-auto px-6 pb-6">
            {(() => {
              const aFile = files.find((f) => f.id === analysisFileId) || null;
              if (!aFile || !aFile.colorAnalysis) {
                return (
                  <p className="text-sm text-gray-500">
                    Color analysis is unavailable for this file.
                  </p>
                );
              }
              const ca = aFile.colorAnalysis;
              return (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="font-semibold text-gray-900">
                    Document Analysis — {aFile.fileName}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {ca.totalPages} page{ca.totalPages !== 1 ? "s" : ""} detected ·{" "}
                    {ca.colorPages.length} color page{ca.colorPages.length !== 1 ? "s" : ""} ·{" "}
                    {ca.bwPages.length} black &amp; white page{ca.bwPages.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-2 space-y-2">
                    {ca.bwPages.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-gray-700">
                          Black and White Pages
                        </p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          Page {ca.bwPages.join(", ")}
                        </p>
                      </div>
                    )}
                    {(() => {
                      const colorPages = ca.colorPages;
                      const hasMore = colorPages.length > 3;
                      const renderRow = (page: number) => (
                        <div
                          key={page}
                          className="flex items-center justify-between gap-4 rounded border border-blue-100 bg-[#F2F7FF] px-2.5 py-1.5"
                        >
                          <span className="text-gray-700">Page {page}</span>
                          <span className="font-medium text-gray-900">
                            {ca.colorPercentages[page] ?? 0}% color
                          </span>
                        </div>
                      );
                      return (
                        <div
                          onClick={() => {
                            if (analysisShowAll) setAnalysisShowAll(false);
                          }}
                          title={analysisShowAll ? "Click to collapse" : undefined}
                          className={`rounded-lg border p-2.5 transition-colors ${
                            analysisShowAll
                              ? "cursor-pointer select-none border-blue-200 bg-blue-50/70"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <p className="text-xs font-semibold text-gray-700">Colored Pages</p>
                          {colorPages.length > 0 ? (
                            hasMore ? (
                              <>
                                {!analysisShowAll && (
                                  <div className="mt-1.5 space-y-1">
                                    {colorPages.slice(0, 3).map(renderRow)}
                                  </div>
                                )}
                                <div
                                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                    analysisShowAll ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                  }`}
                                >
                                  <div className="min-h-0 overflow-hidden">
                                    <div
                                      className="mt-1.5 space-y-1 overflow-y-auto pr-1"
                                      style={{
                                        maxHeight: analysisShowAll ? "9rem" : "0px",
                                      }}
                                    >
                                      {colorPages.map(renderRow)}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  aria-expanded={analysisShowAll}
                                  onClick={() => setAnalysisShowAll(!analysisShowAll)}
                                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FD6] hover:bg-[#F2F7FF]"
                                >
                                  {analysisShowAll
                                    ? "Collapse"
                                    : `Show All (${colorPages.length} pages)`}
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform duration-300 ${
                                      analysisShowAll ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                              </>
                            ) : (
                              <div className="mt-1.5 space-y-1">
                                {colorPages.map(renderRow)}
                              </div>
                            )
                          ) : (
                            <p className="text-xs text-gray-500 mt-1">
                              No color detected on any page.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave print request confirmation (customer only, has uploads, not yet
          submitted) */}
      {!isWalkin && blocker && blocker.state === "blocked" && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open && blocker.state === "blocked") blocker.reset();
          }}
          onConfirm={() => {
            clearPrintDraft();
            blocker.proceed();
          }}
          title="Leave print request?"
          description={`You have ${files.length} file${files.length === 1 ? "" : "s"} uploaded but have not reached payment verification. Leaving now will discard your progress and reset the form.`}
          confirmLabel="Leave & Reset"
          cancelLabel="Keep Editing"
          destructive={false}
        />
      )}

      {/* View Payment QR Code Modal (customer only) */}
      {!isWalkin && (
        <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#10316B]">
                {selectedMethod ? `${selectedMethod.name} QR Code` : "Payment QR Code"}
              </DialogTitle>
              <DialogDescription>
                Scan the QR code to pay, or download it for later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedMethod && onlineMethods.some((m) => m.id === selectedMethod.id) ? (
                <PaymentMethodQRPanel method={selectedMethod} />
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  This payment method is no longer available. Please choose another
                  method.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="w-full sm:w-auto h-10"
                onClick={() => setShowQRModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Customer Success Modal */}
      {!isWalkin && (
        <Dialog
          open={showSuccessModal}
          onOpenChange={(open) => {
            setShowSuccessModal(open);
            // Dismissing the modal (X / escape / outside click) without
            // choosing an action clears the whole request so the same order
            // can never be placed twice.
            if (!open && submittedOrderId) {
              orderSubmittedRef.current = false;
              setSubmittedOrderId("");
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex justify-center mb-4">
                {paymentRequirementFor(calculateTotal()) !== "none" ? (
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                    <CreditCard className="w-10 h-10 text-amber-600" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                )}
              </div>
              <DialogTitle className="text-center text-xl">
                {requiresFullPayment
                  ? "Order Submitted — Full Payment Required"
                  : requiresDownPayment
                    ? "Order Submitted — Down Payment Required"
                    : isLowValueCash
                      ? "Order Submitted — In Queue"
                      : "Order Submitted — Awaiting Payment"}
              </DialogTitle>
              <DialogDescription className="text-center space-y-4 pt-4">
                {(() => {
                  const total = calculateTotal();

                  return requiresFullPayment || requiresDownPayment ? (
                    <>
                      <p className="text-gray-700">
                        Your order has been submitted and placed <strong>awaiting payment verification</strong>. {requiresFullPayment
                          ? "Full payment must be made and verified before printing can begin."
                          : "A down payment must be made and verified before printing can begin."}
                      </p>
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-left space-y-2">
                        <p className="text-sm font-bold text-amber-800">
                          {requiresFullPayment ? "Full Payment Summary" : "Down Payment Summary"}
                        </p>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Order Total</span>
                          <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900">{formatCurrency(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-amber-200 pt-2">
                          <span className="text-amber-800 font-bold">
                            {requiresFullPayment ? "Amount Due (Full Payment)" : "Down Payment (50%)"}
                          </span>
                          <span className="font-bold text-amber-700">{formatCurrency(requiresFullPayment ? total : downPaymentValue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Balance After Payment</span>
                          <span className="font-semibold text-gray-700">{formatCurrency(requiresFullPayment ? 0 : downPaymentValue)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        Pay <strong>{formatCurrency(requiresFullPayment ? total : downPaymentValue)}</strong> via{" "}
                        <strong>{isOnline ? paymentMethod : "Cash at the shop"}</strong>, then inform staff to verify. Your order will be queued for printing once verified.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-700">
                        {isOnline
                          ? "Your print request has been successfully received by our admin/staff team."
                          : isLowValueCash
                            ? <>Your order has been submitted and is already <strong>in the print queue</strong>.</>
                            : <>Your order has been submitted and is <strong>awaiting payment confirmation at the shop</strong>.</>}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isOnline
                          ? "You can track your order status from the My Orders page or proceed to payment verification if required."
                          : isLowValueCash
                            ? <>Pay <strong>{formatCurrency(total)}</strong> in cash at the shop when you pick up this order.</>
                            : <>Please visit the shop and pay <strong>{formatCurrency(total)}</strong> in cash before the payment deadline to confirm this order. The staff will verify your payment and your order will be added to the print queue.</>}
                      </p>
                    </>
                  );
                })()}
                <div className="bg-[#F2F7FF] p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">Order ID</p>
                  <p className="font-mono font-semibold text-[#10316B]">
                    {submittedDisplayId}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSuccessModal(false);
                  if (isDownTier && !isOnline) {
                    navigate(`/customer/payment-method/${submittedOrderId}`, {
                      state: {
                        paymentMethod: "Cash",
                        total: calculateTotal(),
                      },
                    });
                  } else if (isOnline) {
                    navigate(`/customer/payment/${submittedOrderId}`, {
                      state: {
                        paymentMethod,
                        total: calculateTotal(),
                      },
                    });
                  } else {
                    navigate(`/customer/track/${submittedOrderId}`);
                  }
                }}
                className="flex-1"
              >
                {isDownTier && !isOnline
                  ? "Proceed to Down Payment Method"
                  : isOnline
                    ? "Proceed to Payment"
                    : "Track Order"}
              </Button>
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate("/customer/dashboard");
                }}
                className="flex-1 bg-white text-[#1D73EC] border-2 border-blue-200 hover:bg-[#1D73EC] hover:text-white"
              >
                Go to Dashboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Place Order / Go to Payment Verification Confirmation (customer only) */}
      {!isWalkin && showPlaceOrderConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowPlaceOrderConfirm}
          onConfirm={() => { handleSubmit(); setShowPlaceOrderConfirm(false); }}
          title={
            isOnline
              ? "Go to Payment Verification?"
              : "Place this order?"
          }
          description={(() => {
            const total = calculateTotal();
            const paymentNote =
              requiresFullPayment
                ? ` Full payment of ${formatCurrency(total)} is required before printing (no 50% option).`
                : requiresDownPayment
                  ? ` A 50% down payment of ${formatCurrency(total * 0.5)} is required before printing.`
                  : isOnline
                    ? ` Full payment of ${formatCurrency(total)} is required before printing.`
                    : ` You selected Cash on Pickup — you must pay ${formatCurrency(total)} in cash at the shop before your order can be printed.`;

            return isOnline
                ? `Your print request for ${files.length} file(s), ${files.reduce((s, f) => s + f.pageCount * f.copies, 0)} pages, total ${formatCurrency(total)} via ${paymentMethod}. Continuing will take you to payment verification, where you will upload your ${paymentMethod} payment receipt and submit your reference number.${paymentNote} Your order is NOT placed in the system until you submit your reference.`
                : `Submit your print request for ${files.length} file(s), ${files.reduce((s, f) => s + f.pageCount * f.copies, 0)} pages, total ${formatCurrency(total)} via ${paymentMethod === "" ? "your selected method" : paymentMethod}.${paymentNote} This will create your order, reserve paper stock, and notify staff. Review your details before confirming.`;
          })()}
          confirmLabel={
            isOnline
              ? "Go to Payment Verification"
              : "Place Order"
          }
          cancelLabel="Go Back"
          destructive={false}
          loading={isSubmittingOrder}
        />
      )}

      {!isWalkin && (
        <LegalPolicyDialog
          open={showLegalPolicy}
          onOpenChange={setShowLegalPolicy}
          initialTab={legalPolicyTab}
        />
      )}

      {/* Non-PDF upload — preferred-format reminder */}
      <Dialog open={showNonPdfDialog} onOpenChange={setShowNonPdfDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <FileText className="h-5 w-5 text-amber-600" />
              Preferred Format: PDF
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              You selected{" "}
              <span className="font-semibold text-gray-800">
                {pendingUpload?.map((f) => f.name).join(", ")}
              </span>
              . Docufy recommends uploading <strong>PDF</strong> files for the
              most accurate print output. DOC, DOCX, Excel, and image files are
              also supported, but Docufy is not responsible for any formatting
              errors or layout issues that may occur when printing these
              non-PDF formats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-300 text-gray-600"
              onClick={() => {
                setShowNonPdfDialog(false);
                setPendingUpload(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-primary-action
              onClick={() => {
                const filesToProcess = pendingUpload ?? [];
                setShowNonPdfDialog(false);
                setPendingUpload(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                void processUploadedFiles(filesToProcess);
              }}
              className="bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
            >
              Continue with Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog (walk-in only) */}
      {isWalkin && (
        <Dialog open={showCancelConfirmDialog} onOpenChange={setShowCancelConfirmDialog}>
          <DialogContent className="sm:max-w-md border-t-4 border-t-red-500">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-50 ring-1 ring-red-200 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <DialogTitle className="text-xl text-red-700">
                  Cancel Walk-in Transaction
                </DialogTitle>
              </div>
              <DialogDescription className="text-base">
                Are you sure you want to cancel this walk-in transaction? All entered information will be lost.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-2">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> This action cannot be undone. Customer details, uploaded files, and all settings will be cleared.
              </p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirmDialog(false)}
                className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
              >
                Keep Editing
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancelOrder}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, Cancel Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Proceed to In Queue Confirmation (walk-in only) */}
      {isWalkin && showProceedConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowProceedConfirm}
          onConfirm={() => { handleProceedToQueue(); setShowProceedConfirm(false); }}
          title="Place Walk-in Order?"
          description={isPhotocopy
            ? `This will create a walk-in photocopy order (${photocopyCopies} ${photocopyCopies === 1 ? "copy" : "copies"}, ${photocopyPaperLabel(photocopyPaperSize)}, ${photocopyColorMode === "bw" ? "Black & White" : "Colored"}), with a staff-entered price of ${formatCurrency(photocopyPrice)}, and send it to the print queue immediately.`
            : `This will create a walk-in order (${WALKIN_CUSTOMER_TYPE_LABELS[customerType]}) for your ${files.length} file(s), add any selected add-ons, total ${formatCurrency(calculateTotal())}, and send it to the print queue immediately.`}
          confirmLabel="Proceed to In Queue"
          cancelLabel="Go Back"
          destructive={false}
          loading={isSubmittingOrder}
        />
      )}
    </Layout>
  );
}
