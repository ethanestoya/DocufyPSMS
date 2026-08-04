import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Bell,
  LogOut,
  Menu,
  User,
  ChevronDown,
  Printer,
  CheckCircle,
  Package as PackageIcon,
  AlertTriangle,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Shield,
  MapPin,
  XCircle,
  Clock,
  Upload,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logoImage from "figma:asset/32cd46dac3d06839e0db69b6c6ad22c9a8ac17a6.png";
import { inventoryStore } from "../utils/inventoryStore";
import { notificationStore, type Notification } from "../utils/notificationStore";
import { siemAlertStore, type SIEMAlert } from "../utils/siemAlertStore";
import { toast } from "sonner";

interface LayoutProps {
  children: React.ReactNode;
  menuItems: {
    label: string;
    path: string;
    icon: React.ReactNode;
  }[];
  title?: string;
  showBackButton?: boolean;
  backButtonPath?: string;
}

export default function Layout({
  children,
  menuItems,
  title,
  showBackButton = false,
  backButtonPath,
}: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleBack = () => {
    if (backButtonPath) {
      navigate(backButtonPath);
    } else {
      navigate(-1);
    }
  };

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(
    () => {
      const saved = localStorage.getItem("sidebarExpanded");
      return saved !== null ? JSON.parse(saved) : true;
    },
  );

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] =
    useState(false);
  const [isSIEMOpen, setIsSIEMOpen] = useState(false);

  // Track notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track SIEM alerts (admin only)
  const [siemAlerts, setSiemAlerts] = useState<SIEMAlert[]>([]);
  const [siemUnreadCount, setSiemUnreadCount] = useState(0);
  const [siemCriticalCount, setSiemCriticalCount] = useState(0);

  // Track low inventory items
  const [lowInventoryItems, setLowInventoryItems] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem(
      "sidebarExpanded",
      JSON.stringify(isSidebarExpanded),
    );
  }, [isSidebarExpanded]);

  // Subscribe to notifications
  useEffect(() => {
    const updateNotifications = () => {
      const userNotifications = notificationStore.getNotifications(user?.role, user?.email);
      setNotifications(userNotifications);
      setUnreadCount(notificationStore.getUnreadCount(user?.role, user?.email));
    };

    updateNotifications();
    const unsubscribe = notificationStore.subscribe(updateNotifications);
    return unsubscribe;
  }, [user?.role, user?.email]);

  // Subscribe to SIEM alerts (admin only)
  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }

    const updateSIEMAlerts = () => {
      const alerts = siemAlertStore.getAlerts(user?.role);
      setSiemAlerts(alerts);
      setSiemUnreadCount(siemAlertStore.getUnreadCount(user?.role));
      setSiemCriticalCount(siemAlertStore.getCriticalUnreadCount(user?.role));
    };

    updateSIEMAlerts();
    const unsubscribe = siemAlertStore.subscribe(updateSIEMAlerts);
    return unsubscribe;
  }, [user?.role]);

  // Check for low inventory items (threshold: 100 for paper, 10 for supplies)
  useEffect(() => {
    const checkInventory = () => {
      const items = inventoryStore.getItems();
      const lowItems = items.filter(item => {
        if (item.archived) return false;
        const threshold = item.category === 'Paper' ? 100 : 10;
        return item.currentStock <= threshold;
      }).map(item => item.itemName);
      setLowInventoryItems(lowItems);
    };

    checkInventory();
    const unsubscribe = inventoryStore.subscribe(checkInventory);
    return unsubscribe;
  }, []);

  const displayTitle =
    title ||
    menuItems.find((item) => item.path === location.pathname)
      ?.label ||
    "Dashboard";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    notificationStore.markAsRead(notification.id);

    setIsNotificationOpen(false);

    // Navigate if clickable
    if (notification.clickable && notification.relatedRoute) {
      navigate(notification.relatedRoute);
    } else if (notification.clickable && notification.relatedOrderId && user) {
      // Navigate to order tracking
      if (user.role === 'customer') {
        navigate(`/customer/track/${notification.relatedOrderId}`);
      } else {
        navigate(`/${user.role}/orders`);
      }
    }
  };

  const handleMarkAllRead = () => {
    notificationStore.markAllAsRead(user?.role, user?.email);
    toast.success('All notifications marked as read');
  };

  const handleSIEMAlertClick = (alert: SIEMAlert) => {
    siemAlertStore.markAsRead(alert.id);
    setIsSIEMOpen(false);
    if (alert.investigateUrl) {
      navigate(alert.investigateUrl);
    }
  };

  const handleMarkAllSIEMRead = () => {
    siemAlertStore.markAllAsRead(user?.role);
    toast.success('All security alerts marked as read');
  };

  const getSIEMAlertIcon = (type: SIEMAlert['type']) => {
    switch (type) {
      case 'impossible_travel':
        return { icon: MapPin, color: 'bg-red-100 text-red-600' };
      case 'brute_force':
        return { icon: AlertTriangle, color: 'bg-red-100 text-red-600' };
      case 'suspicious_upload':
        return { icon: Upload, color: 'bg-yellow-100 text-yellow-600' };
      case 'unusual_access':
        return { icon: Clock, color: 'bg-yellow-100 text-yellow-600' };
      case 'repeated_failures':
        return { icon: XCircle, color: 'bg-orange-100 text-orange-600' };
      default:
        return { icon: AlertTriangle, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const getSIEMSeverityBadge = (severity: SIEMAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return { icon: PackageIcon, color: 'bg-green-100 text-green-600' };
      case 'payment':
        return { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-600' };
      case 'inventory':
        return { icon: AlertCircle, color: 'bg-red-100 text-red-600' };
      case 'status_update':
        return { icon: CheckCircle, color: 'bg-blue-100 text-blue-600' };
      default:
        return { icon: Bell, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex font-poppins overflow-hidden">
      {/* ─── SIDEBAR (Gradient removed, solid blue restored) ─── */}
      <aside
        className={`bg-[#1D73EC] flex flex-col z-50 shadow-2xl transition-all duration-300 ease-in-out flex-shrink-0 relative ${
          isSidebarExpanded ? "w-64" : "w-[72px]"
        }`}
      >
        {/* Brand / Logo */}
        <div className="pt-5 pb-3 w-full">
          <div className="flex items-center justify-center">
            <img
              src={logoImage}
              alt="DocuFy Logo"
              className="w-10 h-10 rounded-full bg-white/10 p-0.5 shadow-lg flex-shrink-0"
            />
          </div>
        </div>

        {/* Toggle Button Section - Arrow Only & High Visibility Lines */}
        <div className="my-2 px-3">
          <div className="h-[2px] bg-white/40 w-full mb-4 shadow-sm" />
          <div className="flex justify-center">
            <button
              onClick={() =>
                setIsSidebarExpanded(!isSidebarExpanded)
              }
              className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                isSidebarExpanded
                  ? "w-full px-3 py-2.5 gap-3"
                  : "w-10 h-10 justify-center"
              } text-blue-100 hover:bg-white/10 hover:text-white`}
            >
              <div className="flex-shrink-0">
                {isSidebarExpanded ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </div>
              {isSidebarExpanded && (
                <span className="text-sm font-medium">
                  Collapse
                </span>
              )}

              {/* Tooltip for Toggle Button */}
              {!isSidebarExpanded && (
                <div className="fixed left-[80px] px-3 py-1.5 bg-[#1c1f26] text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-[9999] whitespace-nowrap border border-white/10">
                  Open Sidebar
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1c1f26]" />
                </div>
              )}
            </button>
          </div>
          <div className="h-[2px] bg-white/40 w-full mt-4 shadow-sm" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-5 space-y-2 overflow-y-auto custom-scrollbar flex flex-col items-center">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <div
                key={item.path}
                className="relative group w-full flex justify-center px-3"
              >
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex items-center transition-all duration-200 ${
                    isSidebarExpanded
                      ? "w-full px-4 py-3 gap-3.5 rounded-xl"
                      : "w-11 h-11 justify-center rounded-xl"
                  } ${
                    isActive
                      ? "bg-white text-[#1D73EC] shadow-lg"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex-shrink-0 flex items-center justify-center">
                    {item.icon}
                  </div>
                  {isSidebarExpanded && (
                    <span className="text-sm font-medium whitespace-nowrap truncate">
                      {item.label}
                    </span>
                  )}
                  {isActive && isSidebarExpanded && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1D73EC]" />
                  )}
                </button>

                {/* Fixed Tooltip for Tab Names */}
                {!isSidebarExpanded && (
                  <div className="fixed left-[80px] px-3 py-1.5 bg-[#1c1f26] text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-[9999] whitespace-nowrap border border-white/10">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1c1f26]" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-16 bg-white border-b border-gray-200 px-6 lg:px-8 flex items-center justify-between z-40 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-[#1D73EC]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-base font-bold text-[#1c1f26] truncate">
              {displayTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Badge */}
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
              user?.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
              user?.role === 'staff' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
              'bg-green-100 text-green-700 border border-green-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                user?.role === 'admin' ? 'bg-purple-500' :
                user?.role === 'staff' ? 'bg-blue-500' :
                'bg-green-500'
              }`} />
              {user?.role === 'admin' ? 'Admin Account' : user?.role === 'staff' ? 'Staff Account' : 'Customer Account'}
            </div>

            {/* SIEM Security Alerts (Admin Only) */}
            {user?.role === 'admin' && (
              <div className="relative">
                <button
                  onClick={() => {
                    setIsSIEMOpen(!isSIEMOpen);
                    setIsNotificationOpen(false);
                    setIsProfileOpen(false);
                  }}
                  className={`p-2 rounded-xl border transition-all relative ${isSIEMOpen ? "bg-red-100 border-red-300" : siemCriticalCount > 0 ? "bg-red-50 border-red-200 animate-pulse" : "hover:bg-gray-50 border-transparent"}`}
                >
                  <Shield className={`w-5 h-5 ${siemCriticalCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                  {siemUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
                      {siemUnreadCount > 99 ? '99+' : siemUnreadCount}
                    </span>
                  )}
                </button>

                {isSIEMOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsSIEMOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-red-200 z-20">
                      <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-600" />
                          <h3 className="font-bold text-sm text-red-900">Security Alerts</h3>
                          {siemCriticalCount > 0 && (
                            <span className="ml-auto px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                              {siemCriticalCount} Critical
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {siemAlerts.length === 0 ? (
                          <div className="p-8 text-center">
                            <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">No security alerts</p>
                          </div>
                        ) : (
                          siemAlerts.map((alert, index) => {
                            const { icon: Icon, color } = getSIEMAlertIcon(alert.type);
                            const severityClass = getSIEMSeverityBadge(alert.severity);
                            return (
                              <div
                                key={alert.id}
                                className={`p-4 ${index !== siemAlerts.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-red-50 transition-colors cursor-pointer ${!alert.read ? 'bg-red-50/50' : ''}`}
                                onClick={() => handleSIEMAlertClick(alert)}
                              >
                                <div className="flex gap-3">
                                  <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <p className={`text-xs ${!alert.read ? 'font-bold' : 'font-medium'} text-gray-900`}>
                                        {alert.title}
                                      </p>
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityClass} uppercase`}>
                                        {alert.severity}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                                      {alert.description}
                                    </p>
                                    {alert.affectedAccount && (
                                      <p className="text-xs text-red-700 font-medium mb-1">
                                        Account: {alert.affectedAccount}
                                      </p>
                                    )}
                                    <p className="text-[10px] text-gray-400">
                                      {formatTimeAgo(alert.timestamp)}
                                    </p>
                                  </div>
                                  {!alert.read && (
                                    <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="px-4 py-2.5 border-t border-red-100 bg-red-50">
                        <button
                          className="text-xs font-medium text-red-700 hover:text-red-800 transition-colors"
                          onClick={handleMarkAllSIEMRead}
                        >
                          Mark all as read
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  setIsProfileOpen(false);
                  setIsSIEMOpen(false);
                }}
                className={`p-2 rounded-xl border transition-all relative ${isNotificationOpen ? "bg-gray-100 border-gray-300" : "hover:bg-gray-50 border-transparent"}`}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => {
                      setIsNotificationOpen(false);
                      setIsSIEMOpen(false);
                    }}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-sm text-gray-900">Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification, index) => {
                          const { icon: Icon, color } = getNotificationIcon(notification.type);
                          return (
                            <div
                              key={notification.id}
                              className={`p-4 ${index !== notifications.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors ${notification.clickable ? 'cursor-pointer' : ''} ${!notification.read ? 'bg-blue-50/50' : ''}`}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs ${!notification.read ? 'font-bold' : 'font-medium'} text-gray-900`}>
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    {formatTimeAgo(notification.timestamp)}
                                  </p>
                                </div>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-gray-100">
                      <button className="text-xs font-medium text-[#1D73EC] hover:text-[#1557b8] transition-colors" onClick={handleMarkAllRead}>
                        Mark all as read
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationOpen(false);
                  setIsSIEMOpen(false);
                }}
                className={`flex items-center gap-2.5 py-1.5 pl-1.5 pr-3 rounded-xl border transition-all ${isProfileOpen ? "bg-gray-100 border-gray-300" : "hover:bg-gray-50 border-transparent"}`}
              >
                {/* Profile Badge remains Gradient-styled if specified, or solid blue */}
                <div className="w-8 h-8 bg-[#1D73EC] rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase flex-shrink-0">
                  {user?.email?.[0]}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-gray-900 leading-none">
                    {user?.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize leading-none mt-0.5">
                    {user?.role}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isProfileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-20">
                    {/* Profile Section */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-900">{user?.email}</p>
                      <p className="text-[10px] text-gray-500 capitalize mt-0.5">{user?.role} Account</p>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          navigate(`/${user?.role}/profile`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <User className="w-4 h-4" /> My Profile
                      </button>
                    </div>

                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-50 transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#f0f4f8]">
          <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        /* Custom Scrollbar Styling - Beautiful & Modern */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.12) transparent;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.02);
          border-radius: 10px;
          margin: 4px 0;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.12);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
          transition: background 0.2s ease;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2);
          background-clip: padding-box;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:active {
          background: rgba(0,0,0,0.3);
          background-clip: padding-box;
        }

        /* Sidebar-specific scrollbar - White theme for blue background */
        aside .custom-scrollbar {
          scrollbar-color: rgba(255,255,255,0.25) transparent;
        }

        aside .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }

        aside .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.25);
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        aside .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.35);
          background-clip: padding-box;
        }

        aside .custom-scrollbar::-webkit-scrollbar-thumb:active {
          background: rgba(255,255,255,0.45);
          background-clip: padding-box;
        }
      `}</style>
    </div>
  );
}