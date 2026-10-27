import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Smartphone,
  Banknote,
  Check,
  X,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import { FilterLabel } from "../ui/filter-label";
import { SummaryCard } from "../ui/summary-card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { dataStore } from "../../utils/dataStore";
import { notificationStore } from "../../utils/notificationStore";
import { auditLogStore } from "../../utils/auditLogStore";
import { verifyPayment, rejectPayment, confirmCashPayment } from "../../../lib/db/paymentsRepo";
import { showDbError } from "../../../lib/db/errors";
import { BUCKETS, getSignedObjectUrl } from "../../../lib/db/storage";
import { pricingStore } from "../../utils/pricingStore";
import { formatPHTime, formatPHDate, formatPHDateTime, toPHTKey, todayPHTKey } from "../../utils/pht";
import { formatCurrency } from "../../utils/formatNumber";
import {
  paymentMethodsStore,
} from "../../utils/paymentMethodsStore";
import {
  getLock,
  claimLock,
  releaseLock,
  verifyLockOnServer,
  subscribeToLocks,
  holdLockWhileOpen,
} from "../../utils/orderLocks";
import { useAuth } from "../../contexts/AuthContext";
import { PaymentDeadlineCountdown } from "./PaymentDeadlineCountdown";
import { StartHereTag, PriorityBadge } from "../ui/priority-badge";

// --- Types ---

type PaymentType = {
  id: string;
  orderId: string;
  // Human-facing ORD-0001 form; consumers display `displayId ?? orderId`.
  displayId?: string;
  customer: string;
  amount: number;
  method: string;
  status: "pending" | "verified" | "rejected";
  submittedAt: Date;
  // When the payment was actually verified (staff/admin approval), not when the
  // customer submitted it — "Verified Today" must count by this, otherwise an
  // order submitted last week and approved this morning is never counted.
  verifiedAt?: Date;
  time: string;
  reference?: string;
  proofImageUrl?: string;
  // Raw storage path of the uploaded proof (private `payment-proofs` bucket);
  // used to sign the image URL at read time.
  proofStoragePath?: string;
  // Payment-kind-aware fields (see generatePaymentsFromOrders):
  //  - cash       → Cash on Pickup: paid at the shop, Amount to Pay + Deadline
  //  - online     → Online payment (full amount, incl. high-value orders)
  //  - online-down→ Online down payment (Total / Paid / Remaining Balance)
  //  downTier     → marks a CASH order in the down-payment range (₱50–99): the
  //                 customer chose "Pay at the Shop", so staff verify what was
  //                 paid (50% down or Full) at the counter before queuing.
  kind: "cash" | "online" | "online-down";
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  deadline?: string;
  fullPaymentRequired?: boolean;
  downPaymentRequired?: boolean;
  canceled?: boolean;
  expired?: boolean;
  cancellationReason?: string;
  downTier?: boolean;
  downPaymentAmount?: number;
  // Low-value Cash on Pickup order (total under the down-payment threshold):
  // auto-queued at checkout, so it shows as "Pending Payment · In Queue" with
  // no reference number / proof of payment to review.
  isLowValueCash?: boolean;
  // The DB `payments` row id for this order's latest submission (present for
  // online/down payments the customer submitted; absent for cash at the shop).
  rowId?: string;
};

// Status filters. Every summary card and every Status option maps to exactly
// one of these.
type StatusFilter =
  | "all"
  | "pending"
  | "verified"
  | "verifiedToday"
  | "closed"
  | "cancelled"
  | "expired";

// ONE predicate per filter, used by BOTH the count on the card and the list
// itself, so a card can never report 3 and then show 2 rows.
function matchesStatusFilter(
  payment: PaymentType,
  filter: StatusFilter,
  todayKey: string,
): boolean {
  switch (filter) {
    case "pending":
      return payment.status === "pending";
    case "verified":
      return payment.status === "verified";
    case "verifiedToday":
      return (
        payment.status === "verified" &&
        toPHTKey(payment.verifiedAt ?? payment.submittedAt) === todayKey
      );
    case "cancelled":
      return payment.status === "rejected" && !payment.expired;
    case "expired":
      return payment.status === "rejected" && payment.expired === true;
    case "closed":
      return payment.status === "rejected";
    case "all":
    default:
      return true;
  }
}

function parseOrderTotal(order: {
  total?: string;
  fullPaymentRequired?: boolean;
  fullPaymentAmount?: number;
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
}): number {
  return parseFloat((order.total || '₱0').replace('₱', '').replace(',', ''));
}

const SAMPLE_PROOF_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UGF5bWVudCBQcm9vZiBTY3JlZW5zaG90PC90ZXh0Pjwvc3ZnPg==";

