import React, { useState, useMemo, useEffect } from "react";
import {
  Shield,
  AlertTriangle,
  Activity,
  UserCheck,
  UserX,
  MapPin,
  Clock,
  Eye,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
  Globe,
  Server,
  Key,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { adminMenuItems } from "../../utils/adminMenuItems";
import { siemAlertStore, type SIEMAlert } from "../../utils/siemAlertStore";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

// Mock security data
const generateSecurityMetrics = () => {
  return {
    totalLogins24h: 147,
    failedLogins24h: 23,
    suspiciousActivities: 5,
    blockedAttempts: 12,
    activeSessions: 42,
    mfaEnabled: 89,
    accountLockouts: 3,
    unusualAccess: 8,
  };
};

const generateRecentAuthEvents = () => {
  return [
    {
      id: "AUTH-001",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      username: "admin@test.com",
      eventType: "Login Success",
      ipAddress: "192.168.1.105",
      location: "Manila, Philippines",
      device: "Chrome 125 / Windows 11",
      status: "success" as const,
      mfaVerified: true,
    },
    {
      id: "AUTH-002",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      username: "unknown@test.com",
      eventType: "Login Failed",
      ipAddress: "203.124.52.19",
      location: "Unknown",
      device: "Firefox 124 / Ubuntu",
      status: "failed" as const,
      mfaVerified: false,
      reason: "Invalid credentials",
    },
    {
      id: "AUTH-003",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      username: "customer@test.com",
      eventType: "MFA Verified",
      ipAddress: "192.168.1.110",
      location: "Manila, Philippines",
      device: "Safari 17 / macOS 14",
      status: "success" as const,
      mfaVerified: true,
    },
    {
      id: "AUTH-004",
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      username: "attacker@malicious.com",
      eventType: "Brute Force Blocked",
      ipAddress: "45.142.212.61",
      location: "Moscow, Russia",
      device: "Python-requests/2.28",
      status: "blocked" as const,
      mfaVerified: false,
      reason: "15 rapid attempts detected",
    },
    {
      id: "AUTH-005",
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      username: "staff@test.com",
      eventType: "Session Expired",
      ipAddress: "192.168.1.112",
      location: "Manila, Philippines",
      device: "Edge 124 / Windows 10",
      status: "expired" as const,
      mfaVerified: true,
    },
    {
      id: "AUTH-006",
      timestamp: new Date(Date.now() - 90 * 60 * 1000),
      username: "customer@test.com",
      eventType: "Impossible Travel Detected",
      ipAddress: "85.214.132.55",
      location: "Berlin, Germany",
      device: "Chrome 124 / Android 13",
      status: "flagged" as const,
      mfaVerified: false,
      reason: "Login 10 min after Manila login",
    },
  ];
};

const generateActiveSessions = () => {
  return [
    {
      id: "SESS-001",
      username: "admin@test.com",
      role: "Admin",
      ipAddress: "192.168.1.105",
      location: "Manila, Philippines",
      device: "Chrome 125 / Windows 11",
      loginTime: new Date(Date.now() - 120 * 60 * 1000),
      lastActivity: new Date(Date.now() - 2 * 60 * 1000),
      status: "active" as const,
    },
    {
      id: "SESS-002",
      username: "staff@test.com",
      role: "Staff",
      ipAddress: "192.168.1.112",
      location: "Manila, Philippines",
      device: "Edge 124 / Windows 10",
      loginTime: new Date(Date.now() - 180 * 60 * 1000),
      lastActivity: new Date(Date.now() - 5 * 60 * 1000),
      status: "active" as const,
    },
    {
      id: "SESS-003",
      username: "customer@test.com",
      role: "Customer",
      ipAddress: "192.168.1.110",
      location: "Manila, Philippines",
      device: "Safari 17 / macOS 14",
      loginTime: new Date(Date.now() - 45 * 60 * 1000),
      lastActivity: new Date(Date.now() - 25 * 60 * 1000),
      status: "idle" as const,
    },
  ];
};

export default function SecurityCenter() {
  const navigate = useNavigate();
  const [metrics] = useState(generateSecurityMetrics());
  const [authEvents] = useState(generateRecentAuthEvents());
  const [activeSessions] = useState(generateActiveSessions());
  const [siemAlerts, setSiemAlerts] = useState<SIEMAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SIEMAlert | null>(null);
  const [showAlertDetails, setShowAlertDetails] = useState(false);

  useEffect(() => {
    const updateAlerts = () => {
      setSiemAlerts(siemAlertStore.getAlerts('admin'));
    };
    updateAlerts();
    const unsubscribe = siemAlertStore.subscribe(updateAlerts);
    return unsubscribe;
  }, []);

  const criticalAlerts = siemAlerts.filter(
    (a) => !a.read && (a.severity === 'critical' || a.severity === 'high')
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "success":
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-600" />,
          className: "bg-green-100 text-green-700 border-green-200",
        };
      case "failed":
        return {
          icon: <XCircle className="w-4 h-4 text-red-600" />,
          className: "bg-red-100 text-red-700 border-red-200",
        };
      case "blocked":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
          className: "bg-orange-100 text-orange-700 border-orange-200",
        };
      case "flagged":
        return {
          icon: <AlertCircle className="w-4 h-4 text-yellow-600" />,
          className: "bg-yellow-100 text-yellow-700 border-yellow-200",
        };
      case "expired":
        return {
          icon: <Clock className="w-4 h-4 text-gray-600" />,
          className: "bg-gray-100 text-gray-700 border-gray-200",
        };
      default:
        return {
          icon: <Activity className="w-4 h-4 text-blue-600" />,
          className: "bg-blue-100 text-blue-700 border-blue-200",
        };
    }
  };

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600";
      case "idle":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const handleViewAuditLogs = () => {
    navigate("/admin/audit-logs");
  };

  const handleAlertClick = (alert: SIEMAlert) => {
    setSelectedAlert(alert);
    setShowAlertDetails(true);
    siemAlertStore.markAsRead(alert.id);
  };

  const getSeverityColor = (severity: string) => {
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

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'impossible_travel':
        return <MapPin className="w-6 h-6" />;
      case 'brute_force':
        return <AlertTriangle className="w-6 h-6" />;
      case 'suspicious_upload':
        return <AlertCircle className="w-6 h-6" />;
      case 'unusual_access':
        return <Clock className="w-6 h-6" />;
      case 'repeated_failures':
        return <XCircle className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  return (
    <Layout menuItems={adminMenuItems} title="Security Center">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-7 h-7 text-blue-600" />
              Enterprise Security Center
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Real-time authentication monitoring, threat detection, and session management
            </p>
          </div>
          <Button onClick={handleViewAuditLogs} variant="outline" className="gap-2">
            <Eye className="w-4 h-4" />
            View Full Audit Logs
          </Button>
        </div>

        {/* Critical Alerts Banner */}
        {criticalAlerts.length > 0 && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-900 mb-1">
                  {criticalAlerts.length} Critical Security Alert{criticalAlerts.length !== 1 ? 's' : ''} Require Attention
                </h3>
                <div className="space-y-2 mt-3">
                  {criticalAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-200 cursor-pointer hover:border-red-300 transition-colors"
                      onClick={() => handleAlertClick(alert)}
                    >
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-red-900">{alert.title}</p>
                        <p className="text-xs text-red-700 mt-0.5">{alert.description}</p>
                      </div>
                      <Badge className="text-xs bg-red-600 text-white border-0">
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Security Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Logins (24h)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.totalLogins24h}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">+12% from yesterday</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Failed Logins (24h)</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{metrics.failedLogins24h}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingDown className="w-3 h-3 text-red-600" />
                  <span className="text-xs text-red-600 font-medium">-8% from yesterday</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <UserX className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Suspicious Activities</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{metrics.suspiciousActivities}</p>
                <div className="flex items-center gap-1 mt-2">
                  <AlertTriangle className="w-3 h-3 text-yellow-600" />
                  <span className="text-xs text-yellow-600 font-medium">Requires review</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Blocked Attempts</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.blockedAttempts}</p>
                <div className="flex items-center gap-1 mt-2">
                  <Shield className="w-3 h-3 text-orange-600" />
                  <span className="text-xs text-orange-600 font-medium">Auto-blocked</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Active Sessions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.activeSessions}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">MFA Enabled</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.mfaEnabled}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Key className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Account Lockouts</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.accountLockouts}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Unusual Access</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.unusualAccess}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Authentication Events */}
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Authentication Events
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {authEvents.map((event) => {
                const statusConfig = getStatusConfig(event.status);
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className={`w-10 h-10 ${statusConfig.className} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      {statusConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{event.eventType}</p>
                          <p className="text-sm text-gray-600">{event.username}</p>
                        </div>
                        <span className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {event.ipAddress}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Server className="w-3 h-3" />
                          {event.device}
                        </div>
                        {event.mfaVerified && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Key className="w-3 h-3" />
                            MFA Verified
                          </div>
                        )}
                      </div>
                      {event.reason && (
                        <p className="text-xs text-red-600 mt-2 font-medium">{event.reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Active Sessions Monitor */}
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Active Session Monitor
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Login Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {activeSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{session.username}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {session.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-700">{session.ipAddress}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">{session.location}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">{session.device}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">
                        {formatTimeAgo(session.loginTime)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">
                        {formatTimeAgo(session.lastActivity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${session.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className={`text-xs font-medium capitalize ${getSessionStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Alert Details Modal */}
      <Dialog open={showAlertDetails} onOpenChange={setShowAlertDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              {selectedAlert && (
                <>
                  <div className={`w-12 h-12 ${getSeverityColor(selectedAlert.severity)} rounded-lg flex items-center justify-center`}>
                    {getAlertTypeIcon(selectedAlert.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{selectedAlert.title}</span>
                      <Badge className={`text-xs font-bold border ${getSeverityColor(selectedAlert.severity)}`}>
                        {selectedAlert.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Security threat detected - Review details and take appropriate action
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Alert Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Alert ID:</span>
                    <span className="font-mono text-gray-900">{selectedAlert.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Timestamp:</span>
                    <span className="text-gray-900">{selectedAlert.timestamp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Type:</span>
                    <span className="text-gray-900 capitalize">{selectedAlert.type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Severity:</span>
                    <Badge className={`text-xs font-bold border ${getSeverityColor(selectedAlert.severity)}`}>
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  {selectedAlert.affectedAccount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Affected Account:</span>
                      <span className="font-mono text-red-700">{selectedAlert.affectedAccount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={`p-4 border rounded-lg ${
                selectedAlert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                selectedAlert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                selectedAlert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedAlert.description}
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Recommended Actions
                </h3>
                <ul className="space-y-2 text-sm text-purple-800">
                  {selectedAlert.type === 'impossible_travel' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Immediately contact the affected user to verify the login attempt</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Temporarily suspend the account if unauthorized access is confirmed</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Force password reset and review recent account activity</span>
                      </li>
                    </>
                  )}
                  {selectedAlert.type === 'brute_force' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>IP address has been automatically blocked by the system</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Add IP to permanent blocklist if attack persists</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Monitor for distributed attacks from multiple IPs</span>
                      </li>
                    </>
                  )}
                  {selectedAlert.type === 'suspicious_upload' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>File has been quarantined and blocked from processing</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Review user's recent upload activity for similar patterns</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Consider account suspension if malicious intent is suspected</span>
                      </li>
                    </>
                  )}
                  {selectedAlert.type === 'unusual_access' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Verify this was an authorized access during off-hours</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Review audit logs for any suspicious activity during this session</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Update access policies if this represents a new work pattern</span>
                      </li>
                    </>
                  )}
                  {selectedAlert.type === 'repeated_failures' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Contact user to verify if they are experiencing login issues</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Check if account is locked and assist with password reset if needed</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span>Monitor for potential account compromise attempts</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowAlertDetails(false);
                    if (selectedAlert.investigateUrl) {
                      navigate(selectedAlert.investigateUrl);
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Audit Log
                </Button>
                <Button onClick={() => setShowAlertDetails(false)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
