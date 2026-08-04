import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Briefcase,
  Clock,
  CheckCircle,
  Package,
  Bell,
  X,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { dataStore } from "../../utils/dataStore";
import { useAuth } from "../../contexts/AuthContext";
import { notificationStore, Notification } from "../../utils/notificationStore";

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

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customerOrders, setCustomerOrders] = useState(
    dataStore.getOrdersByCustomer(user?.email || ""),
  );
  const [stats, setStats] = useState(
    dataStore.getOrderStats(user?.email || ""),
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setCustomerOrders(
        dataStore.getOrdersByCustomer(user?.email || ""),
      );
      setStats(dataStore.getOrderStats(user?.email || ""));
    });
    return unsubscribe;
  }, [user?.email]);

  useEffect(() => {
    const loadNotifications = () => {
      const userNotifs = notificationStore.getNotifications('customer', user?.email);
      // Filter for application-related notifications only
      const appNotifs = userNotifs.filter(n => n.type === 'status_update');
      setNotifications(appNotifs);
    };

    loadNotifications();
    const unsubscribe = notificationStore.subscribe(loadNotifications);
    return unsubscribe;
  }, [user?.email]);

  const handleNotificationClick = (notification: Notification) => {
    notificationStore.markAsRead(notification.id);
    if (notification.clickable && notification.relatedRoute) {
      navigate(notification.relatedRoute);
    }
  };

  const handleDismissNotification = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    notificationStore.deleteNotification(notificationId);
  };

  const recentOrders = customerOrders.slice(0, 3);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-blue-100 text-blue-700";
      case "Released":
        return "bg-gray-100 text-gray-700";
      case "Printing":
        return "bg-blue-100 text-blue-700";
      case "In Queue":
        return "bg-blue-100 text-yellow-700";
      case "On Hold":
        return "bg-amber-100 text-blue-800";
      case "Received":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Layout menuItems={menuItems} title="Dashboard">
      <div className="space-y-6 h-auto overflow-visible pb-10 max-w-7xl mx-auto">

        {/* Welcome Message */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your print orders
            today.
          </p>
        </div>

        {/* Application Notifications */}
        {notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.slice(0, 3).map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 rounded-xl border-2 ${
                  notification.read
                    ? 'bg-white border-gray-200'
                    : 'bg-blue-50 border-blue-300'
                } cursor-pointer hover:shadow-md transition-all group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.read ? 'bg-gray-100' : 'bg-blue-100'
                  }`}>
                    <Bell className={`w-5 h-5 ${notification.read ? 'text-gray-500' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDismissNotification(notification.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              key: "kpi-tot",
              label: "Total Orders",
              val: stats.total,
              icon: FileText,
              click: () => navigate("/customer/orders"),
              desc: "View all orders",
            },
            {
              key: "kpi-prg",
              label: "Active Orders",
              // allActive = received + inQueue + printing + onHold
              // total = allActive + allFinished, so Total = Active + Completed ✓
              val: stats.allActive,
              icon: Clock,
              click: () => navigate("/customer/orders"),
              desc: "Currently processing",
            },
            {
              key: "kpi-com",
              label: "Completed",
              // allFinished = completed + released
              val: stats.allFinished,
              icon: CheckCircle,
              click: () => navigate("/customer/orders"),
              desc: "Ready for pickup",
            },
          ].map((kpi) => (
            <Card
              key={kpi.key}
              className="p-6 bg-white border-2 border-blue-200 shadow-sm cursor-pointer hover:bg-[#2F6FD6] hover:text-white transition-all group"
              onClick={kpi.click}
            >
              <p className="text-sm font-medium text-gray-600 group-hover:text-blue-100">
                {kpi.label}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-3xl font-bold text-gray-900 group-hover:text-white">
                  {kpi.val}
                </p>
                <kpi.icon className="w-10 h-10 text-blue-600 opacity-50 group-hover:text-white group-hover:opacity-100 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-300" />
              </div>
              <p className="text-xs mt-1 text-gray-500 group-hover:text-blue-100">
                {kpi.desc}
              </p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          {/* Left Column: Quick Actions */}
          <div className="lg:col-span-1 flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-4 ml-1">
              Quick Actions
            </h3>
            <div className="flex flex-col gap-2 flex-grow">
              {[
                {
                  key: "qa-1",
                  label: "New Request",
                  icon: FileText,
                  path: "/customer/new-request",
                },
                {
                  key: "qa-2",
                  label: "Track Orders",
                  icon: MapPin,
                  path: "/customer/orders",
                },
                {
                  key: "qa-3",
                  label: "Job Board",
                  icon: Briefcase,
                  path: "/customer/job-board",
                },
              ].map((action) => (
                <button
                  key={action.key}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center justify-center gap-1 p-2 bg-white border border-slate-200 rounded-lg hover:bg-[#2F6FD6] transition-all shadow-sm group cursor-pointer flex-1"
                >
                  <action.icon className="w-6 h-6 text-[#2F6FD6] group-hover:text-white mb-1" />
                  <p className="font-bold text-sm text-gray-900 group-hover:text-white text-center leading-tight">
                    {action.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Recent Orders */}
          <div className="lg:col-span-3">
            <Card className="p-6 bg-white shadow-sm border border-slate-100 h-full flex flex-col">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Recent Orders
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Track your recent print requests
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/customer/orders")}
                  className="border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white cursor-pointer"
                >
                  View All Orders
                </Button>
              </div>

              <div className="overflow-x-auto flex-grow">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">
                        Order ID
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">
                        Total
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="text-center py-4 px-4 text-sm font-semibold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b hover:bg-blue-50/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <span className="font-semibold text-gray-900">
                            {order.id}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            className={`${getStatusColor(order.status)} font-medium text-[#120a01]`}
                          >
                            {order.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-gray-900">
                            {order.total || "₱0.00"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-600 text-sm">
                            {order.date || "N/A"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/customer/track/${order.id}`,
                              )
                            }
                            className="text-[#2F6FD6] hover:bg-blue-100 cursor-pointer"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-[#1D73EC] text-white shadow-lg border-none">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-bold mb-3">
                  Shop Hours
                </h4>
                <div className="space-y-2 text-sm text-white/95">
                  <p>
                    <strong>Mon-Thurs:</strong> 9:00 AM - 6:00
                    PM
                  </p>
                  <p>
                    <strong>Fri-Sun:</strong> Closed
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[#1D73EC] text-white shadow-lg border-none">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-bold mb-3">
                  Quick Tips
                </h4>
                <div className="space-y-2 text-sm text-white/95">
                  <p>
                    • Orders that use e-wallet requires payment
                    verification
                  </p>
                  <p>• If possible, upload PDF files</p>
                  <p>• Check order status regularly</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}