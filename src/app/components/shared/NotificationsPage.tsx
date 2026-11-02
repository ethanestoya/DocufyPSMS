import React, { Fragment, useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Package,
  Briefcase,
  Clock,
  ShoppingCart,
  CreditCard,
  Boxes,
  Bell,
  BadgeDollarSign,
  Wrench,
  Info,
  Sparkles,
  Megaphone,
  AlertTriangle,
  AlertOctagon,
  ArrowLeft,
  Trash2,
  CheckCheck,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  announcementsStore,
  ANNOUNCEMENT_TYPE_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
  type Announcement,
  type AnnouncementType,
} from "../../utils/announcementsStore";
import {
  notificationStore,
  type Notification,
} from "../../utils/notificationStore";
import {
  AnnouncementDetailsModal,
  type AnnouncementDetailData,
} from "./AnnouncementDetailsModal";
import { toPHT, toPHTKey, formatPHTime } from "../../utils/pht";

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

const staffMenuItems = [
  {
    label: "Dashboard",
    path: "/staff/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Clock-In & Timesheet",
    path: "/staff/timesheet",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    label: "Walk-in Transactions",
    path: "/staff/walk-in",
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: "Payment Verification",
    path: "/staff/payment-verification",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: "Orders",
    path: "/staff/queue",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Inventory",
    path: "/staff/inventory",
    icon: <Boxes className="w-5 h-5" />,
  },
];

// What an announcement is about — shown as a small type label where useful.
const TYPE_ICON: Record<
  AnnouncementType,
  React.ComponentType<{ className?: string }>
> = {
  announcement: Megaphone,
  pricing: BadgeDollarSign,
  maintenance: Wrench,
  reminder: Info,
  promo: Sparkles,
};

const NOTIF_TYPE_LABEL: Record<Notification["type"], string> = {
  order: "Order",
  payment: "Payment",
  status_update: "Status Update",
  inventory: "Inventory Alert",
};

const NOTIF_PRIORITY_LABEL = (
  p?: Notification["priority"],
): string | undefined => {
  if (p === "important") return "Important";
  if (p === "emergency") return "Emergency";
  return undefined;
};

type FeedCategory = "announcements" | "orders" | "inventory";
type FilterKey = "all" | "unread" | FeedCategory;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "announcements", label: "Announcements" },
  { key: "orders", label: "Orders" },
];

// Inventory is an INTERNAL operational module — only admin and staff may see
// inventory-related functionality. Customers never get an Inventory filter.
const STAFF_FILTERS: { key: FilterKey; label: string }[] = [
  ...FILTERS,
  { key: "inventory", label: "Inventory" },
];

type FeedItem = {
  key: string;
  kind: "announcement" | "notification";
  category: FeedCategory;
  source: Announcement | Notification;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority?: "important" | "emergency";
  priorityLabel?: string;
  typeLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  markRead: () => void;
  open: () => void;
  action?: { label: string; run: () => void } | null;
};

