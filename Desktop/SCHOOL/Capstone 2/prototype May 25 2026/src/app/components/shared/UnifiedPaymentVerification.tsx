import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Smartphone,
  Banknote,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
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
import { dataStore } from "../../utils/dataStore";

// --- Types ---

type PaymentType = {
  id: string;
  orderId: string;
  customer: string;
  amount: number;
  method: "GCash" | "Cash";
  status: "pending" | "verified" | "rejected";
  submittedAt: Date;
  time: string;
  reference?: string;
  proofImageUrl?: string;
};

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
      const totalAmount = parseFloat(order.total.replace('₱', '').replace(',', ''));

      // Determine status based on paymentVerified field (SINGLE SOURCE OF TRUTH)
      let paymentStatus: "pending" | "verified" | "rejected" = "pending";
      if (order.paymentVerified === true) {
        paymentStatus = "verified";
      } else if (order.status === 'Canceled') {
        paymentStatus = "rejected";
      } else if (order.paymentMethod === 'Cash' || order.paymentMethod === 'cash') {
        // Cash payments are auto-verified since they pay on pickup
        paymentStatus = "verified";
      } else if (order.paymentReferenceNumber && !order.paymentVerified) {
        paymentStatus = "pending";
      }

      // Determine payment method from order
      const paymentMethod = (order.paymentMethod?.toLowerCase() === 'cash' ? 'Cash' : 'GCash') as "GCash" | "Cash";

      return {
        id: `PAY-${order.id.split('-')[1]}`,
        orderId: order.id,
        customer: order.customerName,
        amount: totalAmount,
        method: paymentMethod,
        status: paymentStatus,
        submittedAt: orderDate,
        time: orderDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
        reference: order.paymentReferenceNumber || (paymentMethod === 'Cash' ? 'Cash on Pickup' : `GC-${order.id.split('-')[1]}`),
        proofImageUrl: order.paymentProofUrl || SAMPLE_PROOF_IMAGE,
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
  const [payments, setPayments] = useState<PaymentType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentType | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<string>("all");
  const [showRejectDialog, setShowRejectDialog] =
    useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showProofImage, setShowProofImage] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Load payments from dataStore
  useEffect(() => {
    const loadPayments = () => {
      setPayments(generatePaymentsFromOrders());
    };

    loadPayments();
    const unsubscribe = dataStore.subscribe(loadPayments);
    return unsubscribe;
  }, []);

  const handleVerifyPayment = (
    status: "verified" | "rejected",
  ) => {
    if (selectedPayment) {
      // SYSTEM-WIDE SYNC: Update the actual order in dataStore
      // This ensures Order List and Payment Verification are connected
      dataStore.updateOrder(selectedPayment.orderId, {
        paymentVerified: status === "verified",
        paymentReferenceNumber: selectedPayment.reference,
        // Auto-update order status to "In Queue" when payment is verified
        ...(status === "verified" ? { status: "In Queue" as const } : {}),
      });

      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPayment.id ? { ...p, status } : p,
        ),
      );
      setSelectedPayment({ ...selectedPayment, status });
      toast.success(
        status === "verified"
          ? "Payment verified and order moved to In Queue"
          : `Payment marked as ${status}`
      );

      // Close dialog after verification
      setShowDialog(false);
    }
  };

  const handleOpenDetails = (payment: PaymentType) => {
    setSelectedPayment(payment);
    setShowDialog(true);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleStatusFilterCycle = () => {
    const statuses = ["all", "pending", "verified", "rejected"];
    const currentIndex = statuses.indexOf(statusFilter);
    const nextIndex = (currentIndex + 1) % statuses.length;
    setStatusFilter(statuses[nextIndex]);
  };

  const filteredPayments = payments
    .filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter)
        return false;
      const query = searchQuery.toLowerCase();
      return (
        p.id.toLowerCase().includes(query) ||
        p.customer.toLowerCase().includes(query) ||
        p.reference?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;

      let aVal: any = a[sortColumn as keyof PaymentType];
      let bVal: any = b[sortColumn as keyof PaymentType];

      if (sortColumn === "submittedAt") {
        aVal = a.submittedAt.getTime();
        bVal = b.submittedAt.getTime();
      } else if (sortColumn === "time") {
        aVal = a.submittedAt.getTime();
        bVal = b.submittedAt.getTime();
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const stats = {
    pending: payments.filter((p) => p.status === "pending")
      .length,
    verified: payments.filter((p) => p.status === "verified")
      .length,
    rejected: payments.filter((p) => p.status === "rejected")
      .length,
    totalAmount: payments
      .filter((p) => p.status === "verified")
      .reduce((sum, p) => sum + p.amount, 0),
  };

  return (
    <Layout menuItems={menuItems} title="Payment Verification" showBackButton>
      <div className="flex flex-col h-full max-w-[1800px] mx-auto font-poppins">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-[#1c1f26]">
              Payment Verification
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Review and verify customer payments
            </p>
          </div>

          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-200 focus-visible:ring-[#1D73EC] rounded-lg h-10 text-sm font-medium"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6 shrink-0">
          <SummaryCard
            label="All Transactions"
            value={payments.length}
            icon={<CreditCard />}
            isActive={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            type="blue"
          />
          <SummaryCard
            label="Pending"
            value={stats.pending}
            icon={<Clock />}
            isActive={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
            type="blue"
          />
          <SummaryCard
            label="Verified"
            value={stats.verified}
            icon={<CheckCircle />}
            isActive={statusFilter === "verified"}
            onClick={() => setStatusFilter("verified")}
            type="blue"
          />
          <SummaryCard
            label="Rejected"
            value={stats.rejected}
            icon={<XCircle />}
            isActive={statusFilter === "rejected"}
            onClick={() => setStatusFilter("rejected")}
            type="blue"
          />
          <Card className="p-5 border-2 border-gray-100 bg-[#1D73EC] text-white shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium mb-0.5">
                  Total Verified
                </p>
                <p className="text-2xl font-bold">
                  ₱{stats.totalAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="flex-1 border-none shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F2F7FF] border-b border-[#1D73EC]/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Payment ID
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Order ID
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => handleSort("submittedAt")}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortColumn === "submittedAt" && (
                        sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => handleSort("time")}
                  >
                    <div className="flex items-center gap-1">
                      Time
                      {sortColumn === "time" && (
                        sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Amount
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={handleStatusFilterCycle}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {statusFilter !== "all" && (
                        <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full ml-1">
                          {statusFilter}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#10316B] uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#F2F7FF]">
                {filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-[#F2F7FF]/50 transition-colors cursor-pointer group"
                    onClick={() => handleOpenDetails(payment)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar name={payment.customer} />
                        <p className="text-sm font-semibold text-[#1c1f26]">
                          {payment.customer}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-[#10316B]">
                        {payment.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {payment.orderId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {payment.submittedAt.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {payment.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className="text-xs font-medium border-[#1D73EC]/20 bg-[#F2F7FF] py-1 text-[#1D73EC]"
                      >
                        {payment.method === "GCash" ? (
                          <Smartphone
                            size={12}
                            className="mr-1 inline"
                          />
                        ) : (
                          <Banknote
                            size={12}
                            className="mr-1 inline"
                          />
                        )}
                        {payment.method}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-[#1c1f26]">
                        ₱{payment.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs hover:bg-[#1D73EC] hover:text-white transition-colors h-8 border-[#1D73EC] text-[#1D73EC]"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Payment Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto border-none">
          <DialogHeader>
            <DialogTitle className="text-[#10316B] font-poppins flex items-center justify-between pr-6">
              <span>Payment Details</span>
              <Badge
                variant="outline"
                className="text-xs bg-[#F2F7FF] text-[#1D73EC] border-[#1D73EC]/20 font-mono"
              >
                {selectedPayment?.id}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Review and verify payment information
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="py-4 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-[#F2F7FF] rounded-xl border border-[#1D73EC]/10">
                <Avatar name={selectedPayment.customer} />
                <div className="flex-1">
                  <p className="font-bold text-[#1c1f26] text-lg">
                    {selectedPayment.customer}
                  </p>
                  <p className="text-sm text-gray-500">
                    Payment submitted at {selectedPayment.time}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-[#F2F7FF] rounded-xl col-span-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Verification Status
                  </p>
                  <StatusBadge
                    status={selectedPayment.status}
                    className="text-sm"
                  />
                </div>

                <div className="p-4 bg-white border border-[#F2F7FF] rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Order ID
                  </p>
                  <p className="font-semibold text-[#1c1f26]">
                    {selectedPayment.orderId}
                  </p>
                </div>

                <div className="p-4 bg-white border border-[#F2F7FF] rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Payment Method
                  </p>
                  <p className="font-semibold text-[#1D73EC]">
                    {selectedPayment.method}
                  </p>
                </div>

                <div className="p-4 bg-white border border-[#F2F7FF] rounded-xl col-span-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Amount to Verify
                  </p>
                  <p className="text-2xl font-bold text-[#1D73EC]">
                    ₱{selectedPayment.amount.toLocaleString()}
                  </p>
                </div>

                {selectedPayment.reference && (
                  <div className="p-4 bg-white border-2 border-[#1D73EC]/10 rounded-xl col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[#1D73EC] uppercase tracking-wider flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4" /> GCash
                        Reference Number
                      </p>
                      {selectedPayment.proofImageUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setShowProofImage(true)
                          }
                          className="text-[#1D73EC] border-[#1D73EC]/20 hover:bg-[#F2F7FF] h-7"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />{" "}
                          View Proof
                        </Button>
                      )}
                    </div>
                    <p className="text-sm font-mono font-semibold text-[#10316B]">
                      {selectedPayment.reference}
                    </p>
                  </div>
                )}
              </div>

              {selectedPayment.status === "pending" && (
                <div className="pt-4 border-t border-[#F2F7FF]">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Verification Action
                  </p>
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-[#1D73EC] hover:bg-[#10316B] text-white shadow-none"
                      onClick={() => {
                        handleVerifyPayment("verified");
                        setShowDialog(false);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Payment
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-[#1D73EC]/20 text-[#10316B] hover:bg-gray-50"
                      onClick={() => {
                        setShowDialog(false);
                        setShowRejectDialog(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Payment
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
              className="min-h-[120px] bg-[#F2F7FF]/50 border-[#1D73EC]/10 focus:bg-white focus:border-[#1D73EC] rounded-lg resize-none font-medium"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              className="font-semibold text-[#10316B] border-[#1D73EC]/20"
            >
              Cancel
            </Button>
            <Button
              className="bg-[#1D73EC] hover:bg-[#10316B] text-white font-bold shadow-none"
              onClick={() => {
                if (!rejectionReason.trim())
                  return toast.error("Please provide a reason");
                handleVerifyPayment("rejected");
                setShowRejectDialog(false);
                setRejectionReason("");
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
            src={selectedPayment?.proofImageUrl}
            alt="Proof"
            className="w-full h-auto rounded-lg border border-[#1D73EC]/10"
          />
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowProofImage(false)}
              className="font-semibold border-[#1D73EC] text-[#1D73EC] hover:bg-[#F2F7FF]"
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// --- Helper Components ---

function SummaryCard({
  label,
  value,
  icon,
  isActive,
  onClick,
}: any) {
  return (
    <Card
      className={`p-5 cursor-pointer transition-all border-2 shadow-none ${
        isActive
          ? "border-[#1D73EC] bg-[#F2F7FF]"
          : "border-gray-100 hover:border-[#1D73EC]/30 bg-white"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2.5 rounded-lg ${
            isActive
              ? "bg-[#1D73EC] text-white"
              : "bg-[#F2F7FF] text-[#1D73EC]"
          }`}
        >
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-0.5">
            {label}
          </p>
          <p className="text-2xl font-bold text-[#10316B]">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const styles: any = {
    verified: "bg-[#F2F7FF] text-[#1D73EC] border-[#1D73EC]/20",
    pending: "bg-white text-[#10316B] border-gray-200",
    rejected:
      "bg-white text-[#10316B] border-gray-10 opacity-60",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs font-semibold capitalize py-1 ${styles[status]} ${className}`}
    >
      {status}
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
    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm bg-[#F2F7FF] text-[#1D73EC] border border-[#1D73EC]/10">
      {initials}
    </div>
  );
};
