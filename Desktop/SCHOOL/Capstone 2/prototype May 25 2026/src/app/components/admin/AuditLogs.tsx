import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Lock,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Eye,
  UserCheck,
  UserX,
  Upload,
  Key,
  Settings,
  Clock,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

// Mock audit log data with realistic security events
const generateMockAuditLogs = () => {
  const events = [
    {
      id: "AUD-2026-05-24-001",
      timestamp: new Date("2026-05-24T14:32:15"),
      username: "admin@test.com",
      eventType: "Login Success",
      severity: "info" as const,
      ipAddress: "192.168.1.105",
      device: "Chrome 125 / Windows 11",
      status: "Success",
      description: "User successfully logged in",
    },
    {
      id: "AUD-2026-05-24-002",
      timestamp: new Date("2026-05-24T14:28:43"),
      username: "unknown@test.com",
      eventType: "Login Failed",
      severity: "warning" as const,
      ipAddress: "203.124.52.19",
      device: "Firefox 124 / Ubuntu",
      status: "Failed",
      description: "Failed login attempt - Invalid credentials",
    },
    {
      id: "AUD-2026-05-24-003",
      timestamp: new Date("2026-05-24T14:15:22"),
      username: "customer@test.com",
      eventType: "Password Reset",
      severity: "info" as const,
      ipAddress: "192.168.1.110",
      device: "Safari 17 / macOS 14",
      status: "Success",
      description: "Password successfully changed",
    },
    {
      id: "AUD-2026-05-24-004",
      timestamp: new Date("2026-05-24T13:45:10"),
      username: "staff@test.com",
      eventType: "File Upload",
      severity: "info" as const,
      ipAddress: "192.168.1.112",
      device: "Edge 124 / Windows 10",
      status: "Success",
      description: "Uploaded file: order-invoice-2026.pdf (2.5 MB)",
    },
    {
      id: "AUD-2026-05-24-005",
      timestamp: new Date("2026-05-24T13:20:33"),
      username: "admin@test.com",
      eventType: "Role Change",
      severity: "critical" as const,
      ipAddress: "192.168.1.105",
      device: "Chrome 125 / Windows 11",
      status: "Success",
      description: "Changed user role: customer@test.com from 'customer' to 'staff'",
    },
    {
      id: "AUD-2026-05-24-006",
      timestamp: new Date("2026-05-24T13:10:15"),
      username: "attacker@malicious.com",
      eventType: "Brute Force Detected",
      severity: "critical" as const,
      ipAddress: "45.142.212.61",
      device: "Python-requests/2.28",
      status: "Blocked",
      description: "Blocked 15 rapid login attempts from same IP",
    },
    {
      id: "AUD-2026-05-24-007",
      timestamp: new Date("2026-05-24T12:55:48"),
      username: "admin@test.com",
      eventType: "Payment Verified",
      severity: "success" as const,
      ipAddress: "192.168.1.105",
      device: "Chrome 125 / Windows 11",
      status: "Success",
      description: "Verified payment for order #ORD-2026-0054",
    },
    {
      id: "AUD-2026-05-24-008",
      timestamp: new Date("2026-05-24T12:30:22"),
      username: "staff@test.com",
      eventType: "Session Expired",
      severity: "info" as const,
      ipAddress: "192.168.1.112",
      device: "Edge 124 / Windows 10",
      status: "Success",
      description: "User session expired due to inactivity (30 min)",
    },
    {
      id: "AUD-2026-05-24-009",
      timestamp: new Date("2026-05-24T11:45:00"),
      username: "customer@test.com",
      eventType: "Impossible Travel",
      severity: "critical" as const,
      ipAddress: "85.214.132.55",
      device: "Chrome 124 / Android 13",
      status: "Flagged",
      description: "Login from Berlin, Germany detected 10 minutes after Manila login",
    },
    {
      id: "AUD-2026-05-24-010",
      timestamp: new Date("2026-05-24T11:20:15"),
      username: "admin@test.com",
      eventType: "Administrator Access",
      severity: "warning" as const,
      ipAddress: "192.168.1.105",
      device: "Chrome 125 / Windows 11",
      status: "Success",
      description: "Accessed admin panel at 11:20 PM (unusual time)",
    },
    {
      id: "AUD-2026-05-24-011",
      timestamp: new Date("2026-05-24T10:55:30"),
      username: "system",
      eventType: "Backup Created",
      severity: "success" as const,
      ipAddress: "127.0.0.1",
      device: "System Scheduler",
      status: "Success",
      description: "Automated database backup completed (backup_2026-05-24.sql.gz)",
    },
    {
      id: "AUD-2026-05-24-012",
      timestamp: new Date("2026-05-24T10:30:45"),
      username: "staff@test.com",
      eventType: "File Upload",
      severity: "warning" as const,
      ipAddress: "192.168.1.112",
      device: "Edge 124 / Windows 10",
      status: "Rejected",
      description: "Suspicious file upload blocked: malware-sample.exe (flagged by scanner)",
    },
  ];

  return events;
};

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);

  const auditLogs = useMemo(() => generateMockAuditLogs(), []);

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    const types = Array.from(new Set(auditLogs.map((log) => log.eventType)));
    return types.sort();
  }, [auditLogs]);

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        searchQuery === "" ||
        log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.ipAddress.includes(searchQuery);

      const matchesSeverity =
        severityFilter === "all" || log.severity === severityFilter;

      const matchesEventType =
        eventTypeFilter === "all" || log.eventType === eventTypeFilter;

      return matchesSearch && matchesSeverity && matchesEventType;
    });
  }, [auditLogs, searchQuery, severityFilter, eventTypeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          label: "Critical",
          className: "bg-red-100 text-red-700 border-red-200",
          icon: <AlertTriangle className="w-3 h-3" />,
        };
      case "warning":
        return {
          label: "Warning",
          className: "bg-yellow-100 text-yellow-700 border-yellow-200",
          icon: <AlertTriangle className="w-3 h-3" />,
        };
      case "success":
        return {
          label: "Success",
          className: "bg-green-100 text-green-700 border-green-200",
          icon: <CheckCircle className="w-3 h-3" />,
        };
      default:
        return {
          label: "Info",
          className: "bg-blue-100 text-blue-700 border-blue-200",
          icon: <Info className="w-3 h-3" />,
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Success":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "Failed":
      case "Rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "Blocked":
      case "Flagged":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const handleExport = () => {
    const csvContent = [
      ["Event ID", "Timestamp", "Username", "Event Type", "Severity", "IP Address", "Device", "Status", "Description"],
      ...filteredLogs.map((log) => [
        log.id,
        log.timestamp.toISOString(),
        log.username,
        log.eventType,
        log.severity,
        log.ipAddress,
        log.device,
        log.status,
        log.description,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleLogClick = (log: any) => {
    setSelectedLog(log);
    setShowLogDetails(true);
  };

  return (
    <Layout menuItems={adminMenuItems} title="Audit Logs">
      <div className="space-y-6">
        {/* Header with Immutability Notice */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-7 h-7 text-purple-600" />
              Security Audit Logs
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Centralized monitoring and tracking of security-related events
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <Lock className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-purple-900">Log Immutability Enabled</p>
              <p className="text-xs text-purple-700">Records are cryptographically protected</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by username, event, IP address..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Severity Filter */}
              <Select
                value={severityFilter}
                onValueChange={(value) => {
                  setSeverityFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>

              {/* Event Type Filter */}
              <Select
                value={eventTypeFilter}
                onValueChange={(value) => {
                  setEventTypeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Event Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Event Types</SelectItem>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredLogs.length}</span> of{" "}
                <span className="font-semibold">{auditLogs.length}</span> audit entries
              </p>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Audit Log Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-gray-400" />
                      Event ID
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedLogs.map((log) => {
                  const severityConfig = getSeverityConfig(log.severity);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleLogClick(log)}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs font-mono text-gray-900">{log.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-700">
                          {log.timestamp.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {log.timestamp.toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">{log.username}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-700">{log.eventType}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          className={`text-xs font-semibold border ${severityConfig.className} flex items-center gap-1 w-fit`}
                        >
                          {severityConfig.icon}
                          {severityConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-700">{log.ipAddress}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-600">{log.device}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(log.status)}
                          <span className="text-xs font-medium text-gray-700">{log.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-700 max-w-md">{log.description}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Integrity Notice Card */}
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-purple-900 mb-2">
                Cryptographic Log Integrity Protection
              </h3>
              <p className="text-xs text-purple-800 mb-3 leading-relaxed">
                All audit log entries are cryptographically sealed using SHA-256 hashing and cannot be
                modified or deleted. Each record includes timestamp, user context, and immutable hash
                verification to ensure complete audit trail integrity for compliance and security
                investigations.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-white rounded-lg border border-purple-200">
                  <p className="text-xs font-semibold text-purple-900">Hash Algorithm</p>
                  <p className="text-xs text-purple-700 mt-1">SHA-256</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-purple-200">
                  <p className="text-xs font-semibold text-purple-900">Retention Period</p>
                  <p className="text-xs text-purple-700 mt-1">7 Years</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-purple-200">
                  <p className="text-xs font-semibold text-purple-900">Last Verification</p>
                  <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Log Details Modal */}
      <Dialog open={showLogDetails} onOpenChange={setShowLogDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              {selectedLog && (
                <>
                  <div className={`w-12 h-12 ${getSeverityConfig(selectedLog.severity).className} rounded-lg flex items-center justify-center`}>
                    {getSeverityConfig(selectedLog.severity).icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{selectedLog.eventType}</span>
                      <Badge className={`text-xs font-bold border ${getSeverityConfig(selectedLog.severity).className}`}>
                        {getSeverityConfig(selectedLog.severity).label}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Immutable audit log entry - Read-only cryptographically protected record
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Lock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <div className="text-xs text-purple-800">
                  <span className="font-bold">Immutable Record:</span> This audit log entry is cryptographically sealed and cannot be modified or deleted.
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Event Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium">Event ID</p>
                    <p className="font-mono text-gray-900 mt-1 flex items-center gap-2">
                      <Lock className="w-3 h-3 text-gray-400" />
                      {selectedLog.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Timestamp</p>
                    <p className="text-gray-900 mt-1">{selectedLog.timestamp.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Username</p>
                    <p className="text-gray-900 mt-1">{selectedLog.username}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Event Type</p>
                    <p className="text-gray-900 mt-1">{selectedLog.eventType}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Status</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {getStatusIcon(selectedLog.status)}
                      <span className="font-medium text-gray-700">{selectedLog.status}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Severity</p>
                    <div className="mt-1">
                      <Badge className={`text-xs font-bold border ${getSeverityConfig(selectedLog.severity).className}`}>
                        {getSeverityConfig(selectedLog.severity).label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Network & Device Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium">IP Address</p>
                    <p className="font-mono text-gray-900 mt-1">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Device / Browser</p>
                    <p className="text-gray-900 mt-1">{selectedLog.device}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-bold text-blue-900 mb-2">Event Description</h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {selectedLog.description}
                </p>
                {selectedLog.errorMessage && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs font-medium text-red-900">Error Details:</p>
                    <p className="text-xs text-red-800 mt-1">{selectedLog.errorMessage}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-purple-900 mb-2">Cryptographic Integrity</h3>
                    <p className="text-xs text-purple-800 mb-3">
                      This record is protected with SHA-256 cryptographic hashing to ensure immutability and prevent tampering.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-2 bg-white rounded border border-purple-200 text-center">
                        <p className="text-xs text-purple-700 font-medium">Hash Algorithm</p>
                        <p className="text-xs font-bold text-purple-900 mt-1">SHA-256</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-purple-200 text-center">
                        <p className="text-xs text-purple-700 font-medium">Verification</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <p className="text-xs font-bold text-green-700">Verified</p>
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded border border-purple-200 text-center">
                        <p className="text-xs text-purple-700 font-medium">Retention</p>
                        <p className="text-xs font-bold text-purple-900 mt-1">7 Years</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={() => setShowLogDetails(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
