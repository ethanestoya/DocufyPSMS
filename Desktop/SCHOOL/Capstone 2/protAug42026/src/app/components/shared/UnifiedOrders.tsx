import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Kanban,
  LayoutDashboard,
  ShoppingCart,
  User,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Printer,
  FileText,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Package,
  LayoutGrid,
  Boxes,
  Users,
  UserPlus,
  Briefcase,
  File,
  Settings,
  Download,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { ordersStore } from "../../utils/ordersStore";
import { deductInventoryForOrder } from "../../utils/inventoryIntegration";
import { notificationStore } from "../../utils/notificationStore";
import { Card } from "../ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { FileAttachments } from "../ui/file-attachments";
import { generateInvoiceData, generateInvoiceHTML, InvoiceData } from "../../utils/invoiceUtils";

type OrderType = {
  id: string;
  customer: string;
  pages: number;
  type: string;
  notes: string;
  status:
    | "received"
    | "inQueue"
    | "printing"
    | "completed"
    | "released"
    | "canceled"
    | "onHold";
  time: string;
  paperSize: string;
  copies: number;
  submittedAt: Date;
  holdReason?: string;
  attachedFiles?: {
    name: string;
    size: string;
    type: string;
    url?: string;
  }[];
  paymentVerified?: boolean;
  paymentReferenceNumber?: string;
  orderSource: "online" | "walkin";
  orientation?: "portrait" | "landscape";
  twoSided?: "yes" | "no";
  pagesPerSheet?: "1" | "2" | "4";
  colorMode?: "bw" | "color";
  pageRange?: "all" | "specific";
  specificPages?: string;
  addons?: { name: string; quantity: number; price: number }[];
  costBreakdown?: {
    printingCost: number;
    addonsCost: number;
    total: number;
  };
  statusUpdatedAt?: Date;
  createdAt?: Date;
  lastUpdatedAt?: Date;
};

