import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Package,
  X,
  Calendar,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { dataStore, type Order } from "../../utils/dataStore";
import { useAuth } from "../../contexts/AuthContext";

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

export default function CustomerOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Orders state ──────────────────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>("");

  useEffect(() => {
    loadOrders();
    const unsubscribe = dataStore.subscribe(() => {
      loadOrders();
    });
    return unsubscribe;
  }, [user]);

  const loadOrders = () => {
    if (user?.email) {
      setOrders(dataStore.getOrdersByCustomer(user.email));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":   return "bg-blue-100 text-blue-700";
      case "Released":    return "bg-gray-100 text-gray-700";
      case "Printing":    return "bg-blue-100 text-blue-700";
      case "In Queue":    return "bg-yellow-100 text-yellow-700";
      case "On Hold":     return "bg-amber-100 text-amber-800";
      case "Received":    return "bg-purple-100 text-purple-700";
      case "Canceled":    return "bg-red-100 text-red-700";
      default:            return "bg-gray-100 text-gray-700";
    }
  };

  const handleCancelClick = (orderId: string, status: string) => {
    // Allow cancellation only for Received, In Queue, or On Hold statuses
    const cancellableStatuses = ["Received", "In Queue", "On Hold"];
    if (!cancellableStatuses.includes(status)) {
      toast.error('Only orders with "Received", "In Queue", or "On Hold" status can be canceled.');
      return;
    }

    // Cancel immediately without confirmation dialog
    dataStore.updateOrder(orderId, {
      status: "Canceled",
    });
    toast.success("Order has been canceled successfully.");
  };

  const confirmCancelOrder = () => {
    // This function is no longer needed but kept for compatibility
    if (!orderToCancel) return;

    dataStore.updateOrder(orderToCancel, {
      status: "Canceled",
    });
    setShowCancelDialog(false);
    setOrderToCancel(null);
    setCancellationReason("");
    toast.success("Order has been canceled successfully.");
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      selectedStatus === "All" || order.status === selectedStatus;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.fileName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDateFrom = !dateFrom || order.date >= dateFrom;
    const matchesDateTo = !dateTo || order.date <= dateTo;
    return matchesStatus && matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const clearFilters = () => {
    setSelectedStatus("All");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Layout menuItems={menuItems} title="My Orders" showBackButton>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">

        {/* ── Top Action Bar ─────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <Button
            className="bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
            onClick={() => navigate("/customer/new-request")}
          >
            Print Request
          </Button>
        </div>

        {/* ── Filters Card ───────────────────────────────────── */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Status */}
              <div className="space-y-2 w-full sm:w-48">
                <Label
                  htmlFor="status-filter"
                  className="text-sm font-medium text-gray-700"
                >
                  Status
                </Label>
                <select
                  id="status-filter"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6FD6] focus:border-transparent bg-white"
                >
                  <option value="All">All Status</option>
                  <option value="In Queue">🟡 In Queue</option>
                  <option value="Received">🟣 Received</option>
                  <option value="Printing">🔵 Printing</option>
                  <option value="Completed">🟢 Completed</option>
                  <option value="Released">⚪ Released</option>
                  <option value="On Hold">🟠 On Hold</option>
                  <option value="Canceled">🔴 Canceled</option>
                </select>
              </div>

              {/* Date From */}
              <div className="space-y-2 w-full sm:w-48">
                <Label
                  htmlFor="dateFrom"
                  className="text-sm font-medium text-gray-700"
                >
                  Date From
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Date To */}
              <div className="space-y-2 w-full sm:w-48">
                <Label
                  htmlFor="dateTo"
                  className="text-sm font-medium text-gray-700"
                >
                  Date To
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Search */}
              <div className="space-y-2 flex-1">
                <Label
                  htmlFor="search"
                  className="text-sm font-medium text-gray-700"
                >
                  Search
                </Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Order ID or Document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Clear */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="whitespace-nowrap"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing{" "}
                <span className="font-semibold text-gray-900">
                  {filteredOrders.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900">
                  {orders.length}
                </span>{" "}
                orders
              </p>
            </div>
          </div>
        </Card>

        {/* ── Orders Table ───────────────────────────────────── */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Order ID
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Document
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Pages
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Total
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Date
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Time
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-16 text-center text-sm text-gray-400"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-4 text-sm font-medium text-gray-900">
                        {order.id}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        {order.fileName || "N/A"}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {order.pages || 0}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          className={`${getStatusColor(order.status)} font-medium`}
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-gray-900">
                        {order.total}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(order.date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(order.date).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/customer/track/${order.id}`)
                            }
                            className="bg-[#F2F7FF] border-2 border-[#1D73EC] text-[#1D73EC] hover:bg-[#1D73EC] hover:text-white font-semibold transition-all shadow-sm"
                          >
                            Track
                          </Button>
                          <Button
                            size="sm"
                            className={
                              ["Received", "In Queue", "On Hold"].includes(order.status)
                                ? "bg-white text-gray-900 border-2 border-gray-300 hover:bg-[#2F6FD6] hover:text-white hover:border-[#2F6FD6] transition-all font-semibold"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }
                            onClick={() =>
                              handleCancelClick(order.id, order.status)
                            }
                            disabled={!["Received", "In Queue", "On Hold"].includes(order.status)}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Cancel Dialog ──────────────────────────────────────── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <DialogTitle className="text-xl">Cancel Order</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Are you sure you want to cancel order {orderToCancel}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancellationReason">
                Reason for Cancellation *
              </Label>
              <Textarea
                id="cancellationReason"
                placeholder="Please provide a reason..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Order
            </Button>
            <Button
              onClick={confirmCancelOrder}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!cancellationReason.trim()}
            >
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}