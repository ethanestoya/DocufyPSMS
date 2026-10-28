import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Kanban,
  LayoutDashboard,
  ShoppingCart,
  User,
  Search,
  Clock,
  Check,
  CheckCircle,
  X,
  XCircle,
  Copy,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Printer,
  Play,
  FileText,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Package,
  LayoutGrid,
  Users,
  UserPlus,
  Briefcase,
  File,
  Settings,
  Eye,
  Lock,
  Unlock,
  UserCheck,
  WifiOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { ordersStore } from "../../utils/ordersStore";
import { showDbError } from "../../../lib/db/errors";
import { notificationStore } from "../../utils/notificationStore";
import { auditLogStore } from "../../utils/auditLogStore";
import { formatPHDate, formatPHTime } from "../../utils/pht";
import { formatCurrency } from "../../utils/formatNumber";
import { shopStatusStore } from "../../utils/shopStatusStore";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { SummaryCard } from "../ui/summary-card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Alert, AlertDescription } from "../ui/alert";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import { FileAttachments } from "../ui/file-attachments";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { generateReceiptData } from "../../utils/invoiceUtils";
import { OrderReceiptDialog } from "./OrderReceipt";
import { pricingStore } from "../../utils/pricingStore";
import { ORDER_STATUS_STYLES, getStatusBadgeClasses } from "../../utils/orderStatusPalette";
import { inventoryStore } from "../../utils/inventoryStore";
import { PriorityBadge, StartHereTag } from "../ui/priority-badge";
import { computeOrderPayment } from "./OrderPaymentSummary";
import {
  getLock,
  claimLock,
  releaseLock,
  verifyLockOnServer,
  subscribeToLocks,
  holdLockWhileOpen,
} from "../../utils/orderLocks";
import { useAuth } from "../../contexts/AuthContext";

// How each order status reads inside the Order Details dialog (sentence case,
// matching the dialog's own typography rather than the table's Title Case).
const ORDER_STATUS_LABELS: Record<string, string> = {
  inQueue: "In queue",
  printing: "Printing",
  completed: "Completed",
  released: "Released",
  canceled: "Canceled",
  awaitingPayment: "Awaiting payment",
};

// Fallback estimate when an order has no stored cost breakdown, using the
// shared centralized pricing so admin/staff estimates stay in lockstep.
function fallbackPrintTotal(pages: number, copies: number, type: string): number {
  const pricing = pricingStore.getPricing();
  return (
    pages *
    copies *
    (type === 'Colored' ? pricing.colorHigh : pricing.bw)
  );
}

type OrderType = {
  id: string;
  // Human-facing ORD-0001 form (DB uuid stays in `id`; consumers display this).
  displayId?: string;
  customer: string;
  customerEmail?: string;
  customerType?: 'printing' | 'photocopy';
  pages: number;
  type: string;
  notes: string;
  status:
    | "inQueue"
    | "printing"
    | "completed"
    | "released"
    | "canceled"
    | "awaitingPayment";
  time: string;
  paperSize: string;
  copies: number;
  submittedAt: Date;
  holdReason?: string;
  cancellationReason?: string;
  attachedFiles?: {
    name: string;
    size: string;
    type: string;
    url?: string;
    storagePath?: string;
    printType?: string;
    contentType?: string;
    paperSize?: string;
    pageCount?: number;
    copies?: number;
    colorMode?: string;
    photoSize?: string;
    photoQuantity?: number;
    notes?: string;
  }[];
  paymentVerified?: boolean;
  paymentVerifiedAt?: Date;
  paymentReferenceNumber?: string;
  orderSource: "online" | "walkin";
  paymentMethod?: string;
  paymentProofUrl?: string;
  orientation?: string;
  twoSided?: string;
  pagesPerSheet?: string;
  margins?: string;
  scale?: string;
  customScale?: number;
  colorMode?: string;
  pageRange?: string;
  specificPages?: string;
  addons?: { name: string; quantity: number; price: number }[];
  costBreakdown?: {
    printingCost: number;
    addonsCost: number;
    total: number;
  };
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
  downPaymentVerified?: boolean;
  // Full payment fields (high-value orders ≥ fullPaymentThreshold — no 50% option)
  fullPaymentRequired?: boolean;
  fullPaymentAmount?: number;
  fullPaymentVerified?: boolean;
  expectedPaperUsage?: { size: string; sheets: number }[];
  paperDeductedOnCreate?: boolean;
  paperConfirmed?: boolean;
  errorUsage?: { noErrors: boolean; reason?: string; wastedSheets: number };
  statusUpdatedAt?: Date;
  createdAt?: Date;
  lastUpdatedAt?: Date;
};