function PriorityBadge({ priority }: { priority: "important" | "emergency" }) {
  const emergency = priority === "emergency";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        emergency
          ? "bg-red-50 text-red-600 border border-red-200"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      {emergency ? (
        <AlertOctagon className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {priority}
    </span>
  );
}

const FILTER_EMPTY_TEXT: Record<FilterKey, string> = {
  all: "No notifications yet",
  unread: "No unread notifications",
  announcements: "No announcements",
  orders: "No order updates",
  inventory: "No inventory alerts",
};

export default function NotificationsPage() {
  const hydrating = useHydrating();
  const { user } = useAuth();
  const email = user?.email || "";
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [detail, setDetail] = useState<AnnouncementDetailData | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  useEffect(() => {
    const load = () =>
      setAnnouncements(announcementsStore.getAnnouncementsFor(email, user?.role));
    load();
    const unsubscribe = announcementsStore.subscribe(load);
    return unsubscribe;
  }, [email, user?.role]);

  useEffect(() => {
    const load = () =>
      setNotifications(
        notificationStore.getNotifications(user?.role, user?.email),
      );
    load();
    const unsubscribe = notificationStore.subscribe(load);
    return unsubscribe;
  }, [user?.role, user?.email]);

  const menuItems =
    user?.role === "admin"
      ? adminMenuItems
      : user?.role === "staff"
        ? staffMenuItems
        : customerMenuItems;

  // ── Opening a notification → mark read + open the shared detail modal ──────
  const runNotificationAction = (n: Notification) => {
    if (n.type === "inventory" && user) {
      navigate(
        user.role === "staff" ? "/staff/inventory" : "/admin/inventory",
      );
      return;
    }
    if (n.relatedOrderId && user) {
      if (user.role === "customer") {
        navigate(`/customer/track/${n.relatedOrderId}`);
      } else {
        navigate(
          `/${user.role}/orders?orderId=${encodeURIComponent(n.relatedOrderId)}`,
        );
      }
      return;
    }
    if (n.relatedRoute) navigate(n.relatedRoute);
  };

  const notificationDestination = (
    n: Notification,
  ): { label: string; run: () => void } | null => {
    if (!user) return null;
    if (n.type === "inventory")
      return { label: "View Inventory", run: () => runNotificationAction(n) };
    if (n.relatedOrderId)
      return { label: "View Order", run: () => runNotificationAction(n) };
    if (n.relatedRoute)
      return { label: "Go to Page", run: () => runNotificationAction(n) };
    return null;
  };

  const openAnnouncement = (a: Announcement) => {
    announcementsStore.markRead(a.id, email);
    setDetail({
      title: a.title,
      message: a.message,
      timestamp: new Date(a.sentAt),
      priority:
        a.priority === "emergency"
          ? "emergency"
          : a.priority === "important"
            ? "important"
            : undefined,
      typeLabel: ANNOUNCEMENT_TYPE_LABELS[a.type],
      priorityLabel:
        a.priority !== "regular"
          ? ANNOUNCEMENT_PRIORITY_LABELS[a.priority]
          : undefined,
      action: null,
    });
  };

  const openNotification = (n: Notification) => {
    notificationStore.markAsRead(n.id);
    setDetail({
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      priority:
        n.priority === "emergency"
          ? "emergency"
          : n.priority === "important"
            ? "important"
            : undefined,
      typeLabel: NOTIF_TYPE_LABEL[n.type],
      priorityLabel: NOTIF_PRIORITY_LABEL(n.priority),
      action: notificationDestination(n),
    });
  };

  const notificationMeta = (n: Notification) => {
    if (n.type === "inventory") {
      return n.priority === "emergency"
        ? { icon: AlertOctagon, bg: "bg-red-50 text-red-600" }
        : { icon: Boxes, bg: "bg-amber-50 text-amber-600" };
    }
    switch (n.type) {
      case "payment":
        return { icon: AlertTriangle, bg: "bg-yellow-50 text-yellow-600" };
      case "status_update":
        return { icon: CheckCircle, bg: "bg-blue-50 text-[#1668D9]" };
      case "order":
      default:
        return { icon: Package, bg: "bg-blue-50 text-[#1668D9]" };
    }
  };

  // ── One unified feed: announcements + system notifications, newest first ───
  const feed: FeedItem[] = [];
  for (const a of announcements) {
    const isEmergency = a.priority === "emergency";
    const isImportant = a.priority === "important";
    const meta = isEmergency
      ? { icon: AlertTriangle, bg: "bg-red-50 text-red-600" }
      : isImportant
        ? { icon: AlertTriangle, bg: "bg-amber-50 text-amber-600" }
        : { icon: TYPE_ICON[a.type], bg: "bg-blue-50 text-[#1668D9]" };
    feed.push({
      key: a.id,
      kind: "announcement",
      category: "announcements",
      source: a,
      title: a.title,
      message: a.message,
      timestamp: new Date(a.sentAt),
      read: a.readBy.includes(email),
      priority: isEmergency ? "emergency" : isImportant ? "important" : undefined,
      priorityLabel:
        a.priority !== "regular"
          ? ANNOUNCEMENT_PRIORITY_LABELS[a.priority]
          : undefined,
      typeLabel: ANNOUNCEMENT_TYPE_LABELS[a.type],
      icon: meta.icon,
      iconBg: meta.bg,
      markRead: () => announcementsStore.markRead(a.id, email),
      open: () => openAnnouncement(a),
      action: null,
    });
  }
  for (const n of notifications) {
    // Inventory alerts are internal (staff/admin only) — never render them to
    // customers, even defensively.
    if (n.type === "inventory" && user?.role === "customer") continue;
    const meta = notificationMeta(n);
    feed.push({
      key: n.id,
      kind: "notification",
      category: n.type === "inventory" ? "inventory" : "orders",
      source: n,
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read,
      priority:
        n.priority === "emergency"
          ? "emergency"
          : n.priority === "important"
            ? "important"
            : undefined,
      priorityLabel: NOTIF_PRIORITY_LABEL(n.priority),
      typeLabel: NOTIF_TYPE_LABEL[n.type],
      icon: meta.icon,
      iconBg: meta.bg,
      markRead: () => notificationStore.markAsRead(n.id),
      open: () => openNotification(n),
      action: notificationDestination(n),
    });
  }
  feed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const unread = feed.filter((item) => !item.read).length;

  const filtered = feed.filter((item) => {
    switch (filter) {
      case "unread":
        return !item.read;
      case "announcements":
        return item.category === "announcements";
      case "orders":
        return item.category === "orders";
      case "inventory":
        return item.category === "inventory";
      default:
        return true;
    }
  });

  // Group the filtered feed by Philippines date (TODAY / YESTERDAY / SEPT 3 …).
  const today = toPHT(new Date());
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );
  const sameDay = (p: Date, d: Date) =>
    p.getFullYear() === d.getFullYear() &&
    p.getMonth() === d.getMonth() &&
    p.getDate() === d.getDate();
  const groupMap = new Map<string, { label: string; items: FeedItem[] }>();
  for (const item of filtered) {
    const key = toPHTKey(item.timestamp);
    if (!groupMap.has(key)) {
      const pht = toPHT(item.timestamp);
      const label = sameDay(pht, today)
        ? "Today"
        : sameDay(pht, yesterday)
          ? "Yesterday"
          : pht
              .toLocaleDateString("en-US", { month: "long", day: "numeric" })
              .toUpperCase();
      groupMap.set(key, { label, items: [] });
    }
    groupMap.get(key)!.items.push(item);
  }
  const groups = [...groupMap.entries()].map(([id, g]) => ({
    id,
    label: g.label,
    items: g.items,
  }));

  const handleMarkAllRead = () => {
    announcementsStore.markAllRead(email);
    notificationStore.markAllAsRead(user?.role, user?.email);
    toast.success("All notifications marked as read");
  };

  const renderItem = (item: FeedItem, last: boolean) => {
    const isEmergency = item.priority === "emergency";
    const isImportant = item.priority === "important";
    const rowBg = isEmergency
      ? "bg-red-50/30"
      : isImportant
        ? "bg-amber-50/20"
        : !item.read
          ? "bg-blue-50/20"
          : "";
    const leftBorder = isEmergency
      ? "border-l-2 border-l-red-400"
      : isImportant
        ? "border-l-2 border-l-amber-400"
        : "";
    return (
      <div
        key={item.key}
        role="button"
        tabIndex={0}
        className={`group flex items-start gap-3 px-3.5 sm:px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${rowBg} ${leftBorder} ${last ? "" : "border-b border-gray-50"}`}
        onClick={item.open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            item.open();
          }
        }}
      >
        <div
          className={`w-8 h-8 ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}
        >
          <item.icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          {(item.priorityLabel || item.kind === "announcement") && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.priorityLabel && (
                <PriorityBadge
                  priority={item.priority as "important" | "emergency"}
                />
              )}
              {item.kind === "announcement" && (
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  {item.typeLabel}
                </span>
              )}
            </div>
          )}
          <p
            className={`text-sm mt-0.5 leading-snug ${item.read ? "font-medium text-gray-800" : "font-bold text-gray-900"}`}
          >
            {item.title}
          </p>
          <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-1 leading-snug">
            {item.message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-500">
              {formatPHTime(item.timestamp)}
            </span>
            {item.action && (
              <button
                type="button"
                className="text-[11px] font-semibold text-[#1668D9] hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  item.markRead();
                  item.action?.run();
                }}
              >
                {item.action.label}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mt-1">
          {!item.read && (
            <span
              className={`w-2 h-2 rounded-full ${isEmergency ? "bg-red-500" : isImportant ? "bg-amber-500" : "bg-[#1668D9]"}`}
            />
          )}
          {isAdmin && item.kind === "announcement" && (
            <button
              type="button"
              title="Delete notification"
              aria-label={`Delete ${item.title}`}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(item.source as Announcement);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout
      menuItems={menuItems}
      title="Notifications"
      hideMobileBackButton
    >
      <div className="mx-auto max-w-3xl space-y-5 pb-10">
        {/* Mobile Back — sits directly under the header, same spot a sidebar item would */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#10316B]">
              Notifications
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Announcements and updates from Docufy.
            </p>
          </div>
        </div>

        {/* Unread count + mark all read */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#1668D9] text-white text-xs font-bold">
              {unread}
            </span>
            unread notification{unread === 1 ? "" : "s"}
          </p>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2F6FD6] hover:text-[#1668D9] transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(user?.role === "customer" ? FILTERS : STAFF_FILTERS).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "bg-[#1668D9] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-[#1668D9]/40 hover:text-[#1668D9]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Unified feed */}
        {hydrating ? (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <TableSkeleton columns={2} rows={5} />
          </div>
        ) : feed.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-14 px-6 text-center">
            <div className="w-12 h-12 bg-[#F2F7FF] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-[#1668D9]/40" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              No notifications yet
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Announcements and order updates will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 px-6 text-center">
            <p className="text-sm font-semibold text-gray-700">
              {FILTER_EMPTY_TEXT[filter]}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Adjust your filter to see more notifications.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            {groups.map((group) => (
              <Fragment key={group.id}>
                <div className="px-4 sm:px-5 pt-4 pb-2.5 border-b border-gray-100">
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {group.label}
                    </span>
                    <span className="flex-1 h-px bg-gray-100" />
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.items.map((item, i) =>
                    renderItem(item, i === group.items.length - 1),
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Shared Announcement Details Modal — same one used across Docufy */}
      <AnnouncementDetailsModal
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        announcement={detail}
      />

      {/* Delete Notification Confirmation */}
      {deleteTarget && (
        <ConfirmationDialog
          open
          onOpenChange={() => setDeleteTarget(null)}
          onConfirm={() => {
            announcementsStore.deleteAnnouncement(deleteTarget.id);
            if (detail?.title === deleteTarget.title) setDetail(null);
            toast.success("Notification deleted");
            setDeleteTarget(null);
          }}
          title="Delete this notification?"
          description={`"${deleteTarget.title}" is removed for everyone. This cannot be undone.`}
          confirmLabel="Delete Notification"
          cancelLabel="Keep It"
          requirePhrase
          destructive
        />
      )}
    </Layout>
  );
}
