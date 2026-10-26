import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Package,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowLeft,
  Search,
  AlertTriangle,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { DateRangeFilter } from "../ui/date-range-filter";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { dataStore, type Order } from "../../utils/dataStore";
import { useAuth } from "../../contexts/AuthContext";
import ShopStatusBanner from "../shared/ShopStatusBanner";
import { UnclaimedOrderWarning } from "../shared/UnclaimedOrderWarning";
import { useUnclaimedOffenses } from "../../utils/useUnclaimedOffenses";
import { getStatusBadgeClasses, getCustomerStatusLabel } from "../../utils/orderStatusPalette";
import { formatPHDate, formatPHTime } from "../../utils/pht";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";

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
  const hydrating = useHydrating();

  // The customer's derived unclaimed orders (shared with the notice above),
  // used only to highlight the affected order rows.
  const { summary: unclaimedSummary } = useUnclaimedOffenses(user?.email);
  const affectedOrderIds = new Set(
    (unclaimedSummary?.records ?? []).map((r) => r.orderId),
  );

  // ── Orders state ──────────────────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

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

  const getStatusColor = (status: string) => getStatusBadgeClasses(status);

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

  // Pagination over the filtered set
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
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
  }, [selectedStatus, searchQuery, dateFrom, dateTo]);

  const clearFilters = () => {
    setSelectedStatus("All");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Layout menuItems={menuItems} title="My Orders" showBackButton hideMobileBackButton>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">

        <ShopStatusBanner />

        {/* Unclaimed-order warning — derived from the customer's real order history */}
        <UnclaimedOrderWarning customerKey={user?.email} />

        {/* ── Top Action Bar ─────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 md:justify-end mb-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        {/* ── Filters Card ───────────────────────────────────── */}
        <Card className="p-4 sm:p-6 bg-white shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {/* Status */}
              <div className="hidden space-y-2 w-full sm:block sm:w-48">
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
                  <option value="Printing">🔵 Printing</option>
                  <option value="Completed">🟢 Completed</option>
                  <option value="Released">⚪ Released</option>
                  <option value="Awaiting Payment">⏳ Awaiting Payment</option>
                  <option value="Canceled">🔴 Canceled</option>
                </select>
              </div>

              <div className="relative space-y-2 w-full sm:hidden">
                <Label htmlFor="mobile-status-filter">Status</Label>
                <button
                  id="mobile-status-filter"
                  type="button"
                  onClick={() => setShowStatusMenu((isOpen) => !isOpen)}
                  aria-expanded={showStatusMenu}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm"
                >
                  <span>{selectedStatus === "All" ? "All Status" : selectedStatus}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showStatusMenu ? "rotate-180" : ""}`} />
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                    {["All", "In Queue", "Printing", "Completed", "Released", "Awaiting Payment", "Canceled"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setSelectedStatus(status);
                          setShowStatusMenu(false);
                        }}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50 ${selectedStatus === status ? "bg-blue-50 font-semibold text-[#2F6FD6]" : "text-gray-700"}`}
                      >
                        {status === "All" ? "All Status" : status}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Expanded Filters (smooth drawer on mobile, inline row on desktop) */}
              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out sm:flex sm:flex-1 sm:flex-row sm:items-end sm:gap-4 sm:min-w-0 sm:w-auto ${showMoreFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr] -my-2 sm:my-0"}`}>
                <div className="min-h-0 overflow-hidden sm:contents">
                  <div className="flex flex-col gap-4 sm:contents">
                    {/* Date range */}
                    <DateRangeFilter
                      value={{ from: dateFrom, to: dateTo }}
                      onChange={(next) => {
                        setDateFrom(next.from);
                        setDateTo(next.to);
                      }}
                      fromLabel="Date From"
                      toLabel="Date To"
                      fromAriaLabel="Date From"
                      toAriaLabel="Date To"
                      className="w-full sm:w-auto"
                    />

                    {/* Search */}
                    <div className="w-full sm:max-w-xs space-y-2">
                      <Label
                        htmlFor="search"
                        className="text-sm font-medium text-gray-700"
                      >
                        Search
                      </Label>
                      <div className="group relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
                        <Input
                          id="search"
                          type="text"
                          placeholder="Order ID or Document..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Clear */}
                    <div className="flex items-end">
                      <Button
                        onClick={clearFilters}
                        className="bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white whitespace-nowrap"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* See More / Show Less (mobile) */}
              <button
                type="button"
                onClick={() => setShowMoreFilters((isOpen) => !isOpen)}
                aria-expanded={showMoreFilters}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-[#2F6FD6] px-3 py-2 text-sm font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 sm:hidden ${
                  showMoreFilters
                    ? "bg-white text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
                    : "bg-[#2F6FD6] text-white shadow-md hover:bg-[#2557b8]"
                }`}
              >
                {showMoreFilters ? "Show Less" : "See More"}
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showMoreFilters ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        </Card>

        {/* ── Orders Table ───────────────────────────────────── */}
        <Card className="overflow-hidden bg-white shadow-sm gap-0">
          {/* The list paints from the local mirror first, so an empty table is
              ambiguous. The skeleton claims the loading case and leaves the
              empty state meaning what it says. */}
          {hydrating && <TableSkeleton columns={7} rows={10} />}
          {!hydrating && (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Document
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden sm:table-cell whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Pages
                  </th>
                  <th className="hidden sm:table-cell whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Total
                  </th>
                  <th className="hidden sm:table-cell whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Date
                  </th>
                  <th className="hidden sm:table-cell whitespace-nowrap px-4 py-2.5 align-middle text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-16 text-center text-sm text-gray-500"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`cursor-pointer border-b transition-colors ${
                        affectedOrderIds.has(order.id)
                          ? "bg-amber-50/70 hover:bg-amber-50 ring-1 ring-inset ring-amber-200"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => navigate(`/customer/track/${order.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/customer/track/${order.id}`);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="py-4 px-4 text-sm font-medium text-gray-900">
                        <span className="whitespace-nowrap">
                          {order.displayId ?? order.id}
                        </span>
                        {affectedOrderIds.has(order.id) && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                              title="This order was recorded as unclaimed."
                            >
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              Unclaimed
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        <div className="flex min-w-0 items-center gap-2">
                          <Eye className="h-5 w-5 shrink-0 text-[#1668D9]" aria-hidden="true" />
                          <span className="max-w-[8rem] truncate sm:max-w-none">{order.fileName || "N/A"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          className={`${getStatusColor(getCustomerStatusLabel(order))} font-medium`}
                        >
                          {getCustomerStatusLabel(order)}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell py-4 px-4 text-sm text-gray-600">
                        {order.pages || 0}
                      </td>
                      <td className="hidden sm:table-cell py-4 px-4 text-sm font-medium text-gray-900">
                        {order.total}
                      </td>
                      <td className="hidden sm:table-cell py-4 px-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatPHDate(order.date, "short")}
                      </td>
                      <td className="hidden sm:table-cell py-4 px-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatPHTime(order.createdAt || order.date)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 bg-white px-4 sm:px-5 py-4">
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

    </Layout>
  );
}
