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

const menuItems = [
  {
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Payment Verification",
    path: "/admin/payment-verification",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: "Orders",
    path: "/admin/orders",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Inventory",
    path: "/admin/inventory",
    icon: <Boxes className="w-5 h-5" />,
  },
  {
    label: "Staff",
    path: "/admin/staff",
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: "Reports",
    path: "/admin/reports",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/admin/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    label: "Content Management",
    path: "/admin/content",
    icon: <Settings className="w-5 h-5" />,
  },
];

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

const initialOrders: OrderType[] = [
  {
    id: "ORD-001",
    customer: "Angela Bishop",
    status: "inQueue",
    pages: 45,
    type: "B&W",
    notes: "",
    time: "2:45 pm",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T14:45:00"),
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
    status: "inQueue",
    pages: 28,
    type: "Colored",
    notes: "Please rush if possible",
    time: "2:50 pm",
    paperSize: "Letter",
    copies: 2,
    submittedAt: new Date("2024-04-10T14:50:00"),
    attachedFiles: [
      {
        name: "Presentation_Final.pptx",
        size: "8.1 MB",
        type: "PowerPoint",
      },
    ],
    paymentVerified: false,
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
    time: "3:00 pm",
    paperSize: "Legal",
    copies: 1,
    submittedAt: new Date("2024-04-10T15:00:00"),
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
  },
  {
    id: "ORD-004",
    customer: "Mark Nowell",
    status: "inQueue",
    pages: 12,
    type: "B&W",
    notes: "Staple each set",
    time: "3:05 pm",
    paperSize: "A4",
    copies: 3,
    submittedAt: new Date("2024-04-10T15:05:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "bw",
    pageRange: "all",
    addons: [{ name: "Stapling", quantity: 3, price: 5 }],
  },
  {
    id: "ORD-005",
    customer: "Lori Bechner",
    status: "completed",
    pages: 35,
    type: "Colored",
    notes: "",
    time: "1:30 pm",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T13:30:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
  },
  {
    id: "ORD-006",
    customer: "Emma Wilson",
    status: "released",
    pages: 20,
    type: "B&W",
    notes: "",
    time: "1:15 pm",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T13:15:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "no",
    pagesPerSheet: "2",
    colorMode: "bw",
    pageRange: "all",
  },
  {
    id: "ORD-007",
    customer: "Mike Brown",
    status: "canceled",
    pages: 50,
    type: "Colored",
    notes: "Customer cancelled",
    time: "2:00 pm",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T14:00:00"),
    paymentVerified: false,
    orderSource: "online",
    orientation: "landscape",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
  },
  {
    id: "ORD-008",
    customer: "Sarah Johnson",
    status: "received",
    pages: 18,
    type: "B&W",
    notes: "",
    time: "3:20 pm",
    paperSize: "Letter",
    copies: 1,
    submittedAt: new Date("2024-04-10T15:20:00"),
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
    time: "12:45 pm",
    paperSize: "A4",
    copies: 2,
    submittedAt: new Date("2024-04-10T12:45:00"),
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "no",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
    addons: [{ name: "Lamination", quantity: 2, price: 15 }],
  },
  {
    id: "ORD-010",
    customer: "Lisa Anderson",
    status: "onHold",
    pages: 30,
    type: "Colored",
    notes: "",
    time: "2:30 pm",
    paperSize: "A4",
    copies: 1,
    submittedAt: new Date("2024-04-10T14:30:00"),
    holdReason:
      "Waiting for customer to confirm paper size change",
    paymentVerified: true,
    orderSource: "online",
    orientation: "portrait",
    twoSided: "yes",
    pagesPerSheet: "1",
    colorMode: "color",
    pageRange: "all",
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

export default function AdminOrders() {
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
        if (earlierOrder.status === "canceled") continue;
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
          }
        : o,
    );
    ordersStore.setOrders(updatedOrders);

    setSelectedOrder({
      ...selectedOrder,
      status: pendingStatus,
      holdReason:
        pendingStatus === "onHold"
          ? statusFormData.holdReason
          : selectedOrder.holdReason,
    });

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

    // Reset form
    setShowStatusForm(false);
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
      const period = getTimePeriod(order.submittedAt);
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
                  <SortableHeader column="statusUpdatedAt">
                    Last Updated (Date)
                  </SortableHeader>
                  <SortableHeader column="statusUpdatedAt">
                    Last Updated (Time)
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
                            colSpan={13}
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
                        {periodOrders.map((order, index) => (
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
                              {order.submittedAt.toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {order.submittedAt.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {order.statusUpdatedAt
                                ? order.statusUpdatedAt.toLocaleDateString()
                                : order.submittedAt.toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {order.statusUpdatedAt
                                ? order.statusUpdatedAt.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : order.submittedAt.toLocaleTimeString('en-US', {
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
                        ))}
                      </React.Fragment>
                    );
                  },
                )}
                {Object.keys(groupedOrders).length === 0 && (
                  <tr>
                    <td colSpan={13}>
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

      {/* Order Details Dialog */}
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
                  {/* 1. Paper Size */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Paper Size
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.paperSize}
                    </p>
                  </div>

                  {/* 2. Number of Copies */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Number of Copies
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.copies}
                    </p>
                  </div>

                  {/* 3. Orientation */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Orientation
                    </p>
                    <p className="font-semibold text-[#1c1f26] capitalize">
                      {selectedOrder.orientation || "Portrait"}
                    </p>
                  </div>

                  {/* 4. Two-Sided Printing */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Two-Sided Printing
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.twoSided === "yes"
                        ? "Yes (Double-Sided)"
                        : "No (Single-Sided)"}
                    </p>
                  </div>

                  {/* 5. Pages per Sheet */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Pages per Sheet
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.pagesPerSheet || "1"} page
                      {selectedOrder.pagesPerSheet !== "1" &&
                      selectedOrder.pagesPerSheet !== undefined
                        ? "s"
                        : ""}{" "}
                      per sheet
                    </p>
                  </div>

                  {/* 6. Color Mode */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Color Mode
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.colorMode === "bw" ||
                      !selectedOrder.colorMode
                        ? "Black & White"
                        : "Color"}
                    </p>
                  </div>

                  {/* 7. Page Range */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Page Range
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.pageRange === "all" ||
                      !selectedOrder.pageRange
                        ? "All Pages"
                        : `Pages: ${selectedOrder.specificPages || ""}`}
                    </p>
                  </div>

                  {/* 8. Total Pages */}
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Total Pages
                    </p>
                    <p className="font-semibold text-[#1c1f26]">
                      {selectedOrder.pages}
                    </p>
                  </div>
                </div>

                {/* Document Analysis Results */}
                {selectedOrder.colorAnalysis && (
                  <div className="bg-blue-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Document
                      Analysis Results
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">
                          Color Pages Detected
                        </p>
                        <p className="font-bold text-purple-700 text-lg">
                          {
                            selectedOrder.colorAnalysis
                              .colorPages.length
                          }{" "}
                          pages
                        </p>
                        {selectedOrder.colorAnalysis.colorPages
                          .length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Pages:{" "}
                            {selectedOrder.colorAnalysis.colorPages
                              .slice(0, 10)
                              .join(", ")}
                            {selectedOrder.colorAnalysis
                              .colorPages.length > 10 &&
                              ` +${selectedOrder.colorAnalysis.colorPages.length - 10} more`}
                          </p>
                        )}
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">
                          B&W Pages Detected
                        </p>
                        <p className="font-bold text-gray-700 text-lg">
                          {
                            selectedOrder.colorAnalysis.bwPages
                              .length
                          }{" "}
                          pages
                        </p>
                        {selectedOrder.colorAnalysis.bwPages
                          .length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Pages:{" "}
                            {selectedOrder.colorAnalysis.bwPages
                              .slice(0, 10)
                              .join(", ")}
                            {selectedOrder.colorAnalysis.bwPages
                              .length > 10 &&
                              ` +${selectedOrder.colorAnalysis.bwPages.length - 10} more`}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedOrder.colorAnalysis.colorPages
                      .length > 0 && (
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Color Intensity Breakdown
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {selectedOrder.colorAnalysis.colorPages
                            .slice(0, 9)
                            .map((page) => (
                              <div
                                key={page}
                                className="flex justify-between items-center bg-purple-50 px-2 py-1 rounded"
                              >
                                <span className="text-gray-700">
                                  Page {page}:
                                </span>
                                <span className="font-semibold text-purple-700">
                                  {
                                    selectedOrder.colorAnalysis!
                                      .colorPercentages[page]
                                  }
                                  %
                                </span>
                              </div>
                            ))}
                          {selectedOrder.colorAnalysis
                            .colorPages.length > 9 && (
                            <div className="flex items-center justify-center bg-purple-100 px-2 py-1 rounded text-purple-700 font-medium">
                              +
                              {selectedOrder.colorAnalysis
                                .colorPages.length - 9}{" "}
                              more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 9. Add-ons */}
                {selectedOrder.addons &&
                  selectedOrder.addons.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Package className="w-4 h-4" /> Add-ons
                      </p>
                      <div className="space-y-2">
                        {selectedOrder.addons.map(
                          (addon, index) => (
                            <div
                              key={index}
                              className="flex justify-between text-sm bg-white p-2 rounded"
                            >
                              <span className="text-gray-700">
                                {addon.name} × {addon.quantity}
                              </span>
                              <span className="font-semibold text-gray-900">
                                ₱
                                {(
                                  addon.price * addon.quantity
                                ).toFixed(2)}
                              </span>
                            </div>
                          ),
                        )}
                        <div className="border-t border-blue-300 pt-2 mt-2 flex justify-between font-bold">
                          <span className="text-gray-900">
                            Add-ons Total:
                          </span>
                          <span className="text-blue-700">
                            ₱
                            {selectedOrder.addons
                              .reduce(
                                (sum, addon) =>
                                  sum +
                                  addon.price * addon.quantity,
                                0,
                              )
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* 10. Attached Files */}
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

                {/* 11. Cost Breakdown */}
                {selectedOrder.costBreakdown && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      💰 Cost Breakdown
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm bg-white p-2 rounded">
                        <span className="text-gray-700">
                          Printing Cost
                        </span>
                        <span className="font-semibold text-gray-900">
                          ₱
                          {selectedOrder.costBreakdown.printingCost.toFixed(
                            2,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm bg-white p-2 rounded">
                        <span className="text-gray-700">
                          Add-ons Cost
                        </span>
                        <span className="font-semibold text-gray-900">
                          ₱
                          {selectedOrder.costBreakdown.addonsCost.toFixed(
                            2,
                          )}
                        </span>
                      </div>
                      <div className="border-t-2 border-blue-300 pt-2 mt-2 flex justify-between font-bold text-lg">
                        <span className="text-gray-900">
                          Total Cost:
                        </span>
                        <span className="text-blue-700">
                          ₱
                          {selectedOrder.costBreakdown.total.toFixed(
                            2,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 12. Order Source */}
                <div className="p-4 bg-white border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
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
                        ? "bg-white border-2 border-blue-2000 hover:bg-red-700"
                        : "hover:bg-white border-2 border-blue-200 hover:border-blue-300"
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
            {/* Received Status Form */}
            {pendingStatus === "received" && (
              <div className="space-y-4">
                <Alert className="bg-purple-50 border-purple-200">
                  <AlertCircle className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-900">
                    Mark this order as received and ready for
                    processing.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="receivedTime">
                    Received Time (Auto-generated)
                  </Label>
                  <Input
                    id="receivedTime"
                    type="time"
                    value={statusFormData.estimatedTime}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* In Queue Status Form */}
            {pendingStatus === "inQueue" && (
              <div className="space-y-4">
                <Alert className="bg-white border-2 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-amber-900">
                    Add this order to the printing queue.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="queueTime">
                    Queue Entry Time (Auto-generated)
                  </Label>
                  <Input
                    id="queueTime"
                    type="time"
                    value={statusFormData.estimatedTime}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Printing Status Form */}
            {pendingStatus === "printing" && (
              <div className="space-y-4">
                <Alert className="bg-white border-2 border-blue-200">
                  <Printer className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    Start printing this order now.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="startTime">
                    Start Time (Auto-generated)
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={statusFormData.estimatedTime}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Completed Status Form */}
            {pendingStatus === "completed" && (
              <div className="space-y-4">
                <Alert className="bg-white border-2 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    Mark this order as completed and ready for
                    pickup.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="completionTime">
                    Completion Time (Current Time)
                  </Label>
                  <Input
                    id="completionTime"
                    type="datetime-local"
                    value={statusFormData.completionTime}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Released Status Form */}
            {pendingStatus === "released" && (
              <div className="space-y-4">
                <Alert className="bg-gray-50 border-gray-300">
                  <Package className="h-4 w-4 text-gray-600" />
                  <AlertDescription className="text-gray-900">
                    Release this order to the customer.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="releaseRecipient">
                    Released To (Auto-generated from customer)
                  </Label>
                  <Input
                    id="releaseRecipient"
                    value={statusFormData.releaseRecipient}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="releaseIdNumber">
                    Order Reference (Auto-generated)
                  </Label>
                  <Input
                    id="releaseIdNumber"
                    value={statusFormData.releaseIdNumber}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="releaseTime">
                    Release Time (Current Time)
                  </Label>
                  <Input
                    id="releaseTime"
                    type="datetime-local"
                    value={statusFormData.completionTime}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Canceled Status Form */}
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
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          cancellationReason:
                            "Customer requested cancellation",
                        }))
                      }
                    >
                      Customer requested
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          cancellationReason:
                            "Payment not received",
                        }))
                      }
                    >
                      Payment not received
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          cancellationReason:
                            "Unable to fulfill requirements",
                        }))
                      }
                    >
                      Unable to fulfill
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          cancellationReason: "Duplicate order",
                        }))
                      }
                    >
                      Duplicate order
                    </Button>
                  </div>
                  <Textarea
                    id="cancellationReason"
                    placeholder="Select a reason above or type your own..."
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

            {/* On Hold Status Form */}
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
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason:
                            "Waiting for customer confirmation",
                        }))
                      }
                    >
                      Customer confirmation
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason: "Insufficient payment",
                        }))
                      }
                    >
                      Insufficient payment
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason:
                            "Paper size currently unavailable",
                        }))
                      }
                    >
                      Paper unavailable
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        setStatusFormData((prev) => ({
                          ...prev,
                          holdReason:
                            "Customer requested delay",
                        }))
                      }
                    >
                      Customer requested delay
                    </Button>
                  </div>
                  <Textarea
                    id="holdReason"
                    placeholder="Select a reason above or type your own..."
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
                pendingStatus === "received"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : pendingStatus === "inQueue"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : pendingStatus === "printing"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : pendingStatus === "completed"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : pendingStatus === "onHold"
                          ? "bg-orange-600 hover:bg-orange-700"
                          : pendingStatus === "released"
                            ? "bg-gray-600 hover:bg-gray-700"
                            : "bg-red-600 hover:bg-red-700"
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
    </Layout>
  );
}