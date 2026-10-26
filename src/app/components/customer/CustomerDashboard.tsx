import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Briefcase,
  Package,
  Clock,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Megaphone,
  CircleDot,
  Check,
  Lightbulb,
  ChevronDown,
  X,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { CardSkeleton, DetailSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { shopPhotosStore, type ShopPhoto } from "../../utils/shopPhotosStore";
import { landingContentStore, DEFAULT_MAP_EMBED, type LandingPageContent } from "../../utils/landingContentStore";
import { dataStore, Order } from "../../utils/dataStore";
import ShopStatusBanner from "../shared/ShopStatusBanner";
import { useAuth } from "../../contexts/AuthContext";
import {
  announcementsStore,
  type Announcement,
  ANNOUNCEMENT_PRIORITY_LABELS,
} from "../../utils/announcementsStore";
import {
  AnnouncementDetailsModal,
  type AnnouncementDetailData,
} from "../shared/AnnouncementDetailsModal";
import { getStatusBadgeClasses, getCustomerStatusLabel } from "../../utils/orderStatusPalette";
import { UnclaimedOrderWarning } from "../shared/UnclaimedOrderWarning";

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

const STATUS_STEPS = [
  { key: "In Queue", label: "In Queue" },
  { key: "Printing", label: "Printing" },
  { key: "Completed", label: "Ready for Pickup" },
  { key: "Released", label: "Picked Up" },
];

function getProgressIndex(status: string): number {
  if (status === "Awaiting Payment") return -1;
  if (status === "In Queue") return 0;
  if (status === "Printing") return 1;
  if (status === "Completed") return 2;
  if (status === "Released") return 3;
  if (status === "Canceled") return -1;
  return -1;
}

function getStatusMessage(status: string): string {
  switch (status) {
    case "In Queue":
      return "Your order is in the queue and will be printed soon.";
    case "Printing":
      return "Your order is currently being printed. We'll notify you once it's ready for pickup.";
    case "Completed":
      return "Your order is ready for pickup! Please visit the shop to collect it.";
    case "Released":
      return "Your order has been picked up. Thank you!";
    case "Awaiting Payment":
      return "Your order is awaiting payment confirmation.";
    case "Canceled":
      return "This order has been canceled.";
    default:
      return "";
  }
}

function getOrderSummary(order: Order): string {
  const parts: string[] = [];
  if (order.printType) parts.push(order.printType);
  if (order.paperSize) parts.push(order.paperSize);
  if (order.copies)
    parts.push(`${order.copies} ${order.copies === 1 ? "copy" : "copies"}`);
  return parts.join(" \u2022 ") || "Print request";
}

function compactCount(value: number): string {
  return value > 99 ? "99+" : String(value);
}

function formatOrderDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function CustomerDashboard() {
  const hydrating = useHydrating();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customerOrders, setCustomerOrders] = useState(
    dataStore.getOrdersByCustomer(user?.email || ""),
  );
  const [stats, setStats] = useState(
    dataStore.getOrderStats(user?.email || ""),
  );
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementDetailData | null>(null);
  const [showShopPhotos, setShowShopPhotos] = useState(false);
  const [shopLocationOpen, setShopLocationOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [shopPhotos, setShopPhotos] = useState<ShopPhoto[]>(
    shopPhotosStore.getPhotos(),
  );
  const [landingContent, setLandingContent] = useState<LandingPageContent>(() =>
    landingContentStore.getContent(),
  );

  useEffect(() => {
    const load = () => setShopPhotos(shopPhotosStore.getPhotos());
    return shopPhotosStore.subscribe(load);
  }, []);

  useEffect(() => {
    const load = () => setLandingContent(landingContentStore.getContent());
    return landingContentStore.subscribe(load);
  }, []);

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setCustomerOrders(dataStore.getOrdersByCustomer(user?.email || ""));
      setStats(dataStore.getOrderStats(user?.email || ""));
    });
    return unsubscribe;
  }, [user?.email]);

  useEffect(() => {
    const loadAnnouncements = () => {
      const list = announcementsStore.getAnnouncementsFor(user?.email || "", user?.role);
      setAllAnnouncements(list);
    };
    loadAnnouncements();
    const unsubscribe = announcementsStore.subscribe(loadAnnouncements);
    return unsubscribe;
  }, [user?.email, user?.role]);

  const openAnnouncement = (a: Announcement) => {
    announcementsStore.markRead(a.id, user?.email || "");
    setSelectedAnnouncement({
      title: a.title,
      message: a.message,
      timestamp: new Date(a.sentAt),
      priority:
        a.priority === "emergency"
          ? "emergency"
          : a.priority === "important"
            ? "important"
            : undefined,
      priorityLabel: ANNOUNCEMENT_PRIORITY_LABELS[a.priority],
      typeLabel: undefined,
      action: null,
    });
  };

  const currentOrder = useMemo(() => {
    return (
      customerOrders.find(
        (o) => !["Completed", "Released", "Canceled"].includes(o.status),
      ) || null
    );
  }, [customerOrders]);

  const recentOrders = useMemo(() => {
    return customerOrders.slice(0, 5);
  }, [customerOrders]);

  const inProgressCount = stats.inProgress;
  const readyCount = stats.completed;

  return (
    <Layout menuItems={menuItems} title="Dashboard">
      <div className="space-y-4 sm:space-y-5 pb-6 sm:pb-8 max-w-7xl mx-auto">

        <ShopStatusBanner />

        {/* Welcome */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening with your orders.
          </p>
        </div>

        {/* Unclaimed-order warning — derived from the customer's real order history */}
        <UnclaimedOrderWarning customerKey={user?.email} />

        {/* Announcement Banner */}
        {allAnnouncements
          .filter(
            (a) =>
              a.priority === "important" || a.priority === "emergency",
          )
          .sort((a, b) => {
            if (a.priority === "emergency" && b.priority !== "emergency") return -1;
            if (a.priority !== "emergency" && b.priority === "emergency") return 1;
            return 0;
          })
          .map((a) => {
            const isEmerg = a.priority === "emergency";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => openAnnouncement(a)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer ${
                  isEmerg
                    ? "bg-red-50 border-red-200 hover:border-red-300"
                    : "bg-amber-50 border-amber-200 hover:border-amber-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isEmerg ? "bg-red-100" : "bg-amber-100"
                    }`}
                  >
                    {isEmerg ? (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Megaphone className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">
                        {a.title}
                      </span>
                      <Badge
                        className={`text-[10px] font-semibold ${
                          isEmerg
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}
                      >
                        {ANNOUNCEMENT_PRIORITY_LABELS[a.priority]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 line-clamp-1">
                      {a.message}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

        {/* Summary Cards */}
        {hydrating ? (
          <div className="space-y-4">
            <CardSkeleton cards={3} columns={3} label="Loading your dashboard" />
            <DetailSkeleton blocks={2} />
          </div>
        ) : (
        <>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            {
              label: "Total Orders",
              value: stats.total,
              description: "All orders",
              icon: FileText,
              color: "text-[#1668D9]",
              bg: "bg-blue-50",
            },
            {
              label: "In Progress",
              value: inProgressCount,
              description: "Currently being processed",
              descriptionMobile: "Processing",
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "Ready for Pickup",
              value: readyCount,
              description: "Ready to be collected",
              descriptionMobile: "For claiming",
              icon: Package,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
          ].map((card) => (
            <Card
              key={card.label}
              onClick={() => navigate("/customer/orders")}
              className="p-3 sm:p-5 cursor-pointer border border-gray-100 bg-white hover:border-gray-200 hover:shadow-md transition-all group"
            >
              {/* Mobile: number on the right, text at the bottom */}
              <div className="sm:hidden flex items-center justify-between gap-2">
                <div
                  className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-3xl font-bold text-gray-900 leading-none">
                  {compactCount(card.value)}
                </p>
              </div>
              <p className="sm:hidden text-[10px] text-gray-500 mt-1.5 leading-tight">
                {card.descriptionMobile ?? card.description}
              </p>

              {/* Desktop: icon left, value + description stacked */}
              <div className="hidden sm:flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 leading-none">
                    {compactCount(card.value)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {card.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Content: Current Order + Recent Orders */}
        <div className="grid grid-cols-1 @min-[900px]:grid-cols-3 gap-4 sm:gap-6">

          {/* Current Order */}
          <div className="lg:col-span-2">
            <Card className="border border-gray-300 sm:border-gray-200 bg-white flex flex-col gap-0">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-300">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  Current Order
                </h2>
              </div>

              <div className="p-4 sm:p-6 flex flex-col">
                {currentOrder ? (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">
{currentOrder.displayId ?? currentOrder.id}
                        </span>
                        <Badge
                          className={`${getStatusBadgeClasses(getCustomerStatusLabel(currentOrder))} font-medium text-xs`}
                        >
                          {getCustomerStatusLabel(currentOrder)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {currentOrder.printType || "Print Request"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {getOrderSummary(currentOrder)}
                      </p>
                    </div>

                    {/* Progress Timeline */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between">
                        {STATUS_STEPS.map((step, idx) => {
                          const progressIdx = getProgressIndex(
                            currentOrder.status,
                          );
                          const isCompleted = progressIdx >= idx;
                          const isCurrent = progressIdx === idx;
                          return (
                            <React.Fragment key={step.key}>
                              <div className="flex flex-col items-center gap-1.5 min-w-0">
                                <div
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                    isCompleted
                                      ? isCurrent
                                        ? "bg-[#1668D9] text-white ring-2 ring-[#1668D9]/30"
                                        : "bg-emerald-500 text-white"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {isCompleted && !isCurrent ? (
                                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  ) : isCurrent ? (
                                    <CircleDot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  ) : (
                                    <span className="text-xs font-bold">
                                      {idx + 1}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] sm:text-xs font-medium text-center leading-tight ${
                                    isCurrent
                                      ? "text-[#1668D9] font-bold"
                                      : isCompleted
                                        ? "text-gray-700"
                                        : "text-gray-500"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                              {idx < STATUS_STEPS.length - 1 && (
                                <div
                                  className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full mt-[-18px] sm:mt-[-20px] ${
                                    progressIdx > idx
                                      ? "bg-emerald-500"
                                      : "bg-gray-200"
                                  }`}
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                      {getStatusMessage(currentOrder.status)}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/customer/track/${currentOrder.id}`)
                      }
                      className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold bg-[#1668D9] text-white hover:bg-[#10316B] transition-all active:scale-[0.97]"
                    >
                      View Order Details
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      No current orders
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Your active orders will appear here.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/customer/new-request")}
                      className="mt-3 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-[#1668D9] text-white hover:bg-[#10316B] transition-all active:scale-[0.97]"
                    >
                      <FileText className="w-4 h-4" />
                      Start a Print Request
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Recent Orders */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-300 sm:border-gray-200 bg-white h-full flex flex-col gap-0">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-300 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  Recent Orders
                </h2>
                <button
                  type="button"
                  onClick={() => navigate("/customer/orders")}
                  className="text-xs font-semibold text-[#1668D9] hover:underline transition-colors"
                >
                  View All
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {recentOrders.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">
                      No orders yet
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Your print requests will appear here once you place an
                      order.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop list */}
                    <div className="hidden sm:block">
                      {recentOrders.map((order, idx) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() =>
                            navigate(`/customer/track/${order.id}`)
                          }
                          className={`w-full text-left px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 ${
                            idx < recentOrders.length - 1
                              ? "border-b border-gray-300 sm:border-gray-200"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900">
                                {order.displayId ?? order.id}
                              </span>
                              <Badge
                                className={`${getStatusBadgeClasses(getCustomerStatusLabel(order))} font-medium text-[10px]`}
                              >
                                {getCustomerStatusLabel(order)}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5 truncate">
                              {order.printType || "Print Request"}
                              {order.paperSize
                                ? ` \u2022 ${order.paperSize}`
                                : ""}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-gray-500">
                                {formatOrderDate(order.date)}
                              </span>
                              <span className="text-[11px] font-semibold text-gray-700">
                                {order.total}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>

                    {/* Mobile stacked cards */}
                    <div className="sm:hidden">
                      {recentOrders.map((order, idx) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() =>
                            navigate(`/customer/track/${order.id}`)
                          }
                          className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 ${
                            idx < recentOrders.length - 1
                              ? "border-b border-gray-300 sm:border-gray-200"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-900">
                                {order.displayId ?? order.id}
                              </span>
                              <Badge
                                className={`${getStatusBadgeClasses(getCustomerStatusLabel(order))} font-medium text-[10px]`}
                              >
                                {getCustomerStatusLabel(order)}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {order.printType || "Print Request"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-gray-500">
                                {formatOrderDate(order.date)}
                              </span>
                              <span className="text-[11px] font-semibold text-gray-700">
                                {order.total}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Shop Information + Quick Tips — previous blue card style */}
        <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3">
          <Card className="p-4 sm:p-6 bg-[#1668D9] text-white shadow-lg border-none">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">
                  Shop Hours
                </h4>
                <div className="space-y-1.5 text-sm text-white/95">
                  <p>
                    <strong>Mon-Fri:</strong> 9:00 AM - 5:00 PM
                  </p>
                  <p>
                    <strong>Saturday:</strong> Closed
                  </p>
                  <p>
                    <strong>Sunday:</strong> Closed
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShopLocationOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-white text-[#1668D9] hover:bg-white/90 transition-all active:scale-[0.97]"
                >
                  <MapPin className="w-4 h-4" />
                  View Shop Location
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 bg-[#1668D9] text-white shadow-lg border-none">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">
                  Quick Tips
                </h4>
                <div className="space-y-2 text-sm text-white/95">
                  <p>
                    Upload a clear file before submitting.
                  </p>
                  <p>
                    Check your printing options carefully.
                  </p>
                  <p>
                    Keep your Order ID for reference.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
        </>
        )}

      </div>

      {/* Announcement Details Modal — shared component */}
      <AnnouncementDetailsModal
        open={!!selectedAnnouncement}
        onOpenChange={(open) => {
          if (!open) setSelectedAnnouncement(null);
        }}
        announcement={selectedAnnouncement}
      />

      {/* Shop Location Dialog */}
      <Dialog open={shopLocationOpen} onOpenChange={setShopLocationOpen}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#2F6FD6]" /> Shop Location
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {landingContent.locationLines?.[0] ||
              "Palawan State University - Main Campus, Puerto Princesa City, Palawan"}
          </p>
          <div className="overflow-hidden rounded-xl border-2 border-blue-100">
            <iframe
              title="Docufy Printing Services - Shop Location"
              src={landingContent.mapEmbedUrl || DEFAULT_MAP_EMBED}
              className="w-full h-72 border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          {shopPhotos.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowShopPhotos(!showShopPhotos)}
                className="flex items-center gap-2 text-sm font-medium text-[#2F6FD6] hover:text-[#1e5bb8] transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showShopPhotos ? "rotate-180" : ""
                  }`}
                />
                {showShopPhotos ? "Hide Shop Photos" : "View Shop Photos"}
              </button>
              {showShopPhotos && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {shopPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightboxPhoto(photo.dataUrl)}
                      className="cursor-pointer"
                    >
                      <img
                        src={photo.dataUrl}
                        alt="Shop location"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:ring-2 hover:ring-[#2F6FD6] transition-all"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {lightboxPhoto && (
        <Dialog open onOpenChange={() => setLightboxPhoto(null)}>
          <DialogContent className="sm:max-w-2xl p-0 bg-black border-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhoto}
              alt="Shop location full view"
              className="w-full max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