// Helper function to generate payments from orders
// SYSTEM-WIDE: This pulls data directly from dataStore to ensure sync with Order List
function generatePaymentsFromOrders(): PaymentType[] {
  const orders = dataStore.getOrders();

  // Show ALL orders in payment verification, not just GCash
  return orders
    .map((order, index) => {
      const orderDate = order.statusUpdatedAt ? new Date(order.statusUpdatedAt) : new Date(order.date);
      const totalAmount = parseOrderTotal(order);

      // Determine status based on paymentVerified field (SINGLE SOURCE OF TRUTH)
      // A payment only shows "Verified" once staff/admin actually approves it.
      // Everything else (cash-on-pickup, GCash, down payment) stays "Pending"
      // until verified, so an unverified customer submission never auto-verifies.
      let paymentStatus: "pending" | "verified" | "rejected" = "pending";
      if (order.paymentVerified === true) {
        paymentStatus = "verified";
      } else if (order.status === 'Canceled') {
        paymentStatus = "rejected";
      }
      const canceled = order.status === 'Canceled';
      const expired = canceled && /deadline|expired?/i.test(order.cancellationReason || '');

      // Determine payment method from order (display name stored on the order)
      const paymentMethod = order.paymentMethod
        ? order.paymentMethod
        : order.orderSource === "walkin"
          ? "Cash"
          : "GCash";

      // Payment-kind-aware display: which amount column means what.
      const isCashOnPickup = paymentMethod === "Cash";
      const kind: PaymentType["kind"] = isCashOnPickup
        ? "cash"
        : order.downPaymentRequired
          ? "online-down"
          : "online";

      // Cash down-tier order: a customer order in the 50%-down range paid at
      // the shop ("Pay at the Shop" on the Down Payment Method page). The order
      // stays on hold until staff verifies at the counter — with a 50% / Full
      // choice — before it enters the queue. Walk-in orders are already fully
      // paid/queued, so they are NOT treated as down-tier.
      const pricing = pricingStore.getPricing();
      const downTier =
        isCashOnPickup &&
        order.orderSource !== "walkin" &&
        totalAmount >= pricing.downPaymentThreshold &&
        totalAmount < pricing.fullPaymentThreshold;

      // For online payments the customer reports the amount they paid; for
      // down payments that's the down-payment amount, for full payments the
      // full amount (falling back to the required amount when not recorded).
      const amountPaid = isCashOnPickup
        ? 0
        : order.paymentAmountPaid !== undefined
          ? order.paymentAmountPaid
          : order.fullPaymentRequired
            ? (order.fullPaymentAmount ?? totalAmount)
            : order.downPaymentRequired
              ? (order.downPaymentAmount ?? totalAmount * 0.5)
              : totalAmount;
      const remainingBalance = Math.max(0, totalAmount - amountPaid);

      // Low-value Cash on Pickup order (below the down-payment threshold) —
      // these are auto-queued at checkout with the cash collected on pickup.
      const isLowValueCash =
        isCashOnPickup &&
        totalAmount < pricing.downPaymentThreshold;

      return {
        id: order.id,
        orderId: order.id,
        displayId: order.displayId,
        rowId: order.paymentRowId,
        customer: order.customerName,
        amount: totalAmount,
        method: paymentMethod,
        status: paymentStatus,
        submittedAt: orderDate,
        verifiedAt: order.paymentVerifiedAt
          ? new Date(order.paymentVerifiedAt)
          : undefined,
        time: formatPHTime(orderDate).toLowerCase(),
        reference: order.paymentReferenceNumber || (isCashOnPickup ? 'Cash on Pickup' : ''),
        proofImageUrl: order.paymentProofUrl || SAMPLE_PROOF_IMAGE,
        proofStoragePath: order.proofStoragePath,
        kind,
        totalAmount,
        amountPaid,
        remainingBalance,
        deadline: order.paymentDeadline,
        fullPaymentRequired: order.fullPaymentRequired,
        downPaymentRequired: order.downPaymentRequired,
        canceled,
        expired,
        cancellationReason: order.cancellationReason,
        isLowValueCash,
        downTier,
        downPaymentAmount:
          order.downPaymentAmount ?? (downTier ? totalAmount * 0.5 : undefined),
      };
    })
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

// --- Main Component ---

interface UnifiedPaymentVerificationProps {
  menuItems: any[];
  userRole: 'admin' | 'staff';
}

export default function UnifiedPaymentVerification({ menuItems, userRole }: UnifiedPaymentVerificationProps) {
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<PaymentType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentType | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const hydrating = useHydrating();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "cash" | "online" | "online-down"
  >("all");
  const [methodFilter, setMethodFilter] = useState<"all" | string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRejectDialog, setShowRejectDialog] =
    useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showProofImage, setShowProofImage] = useState(false);
  // Resolved signed URL for the proof image currently being previewed. The
  // payment-proofs bucket is private, so the public URL stored on the order
  // won't load — we sign it when the preview opens.
  const [proofSignedUrl, setProofSignedUrl] = useState<string | undefined>(undefined);
  const [pendingVerifyAction, setPendingVerifyAction] = useState<
    "verified" | "rejected" | null
  >(null);
  // Cash down-tier verify choice: what amount did the customer actually pay at
  // the shop? "down" = 50% (matches plan), "full" = paid the full amount.
  const [verifyAmountChoice, setVerifyAmountChoice] = useState<"down" | "full">("down");

  // Pagination
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const { user } = useAuth();
  const myName = user?.name || "Staff";

  // Resolve the proof image's signed URL when the preview opens (private bucket).
  useEffect(() => {
    if (!showProofImage || !selectedPayment?.proofStoragePath) {
      setProofSignedUrl(undefined);
      return;
    }
    let cancelled = false;
    setProofSignedUrl(undefined);
    getSignedObjectUrl(BUCKETS.paymentProofs, selectedPayment.proofStoragePath).then(
      (url) => {
        if (!cancelled) setProofSignedUrl(url ?? undefined);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [showProofImage, selectedPayment]);

  // Session lock awareness: a badge tick that re-renders whenever lock state
  // changes (in THIS tab or another — see orderLocks.ts). Used to show who is
  // "viewing" an order and to disable Confirm while someone else holds the lock.
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

  // The current lock for the order being viewed (null if none / expired).
  const selectedLock = selectedPayment ? getLock(selectedPayment.orderId) : null;
  // Name of whoever holds it (could be a different tab / different user).
  const lockHolder = selectedLock?.heldBy ?? null;
  // Do WE hold it right now?
  const iHoldLock = !!selectedLock && selectedLock.heldBy === myName;

  // HEARTBEAT: while our details dialog is open on an actionable row, keep
  // renewing OUR lock so it persists for as long as we keep viewing — it never
  // vanishes mid-review. A dead tab stops beating and expires on its own.
  //
  // The renewal used to be conditional on `stillHoldsLock()`, so the FIRST time
  // the hold lapsed (a tab backgrounded or frozen past the TTL) the beat went
  // quiet for good and the reviewer's own dialog turned read-only on return.
  // `holdLockWhileOpen` renews unconditionally and re-asserts the hold when the
  // tab/window is looked at again, which is safe because claim never steals a
  // live lock from someone else.
  useEffect(() => {
    if (
      !selectedPayment ||
      !showDialog ||
      !(selectedPayment.status === "pending" || selectedPayment.status === "rejected")
    ) {
      return;
    }
    return holdLockWhileOpen(selectedPayment.orderId, myName);
  }, [
    selectedPayment?.id,
    selectedPayment?.orderId,
    selectedPayment?.status,
    showDialog,
    myName,
  ]);

  // Load payments from dataStore
  useEffect(() => {
    const loadPayments = () => {
      setPayments(generatePaymentsFromOrders());
    };

    loadPayments();
    const unsubscribe = dataStore.subscribe(loadPayments);
    return unsubscribe;
  }, []);

  // Re-render whenever payment methods are added/edited (QR + account details)
  const [, setMethodsTick] = useState(0);
  useEffect(() => {
    const unsubscribe = paymentMethodsStore.subscribe(() =>
      setMethodsTick((t) => t + 1),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId || payments.length === 0) return;

    const payment = payments.find((item) => item.orderId === orderId);
    if (payment) {
      setStatusFilter("all");
      setSelectedPayment(payment);
      // Auto-claim when arriving via deep link (e.g. from a notification).
      if (payment.status === "pending" || payment.status === "rejected") {
        const existing = getLock(payment.orderId);
        if (existing && existing.heldBy !== myName) {
          toast.info(`${existing.heldBy} is viewing this order`);
        } else {
          claimLock(payment.orderId, myName);
        }
      }
      setShowDialog(true);
    }
  }, [payments, searchParams, myName]);

  const handleVerifyPayment = async (
    status: "verified" | "rejected",
  ): Promise<boolean> => {
    if (selectedPayment) {
      // ===== SESSION LOCK GUARD =====
      // Re-check ownership at the FINAL confirm moment (a second machine might
      // have claimed the order after we opened the modal). Only the lock holder
      // may act. We verify against the SERVER — the `claim_order_lock` RPC made
      // the claim atomic, and this confirms we still hold it — falling back to
      // the local mirror only when the backend is unreachable.
      if (!(await verifyLockOnServer(selectedPayment.orderId, myName))) {
        const other = getLock(selectedPayment.orderId);
        toast.error(other ? `${other.heldBy} is currently viewing this order` : "This order is no longer available", {
          description: "Only the current reviewer can verify. Refresh to see the latest status.",
        });
        return false;
      }

      // ===== CONFLICT GUARD (Option B) =====
      // Defensive re-read: if someone already verified/rejected this order in
      // another tab while we were looking, abort before writing.
      const orderRecords = dataStore.getOrders();
      const latestOrder = orderRecords.find(
        (o) => o.id === selectedPayment.orderId,
      );
      if (latestOrder && latestOrder.paymentVerified) {
        toast.error("This payment has already been verified", {
          description: "Refresh the page to see the latest status.",
        });
        releaseLock(selectedPayment.orderId, myName);
        setShowDialog(false);
        return false;
      }

      const targetOrder = orderRecords.find(
        (o) => o.id === selectedPayment.orderId,
      );

      // === CASH DOWN-TIER VERIFICATION (Pay at the Shop) ===
      // The staff member confirmed what was actually paid: 50% or Full.
      // If "full" was paid → clear down flags, set fullPaymentRequired +
      // fullPaymentVerified so the order is treated as fully paid online.
      // If "down" (50%) was paid → keep downPaymentRequired +
      // downPaymentVerified true; the balance is collected at pickup.
      const isCashDown =
        selectedPayment.method === "Cash" && (selectedPayment.downTier ?? false);
      const paidFull = isCashDown && verifyAmountChoice === "full";
      const verified = status === "verified";

      dataStore.updateOrder(selectedPayment.orderId, {
        paymentVerified: verified,
        downPaymentVerified: verified
          ? isCashDown
            ? !paidFull
            : true
          : undefined,
        fullPaymentVerified:
          verified && (paidFull || !!targetOrder?.fullPaymentRequired),
        // Cash down-tier ("Pay at the Shop"): rewrite the planned-amount flags
        // to match what was actually paid at the counter (50% vs Full). Other
        // kinds leave the checkout-time flags untouched.
        downPaymentRequired:
          isCashDown && verified ? !paidFull : undefined,
        downPaymentAmount:
          isCashDown && verified && !paidFull
            ? (selectedPayment.downPaymentAmount ?? selectedPayment.totalAmount * 0.5)
            : undefined,
        fullPaymentRequired:
          isCashDown && verified && paidFull ? true : undefined,
        fullPaymentAmount:
          isCashDown && verified && paidFull ? selectedPayment.totalAmount : undefined,
        paymentReferenceNumber: selectedPayment.reference,
        paymentDeadline: undefined,
        // Auto-update order status to "In Queue" when payment is verified so
        // the order enters the queue automatically — UNLESS this is a
        // low-value Cash on Pickup order that was already auto-queued at
        // checkout. Those orders may have progressed to "Printing" by the
        // time staff verifies, so we must NOT reset them back to "In Queue".
        ...(verified && !selectedPayment.isLowValueCash
          ? { status: "In Queue" as const }
          : {}),
      });

      // ===== PAYMENTS TABLE WRITE =====
      // Record the outcome in the `payments` table (audit + reporting).
      // Online/down orders already have a customer-submitted PENDING row, so
      // we flip it to verified/rejected. Cash-at-the-shop orders have no row,
      // so verification creates a VERIFIED cash payment record.
      try {
        if (status === "verified") {
          if (selectedPayment.rowId) {
            await verifyPayment({
              paymentId: selectedPayment.rowId,
              orderId: selectedPayment.orderId,
              verifiedBy: user?.id ?? null,
            });
          } else {
            const collected = isCashDown
              ? !paidFull
                ? (selectedPayment.downPaymentAmount ?? selectedPayment.totalAmount * 0.5)
                : selectedPayment.totalAmount
              : selectedPayment.totalAmount;
            await confirmCashPayment({
              orderId: selectedPayment.orderId,
              methodName: "Cash",
              amount: collected,
              verifiedBy: user?.id ?? null,
              note: isCashDown
                ? paidFull
                  ? "Paid full amount at the shop"
                  : "Paid 50% down at the shop"
                : "Cash collected at the shop",
            });
          }
        } else if (selectedPayment.rowId) {
          await rejectPayment({
            paymentId: selectedPayment.rowId,
            rejectedBy: user?.id ?? null,
            reason: rejectionReason.trim() || "Rejected",
          });
        }
      } catch (err) {
        showDbError("saving the verification", err);
        // Keep the dialog open + keep our lock so the reviewer can retry.
        return false;
      }

      // Audit the verification outcome — who approved/rejected which payment.
      const paymentOrderLabel = targetOrder?.displayId ?? selectedPayment.orderId;
      auditLogStore.record({
        module: "Payments",
        action: status === "verified" ? "Approved" : "Rejected",
        reference: `Order #${paymentOrderLabel}`,
        entityType: "Payment",
        entityId: selectedPayment.rowId ?? selectedPayment.orderId,
        title: status === "verified" ? "Payment Verified" : "Payment Rejected",
        description:
          status === "verified"
            ? isCashDown
              ? `The cash payment for order #${paymentOrderLabel} was confirmed at the shop (${paidFull ? "full amount" : "50% down"}) and the order entered the print queue.`
              : `The payment for order #${paymentOrderLabel} was verified and the order entered the print queue.`
            : `The payment for order #${paymentOrderLabel} was rejected. Reason: ${rejectionReason.trim() || "Rejected"}.`,
        changes: [
          {
            field: "Payment Status",
            previous: "Pending",
            next: status === "verified" ? "Verified" : "Rejected",
          },
        ],
      });

      // Notify the customer about the verification outcome (skips walk-ins /
      // orders without a customer email). Rendered by both the admin and staff
      // copies of this page — one insertion covers both roles.
      if (targetOrder?.customerEmail) {
        const orderLabel = targetOrder?.displayId ?? selectedPayment.orderId;
        if (status === "verified") {
          notificationStore.addNotification(
            "payment",
            "Payment Verified",
            `Your payment for order #${orderLabel} has been verified — your order is now in the print queue.`,
            {
              clickable: true,
              relatedOrderId: selectedPayment.orderId,
              relatedRoute: `/customer/track/${selectedPayment.orderId}`,
              recipientEmail: targetOrder.customerEmail,
            },
          );
        } else {
          notificationStore.addNotification(
            "payment",
            "Payment Rejected",
            `Your payment for order #${orderLabel} was rejected. Reason: ${rejectionReason.trim() || "Rejected"}. Please update your payment details or contact Docufy for assistance.`,
            {
              clickable: true,
              priority: "important",
              relatedOrderId: selectedPayment.orderId,
              relatedRoute: `/customer/payment/${selectedPayment.orderId}`,
              recipientEmail: targetOrder.customerEmail,
            },
          );
        }
      }

      // The order is processed — release our hold so it's free for anyone.
      releaseLock(selectedPayment.orderId, myName);

      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPayment.id ? { ...p, status } : p,
        ),
      );
      setSelectedPayment({ ...selectedPayment, status });
      toast.success(
        status === "verified"
          ? "Payment verified! Order has been added to the queue."
          : `Payment marked as ${status}`
      );

      // Close dialog after verification
      setShowDialog(false);
      return true;
    }
    return false;
  };

  const handleOpenDetails = (payment: PaymentType) => {
    setSelectedPayment(payment);
    // Default the cash down-tier verify choice to the customer's plan
    // (50% = downPaymentRequired, Full = already full) — staff can override
    // with what was actually paid at the shop.
    if (payment.method === "Cash" && (payment.downTier ?? false)) {
      setVerifyAmountChoice(payment.downPaymentRequired ? "down" : "full");
    }
    // Auto-claim the lock when opening the details (only for actionable rows).
    // NOTE (backend later): this claim must be written to the shared
    // session_locks table / broadcast over realtime so OTHER machines see it,
    // not just this tab's localStorage.
    const existing = getLock(payment.orderId);
    if (payment.status === "pending" || payment.status === "rejected") {
      if (existing && existing.heldBy !== myName) {
        toast.info(`${existing.heldBy} is viewing this order`, {
          description: "You can review it, but only the current reviewer can verify.",
        });
      } else {
        claimLock(payment.orderId, myName);
      }
    }
    setShowDialog(true);
  };

  // One key for "today" shared by the filters and the card counts.
  const todayKey = todayPHTKey();

  const filteredPayments = payments
    .filter((p) => {
      const query = searchQuery.toLowerCase();
      if (
        query &&
        !p.id.toLowerCase().includes(query) &&
        !p.customer.toLowerCase().includes(query) &&
        !p.reference?.toLowerCase().includes(query)
      )
        return false;
      if (!matchesStatusFilter(p, statusFilter, todayKey)) return false;
      if (typeFilter === "cash" && p.kind !== "cash") return false;
      if (typeFilter === "online" && p.kind !== "online") return false;
      if (typeFilter === "online-down" && p.kind !== "online-down")
        return false;
      if (methodFilter !== "all" && p.method !== methodFilter)
        return false;
      if (dateFrom && p.submittedAt.getTime() < new Date(`${dateFrom}T00:00:00`).getTime())
        return false;
      if (dateTo && p.submittedAt.getTime() > new Date(`${dateTo}T23:59:59.999`).getTime())
        return false;
      return true;
    })
    .sort((a, b) => {
      // AUTOMATIC FIFO (verification order): pending items first, oldest
      // first, so the next payment to verify always sits at the top;
      // verified/rejected follow newest-first for convenience.
      const rank: Record<PaymentType["status"], number> = {
        pending: 0,
        verified: 1,
        rejected: 2,
      };
      const aRank = rank[a.status];
      const bRank = rank[b.status];
      if (aRank !== bRank) return aRank - bRank;
      if (a.status === "pending" && b.status === "pending") {
        return a.submittedAt.getTime() - b.submittedAt.getTime();
      }
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });

  // Reset to page 1 whenever filters change so the user always lands at the start
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, methodFilter, dateFrom, dateTo]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE)),
    [filteredPayments],
  );
  const paginatedPayments = useMemo(
    () =>
      filteredPayments.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredPayments, currentPage],
  );

  // VERIFICATION SEQUENCE: pending payments ranked oldest-first (FIFO). The
  // numbers staff see (1, 2, 3...) are the order in which payments should be
  // verified — the first pending record is always "next to verify".
  const pendingSequenceById = useMemo(() => {
    const map = new Map<string, number>();
    const pending = payments
      .filter((p) => p.status === "pending")
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    pending.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [payments]);
  const nextToVerifyId = useMemo(() => {
    const pending = payments
      .filter((p) => p.status === "pending")
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    return pending[0]?.id;
  }, [payments]);

  // Distinct payment methods present in the list (for the Method filter)
  const methodsInList = useMemo(
    () => Array.from(new Set(payments.map((p) => p.method))).sort(),
    [payments],
  );

  // Counts are derived from the SAME predicate each card filters by, so a card
  // can never advertise a number the list does not produce.
  const stats = {
    pending: payments.filter((p) =>
      matchesStatusFilter(p, "pending", todayKey),
    ).length,
    verifiedToday: payments.filter((p) =>
      matchesStatusFilter(p, "verifiedToday", todayKey),
    ).length,
    closed: payments.filter((p) =>
      matchesStatusFilter(p, "closed", todayKey),
    ).length,
    totalVerifiedToday: payments
      .filter((p) => matchesStatusFilter(p, "verifiedToday", todayKey))
      .reduce((sum, p) => sum + p.amount, 0),
  };

  // The empty state must say WHY the list is empty — "no payments to verify"
  // is wrong when the list is empty because of a filter, not because there is
  // nothing to do.
  const narrowedByHand =
    searchQuery.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    typeFilter !== "all" ||
    methodFilter !== "all";

  const emptyState = (() => {
    if (narrowedByHand) {
      return {
        title: "No payments match these filters",
        body: "Try a different search, date range, type or method.",
      };
    }
    switch (statusFilter) {
      case "pending":
        return {
          title: "No payments to verify",
          body: "Payment records appear here when customers place orders.",
        };
      case "verifiedToday":
        return {
          title: "Nothing verified today",
          body: "Payments you verify today will be listed here.",
        };
      case "verified":
        return {
          title: "No verified payments yet",
          body: "Payments appear here once they have been verified.",
        };
      case "closed":
        return {
          title: "No cancelled or expired payments",
          body: "Cancelled orders and payments past their deadline appear here.",
        };
      case "cancelled":
        return {
          title: "No cancelled payments",
          body: "Orders cancelled by a customer or by staff appear here.",
        };
      case "expired":
        return {
          title: "No expired payments",
          body: "Orders that ran past their payment deadline appear here.",
        };
      default:
        return {
          title: "No payments found",
          body: "There are no payment records yet.",
        };
    }
  })();

  return (
    <Layout menuItems={menuItems} title="Payment Verification" showBackButton>
      <StaffTimeInGate>
        <div className="flex flex-col h-full max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#1c1f26]">
              Payment Verification
            </h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Review and verify customer payments
            </p>
          </div>
        </div>

        {/* Summary Cards — every card that shows a count filters the list; the
            money total is display-only and deliberately does not look clickable. */}
        <div className="grid grid-cols-2 @min-[1100px]:grid-cols-4 gap-3 mb-4 shrink-0">
          <SummaryCard
            label="Pending Verification"
            value={stats.pending}
            icon={Clock}
            active={statusFilter === "pending"}
            onClick={() =>
              setStatusFilter((f) => (f === "pending" ? "all" : "pending"))
            }
          />
          <SummaryCard
            label="Verified Today"
            value={stats.verifiedToday}
            icon={CheckCircle}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            active={statusFilter === "verifiedToday"}
            onClick={() =>
              setStatusFilter((f) =>
                f === "verifiedToday" ? "all" : "verifiedToday",
              )
            }
          />
          <SummaryCard
            label="Cancelled"
            value={stats.closed}
            icon={XCircle}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            active={statusFilter === "closed"}
            onClick={() =>
              setStatusFilter((f) => (f === "closed" ? "all" : "closed"))
            }
          />
          <SummaryCard
            highlight
            label="Total Verified Today"
            value={`₱${stats.totalVerifiedToday.toLocaleString()}`}
            icon={Banknote}
          />
        </div>

        {/* Payment Filter & Search bar */}
        <Card className="p-4 border border-slate-100 shadow-sm mb-4 shrink-0">
          <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-end gap-4">
            <div className="w-full lg:flex-1 lg:min-w-[200px]">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</Label>
              <div className="group relative mt-1.5">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                <Input
                  aria-label="Search payments"
                  placeholder="Search by customer, order ID, or reference..."
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
            <div className="w-full lg:w-48">
              <FilterLabel applied={statusFilter !== "pending"}>Status</FilterLabel>
              <ZoomSafeDropdown
                label="Payment status"
                className="mt-1.5"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                applied={statusFilter !== "pending"}
                options={[
                  { value: "pending",       label: "Pending" },
                  { value: "verifiedToday", label: "Verified Today" },
                  { value: "verified",      label: "Verified (all time)" },
                  { value: "closed",        label: "Cancelled / Expired" },
                  { value: "cancelled",     label: "Cancelled" },
                  { value: "expired",       label: "Expired" },
                  { value: "all",           label: "All Statuses" },
                ]}
              />
            </div>
            <div className="w-full lg:w-48">
              <FilterLabel applied={typeFilter !== "all"}>Type</FilterLabel>
              <ZoomSafeDropdown
                label="Payment type"
                className="mt-1.5"
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as typeof typeFilter)}
                applied={typeFilter !== "all"}
                options={[
                  { value: "all",         label: "All Types" },
                  { value: "cash",        label: "Cash on Pickup" },
                  { value: "online",      label: "Full Payment" },
                  { value: "online-down", label: "Down Payment" },
                ]}
              />
            </div>
            {methodsInList.length > 0 && (
              <div className="w-full lg:w-48">
                <FilterLabel applied={methodFilter !== "all"}>Method</FilterLabel>
                <ZoomSafeDropdown
                  label="Payment method"
                  className="mt-1.5"
                  value={methodFilter}
                  onChange={setMethodFilter}
                  applied={methodFilter !== "all"}
                  options={[
                    { value: "all", label: "All Methods" },
                    ...methodsInList.map((m) => ({ value: m, label: m })),
                  ]}
                />
              </div>
            )}
            <div className="flex-none self-end">
              <Button
                variant="outline"
                className="h-9 border border-[#D5DCE6] bg-white text-[#64748B] hover:border-[#B7C3D4] hover:bg-[#FCFDFF] hover:text-[#475467] hover:translate-y-0 hover:shadow-none"
                onClick={() => {
                  setSearchQuery("");
                  setDateFrom("");
                  setDateTo("");
                  setStatusFilter("pending");
                  setTypeFilter("all");
                  setMethodFilter("all");
                }}
              >
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Payments Table */}
        <Card className="flex-1 border border-gray-200/80 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          {hydrating ? (
            <TableSkeleton columns={7} rows={10} />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider w-24">
                    #
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Payment Type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#10316B] uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <CreditCard className="mx-auto mb-3 h-10 w-10 text-[#1668D9]/35" />
                      <p className="text-sm font-semibold text-gray-500">{emptyState.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{emptyState.body}</p>
                    </td>
                  </tr>
                ) : paginatedPayments.map((payment, index) => {
                  const isNext =
                    payment.status === "pending" &&
                    payment.id === nextToVerifyId;
                  const priority = pendingSequenceById.get(payment.id);
                  // Live lock for this row (recomputed on every locksTick).
                  const rowLock = getLock(payment.orderId);
                  const rowLockedByMe = !!rowLock && rowLock.heldBy === myName;
                  return (
                  <tr
                    key={payment.id}
                    className="hover:bg-[#F2F7FF]/60 transition-colors cursor-pointer group"
                    onClick={() => handleOpenDetails(payment)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <div className="flex flex-col items-center gap-1">
                        {payment.status === "pending" ? (
                          <>
                            <PriorityBadge
                              number={priority ?? index + 1}
                              active={isNext}
                            />
                            {isNext && (
                              <StartHereTag label="Next to Verify" />
                            )}
                          </>
                        ) : payment.status === "verified" ? (
                          <span className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-green-50 text-green-600 shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-red-50 text-red-500 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={payment.customer} />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-[#1c1f26]">
                            {payment.customer}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {payment.displayId ?? payment.orderId}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {formatPHDate(payment.submittedAt, "short")} ·{" "}
                            <span className="font-semibold text-gray-800">
                              {payment.time}
                            </span>
                          </p>
                          {rowLock && (
                            <span
                              title={
                                rowLockedByMe
                                  ? "You are reviewing this order"
                                  : `${rowLock.heldBy} is reviewing this order`
                              }
                              className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${
                                rowLockedByMe ? "text-green-600" : "text-amber-600"
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              {rowLockedByMe ? "Reviewing (you)" : `${rowLock.heldBy} is viewing`}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PaymentTypePill kind={payment.kind} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        {payment.method !== "Cash" ? (
                          <Smartphone className="w-3.5 h-3.5 text-[#1668D9]" />
                        ) : (
                          <Banknote className="w-3.5 h-3.5 text-gray-500" />
                        )}
                        {payment.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {payment.kind === "cash" ? (
                        <div className="leading-tight">
                          <p className="text-sm font-bold text-[#1c1f26]">
                            ₱{payment.totalAmount.toLocaleString()}
                          </p>
                          {payment.downTier ? (
                            <>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                Down payment tier — pay at shop
                              </p>
                              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                                ₱{(payment.downPaymentAmount ?? payment.totalAmount * 0.5).toLocaleString()} down · ₱{payment.remainingBalance.toLocaleString()} on pickup
                              </p>
                            </>
                          ) : (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Amount to pay at shop
                            </p>
                          )}
                          {payment.deadline && (
                            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                              Due {formatPHDateTime(payment.deadline)}
                            </p>
                          )}
                        </div>
                      ) : payment.kind === "online-down" ? (
                        <div className="leading-tight">
                          <p className="text-sm font-bold text-[#1c1f26]">
                            ₱{payment.totalAmount.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Paid ₱{payment.amountPaid.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                            Balance ₱{payment.remainingBalance.toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <div className="leading-tight">
                          <p className="text-sm font-bold text-[#1c1f26]">
                            ₱{payment.totalAmount.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Paid ₱{payment.amountPaid.toLocaleString()}
                            <span className="text-green-600 font-semibold">
                              {" "}· Fully paid
                            </span>
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge
                        status={payment.status}
                        canceled={payment.canceled}
                        expired={payment.expired}
                        lowValueCash={payment.isLowValueCash}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs text-gray-600 border-gray-200 hover:border-transparent hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-white">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {totalPages === 1
                  ? filteredPayments.length
                  : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredPayments.length)}`}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{filteredPayments.length}</span>{" "}
              payment{filteredPayments.length === 1 ? "" : "s"}
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

      {/* Payment Details Dialog */}
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            // Release OUR hold when this details modal closes (reviewer done,
            // or closed via X / Reject flow). ONLY releases our own lock —
            // a different reviewer holding it is left untouched. The lock then
            // expires on its own if a tab dies without cleanup.
            if (selectedPayment) releaseLock(selectedPayment.orderId, myName);
            setShowDialog(false);
          } else {
            setShowDialog(true);
          }
        }}
      >
<DialogContent className="sm:max-w-[520px] max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="flex-row items-center justify-between gap-3 px-5 pt-5 pb-0 pr-12">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="text-lg font-semibold text-[#1c1f26]">
                Payment Details
              </DialogTitle>
              <Badge
                variant="outline"
                className="shrink-0 rounded-md border-gray-200 bg-gray-100 px-1.5 py-px font-mono text-xs font-medium text-gray-600"
              >
                {selectedPayment?.displayId ?? selectedPayment?.orderId}
              </Badge>
            </div>
            <DialogDescription className="sr-only">
              Review and verify payment information
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <>
              <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5">
                {/* Who submitted it, when, and the one status chip */}
                <div className="flex items-center gap-3">
                  <Avatar name={selectedPayment.customer} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[#1c1f26]">
                      {selectedPayment.customer}
                    </p>
                    <p className="mt-0.5 text-[13px] text-gray-500">
                      Submitted{" "}
                      {formatPHDate(selectedPayment.submittedAt, "short")} ·{" "}
                      {formatPHTime(selectedPayment.submittedAt)}
                    </p>
                  </div>
                  <StatusBadge
                    status={selectedPayment.status}
                    canceled={selectedPayment.canceled}
                    expired={selectedPayment.expired}
                    lowValueCash={selectedPayment.isLowValueCash}
                    className="shrink-0"
                  />
                </div>

                {/* The amount is the anchor of the screen */}
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      {selectedPayment.method === "Cash"
                        ? "Amount to collect"
                        : "Amount paid"}
                    </p>
                    <p className="mt-1 flex items-baseline gap-0.5 text-3xl font-bold tabular-nums text-[#1c1f26]">
                      <span className="text-xl font-semibold text-gray-600">₱</span>
                      {selectedPayment.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <PaymentTypePill kind={selectedPayment.kind} />
                </div>

                {/* Everything else is one quiet label/value list */}
                <dl className="mt-3 divide-y divide-gray-100">
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-[13px] text-gray-500">Payment method</dt>
                    <dd className="text-[13px] font-medium text-[#1c1f26]">
                      {selectedPayment.method}
                    </dd>
                  </div>

                  {selectedPayment.method === "Cash"
                    ? !selectedPayment.isLowValueCash && (
                        <div className="flex items-center justify-between gap-4 py-2.5">
                          <dt className="text-[13px] text-gray-500">
                            Reference number
                          </dt>
                          <dd className="text-[13px] text-gray-400">
                            Not required for cash
                          </dd>
                        </div>
                      )
                    : selectedPayment.reference && (
                        <div className="flex items-center justify-between gap-4 py-2.5">
                          <dt className="text-[13px] text-gray-500">
                            Reference number
                          </dt>
                          <dd className="font-mono text-[13px] font-medium tracking-wide text-[#1c1f26]">
                            {selectedPayment.reference}
                          </dd>
                        </div>
                      )}

                  {selectedPayment.method !== "Cash" &&
                    (() => {
                      const methodDetails =
                        paymentMethodsStore.findByName(selectedPayment.method);
                      if (
                        !methodDetails?.accountName &&
                        !methodDetails?.accountNumber
                      ) {
                        return null;
                      }
                      return (
                        <div className="flex items-start justify-between gap-4 py-2.5">
                          <dt className="text-[13px] text-gray-500">Paid to</dt>
                          <dd className="text-right text-[13px] font-medium text-[#1c1f26]">
                            {methodDetails?.accountName || selectedPayment.method}
                            {methodDetails?.accountNumber && (
                              <span className="mt-0.5 block text-xs font-normal text-gray-400">
                                {methodDetails.accountNumber}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })()}

                  {selectedPayment.proofImageUrl && (
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-[13px] text-gray-500">
                        Proof of payment
                      </dt>
                      <dd>
                        <button
                          type="button"
                          onClick={() => setShowProofImage(true)}
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2F6FD6] hover:underline"
                        >
                          View screenshot
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Cash down-tier: what did the customer actually pay at the shop? */}
                {selectedPayment.method === "Cash" &&
                  (selectedPayment.downTier ?? false) &&
                  (selectedPayment.status === "pending" ||
                    selectedPayment.status === "rejected") && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <p className="mb-1 text-sm font-semibold text-[#1c1f26]">
                        Cash down payment — how much was paid at the shop?
                      </p>
                      <p className="mb-3 text-xs text-gray-500">
                        This order is in the down-payment range. Confirm what
                        the customer actually paid at the counter. The balance
                        ({formatCurrency(
                          selectedPayment.totalAmount -
                            (selectedPayment.downPaymentAmount ?? selectedPayment.totalAmount * 0.5),
                        )}) is collected on pickup if only the 50% down was paid.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setVerifyAmountChoice("down")}
                          className={`flex-1 min-w-[140px] rounded-lg border-2 px-4 py-2.5 text-left transition-all ${
                            verifyAmountChoice === "down"
                              ? "border-[#2F6FD6] bg-white"
                              : "border-gray-200 bg-white/50 hover:border-gray-300"
                          }`}
                        >
                          <p className="text-xs text-gray-500">
                            Paid 50% Down
                          </p>
                          <p className="font-bold text-gray-900">
                            ₱
                            {(
                              selectedPayment.downPaymentAmount ??
                              selectedPayment.totalAmount * 0.5
                            ).toLocaleString()}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerifyAmountChoice("full")}
                          className={`flex-1 min-w-[140px] rounded-lg border-2 px-4 py-2.5 text-left transition-all ${
                            verifyAmountChoice === "full"
                              ? "border-[#2F6FD6] bg-white"
                              : "border-gray-200 bg-white/50 hover:border-gray-300"
                          }`}
                        >
                          <p className="text-xs text-gray-500">
                            Paid Full Amount
                          </p>
                          <p className="font-bold text-gray-900">
                            ₱{selectedPayment.totalAmount.toLocaleString()}
                          </p>
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              {/* Sticky action footer: lock state, then the two actions */}
              <div className="flex flex-col gap-2.5 border-t border-gray-200 bg-white px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:py-3">
                {(() => {
                  const actionable =
                    selectedPayment.status === "pending" ||
                    selectedPayment.status === "rejected";
                  if (!actionable) {
                    return (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 sm:mr-auto">
                        <Unlock className="h-3 w-3" />
                        Read-only — this order is already processed
                      </p>
                    );
                  }
                  if (iHoldLock) {
                    return (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 sm:mr-auto">
                        <Lock className="h-3 w-3" />
                        Only you can verify this order
                      </p>
                    );
                  }
                  if (lockHolder) {
                    return (
                      <p className="flex items-center gap-1.5 text-xs text-amber-700 sm:mr-auto">
                        <Eye className="h-3 w-3" />
                        {lockHolder} is reviewing this order
                      </p>
                    );
                  }
                  return (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500 sm:mr-auto">
                      <Lock className="h-3 w-3" />
                      This order is available
                    </p>
                  );
                })()}

                {(selectedPayment.status === "pending" ||
                  selectedPayment.status === "rejected") && (
                  <div className="flex items-center gap-2">
                    {selectedPayment.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!iHoldLock}
                        title={
                          !iHoldLock && lockHolder
                            ? `${lockHolder} is reviewing this order`
                            : undefined
                        }
                        onClick={() => {
                          setShowDialog(false);
                          setShowRejectDialog(true);
                        }}
                        className="h-9 flex-1 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 hover:text-red-600 hover:-translate-y-0 hover:shadow-none sm:flex-none"
                      >
                        <XCircle />
                        Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      data-primary-action
                      disabled={!iHoldLock}
                      title={
                        !iHoldLock && lockHolder
                          ? `${lockHolder} is reviewing this order`
                          : undefined
                      }
                      onClick={() => setPendingVerifyAction("verified")}
                      className="h-9 flex-1 rounded-lg bg-[#2F6FD6] text-[13px] font-medium text-white hover:bg-[#2557b8] hover:-translate-y-0 hover:shadow-none sm:flex-none"
                    >
                      <CheckCircle />
                      Verify payment
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
      >
        <DialogContent className="sm:max-w-[500px] font-poppins border-none">
          <DialogHeader>
            <DialogTitle className="text-[#10316B] font-bold">
              Reject Payment
            </DialogTitle>
            <DialogDescription className="font-medium text-gray-500">
              Please provide a reason for rejecting this
              payment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label
              htmlFor="rejection-reason"
              className="text-[#10316B] font-semibold mb-2 block"
            >
              Rejection Reason
            </Label>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                onClick={() =>
                  setRejectionReason("Invalid reference number")
                }
              >
                Invalid reference number
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                onClick={() =>
                  setRejectionReason("Payment amount mismatch")
                }
              >
                Amount mismatch
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                onClick={() =>
                  setRejectionReason("Unclear payment proof - please resubmit with clearer image")
                }
              >
                Unclear proof
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                onClick={() =>
                  setRejectionReason("Duplicate payment submission")
                }
              >
                Duplicate submission
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                onClick={() =>
                  setRejectionReason("Payment not found in system")
                }
              >
                Not found
              </Button>
            </div>
            <Textarea
              id="rejection-reason"
              placeholder="Enter the reason for rejection..."
              value={rejectionReason}
              onChange={(e) =>
                setRejectionReason(e.target.value)
              }
              className="min-h-[120px] bg-[#F2F7FF]/50 border-[#1668D9]/10 focus:bg-white focus:border-[#1668D9] rounded-lg resize-none font-medium"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              className="font-semibold text-[#10316B] border-[#1668D9]/20"
            >
              Cancel
            </Button>
            <Button
              className="border-2 border-[#1668D9]/30 text-[#1668D9] hover:bg-[#1668D9] hover:text-white font-bold"
              onClick={() => {
                if (!rejectionReason.trim())
                  return toast.error("Please provide a reason");
                setPendingVerifyAction("rejected");
              }}
            >
              <XCircle className="w-4 h-4 mr-2" /> Confirm
              Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof Preview */}
      <Dialog
        open={showProofImage}
        onOpenChange={setShowProofImage}
      >
        <DialogContent className="max-w-4xl font-poppins border-none">
          <DialogHeader>
            <DialogTitle className="font-bold text-[#10316B]">
              Payment Proof
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              View uploaded payment proof image
            </DialogDescription>
          </DialogHeader>
          <img
            src={proofSignedUrl || selectedPayment?.proofImageUrl}
            alt="Proof"
            className="w-full h-auto rounded-lg border border-[#1668D9]/10"
          />
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowProofImage(false)}
className="font-semibold border-2 border-[#1668D9]/30 text-[#1668D9] hover:bg-[#1668D9] hover:text-white transition-all"
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verify Payment Confirmation */}
      {pendingVerifyAction === "verified" && selectedPayment && (
        <ConfirmationDialog
          open
          onOpenChange={() => setPendingVerifyAction(null)}
          onConfirm={async () => {
            const ok = await handleVerifyPayment("verified");
            if (ok) {
              setShowDialog(false);
              setPendingVerifyAction(null);
            }
          }}
          title="Verify Payment?"
          description="Confirm that this payment has been reviewed and approved."
          confirmLabel="Verify Payment"
          cancelLabel="Go Back"
          destructive={false}
          loadingText="Verifying..."
          closeOnConfirm={false}
        />
      )}
      {pendingVerifyAction === "rejected" && selectedPayment && (
        <ConfirmationDialog
          open
          onOpenChange={() => setPendingVerifyAction(null)}
          onConfirm={async () => {
            const ok = await handleVerifyPayment("rejected");
            if (ok) {
              setShowRejectDialog(false);
              setRejectionReason("");
              setPendingVerifyAction(null);
            }
          }}
          title="Reject Payment?"
          description={`Confirm that this payment should be rejected${
            rejectionReason.trim() ? ` (${rejectionReason.trim()})` : ""
          }.`}
          confirmLabel="Reject Payment"
          cancelLabel="Go Back"
          destructive
          requirePhrase
          loadingText="Rejecting..."
          closeOnConfirm={false}
        />
      )}
      </StaffTimeInGate>
    </Layout>
  );
}

// --- Helper Components ---

function StatusBadge({
  status,
  canceled,
  expired,
  className,
  lowValueCash,
}: {
  status: string;
  canceled?: boolean;
  expired?: boolean;
  className?: string;
  lowValueCash?: boolean;
}) {
  const isPending = status === "pending";
  const label =
    status === "verified"
      ? "Verified"
      : isPending
        ? lowValueCash
          ? "Pending Payment"
          : "Pending"
        : expired
          ? "Expired"
          : canceled
            ? "Cancelled"
            : "Rejected";
  const styles =
    status === "verified"
      ? "bg-green-50 text-green-700 border-green-200"
      : isPending
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={`text-[11px] font-semibold py-0.5 px-2 rounded-full border ${styles} ${className}`}
      >
        {label}
      </Badge>
      {isPending && lowValueCash && (
        <Badge
          variant="outline"
          className="text-[10px] font-semibold py-0.5 px-1.5 rounded-full border bg-blue-50 text-[#1668D9] border-blue-200"
        >
          In Queue
        </Badge>
      )}
    </span>
  );
}

function PaymentTypePill({
  kind,
}: {
  kind: PaymentType["kind"];
}) {
  const config =
    kind === "cash"
      ? {
          label: "Cash on Pickup",
          cls: "bg-blue-50 text-[#1668D9] border-blue-200",
          icon: Banknote,
        }
      : kind === "online-down"
        ? {
            label: "Down Payment",
            cls: "bg-amber-50 text-amber-700 border-amber-200",
            icon: Smartphone,
          }
        : {
            label: "Full Payment",
            cls: "bg-green-50 text-green-700 border-green-200",
            icon: Smartphone,
          };
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium py-0.5 px-2 rounded-full border inline-flex items-center gap-1 ${config.cls}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

const Avatar = ({ name }: { name: string }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[#F2F7FF] text-[#1668D9] border border-[#1668D9]/10">
      {initials}
    </div>
  );
};