// Avatar component for initials
const Avatar = ({ name }: { name: string }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-blue-100 text-blue-700",
    "bg-blue-100 text-blue-700",
    "bg-blue-50 text-blue-700",
    "bg-[#F2F7FF] text-[#1668D9]",
    "bg-blue-200 text-blue-800",
  ];

  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm ${colors[colorIndex]}`}
    >
      {initials}
    </div>
  );
};

/** A titled group inside the Order Details window (one consistent style). */
function DetailSection({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: React.ElementType;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#2F6FD6]" />
        <h3 className="text-[13px] font-semibold text-slate-700">{title}</h3>
        {aside ? (
          <span className="ml-auto text-[11px] font-medium text-slate-500">
            {aside}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Label over value, used in every detail grid so the type scale matches. */
function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-medium text-slate-900 break-words">
        {value}
      </p>
    </div>
  );
}

interface UnifiedOrdersProps {
  menuItems: Array<{
    label: string;
    path: string;
    icon: React.ReactNode;
  }>;
  userRole: "admin" | "staff";
}

export default function UnifiedOrders({ menuItems, userRole }: UnifiedOrdersProps) {
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] =
    useState<OrderType | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(
    null,
  );
  const [sortDirection, setSortDirection] = useState<
    "asc" | "desc"
  >("asc");
  const [statusFilter, setStatusFilter] =
    useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showPaperConfirm, setShowPaperConfirm] = useState(false);
  const hydrating = useHydrating();
  // Covers the whole status write, including the session-lock re-check that
  // runs before it. Without it, clicking Confirm Update on a slow connection
  // looked like a dead button.
  const [statusSaving, setStatusSaving] = useState(false);
  const [paperFormData, setPaperFormData] = useState<{
    noErrors: boolean;
    reason: string;
    wastedSheets: number;
  }>({ noErrors: false, reason: "", wastedSheets: 0 });
  const [pendingStatus, setPendingStatus] = useState<
    | "inQueue"
    | "printing"
    | "completed"
    | "released"
    | "canceled"
    | null
  >(null);
  const [shopPaused, setShopPaused] = useState(() => !shopStatusStore.isOperational());
  const [pauseOverride, setPauseOverride] = useState<{
    newStatus: "printing";
    order: OrderType;
  } | null>(null);
  useEffect(() => {
    const unsub = shopStatusStore.subscribe(() => setShopPaused(!shopStatusStore.isOperational()));
    return unsub;
  }, []);
  const [statusFormData, setStatusFormData] = useState({
    estimatedTime: "",
    completionTime: "",
    releaseRecipient: "",
    releaseIdNumber: "",
    cancellationReason: "",
    holdReason: "",
  });
  const [showReceipt, setShowReceipt] = useState(false);

  // Pagination
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const { user } = useAuth();
  const myName = user?.name || "Staff";

  // Session lock awareness (demo: two tabs = two PCs). See orderLocks.ts.
  const [, setLocksTick] = useState(0);
  useEffect(() => {
    const bump = () => setLocksTick((t) => t + 1);
    const unsub = subscribeToLocks(bump);
    const iv = setInterval(bump, 5000);
    return () => {
      unsub();
      clearInterval(iv);
    };
  }, []);

  // Current lock for the viewed order, and whether WE hold it.
  // Photocopy orders are NEVER session-locked: staff/admin may manually take
  // a photocopy at any time, so we don't claim/display a lock for them.
  const isPhotocopyOrder = (order: OrderType | null | undefined): boolean =>
    !!order && (order.customerType === "photocopy" || order.type === "Photocopy");
  const selectedLock = selectedOrder && !isPhotocopyOrder(selectedOrder) ? getLock(selectedOrder.id) : null;
  const lockHolder = selectedLock?.heldBy ?? null;
  const iHoldLock = !!selectedLock && selectedLock.heldBy === myName;
  const canActOnOrder = iHoldLock || isPhotocopyOrder(selectedOrder);
  // One payment computation for the header summary strip — the same helper the
  // Payment section renders, so the two can never disagree.
  const selectedPayment = useMemo(
    () =>
      selectedOrder
        ? computeOrderPayment(
            selectedOrder,
            fallbackPrintTotal(
              selectedOrder.pages,
              selectedOrder.copies,
              selectedOrder.type,
            ),
          )
        : null,
    [selectedOrder],
  );
  // Orders in these statuses can be acted on, so they get a lock/claim.
  const isActionableStatus = (status: string) =>
    status === "inQueue" ||
    status === "printing" ||
    status === "completed" ||
    status === "awaitingPayment";

  // Receipt figures drive the payment card and its breakdown, so the order total
  // is printed once (in the card) and only its parts are listed underneath.
  const receipt = useMemo(
    () => (selectedOrder ? generateReceiptData(selectedOrder) : null),
    [selectedOrder],
  );

  // The files shown as the hero of the dialog. A single-file order falls back to
  // the order's own print settings when the file carries no spec of its own.
  const detailFiles = useMemo(() => {
    if (!selectedOrder) return [];
    const files = selectedOrder.attachedFiles ?? [];
    const single = files.length === 1;
    return files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url,
      storagePath: file.storagePath,
      pages: file.pageCount ?? (single ? selectedOrder.pages : undefined),
      paperSize: file.paperSize ?? (single ? selectedOrder.paperSize : undefined),
      copies: file.copies ?? (single ? selectedOrder.copies : undefined),
      colorMode: file.colorMode ?? (single ? selectedOrder.colorMode : undefined),
    }));
  }, [selectedOrder]);

  // The breakdown is a disclosure, so it starts closed for every order.
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  useEffect(() => {
    setBreakdownOpen(false);
  }, [selectedOrder?.id, showDialog]);

  const paymentChipCls =
    selectedPayment?.status === "Paid"
      ? "inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[12px] font-semibold text-[#14532D]"
      : selectedPayment?.status === "Partially Paid"
        ? "inline-flex items-center rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[12px] font-semibold text-[#92400E]"
        : "inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[12px] font-semibold text-[#991B1B]";

  // What the notes section can honestly say: the note recorded on the order,
  // plus the reason behind the CURRENT state — and each of those only once.
  const rawNote = selectedOrder?.notes?.trim() ?? "";
  const holdReason = selectedOrder?.holdReason?.trim() ?? "";
  const awaitingPayment = selectedOrder?.status === "awaitingPayment";
  const cancelNote =
    selectedOrder?.status === "canceled"
      ? selectedOrder.cancellationReason?.trim() ?? ""
      : "";
  // Checkout also stores the hold reason in the order's own notes. Once the
  // hold no longer applies that copy is stale — repeating it would tell staff a
  // verified order is still waiting for payment.
  const customerNote =
    rawNote && rawNote === holdReason && !awaitingPayment ? "" : rawNote;
  const systemNotes = [
    awaitingPayment && holdReason && holdReason !== customerNote
      ? holdReason
      : "",
    cancelNote && cancelNote !== customerNote ? cancelNote : "",
  ].filter(Boolean);

// HEARTBEAT: while our order details dialog is open on an actionable row,
  // keep renewing OUR lock so it persists for as long as we keep viewing —
  // it never vanishes mid-review. A dead tab stops beating and expires.
  //
  // Renewal lives in `holdLockWhileOpen` so this screen and Payment Verification
  // behave identically: it re-claims on a 30s beat AND whenever the tab/window
  // is looked at again, which is what keeps a dialog from turning read-only
  // after a backgrounded tab was throttled (or frozen) past the lock's TTL.
  // Claim is a no-op against someone else's live lock and a renewal against
  // our own, so calling it again is both safe and self-healing.
  useEffect(() => {
    if (!selectedOrder || !showDialog || !isActionableStatus(selectedOrder.status) || isPhotocopyOrder(selectedOrder)) {
      return;
    }
    return holdLockWhileOpen(selectedOrder.id, myName);
  }, [selectedOrder?.id, selectedOrder?.status, showDialog, myName]);

  // Read ?orderId=... so a notification click can deep-open a specific order
  const [searchParams] = useSearchParams();
  const openedOrderIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  // Initialize and subscribe to orders store (Supabase-backed via dataStore)
  useEffect(() => {
    setOrders(ordersStore.getOrders());

    // Subscribe to changes
    const unsubscribe = ordersStore.subscribe(() => {
      setOrders(ordersStore.getOrders());
    });

    return unsubscribe;
  }, []);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(
        sortDirection === "asc" ? "desc" : "asc",
      );
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleOpenDetails = (order: OrderType) => {
    setSelectedOrder(order);
    setShowDialog(true);

    // Claim the session lock for actionable orders (the modal opens as "ours").
    // NOTE (backend later): write this claim to the shared session_locks
    // table / broadcast over realtime so OTHER machines see it too.
    if (isActionableStatus(order.status) && !isPhotocopyOrder(order)) {
      const existing = getLock(order.id);
      if (existing && existing.heldBy !== myName) {
        toast.info(`${existing.heldBy} is viewing this order`, {
          description: "You can review it, but only the current reviewer can act on it.",
        });
      } else {
        claimLock(order.id, myName);
      }
    }
  };

  // Auto-open a specific order when arriving via a notification (?orderId=...)
  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId || orders.length === 0) return;
    if (openedOrderIdRef.current === orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      openedOrderIdRef.current = orderId;
      handleOpenDetails(order);
    }
  }, [orders, searchParams]);

  const handleUpdateStatus = (
    newStatus:
      | "inQueue"
      | "printing"
      | "completed"
      | "released"
      | "canceled",
    order: OrderType | null = selectedOrder,
    opts?: { bypassPause?: boolean },
  ) => {
    if (!order) return;

    // SHOP-PAUSED GATE: while Docufy is paused, staff can still finish jobs
    // already in the pipeline (print/completed/release), but STARTING a new
    // print is on hold unless the staff explicitly overrides it.
    if (shopPaused && newStatus === "printing" && !opts?.bypassPause) {
      setPauseOverride({ newStatus, order });
      return;
    }

    // PAYMENT VERIFICATION LOGIC - System-wide restriction
    // Orders awaiting payment can only leave that state through the system:
    // verifying the payment auto-sets "In Queue", and the expiry engine
    // auto-cancels overdue orders. Staff should never manually push an
    // unverified awaiting-payment order into the queue, so the only manual
    // action available here is cancelling it.
    if (order.status === "awaitingPayment" && !order.paymentVerified) {
      if (newStatus !== "canceled") {
        setErrorMessage(
          "Awaiting payment. Verify it in Payment Verification and the order queues automatically.",
        );
        return;
      }
    }

    // INDEPENDENT STATUS FLOW: every order advances on its own
    // (In Queue → Printing → Completed → Released). With multiple printers,
    // shorter jobs can finish and be completed/released while other orders are
    // still printing, so there is NO cross-order sequence lock here.

    // Auto-populate date/time fields with current date and time
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDateTime = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format

    setStatusFormData({
      estimatedTime: currentTime,
      completionTime: currentDateTime,
      releaseRecipient:
        newStatus === "released" ? order.customer : "",
      releaseIdNumber:
        newStatus === "released" ? order.id : "",
      cancellationReason: "",
      holdReason: "",
    });

    // Show form for status update
    setPendingStatus(newStatus);
    setShowStatusForm(true);
    setErrorMessage("");
  };

    // "Start Here" action: immediately opens the status form to move the next
  // order to Printing. After confirmation the order leaves inQueue,
  // so firstToProcessId advances and the tag moves to the next order (or
  // disappears when none are left to process).
  const handleStartFromHere = (order: OrderType) => {
    if (order.status === "awaitingPayment" && !order.paymentVerified) {
      setErrorMessage(
        "Awaiting payment. Verify it in Payment Verification and the order queues automatically.",
      );
      toast.error(
        "Awaiting payment. Verify it in Payment Verification first.",
      );
      return;
    }
    setSelectedOrder(order);
    // Claim the lock for this order too (Start Here goes straight to the form),
    // unless it's a photocopy — photocopies are never locked.
    if (!isPhotocopyOrder(order)) {
      const existing = getLock(order.id);
      if (!existing || existing.heldBy === myName) {
        claimLock(order.id, myName);
      } else {
        toast.error(`${existing.heldBy} is managing this order`, {
          description: "Only the current reviewer can start it.",
        });
        return;
      }
    }
    handleUpdateStatus("printing", order);
  };

  // Paper display helper: map an order's paper-size label back to an internal code
  const paperCodeFromLabel = (label: string): string => {
    const map: Record<string, string> = {
      "A4": "a4", "Short": "short", "Legal": "legal",
      "Long": "long", "Folio": "long", "A3": "a4",
    };
    return map[label] || (label || "a4").toLowerCase() || "a4";
  };

  // Open the Error Usage dialog (called when staff/admin mark an order Completed).
  // It captures only error usage � whether there were errors and how many sheets
  // were wasted � with quick-reason chips so staff don't have to type during peak hours.
  const openPaperConfirm = () => {
    if (!selectedOrder) return;
    setPaperFormData({ noErrors: false, reason: "", wastedSheets: 0 });
    setShowPaperConfirm(true);
  };

  // Called by the Error Usage dialog confirm. Deducts the expected (planned)
  // paper usage from inventory and records any error usage for audit.
  const getExpectedUsage = (): { size: string; sheets: number }[] => {
    if (!selectedOrder) return [];
    if (selectedOrder.expectedPaperUsage && selectedOrder.expectedPaperUsage.length > 0) {
      return selectedOrder.expectedPaperUsage;
    }
    // Legacy order without stored per-size usage: best-effort single estimate.
    const pps = parseInt(selectedOrder.pagesPerSheet || "1", 10) || 1;
    const expected = Math.ceil((selectedOrder.pages || 0) / pps) * (selectedOrder.copies || 1);
    return [{ size: paperCodeFromLabel(selectedOrder.paperSize), sheets: expected }];
  };

  // Deduct the CONFIRMED actual paper usage and complete the order status update.
  const confirmPaperUsage = (forceNoErrors = false) => {
    if (!selectedOrder) return;

    const noError = forceNoErrors || paperFormData.noErrors;

    // Deduct the EXPECTED (planned) usage per size. Legacy orders placed before
    // this feature were auto-deducted at placement, so they are skipped to avoid
    // double-counting. New orders (paperDeductedOnCreate === false) are deducted here.
    if (selectedOrder.paperDeductedOnCreate === false && !selectedOrder.paperConfirmed) {
      getExpectedUsage().forEach((u) => {
        if (u.sheets > 0) {
          inventoryStore.deductPaperPieces(u.size, u.sheets, {
            reason: "Order completion",
            person: selectedOrder.customer,
            related: selectedOrder.id,
          });
        }
      });
    }

    // Record error usage for audit. If no error, nothing more is kept.
    const errorUsage = noError
      ? { noErrors: true, reason: undefined, wastedSheets: 0 }
      : {
          noErrors: false,
          reason: paperFormData.reason,
          wastedSheets: paperFormData.wastedSheets,
        };

    if (!noError && paperFormData.wastedSheets > 0) {
      toast.info(
        `Error usage recorded: ${paperFormData.wastedSheets} wasted sheet(s) for order ${selectedOrder.id}`,
      );
    }

    setShowPaperConfirm(false);
    runStatusUpdate({
      paperConfirmed: true,
      errorUsage,
    });
  };

  const runStatusUpdate = async (paperData?: {
    paperConfirmed: boolean;
    errorUsage?: { noErrors: boolean; reason?: string; wastedSheets: number };
  }) => {
    setStatusSaving(true);
    try {
      await confirmStatusUpdate(paperData);
    } finally {
      setStatusSaving(false);
    }
  };

  const confirmStatusUpdate = async (paperData?: {
    paperConfirmed: boolean;
    errorUsage?: { noErrors: boolean; reason?: string; wastedSheets: number };
  }) => {
    if (!selectedOrder || !pendingStatus) return;

    // ===== SESSION LOCK GUARD =====
    // Re-check ownership at the FINAL confirm moment — a second machine might
    // have claimed the order after we opened the modal. Only the lock holder
    // may act. We verify against the SERVER (the `claim_order_lock` storage
    // RPC made the claim atomic; this read confirms we still hold it), falling
    // back to the local mirror only when the backend is unreachable.
    // Photocopy orders are never session-locked, so the final-reconfirm lock
    // guard only applies to regular (printing) orders.
    if (!isPhotocopyOrder(selectedOrder) && !(await verifyLockOnServer(selectedOrder.id, myName))) {
      const other = getLock(selectedOrder.id);
      setShowStatusForm(false);
      setPendingStatus(null);
      toast.error(
        other ? `${other.heldBy} is currently viewing this order` : "This order is no longer available",
        { description: "Only the current reviewer can update it. Refresh to see the latest status." },
      );
      return;
    }

    // Persist paper-usage confirmation fields onto the updated order when completing.
    let extraOrder: Record<string, unknown> = {};
    if (pendingStatus === "completed" && paperData) {
      extraOrder = { ...paperData };
    }

    // Persist the status change through the store (Supabase-backed). A single
    // row update — not a full-list rewrite — so status changes stay fast.
    try {
      await ordersStore.updateOrder(selectedOrder.id, {
        ...extraOrder,
        status: pendingStatus,
        cancellationReason:
          pendingStatus === "canceled"
            ? statusFormData.cancellationReason
            : selectedOrder.cancellationReason,
        statusUpdatedAt: new Date(), // Update timestamp
      });
    } catch (err) {
      showDbError("updating the order status", err);
      // Keep the form open so the user can retry.
      return;
    }

    // Audit the status change — an immutable record of who moved the order
    // where, and when.
    const orderStatusLabel: Record<string, string> = {
      awaitingPayment: "Awaiting Payment",
      inQueue: "In Queue",
      printing: "Printing",
      completed: "Completed",
      released: "Released",
      canceled: "Canceled",
      onHold: "On Hold",
    };
    auditLogStore.record({
      module: "Orders",
      action: pendingStatus === "released" ? "Released" : "Updated",
      reference: `Order #${selectedOrder.displayId ?? selectedOrder.id}`,
      entityType: "Order",
      entityId: selectedOrder.id,
      title: pendingStatus === "canceled" ? "Order Canceled" : "Order Status Updated",
      description:
        pendingStatus === "canceled"
          ? `The order was canceled. Reason: ${statusFormData.cancellationReason || "Not specified"}.`
          : `The order status was changed from ${orderStatusLabel[selectedOrder.status] ?? selectedOrder.status} to ${orderStatusLabel[pendingStatus] ?? pendingStatus}.`,
      changes: [
        {
          field: "Order Status",
          previous: orderStatusLabel[selectedOrder.status] ?? selectedOrder.status,
          next: orderStatusLabel[pendingStatus] ?? pendingStatus,
        },
      ],
    });

    const updatedSelectedOrder = {
      ...selectedOrder,
      ...extraOrder,
      status: pendingStatus,
      cancellationReason:
        pendingStatus === "canceled"
          ? statusFormData.cancellationReason
          : selectedOrder.cancellationReason,
      statusUpdatedAt: new Date(),
    };

    setSelectedOrder(updatedSelectedOrder);

    // Send notification to customer about status update
    const statusMessages: Record<string, string> = {
      inQueue: 'Your order is now in the print queue.',
      printing: 'Your order is currently being printed.',
      completed: 'Your order has been completed and is ready for pickup.',
      released: 'Your order has been released.',
      canceled: `Your order has been canceled. Reason: ${statusFormData.cancellationReason || 'Please contact staff for details.'}`,
    };

    const statusTitle = pendingStatus === "inQueue" ? "In Queue" : pendingStatus.charAt(0).toUpperCase() + pendingStatus.slice(1);

    notificationStore.addNotification(
      'status_update',
      `Order ${statusTitle}`,
      statusMessages[pendingStatus] || `Your order status has been updated to ${statusTitle}.`,
      {
        clickable: true,
        relatedOrderId: selectedOrder.id,
        relatedRoute: `/customer/track/${selectedOrder.id}`,
        recipientEmail: selectedOrder.customerEmail || selectedOrder.customer,
        recipientRole: 'customer',
      }
    );

    if (pendingStatus === "completed") {
      toast.success(
        `Order ${selectedOrder.displayId ?? selectedOrder.id} completed!`,
      );
    } else {
      toast.success(
        `Order ${selectedOrder.displayId ?? selectedOrder.id} updated to ${pendingStatus === "inQueue" ? "In Queue" : pendingStatus} successfully!`,
      );
    }

    // Reset form and close dialogs
    setShowStatusForm(false);
    setShowDialog(false); // Close Order Details dialog
    setPendingStatus(null);
    releaseLock(selectedOrder.id, myName); // Order processed — free OUR lock
    setStatusFormData({
      estimatedTime: "",
      completionTime: "",
      releaseRecipient: "",
      releaseIdNumber: "",
      cancellationReason: "",
      holdReason: "",
    });
  };

  // QUEUE-VISIBLE ORDERS: orders still awaiting payment verification are excluded
  // from the Orders/queue list until staff/admin verifies them (they then enter
  // the queue automatically as "In Queue"). Completed, Released, and Canceled
  // are also excluded from the default view - they only appear when their
  // specific status filter is selected.
  const queueOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "awaitingPayment" &&
          o.status !== "completed" &&
          o.status !== "released" &&
          o.status !== "canceled",
      ),
    [orders],
  );

  // PROCESSING SEQUENCE: queue orders ranked oldest-submitted first (FIFO) -
  // the sequence numbers staff see (1, 2, 3...) are processing priority, not
  // order IDs or row indexes. Next to process = the earliest in-queue order
  // still waiting to reach the printer.
  const processingOrder = useMemo(
    () =>
      [...queueOrders].sort(
        (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
      ),
    [queueOrders],
  );
  const priorityById = useMemo(() => {
    const map = new Map<string, number>();
    processingOrder.forEach((o, i) => map.set(o.id, i + 1));
    return map;
  }, [processingOrder]);
  // FIRST TO PROCESS (priority #1 of the FIFO queue): the "Start Here" tag
  // always marks this single order — the earliest one still in the pipeline —
  // exactly like Payment Verification's "Next to Verify" marks its first
  // pending payment. When that order is In Queue the tag is clickable to start
  // printing; when it's already on the printer it just indicates where the
  // queue is at.
  const firstToProcessId = useMemo(
    () => processingOrder[0]?.id,
    [processingOrder],
  );

  const filteredOrders = useMemo(() => {
    // When a specific status filter is selected, show from the full orders list
    // (so completed/released/canceled appear when their filter is chosen).
    // When "all", show only the active queue (excludes awaitingPayment + terminal statuses).
    const base =
      statusFilter !== "all" ? orders : queueOrders;
    let filtered = [...base];

    // PROCESSING ORDER (default): sort by submission time oldest-first (FIFO),
    // matching the status-update validation order in handleUpdateStatus. This
    // keeps the earliest/morning orders at the top of the queue so staff know
    // which job to process next, instead of only seeing the newest updates.
    filtered = filtered.sort(
      (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
    );

    // Filter by search query
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.id.toLowerCase().includes(lowerQ) ||
          o.customer.toLowerCase().includes(lowerQ) ||
          o.type.toLowerCase().includes(lowerQ),
      );
    }

    // Filter by date range
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`);
      filtered = filtered.filter((o) => o.submittedAt.getTime() >= from.getTime());
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`);
      filtered = filtered.filter((o) => o.submittedAt.getTime() <= to.getTime());
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (o) => o.status === statusFilter,
      );
    }

    // Only apply custom sorting if explicitly requested
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sortColumn as keyof OrderType] as string | number | undefined;
        const bv = b[sortColumn as keyof OrderType] as string | number | undefined;
        const aVal: string | number = av == null ? "" : typeof av === "string" ? av.toLowerCase() : av;
        const bVal: string | number = bv == null ? "" : typeof bv === "string" ? bv.toLowerCase() : bv;
        if (aVal < bVal)
          return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal)
          return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    orders,
    queueOrders,
    searchQuery,
    sortColumn,
    sortDirection,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  // Pagination over the filtered set
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE)),
    [filteredOrders],
  );
  const paginatedOrders = useMemo(
    () =>
      filteredOrders.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredOrders, currentPage],
  );

  // Reset to page 1 whenever filters change so the user always lands at the start
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  // Calculate summary stats
  const stats = useMemo(() => {
    return {
      inQueue: orders.filter((o) => o.status === "inQueue")
        .length,
      printing: orders.filter((o) => o.status === "printing")
        .length,
      completed: orders.filter((o) => o.status === "completed")
        .length,
      released: orders.filter((o) => o.status === "released")
        .length,
      canceled: orders.filter((o) => o.status === "canceled")
        .length,
    };
  }, [orders]);

  const SortableHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider cursor-pointer hover:bg-[#E7F1FE] transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column &&
          (sortDirection === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </div>
    </th>
  );

  return (
    <Layout menuItems={menuItems} title="Orders" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col space-y-6">
        {/* Shop-paused banner */}
        {shopPaused && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Docufy is currently paused</p>
              <p className="text-xs text-amber-700 mt-0.5">
                New orders are on hold. You can still finish jobs already in the queue.
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards - one row on wide screens so the queue stays above the fold */}
        <div className="grid grid-cols-2 @min-[720px]:grid-cols-3 @min-[1120px]:grid-cols-6 gap-2 sm:gap-3 mb-4 shrink-0">
          {([
            ["all", "Active Queue", LayoutGrid, queueOrders.length],
            ["inQueue", "In Queue", Clock, stats.inQueue],
            ["printing", "Printing", Printer, stats.printing],
            ["completed", "Completed", CheckCircle, stats.completed],
            ["released", "Released", CheckCircle, stats.released],
            ["canceled", "Canceled", XCircle, stats.canceled],
          ] as const).map(([key, label, Icon, count]) => {
            const s = ORDER_STATUS_STYLES[key];
            return (
              <SummaryCard
                key={key}
                label={label}
                value={count}
                icon={Icon}
                iconBg={s.chip}
                iconColor={s.icon}
                labelColor={s.label}
                active={statusFilter === key}
                activeBorder={s.accent}
                activeBg={s.bg}
                onClick={() => {
                  setStatusFilter(statusFilter === key ? "all" : key);
                }}
              />
            );
          })}
        </div>

        {/* Filter & Search bar */}
        <Card className="p-4 border border-slate-100 shadow-sm mb-6 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</Label>
              <div className="group relative mt-1.5">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                <Input
                  aria-label="Search orders"
                  placeholder="Search order ID, customer, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <DateRangeFilter
              value={{ from: dateFrom, to: dateTo }}
              onChange={(next) => {
                setDateFrom(next.from);
                setDateTo(next.to);
              }}
              fromLabel="From"
              toLabel="To"
              className="w-full lg:w-[21rem]"
            />
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {hydrating ? (
            <TableSkeleton columns={8} rows={10} />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider w-14">
                    #
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider cursor-pointer hover:bg-[#E7F1FE] transition-colors"
                    onClick={() => handleSort("customer")}
                  >
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col leading-tight">
                        Customer
                        <span className="text-[10px] font-medium text-[#10316B]/60 normal-case tracking-normal">
                          Order ID
                        </span>
                      </div>
                      {sortColumn === "customer" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <SortableHeader column="submittedAt">
                    Date
                  </SortableHeader>
                  <SortableHeader column="time">
                    Time
                  </SortableHeader>
                  <SortableHeader column="status">
                    Status
                  </SortableHeader>
                  <SortableHeader column="orderSource">
                    Source
                  </SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Total / Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedOrders.map((order, index) => {
                  // Use statusUpdatedAt if available, otherwise submittedAt
                  const displayDate = order.statusUpdatedAt || order.submittedAt;
                  const listPosition = (currentPage - 1) * PAGE_SIZE + index + 1;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100"
                      onClick={() =>
                        handleOpenDetails(order)
                      }
                    >
<td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              {(() => {
                                const priority = priorityById.get(order.id);
                                const isFirst =
                                  statusFilter === "all" &&
                                  order.id === firstToProcessId;
                                return (
                                  <>
                                    <PriorityBadge
                                      number={priority ?? listPosition}
                                      active={isFirst}
                                    />
                                    {isFirst && (
                                      <StartHereTag
                                        label="Start Here"
                                        onClick={
                                          order.status === "inQueue"
                                            ? () => handleStartFromHere(order)
                                            : undefined
                                        }
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Avatar name={order.customer} />
                                  <div>
                                    <p className="font-semibold text-sm text-[#1c1f26]">
                                      {order.customer}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {order.displayId ?? order.id}
                                    </p>
                                    {order.orderSource === "walkin" && order.customerType && (
                                      <span className="inline-block mt-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
                                        {order.customerType === "printing" ? "Walk-in Printing" : "Photocopy"}
                                      </span>
                                    )}
                                    {order.notes && (
                                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <AlertCircle className="w-3 h-3 text-blue-500" />
                                        Has notes
                                      </p>
                                    )}
                                    {(() => {
                                      const oLock = getLock(order.id);
                                      if (!oLock || isPhotocopyOrder(order)) return null;
                                      const oLockedByMe = oLock.heldBy === myName;
                                      return (
                                        <span
                                          title={
                                            oLockedByMe
                                              ? "You are managing this order"
                                              : `${oLock.heldBy} is managing this order`
                                          }
                                          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${
                                            oLockedByMe ? "text-green-600" : "text-amber-600"
                                          }`}
                                        >
                                          <Eye className="w-3 h-3" />
                                          {oLockedByMe
                                            ? "Managing (you)"
                                            : `${oLock.heldBy} is managing`}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatPHDate(displayDate, "short")}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#10316B] bg-blue-50 border border-blue-100 rounded-lg px-2 py-1">
                                  <Clock className="w-3.5 h-3.5 text-[#1668D9]" />
                                  {formatPHTime(displayDate)}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex flex-col items-start gap-1">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium capitalize ${getStatusBadgeClasses(order.status)}`}
                                >
                                  {order.status === "inQueue"
                                    ? "In Queue"
                                    : order.status === "awaitingPayment"
                                      ? "Awaiting Payment"
                                      : order.status}
                                </Badge>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium ${
                                    order.orderSource === "online"
                                      ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}
                                >
                                  {order.orderSource === "online"
                                    ? "Online"
                                    : "Walk-in"}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {(() => {
                                  // PREVIEW — outstanding balance alongside the total.
                                  const pay = computeOrderPayment(
                                    order,
                                    fallbackPrintTotal(order.pages, order.copies, order.type),
                                  );
                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-sm font-semibold text-[#1c1f26]">
                                        {formatCurrency(pay.total)}
                                      </span>
                                      <span
                                        className={`text-[11px] font-medium ${
                                          pay.remaining > 0 ? "text-amber-600" : "text-green-600"
                                        }`}
                                      >
                                        {pay.remaining > 0
                                          ? `Balance ${formatCurrency(pay.remaining)}`
                                          : "Fully paid"}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg border-[1.5px] border-[#D5DCE6] bg-white px-[13px] text-[11.5px] font-semibold text-[#344054] transition-colors hover:border-[#1668D9] hover:bg-[#1668D9] hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetails(order);
                                  }}
                                >
                                  Details
                                </Button>
                              </td>
                            </tr>
                  );
                })}
                {paginatedOrders.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Search className="w-12 h-12 mb-3" />
                        <p className="text-sm font-medium">
                          {searchQuery || dateFrom || dateTo || statusFilter !== "all"
                            ? "No orders match these filters"
                            : "No active orders"}
                        </p>
                        <p className="text-xs mt-1">
                          {searchQuery || dateFrom || dateTo || statusFilter !== "all"
                            ? "Try a different search, date range or status."
                            : "New orders appear here as customers place them."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-white">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {totalPages === 1
                  ? filteredOrders.length
                  : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}`}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{filteredOrders.length}</span>{" "}
              order{filteredOrders.length === 1 ? "" : "s"}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="bg-white text-slate-600 border border-gray-200 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6] disabled:opacity-40 disabled:pointer-events-none rounded-md px-3 h-9"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <Button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={
                      pg === currentPage
                        ? "bg-[#2F6FD6] text-white hover:bg-[#2557b8] rounded-md shadow-sm shadow-[#2F6FD6]/30 h-9 w-9"
                        : "bg-white text-slate-600 border border-gray-200 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6] rounded-md h-9 w-9"
                    }
                  >
                    {pg}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="bg-white text-slate-600 border border-gray-200 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] hover:border-[#2F6FD6] disabled:opacity-40 disabled:pointer-events-none rounded-md px-3 h-9"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
          </>
          )}
        </Card>
      </div>

      {/* Order Details Dialog - Continues in next part due to length */}
<Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            // Release OUR hold when the order details modal closes. Only frees
            // OUR lock — another reviewer's hold is left untouched.
            if (selectedOrder) releaseLock(selectedOrder.id, myName);
            setShowDialog(false);
          } else {
            setShowDialog(true);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[700px] max-h-[calc(100dvh-2rem)] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl [font-family:inherit] [&_[data-slot=dialog-close]]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            // Focus the dialog itself, so opening it announces the order rather
            // than "Close", and the X starts without a focus ring.
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          {selectedOrder && (
            <>
              {/* Header — the order number and its state, stated once */}
              <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 px-5 pt-5 pb-0 pr-12 text-left">
                <div className="min-w-0 flex items-center gap-2">
                  <DialogTitle className="text-lg font-semibold leading-none text-[#1c1f26]">
                    {selectedOrder.displayId ?? selectedOrder.id}
                  </DialogTitle>
                    <Badge
                      variant="outline"
                      className={`gap-1.5 border-transparent text-[12px] font-semibold ${getStatusBadgeClasses(
                        selectedOrder.status,
                      )}`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current"
                      />
                      {ORDER_STATUS_LABELS[selectedOrder.status] ??
                        selectedOrder.status}
                    </Badge>
                    {lockHolder && !iHoldLock && (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-[#F5CE8A] bg-[#FFF8EB] text-[12px] font-semibold text-[#8A5007]"
                      >
                        <Lock className="size-3" aria-hidden="true" />
                        Locked by {lockHolder}
                      </Badge>
                    )}
                  <DialogDescription className="mt-2.5 text-[13.5px] leading-relaxed text-[#6B7280]">
                    {selectedOrder.customerEmail ? (
                      <span
                        title={selectedOrder.customerEmail}
                        className="cursor-help"
                      >
                        {selectedOrder.customer}
                      </span>
                    ) : (
                      selectedOrder.customer
                    )}
                    {" · "}
                    {selectedOrder.orderSource === "online"
                      ? "Online"
                      : "Walk-in"}
                    {" · "}
                    {formatPHDate(
                      selectedOrder.createdAt || selectedOrder.submittedAt,
                    )}
                    {", "}
                    {formatPHTime(
                      selectedOrder.createdAt || selectedOrder.submittedAt,
                    )}
                  </DialogDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  aria-label="Close order details"
                  className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#D5DBE5] bg-white text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </DialogHeader>

              <div className="h-px bg-[#E5E7EB]" />

              <div className="flex-1 overflow-y-auto">
                {/* The file is the hero of this dialog */}
                <section className="px-6 py-5">
                  <h3 className="text-[13px] font-semibold text-[#111827]">
                    {detailFiles.length > 1 ? "Files to print" : "File to print"}
                  </h3>
                  <div className="mt-3">
                    {detailFiles.length > 0 ? (
                      <FileAttachments
                        files={detailFiles}
                        orderId={selectedOrder.id}
                        showDownload={true}
                        showView={true}
                        lockedBy={canActOnOrder ? null : lockHolder}
                        appearance="card"
                      />
                    ) : (
                      <div className="flex flex-col gap-3 rounded-[14px] border border-[#E5E7EB] px-4 py-3.5 sm:flex-row sm:items-center">
                        <div
                          aria-hidden="true"
                          className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
                        >
                          <Copy className="size-5 text-[#1D4ED8]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#111827]">
                            Photocopy · {selectedOrder.paperSize} paper
                          </p>
                          <p className="mt-1 text-[13px] text-[#6B7280]">
                            {selectedOrder.pages}{" "}
                            {selectedOrder.pages === 1 ? "page" : "pages"} ·{" "}
                            {selectedOrder.copies}{" "}
                            {selectedOrder.copies === 1 ? "copy" : "copies"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Payment — the figure is printed here, once */}
                <section className="border-t border-[#E5E7EB] px-6 py-5">
                  <h3 className="text-[13px] font-semibold text-[#111827]">
                    Payment
                  </h3>
                  <div className="mt-3 flex min-h-[72px] flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border border-[#E5E7EB] px-4 py-3.5">
                    <span className={paymentChipCls}>
                      {selectedPayment?.status ?? "Payment Due"}
                    </span>
                    <span className="text-[15px] font-semibold text-[#111827]">
                      {formatCurrency(selectedPayment?.total ?? 0)}
                      {selectedOrder.paymentMethod && (
                        <span className="font-normal text-[#6B7280]">
                          {" · "}
                          {selectedOrder.paymentMethod}
                        </span>
                      )}
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                      {!selectedOrder.paymentVerified && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `${userRole === "admin" ? "/admin" : "/staff"}/payment-verification?orderId=${encodeURIComponent(
                                selectedOrder.id,
                              )}`,
                            )
                          }
                          className="rounded text-[13px] font-medium text-[#4B5563] transition-colors hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
                        >
                          Verify payment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowReceipt(true)}
                        className="rounded text-[13px] font-medium text-[#1D4ED8] transition-colors hover:text-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
                      >
                        View receipt
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBreakdownOpen((open) => !open)}
                    aria-expanded={breakdownOpen}
                    className="mt-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-[#4B5563] transition-colors hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
                  >
                    <Play
                      aria-hidden="true"
                      className={`size-3 fill-current transition-transform ${
                        breakdownOpen ? "rotate-90" : ""
                      }`}
                    />
                    {breakdownOpen ? "Hide breakdown" : "Show breakdown"}
                  </button>

                  {breakdownOpen && (
                    <dl className="mt-2 w-full max-w-[210px] space-y-1.5 pl-5 text-[13.5px]">
                      <div className="flex items-baseline justify-between gap-6">
                        <dt className="text-[#6B7280]">Printing</dt>
                        <dd className="font-medium text-[#111827]">
                          {formatCurrency(receipt?.printingCost ?? 0)}
                        </dd>
                      </div>
                      {receipt && receipt.addons.length > 0 && (
                        <div className="flex items-baseline justify-between gap-6">
                          <dt className="text-[#6B7280]">Add-ons</dt>
                          <dd className="font-medium text-[#111827]">
                            {formatCurrency(receipt.addonsCost)}
                          </dd>
                        </div>
                      )}
                      {(selectedPayment?.remaining ?? 0) > 0 && (
                        <div className="flex items-baseline justify-between gap-6">
                          <dt className="text-[#6B7280]">Balance</dt>
                          <dd className="font-semibold text-[#92400E]">
                            {formatCurrency(selectedPayment?.remaining ?? 0)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </section>

                {/* Customer notes — the section is always present, honestly */}
                <section className="border-t border-[#E5E7EB] px-6 py-5">
                  <h3 className="text-[13px] font-semibold text-[#111827]">
                    Customer notes
                  </h3>
                  <p className="mt-2.5 break-words text-[14px] leading-relaxed text-[#4B5563]">
                    {customerNote || "None"}
                  </p>
                  {systemNotes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {systemNotes.map((note) => (
                        <p
                          key={note}
                          className={`break-words rounded-[10px] px-3 py-2 text-[13px] leading-relaxed ${
                            note === cancelNote
                              ? "bg-[#FEF2F2] text-[#991B1B]"
                              : "bg-[#F3F4F6] text-[#4B5563]"
                          }`}
                        >
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                </section>

                {errorMessage && (
                  <div className="px-6 pb-5">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>

              {/* Footer — exactly one primary action, labelled by the state */}
              {(selectedOrder.status === "inQueue" ||
                selectedOrder.status === "printing" ||
                selectedOrder.status === "completed" ||
                (selectedOrder.status === "awaitingPayment" &&
                  !selectedOrder.paymentVerified)) && (
                <div className="border-t border-[#E5E7EB] px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      {(selectedOrder.status === "inQueue" ||
                        selectedOrder.status === "awaitingPayment") && (
                        <Button
                          variant="outline"
                          disabled={!canActOnOrder}
                          title={
                            !canActOnOrder && lockHolder
                              ? `${lockHolder} is managing this order`
                              : undefined
                          }
                          onClick={() => handleUpdateStatus("canceled")}
                          className="w-full border-[#B91C1C] bg-white text-[#B91C1C] hover:border-[#991B1B] hover:bg-[#B91C1C] hover:text-white disabled:pointer-events-none disabled:opacity-40 sm:w-[150px]"
                        >
                          Cancel order
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:items-end">
                      {selectedOrder.status === "inQueue" && (
                        <Button
                          data-primary-action
                          disabled={!canActOnOrder}
                          title={
                            !canActOnOrder && lockHolder
                              ? `${lockHolder} is managing this order`
                              : undefined
                          }
                          onClick={() => handleUpdateStatus("printing")}
                          className="w-full bg-[#1D4ED8] text-white hover:bg-[#1E40AF] disabled:pointer-events-none disabled:opacity-40 sm:w-[200px]"
                        >
                          <Printer className="size-4" aria-hidden="true" />
                          Start printing
                        </Button>
                      )}

                      {selectedOrder.status === "printing" && (
                        <Button
                          data-primary-action
                          disabled={!canActOnOrder}
                          title={
                            !canActOnOrder && lockHolder
                              ? `${lockHolder} is managing this order`
                              : undefined
                          }
                          onClick={() => handleUpdateStatus("completed")}
                          className="w-full bg-[#1D4ED8] text-white hover:bg-[#1E40AF] disabled:pointer-events-none disabled:opacity-40 sm:w-[200px]"
                        >
                          <Check className="size-4" aria-hidden="true" />
                          Mark as done
                        </Button>
                      )}

                      {selectedOrder.status === "completed" &&
                        (() => {
                          // Cash on Pickup may only be released once the cash has
                          // been verified (it can be printed before that).
                          const cashPickupUnpaid =
                            selectedOrder.paymentMethod === "Cash" &&
                            !selectedOrder.paymentVerified;
                          return (
                            <>
                              <Button
                                data-primary-action
                                disabled={cashPickupUnpaid || !canActOnOrder}
                                onClick={() => handleUpdateStatus("released")}
                                className="w-full bg-[#1D4ED8] text-white hover:bg-[#1E40AF] disabled:pointer-events-none disabled:opacity-40 sm:w-[200px]"
                              >
                                <Package className="size-4" aria-hidden="true" />
                                Release order
                              </Button>
                              {cashPickupUnpaid && (
                                <p className="text-[12.5px] leading-relaxed text-[#6B7280] sm:text-right">
                                  Verify the cash payment before releasing this
                                  order.
                                </p>
                              )}
                            </>
                          );
                        })()}

                      {selectedOrder.status === "awaitingPayment" &&
                        !selectedOrder.paymentVerified && (
                          <>
                            <button
                              type="button"
                              disabled
                              className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[10px] border border-transparent bg-[#E5E7EB] px-4 text-[14px] font-semibold text-[#9CA3AF] sm:w-[200px]"
                            >
                              <Printer className="size-4" aria-hidden="true" />
                              Start printing
                            </button>
                            <p className="text-[12.5px] leading-relaxed text-[#6B7280] sm:text-right">
                              Waiting for{" "}
                              {selectedOrder.paymentMethod ?? "payment"}{" "}
                              verification before this order can print.
                            </p>
                          </>
                        )}

                      {!canActOnOrder && lockHolder && (
                        <p className="text-[12.5px] leading-relaxed text-[#8A5007] sm:text-right">
                          {lockHolder} is managing this order.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Form Dialog */}
      <Dialog
        open={showStatusForm}
        onOpenChange={setShowStatusForm}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              {pendingStatus === "inQueue"
                ? "Move Order to In Queue"
                : pendingStatus === "completed"
                  ? "Mark Order as Completed"
                  : pendingStatus === "canceled"
                    ? "Cancel Order"
                    : `Update Status to ${String(pendingStatus)
                        .charAt(0)
                        .toUpperCase()}${String(pendingStatus).slice(1)}`}
            </DialogTitle>
            <DialogDescription>
              Fill in the required information for this status
              update
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pendingStatus === "canceled" && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Cancel this order. This action cannot be
                    undone.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="cancellationReason">
                    Cancellation Reason *
                  </Label>
                  <Textarea
                    id="cancellationReason"
                    placeholder="Enter the reason for cancellation..."
                    value={statusFormData.cancellationReason}
                    onChange={(e) =>
                      setStatusFormData((prev) => ({
                        ...prev,
                        cancellationReason: e.target.value,
                      }))
                    }
                    rows={3}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setShowStatusForm(false)}
              className="bg-white hover:-translate-y-0.5 hover:shadow-md hover:bg-red-50 border-2 border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                pendingStatus === "completed"
                  ? openPaperConfirm()
                  : runStatusUpdate()
              }
              loading={statusSaving}
              loadingText="Updating..."
              className={
                pendingStatus === "canceled"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
              }
              disabled={
                statusSaving ||
                (pendingStatus === "canceled" &&
                  !statusFormData.cancellationReason)
              }
            >
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Usage (shown when marking an order Completed) */}
      <Dialog
        open={showPaperConfirm}
        onOpenChange={setShowPaperConfirm}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              Error Usage
            </DialogTitle>
            <DialogDescription>
              Record whether any error usage occurred for order{" "}
              {selectedOrder?.id}. Inventory is deducted from the expected sheets; waste is tracked separately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Inventory items used for this order */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-[#2F6FD6]" />
                <span className="text-sm font-medium text-gray-700">
                  Inventory items used
                </span>
              </div>
              <div className="space-y-1.5">
                {getExpectedUsage().map((u) => {
                  const displayName =
                    inventoryStore.getPaperSizeOptions().find(
                      (opt) => opt.name.toLowerCase() === u.size.toLowerCase(),
                    )?.displayName || u.size;
                  return (
                    <div
                      key={u.size}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm"
                    >
                      <span className="text-gray-700 capitalize">{displayName}</span>
                      <span className="font-medium text-gray-900">
                        {u.sheets} sheet{u.sheets !== 1 && "s"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                These items will be deducted from inventory.
              </p>
            </div>

            <div>
              <Label>Error usage reason</Label>
              <ZoomSafeDropdown
                label="Reason"
                value={paperFormData.reason}
                onChange={(v) => setPaperFormData((prev) => ({ ...prev, reason: v }))}
                placeholder="Select a reason..."
                className="mt-2"
                options={[
                  { value: "Printing Error", label: "Printing Error" },
                  { value: "Equipment Issue", label: "Equipment Issue" },
                  { value: "Out of Ink", label: "Out of Ink" },
                  { value: "Paper Jam", label: "Paper Jam" },
                  { value: "Misalignment", label: "Misalignment" },
                  { value: "Customer Request", label: "Customer Request" },
                  { value: "Other", label: "Other" },
                ]}
              />
            </div>

            <div>
              <Label>Wasted sheets</Label>
              <input
                type="number"
                min={0}
                value={paperFormData.wastedSheets}
                onChange={(e) =>
                  setPaperFormData((prev) => ({
                    ...prev,
                    wastedSheets: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2F6FD6] focus:outline-none"
              />
            </div>

            <p className="text-xs text-gray-500">
              No printing errors? Click <span className="font-medium">No Errors</span>.
              Otherwise pick a quick reason and the number of wasted sheets so the
              error usage is tracked. Inventory is deducted by the expected sheets
              for this order.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => confirmPaperUsage(true)}
            >
              No Errors
            </Button>
            <Button
              onClick={() => confirmPaperUsage(false)}
              disabled={!paperFormData.reason}
              className="bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
            >
              Confirm Error Usage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shop-paused override: staff can start a new print manually */}
      {pauseOverride && (
        <ConfirmationDialog
          open
          onOpenChange={(o) => { if (!o) setPauseOverride(null); }}
          onConfirm={() => {
            const target = pauseOverride;
            setPauseOverride(null);
            handleUpdateStatus(target.newStatus, target.order, { bypassPause: true });
          }}
          title="Start Printing While Paused?"
          description="New orders are on hold while the shop is paused. This job can still start."
          confirmLabel="Start Printing Anyway"
          cancelLabel="Go Back"
        />
      )}

      {/* Order Receipt Dialog */}
      {selectedOrder && (
        <OrderReceiptDialog
          open={showReceipt}
          onOpenChange={setShowReceipt}
          data={generateReceiptData(selectedOrder)}
        />
      )}
      </StaffTimeInGate>
    </Layout>
  );
}