// Sample data with realistic varied timestamps
const initialOrders: OrderType[] = [
  {
    id: "ORD-001",
    customer: "Angela Bishop",
    status: "received",
    pages: 45,
    type: "B&W",
    notes: "",
    time: "8:15 am",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T08:15:00"),
    attachedFiles: [
      {
        name: "Thesis_Chapter_1.pdf",
        size: "2.4 MB",
        type: "PDF",
      },
    ],
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "bw",
    pageRange: "all",
  },
  {
    id: "ORD-002",
    customer: "Jack Sterling",
    status: "received",
    pages: 28,
    type: "Colored",
    notes: "Please rush if possible",
    time: "8:45 am",
    paperSize: "Letter",
    copies: 2,
    submittedAt: new Date("2024-04-10T08:45:00"),
    attachedFiles: [
      {
        name: "Presentation_Final.pptx",
        size: "8.1 MB",
        type: "PowerPoint",
      },
    ],
    paymentVerified: false,
    paymentReferenceNumber: "GC-20240410-002",
    orderSource: "online",
    orientation: "landscape",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
    addons: [
      { name: "Spiral Binding", quantity: 1, price: 25 },
    ],
  },
  {
    id: "ORD-003",
    customer: "Saul Goodman",
    status: "printing",
    pages: 65,
    type: "B&W",
    notes: "",
    time: "9:20 am",
    paperSize: "Legal",
    copies: 1,
    submittedAt: new Date("2024-04-10T09:20:00"),
    attachedFiles: [
      {
        name: "Legal_Brief_2024.docx",
        size: "1.2 MB",
        type: "Word",
      },
    ],
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "bw",
    pageRange: "specific",
    specificPages: "1-10, 15, 20-25",
    statusUpdatedAt: new Date("2024-04-10T10:05:00"),
  },
  {
    id: "ORD-004",
    customer: "Mark Nowell",
    status: "inQueue",
    pages: 12,
    type: "B&W",
    notes: "Staple each set",
    time: "9:35 am",
    paperSize: "A4",
    copies: 3,
    submittedAt: new Date("2024-04-10T09:35:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "bw",
    pageRange: "all",
    addons: [{ name: "Stapling", quantity: 3, price: 5 }],
    statusUpdatedAt: new Date("2024-04-10T09:50:00"),
  },
  {
    id: "ORD-005",
    customer: "Lori Bechner",
    status: "completed",
    pages: 35,
    type: "Colored",
    notes: "",
    time: "7:30 am",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T07:30:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
    statusUpdatedAt: new Date("2024-04-10T09:15:00"),
  },
  {
    id: "ORD-006",
    customer: "Emma Wilson",
    status: "released",
    pages: 20,
    type: "B&W",
    notes: "",
    time: "7:15 am",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T07:15:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "no",
    pagesPerSheet: "2",
    colorMode: "bw",
    pageRange: "all",
    statusUpdatedAt: new Date("2024-04-10T10:30:00"),
  },
  {
    id: "ORD-007",
    customer: "Mike Brown",
    status: "canceled",
    pages: 50,
    type: "Colored",
    notes: "Customer cancelled",
    time: "8:00 am",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T08:00:00"),
    paymentVerified: false,
    orderSource: "online",
    orientation: "landscape",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
    statusUpdatedAt: new Date("2024-04-10T08:30:00"),
  },
  {
    id: "ORD-008",
    customer: "Sarah Johnson",
    status: "received",
    pages: 18,
    type: "B&W",
    notes: "",
    time: "10:20 am",
    paperSize: "Letter",
    copies: 1,
    submittedAt: new Date("2024-04-10T10:20:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "bw",
    pageRange: "all",
  },
  {
    id: "ORD-009",
    customer: "Tom Baker",
    status: "completed",
    pages: 42,
    type: "Colored",
    notes: "Front page color only",
    time: "6:45 am",
    paperSize: "A4",
    copies: 2,
    submittedAt: new Date("2024-04-10T06:45:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
    addons: [{ name: "Lamination", quantity: 2, price: 15 }],
    statusUpdatedAt: new Date("2024-04-10T08:50:00"),
  },
  {
    id: "ORD-010",
    customer: "Lisa Anderson",
    status: "onHold",
    pages: 30,
    type: "Colored",
    notes: "",
    time: "8:30 am",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T08:30:00"),
    holdReason:
      "Waiting for customer to confirm paper size change",
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
    statusUpdatedAt: new Date("2024-04-10T09:00:00"),
  },
].sort(
  (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
);

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
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-cyan-100 text-cyan-700",
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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<
    | "received"
    | "inQueue"
    | "printing"
    | "completed"
    | "released"
    | "canceled"
    | "onHold"
    | null
  >(null);
  const [statusFormData, setStatusFormData] = useState({
    estimatedTime: "",
    completionTime: "",
    releaseRecipient: "",
    releaseIdNumber: "",
    cancellationReason: "",
    holdReason: "",
  });
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  // Initialize and subscribe to orders store
  useEffect(() => {
    // Initialize store with initial orders if empty
    if (ordersStore.getOrders().length === 0) {
      ordersStore.setOrders(initialOrders);
    }
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

    // Generate invoice data if order is completed or released
    if (order.status === 'completed' || order.status === 'released') {
      try {
        const invoice = generateInvoiceData({
          ...order,
          id: order.id,
          customerName: order.customer,
          date: order.submittedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          fileName: order.attachedFiles?.[0]?.name || 'document.pdf',
          status: order.status === 'completed' ? 'Completed' : order.status === 'released' ? 'Released' : order.status,
          total: `₱${((order.costBreakdown?.total || (order.pages * order.copies * (order.type === 'Colored' ? 5 : 1)))).toFixed(2)}`,
          printType: order.type,
          paymentMethod: order.orderSource === 'walkin' ? 'Cash' : 'GCash',
          paymentVerified: order.paymentVerified || false,
          colorMode: order.colorMode || (order.type === 'Colored' ? 'colored' : 'bw'),
        });
        setInvoiceData(invoice);
      } catch (error) {
        console.error('Error generating invoice:', error);
        setInvoiceData(null);
      }
    } else {
      setInvoiceData(null);
    }
  };

  const handleDownloadInvoice = () => {
    if (!invoiceData) {
      toast.error("Invoice data is not available");
      return;
    }

    const invoiceContent = generateInvoiceHTML(invoiceData);
    const blob = new Blob([invoiceContent], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${invoiceData.orderId}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Invoice downloaded successfully!");
  };

  const handleUpdateStatus = (
    newStatus:
      | "received"
      | "inQueue"
      | "printing"
      | "completed"
      | "released"
      | "canceled"
      | "onHold",
  ) => {
    if (!selectedOrder) return;

    // PAYMENT VERIFICATION LOGIC - System-wide restriction
    // Orders with unverified payment can only move to: Received, On Hold, or Canceled
    // Once in "In Queue" to "Released", payment MUST be verified
    const hasUnverifiedPayment = selectedOrder.paymentReferenceNumber && !selectedOrder.paymentVerified;

    // Check if trying to move to a status that requires payment verification
    const progressStatuses = ["inQueue", "printing", "completed", "released"];
    const isMovingToProgress = progressStatuses.includes(newStatus);

    if (hasUnverifiedPayment && isMovingToProgress) {
      setErrorMessage(
        "Payment verification is pending. This order can only be set to 'Received', 'On Hold', or 'Canceled' until payment is verified by Admin or Staff.",
      );
      return;
    }

    // Additional check: if order is already in progress statuses, payment must be verified
    const currentIsInProgress = progressStatuses.includes(selectedOrder.status);
    if (currentIsInProgress && !selectedOrder.paymentVerified) {
      // This shouldn't happen, but if it does, restrict further progress
      if (isMovingToProgress && newStatus !== selectedOrder.status) {
        setErrorMessage(
          "Payment must be verified before changing status. Please verify payment in the Payment Verification page.",
        );
        return;
      }
    }

    // Validation check before showing form (skip for completed->released and canceled/onHold)
    if (
      newStatus !== "canceled" &&
      newStatus !== "onHold" &&
      !(
        selectedOrder.status === "completed" &&
        newStatus === "released"
      )
    ) {
      const sortedOrders = [...orders].sort(
        (a, b) =>
          a.submittedAt.getTime() - b.submittedAt.getTime(),
      );
      const currentOrderIndex = sortedOrders.findIndex(
        (o) => o.id === selectedOrder.id,
      );
      const earlierOrders = sortedOrders.slice(
        0,
        currentOrderIndex,
      );

      const statusHierarchy: Record<string, number> = {
        received: 1,
        inQueue: 2,
        printing: 3,
        completed: 4,
        released: 5,
        canceled: 0,
        onHold: 0,
      };

      const newStatusLevel = statusHierarchy[newStatus];

      for (const earlierOrder of earlierOrders) {
        // SKIP ON HOLD ORDERS - They should be bypassed in queue validation
        if (earlierOrder.status === "canceled" || earlierOrder.status === "onHold") continue;

        const earlierStatusLevel =
          statusHierarchy[earlierOrder.status];

        if (earlierStatusLevel < newStatusLevel) {
          const earlierOrderPosition =
            sortedOrders.findIndex(
              (o) => o.id === earlierOrder.id,
            ) + 1;
          const currentOrderPosition = currentOrderIndex + 1;

          setErrorMessage(
            `Cannot update to "${newStatus === "inQueue" ? "In Queue" : newStatus}". Order #${currentOrderPosition} (${selectedOrder.customer}) cannot skip ahead of Order #${earlierOrderPosition} (${earlierOrder.customer}) who is still in "${earlierOrder.status === "inQueue" ? "In Queue" : earlierOrder.status}" status. Please process orders in sequence.`,
          );
          return;
        }
      }
    }

    // Auto-populate date/time fields with current date and time
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDateTime = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format

    setStatusFormData({
      estimatedTime: currentTime,
      completionTime: currentDateTime,
      releaseRecipient:
        newStatus === "released" ? selectedOrder.customer : "",
      releaseIdNumber:
        newStatus === "released" ? selectedOrder.id : "",
      cancellationReason: "",
      holdReason: "",
    });

    // Show form for status update
    setPendingStatus(newStatus);
    setShowStatusForm(true);
    setErrorMessage("");
  };

  const confirmStatusUpdate = () => {
    if (!selectedOrder || !pendingStatus) return;

    // Update the status with form data (including hold reason if applicable)
    const updatedOrders = orders.map((o) =>
      o.id === selectedOrder.id
        ? {
            ...o,
            status: pendingStatus,
            holdReason:
              pendingStatus === "onHold"
                ? statusFormData.holdReason
                : o.holdReason,
            statusUpdatedAt: new Date(), // Update timestamp
          }
        : o,
    );
    ordersStore.setOrders(updatedOrders);

    const updatedSelectedOrder = {
      ...selectedOrder,
      status: pendingStatus,
      holdReason:
        pendingStatus === "onHold"
          ? statusFormData.holdReason
          : selectedOrder.holdReason,
      statusUpdatedAt: new Date(),
    };

    setSelectedOrder(updatedSelectedOrder);

    // Regenerate invoice data if order is now completed or released
    if (pendingStatus === 'completed' || pendingStatus === 'released') {
      try {
        const invoice = generateInvoiceData({
          ...updatedSelectedOrder,
          id: updatedSelectedOrder.id,
          customerName: updatedSelectedOrder.customer,
          date: updatedSelectedOrder.submittedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          fileName: updatedSelectedOrder.attachedFiles?.[0]?.name || 'document.pdf',
          status: pendingStatus === 'completed' ? 'Completed' : 'Released',
          total: `₱${((updatedSelectedOrder.costBreakdown?.total || (updatedSelectedOrder.pages * updatedSelectedOrder.copies * (updatedSelectedOrder.type === 'Colored' ? 5 : 1)))).toFixed(2)}`,
          printType: updatedSelectedOrder.type,
          paymentMethod: updatedSelectedOrder.orderSource === 'walkin' ? 'Cash' : 'GCash',
          paymentVerified: updatedSelectedOrder.paymentVerified || false,
          colorMode: updatedSelectedOrder.colorMode || (updatedSelectedOrder.type === 'Colored' ? 'colored' : 'bw'),
        });
        setInvoiceData(invoice);
      } catch (error) {
        console.error('Error generating invoice:', error);
      }
    }

    // Send notification to customer about status update
    const statusMessages: Record<string, string> = {
      received: 'Your order has been received and is awaiting processing.',
      inQueue: 'Your order is now in the print queue.',
      printing: 'Your order is currently being printed.',
      completed: 'Your order has been completed and is ready for pickup.',
      released: 'Your order has been released.',
      onHold: `Your order has been placed on hold. Reason: ${statusFormData.holdReason || 'Please contact staff for details.'}`,
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
        recipientEmail: selectedOrder.customer,
        recipientRole: 'customer',
      }
    );

    if (pendingStatus === "completed") {
      // Deduct inventory when order is completed
      const orderDetails = {
        id: selectedOrder.id,
        pages: selectedOrder.pages,
        copies: selectedOrder.copies,
        paperSize: selectedOrder.paperSize,
        type: selectedOrder.type,
        colorMode: selectedOrder.colorMode,
        pagesPerSheet: selectedOrder.pagesPerSheet,
        addons: selectedOrder.addons,
      };

      const inventoryDeducted =
        deductInventoryForOrder(orderDetails);

      const totalPagesUsed =
        selectedOrder.pages * selectedOrder.copies;
      const reamsUsed = (totalPagesUsed / 500).toFixed(2);

      if (inventoryDeducted) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">
              Order {selectedOrder.id} completed!
            </span>
            <span className="text-sm">
              Inventory deducted: {totalPagesUsed} pages (
              {reamsUsed} reams)
            </span>
          </div>,
        );
      } else {
        toast.warning(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">
              Order {selectedOrder.id} completed!
            </span>
            <span className="text-sm">
              Warning: Some inventory items could not be
              deducted
            </span>
          </div>,
        );
      }
    } else {
      toast.success(
        `Order ${selectedOrder.id} updated to ${pendingStatus === "inQueue" ? "In Queue" : pendingStatus} successfully!`,
      );
    }

    // Reset form and close dialogs
    setShowStatusForm(false);
    setShowDialog(false); // Close Order Details dialog
    setPendingStatus(null);
    setStatusFormData({
      estimatedTime: "",
      completionTime: "",
      releaseRecipient: "",
      releaseIdNumber: "",
      cancellationReason: "",
      holdReason: "",
    });
  };

  // Helper function to categorize orders by time period
  const getTimePeriod = (date: Date) => {
    const hour = date.getHours();
    if (hour >= 6 && hour < 12)
      return "Morning (6:00 AM - 11:59 AM)";
    if (hour >= 12 && hour < 18)
      return "Afternoon (12:00 PM - 5:59 PM)";
    if (hour >= 18 && hour < 24)
      return "Evening (6:00 PM - 11:59 PM)";
    return "Late Night (12:00 AM - 5:59 AM)";
  };

  const getTimePeriodIcon = (period: string) => {
    return "";
  };

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // SYSTEM-WIDE SORTING: Sort by most recent status update (newest first)
    // This ensures orders with recent updates appear at the top
    filtered = [...filtered].sort((a, b) => {
      const aTime = a.statusUpdatedAt?.getTime() || a.submittedAt.getTime();
      const bTime = b.statusUpdatedAt?.getTime() || b.submittedAt.getTime();
      // Sort descending (newest first) - 8:02 AM appears above 8:00 AM
      return bTime - aTime;
    });

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

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (o) => o.status === statusFilter,
      );
    }

    // Only apply custom sorting if explicitly requested
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortColumn as keyof OrderType];
        let bVal = b[sortColumn as keyof OrderType];

        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();

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
    searchQuery,
    sortColumn,
    sortDirection,
    statusFilter,
  ]);

  // Group orders by time period
  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: OrderType[] } = {};

    filteredOrders.forEach((order) => {
      // Use statusUpdatedAt for grouping if available, otherwise use submittedAt
      const relevantDate = order.statusUpdatedAt || order.submittedAt;
      const period = getTimePeriod(relevantDate);
      if (!groups[period]) {
        groups[period] = [];
      }
      groups[period].push(order);
    });

    return groups;
  }, [filteredOrders]);

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
      received: orders.filter((o) => o.status === "received")
        .length,
      onHold: orders.filter((o) => o.status === "onHold")
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
      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors"
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
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-500 mt-0.5">
                Monitor and manage all print jobs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search for anything"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus-visible:ring-[#1D73EC] rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 ml-4">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Cards - 2 Rows */}
        <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "all" ? "border-[#1D73EC] bg-white border-2 border-blue-200/50" : "border-gray-100 hover:border-[#1D73EC]"}`}
            onClick={() => setStatusFilter("all")}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-[#F2F7FF] rounded-lg">
                  <LayoutGrid className="w-4 h-4 text-[#1D73EC]" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  All Orders
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {orders.length}
              </p>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "received" ? "border-purple-200 bg-purple-50" : "border-gray-100 hover:border-purple-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "received"
                  ? "all"
                  : "received",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Received
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.received}
              </p>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "inQueue" ? "border-blue-200 bg-white border-2 border-blue-200" : "border-gray-100 hover:border-blue-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "inQueue" ? "all" : "inQueue",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  In Queue
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.inQueue}
              </p>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "printing" ? "border-blue-200 bg-white border-2 border-blue-200" : "border-gray-100 hover:border-blue-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "printing"
                  ? "all"
                  : "printing",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Printer className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Printing
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.printing}
              </p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "completed" ? "border-blue-200 bg-white border-2 border-blue-200" : "border-gray-100 hover:border-blue-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "completed"
                  ? "all"
                  : "completed",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Completed
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.completed}
              </p>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "onHold" ? "border-orange-200 bg-orange-50" : "border-gray-100 hover:border-orange-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "onHold" ? "all" : "onHold",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  On Hold
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.onHold}
              </p>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "released" ? "border-gray-200 bg-gray-50" : "border-gray-100 hover:border-gray-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "released"
                  ? "all"
                  : "released",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-gray-100 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-gray-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Released
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.released}
              </p>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 ${statusFilter === "canceled" ? "border-blue-200 bg-white border-2 border-blue-200" : "border-gray-100 hover:border-blue-200"}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "canceled"
                  ? "all"
                  : "canceled",
              )
            }
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Canceled
                </p>
              </div>
              <p className="text-xl font-bold text-[#1c1f26] ml-10">
                {stats.canceled}
              </p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                    #
                  </th>
                  <SortableHeader column="customer">
                    Customer
                  </SortableHeader>
                  <SortableHeader column="id">
                    Order ID
                  </SortableHeader>
                  <SortableHeader column="submittedAt">
                    Date
                  </SortableHeader>
                  <SortableHeader column="time">
                    Time
                  </SortableHeader>
                  <SortableHeader column="type">
                    Type
                  </SortableHeader>
                  <SortableHeader column="pages">
                    Pages
                  </SortableHeader>
                  <SortableHeader column="copies">
                    Copies
                  </SortableHeader>
                  <SortableHeader column="status">
                    Status
                  </SortableHeader>
                  <SortableHeader column="orderSource">
                    Source
                  </SortableHeader>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {Object.entries(groupedOrders).map(
                  ([period, periodOrders]) => {
                    const periodStartIndex =
                      filteredOrders.findIndex(
                        (o) => o.id === periodOrders[0].id,
                      );
                    return (
                      <React.Fragment key={period}>
                        <tr className="bg-gray-50 border-y border-gray-200">
                          <td
                            colSpan={11}
                            className="px-6 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">
                                {getTimePeriodIcon(period)}
                              </span>
                              <span className="font-bold text-sm text-gray-700 uppercase tracking-wide">
                                {period}
                              </span>
                              <span className="ml-auto text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-300">
                                {periodOrders.length}{" "}
                                {periodOrders.length === 1
                                  ? "order"
                                  : "orders"}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {periodOrders.map((order, index) => {
                          // Use statusUpdatedAt if available, otherwise submittedAt
                          const displayDate = order.statusUpdatedAt || order.submittedAt;

                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100"
                              onClick={() =>
                                handleOpenDetails(order)
                              }
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="w-8 h-8 rounded-full bg-[#1D73EC] text-white flex items-center justify-center font-bold text-sm">
                                  {periodStartIndex + index + 1}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <Avatar name={order.customer} />
                                  <div>
                                    <p className="font-semibold text-sm text-[#1c1f26]">
                                      {order.customer}
                                    </p>
                                    {order.notes && (
                                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <AlertCircle className="w-3 h-3 text-orange-500" />
                                        Has notes
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {order.id}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {displayDate.toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {displayDate.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className="text-xs font-medium border-gray-200 bg-gray-50"
                                >
                                  {order.type}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {order.pages}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {order.copies}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium capitalize border ${
                                    order.status === "completed"
                                      ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                                      : order.status ===
                                          "printing"
                                        ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                                        : order.status ===
                                            "inQueue"
                                          ? "bg-white border-2 border-blue-200 text-blue-800 border-blue-200"
                                          : order.status ===
                                              "received"
                                            ? "bg-purple-50 text-purple-700 border-purple-200"
                                            : order.status ===
                                                "onHold"
                                              ? "bg-orange-50 text-orange-700 border-orange-200"
                                              : order.status ===
                                                  "canceled"
                                                ? "bg-white border-2 border-blue-200 text-red-500 border-blue-200"
                                                : "bg-gray-50 text-gray-700 border-gray-200"
                                  }`}
                                >
                                  {order.status === "inQueue"
                                    ? "In Queue"
                                    : order.status === "onHold"
                                      ? "On Hold"
                                      : order.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium ${
                                    order.orderSource === "online"
                                      ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                                      : "bg-purple-50 text-purple-700 border-purple-200"
                                  }`}
                                >
                                  {order.orderSource === "online"
                                    ? "Online"
                                    : "Walk-in"}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs hover:bg-[#1D73EC] hover:text-white hover:border-[#1D73EC] transition-colors"
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
                      </React.Fragment>
                    );
                  },
                )}
                {Object.keys(groupedOrders).length === 0 && (
                  <tr>
                    <td colSpan={11}>
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Search className="w-12 h-12 mb-3" />
                        <p className="text-sm font-medium">
                          No orders found
                        </p>
                        <p className="text-xs mt-1">
                          Try adjusting your search or filter
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Order Details Dialog - Continues in next part due to length */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#10316B] font-poppins flex items-center justify-between">
              Order Details
              <Badge
                variant="outline"
                className="text-xs bg-gray-50 font-mono"
              >
                {selectedOrder?.id}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Manage and update print job information
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="py-4 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <Avatar name={selectedOrder.customer} />
                <div className="flex-1">
                  <p className="font-bold text-[#1c1f26] text-lg">
                    {selectedOrder.customer}
                  </p>
                  <p className="text-sm text-gray-500">
                    Order placed at {selectedOrder.time}
                  </p>
                </div>
              </div>

              {/* Print Job Details Section */}
              <div className="space-y-4">
                <div className="border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-bold text-[#10316B] uppercase tracking-wider">
                    Print Job Details
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Print job details fields */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Paper Size
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.paperSize}
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Number of Copies
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.copies}
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Total Pages
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.pages}
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Order Source
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-sm font-medium ${
                        selectedOrder.orderSource === "online"
                          ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      }`}
                    >
                      {selectedOrder.orderSource === "online"
                        ? "🌐 Online"
                        : "🏪 Walk-in"}
                    </Badge>
                  </div>
                </div>

                {/* Attached Files */}
                {selectedOrder.attachedFiles &&
                  selectedOrder.attachedFiles.length > 0 && (
                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Attached Files
                      </p>
                      <FileAttachments
                        files={selectedOrder.attachedFiles}
                        orderId={selectedOrder.id}
                        showDownload={true}
                      />
                    </div>
                  )}
              </div>

              {/* Additional Information Section */}
              <div className="space-y-4">
                <div className="border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-bold text-[#10316B] uppercase tracking-wider">
                    Additional Information
                  </h3>
                </div>

                {/* Status */}
                <div className="p-4 bg-white border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Status
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-sm font-medium capitalize border ${
                      selectedOrder.status === "completed"
                        ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                        : selectedOrder.status === "printing"
                          ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                          : selectedOrder.status === "inQueue"
                            ? "bg-white border-2 border-blue-200 text-blue-800 border-blue-200"
                            : selectedOrder.status ===
                                "received"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : selectedOrder.status ===
                                  "onHold"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : selectedOrder.status ===
                                    "canceled"
                                  ? "bg-white border-2 border-blue-200 text-red-500 border-blue-200"
                                  : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    {selectedOrder.status === "inQueue"
                      ? "In Queue"
                      : selectedOrder.status === "onHold"
                        ? "On Hold"
                        : selectedOrder.status}
                  </Badge>
                </div>

                {/* Payment Status */}
                <div className="p-4 bg-white border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Payment Status
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-sm font-medium ${
                      selectedOrder.paymentVerified
                        ? "bg-white border-2 border-blue-200 text-blue-700 border-blue-200"
                        : "bg-white border-2 border-blue-200 text-yellow-700 border-blue-200"
                    }`}
                  >
                    {selectedOrder.paymentVerified
                      ? "✓ Verified"
                      : "⚠ Not Verified"}
                  </Badge>
                </div>

                {/* Hold Reason */}
                {selectedOrder.holdReason && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Hold
                      Reason
                    </p>
                    <p className="text-sm text-orange-900 leading-relaxed">
                      {selectedOrder.holdReason}
                    </p>
                  </div>
                )}

                {/* Special Instructions */}
                {selectedOrder.notes && (
                  <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Special
                      Instructions
                    </p>
                    <p className="text-sm text-blue-900 leading-relaxed">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Invoice Section - Only show when order is Completed or Released */}
              {(selectedOrder.status === 'completed' || selectedOrder.status === 'released') && invoiceData && (
                <div className="space-y-4 pt-6 border-t border-gray-200">
                  <div className="border-b border-gray-200 pb-2">
                    <h3 className="text-sm font-bold text-[#10316B] uppercase tracking-wider flex items-center justify-between">
                      <span>Invoice</span>
                      <Badge className="bg-blue-100 text-blue-700 font-mono text-xs">
                        {invoiceData.invoiceNumber}
                      </Badge>
                    </h3>
                  </div>

                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Invoice Date
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {invoiceData.date}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Total Amount
                        </p>
                        <p className="text-lg font-bold text-[#2F6FD6]">
                          {invoiceData.totalAmount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Payment Method
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {invoiceData.paymentMethod}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Payment Status
                        </p>
                        <Badge
                          className={`text-xs font-medium ${
                            invoiceData.paymentStatus === 'verified'
                              ? "bg-blue-100 text-blue-700"
                              : invoiceData.paymentStatus === 'cash'
                                ? "bg-gray-100 text-gray-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {invoiceData.paymentStatus === 'verified' ? '✓ Verified' :
                           invoiceData.paymentStatus === 'cash' ? 'Cash on Pickup' : '⚠ Pending'}
                        </Badge>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Cost Breakdown
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Printing ({invoiceData.totalPages} pages × {invoiceData.copies} copies)
                          </span>
                          <span className="font-medium text-gray-900">
                            ₱{invoiceData.costBreakdown.printingCost.toFixed(2)}
                          </span>
                        </div>
                        {invoiceData.addons.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Add-ons</span>
                            <span className="font-medium text-gray-900">
                              ₱{invoiceData.costBreakdown.addonsCost.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInvoicePreview(true)}
                      className="flex-1 border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#F2F7FF]"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Invoice
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDownloadInvoice}
                      className="flex-1 bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Update Status
                </p>

                {errorMessage && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {errorMessage}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "received"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "received"
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "hover:bg-purple-50 hover:border-purple-300"
                    }
                    onClick={() =>
                      handleUpdateStatus("received")
                    }
                  >
                    Received
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "inQueue"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "inQueue"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "hover:bg-white border-2 border-blue-200 hover:border-blue-300"
                    }
                    onClick={() =>
                      handleUpdateStatus("inQueue")
                    }
                  >
                    In Queue
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "printing"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "printing"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "hover:bg-white border-2 border-blue-200 hover:border-blue-300"
                    }
                    onClick={() =>
                      handleUpdateStatus("printing")
                    }
                  >
                    Printing
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "completed"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "completed"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "hover:bg-white border-2 border-blue-200 hover:border-blue-300"
                    }
                    onClick={() =>
                      handleUpdateStatus("completed")
                    }
                  >
                    Completed
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "onHold"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "onHold"
                        ? "bg-orange-600 hover:bg-orange-700"
                        : "hover:bg-orange-50 hover:border-orange-300"
                    }
                    onClick={() => handleUpdateStatus("onHold")}
                  >
                    On Hold
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "released"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "released"
                        ? "bg-gray-600 hover:bg-gray-700"
                        : "hover:bg-gray-50 hover:border-gray-300"
                    }
                    onClick={() =>
                      handleUpdateStatus("released")
                    }
                  >
                    Released
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      selectedOrder.status === "canceled"
                        ? "default"
                        : "outline"
                    }
                    className={
                      selectedOrder.status === "canceled"
                        ? "bg-red-600 text-white border-2 border-red-600 hover:bg-red-700"
                        : "hover:bg-red-50 border-2 border-blue-200 hover:border-red-300"
                    }
                    onClick={() =>
                      handleUpdateStatus("canceled")
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
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
              Update Status to{" "}
              {pendingStatus === "inQueue"
                ? "In Queue"
                : pendingStatus === "onHold"
                  ? "On Hold"
                  : pendingStatus}
            </DialogTitle>
            <DialogDescription>
              Fill in the required information for this status
              update
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Status Form Content */}
            {pendingStatus === "onHold" && (
              <div className="space-y-4">
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-900">
                    Put this order on hold with a reason for the
                    customer.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="holdReason">
                    Hold Reason *
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason: "Waiting for customer payment",
                        }))
                      }
                    >
                      Waiting for payment
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason: "Out of stock - awaiting supplies",
                        }))
                      }
                    >
                      Out of stock
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason: "Customer requested delay",
                        }))
                      }
                    >
                      Customer delay
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason: "Technical issue - equipment malfunction",
                        }))
                      }
                    >
                      Technical issue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason: "Awaiting customer approval",
                        }))
                      }
                    >
                      Awaiting approval
                    </Button>
                  </div>
                  <Textarea
                    id="holdReason"
                    placeholder="Enter the reason for hold..."
                    value={statusFormData.holdReason}
                    onChange={(e) =>
                      setStatusFormData((prev) => ({
                        ...prev,
                        holdReason: e.target.value,
                      }))
                    }
                    rows={3}
                    required
                  />
                </div>
              </div>
            )}

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
              variant="outline"
              onClick={() => setShowStatusForm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusUpdate}
              className={
                pendingStatus === "onHold"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : pendingStatus === "canceled"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
              }
              disabled={
                (pendingStatus === "canceled" &&
                  !statusFormData.cancellationReason) ||
                (pendingStatus === "onHold" &&
                  !statusFormData.holdReason)
              }
            >
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Invoice Preview - {invoiceData?.orderId || selectedOrder?.id}
            </DialogTitle>
            <DialogDescription>
              View and download invoice for order {invoiceData?.orderId || selectedOrder?.id}
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
                      Payment Status:
                    </span>
                    <Badge
                      className={
                        invoiceData.paymentStatus === 'verified'
                          ? "bg-blue-100 text-blue-700"
                          : invoiceData.paymentStatus === 'cash'
                            ? "bg-gray-100 text-gray-700"
                            : "bg-yellow-100 text-yellow-700"
                      }
                    >
                      {invoiceData.paymentStatus === 'verified' ? '✓ Verified' :
                       invoiceData.paymentStatus === 'cash' ? 'Cash on Pickup' : '⚠ Pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-semibold text-gray-600">
                      Order Source:
                    </span>
                    <Badge
                      className={
                        invoiceData.orderSource === 'online'
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }
                    >
                      {invoiceData.orderSource === 'online' ? 'Online' : 'Walk-in'}
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
              onClick={() => setShowInvoicePreview(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleDownloadInvoice}
              className="bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
