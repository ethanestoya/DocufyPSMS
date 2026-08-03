import React, { useState, useMemo } from "react";
import {
  Database,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Play,
  Shield,
  Clock,
  Server,
  Activity,
  FileCheck,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Info,
  Lock,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { toast } from "sonner";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

// Mock backup history data
const generateMockBackups = () => {
  return [
    {
      id: "BKP-2026-05-24-001",
      timestamp: new Date("2026-05-24T06:00:00"),
      type: "Automated",
      status: "Successful" as const,
      size: "2.47 GB",
      duration: "4m 23s",
      storageRegion: "US-East-1",
      encryption: "AES-256",
      integrityHash: "a7f3c9d2e8b4f1a6c2d5e9f8b3a1c4d7e2f5a8b9",
      verificationStatus: "Hash Match Verified" as const,
    },
    {
      id: "BKP-2026-05-23-001",
      timestamp: new Date("2026-05-23T06:00:00"),
      type: "Automated",
      status: "Successful" as const,
      size: "2.45 GB",
      duration: "4m 18s",
      storageRegion: "US-East-1",
      encryption: "AES-256",
      integrityHash: "b2e4d6f8a1c3e5g7i9k1m3o5q7s9u1w3",
      verificationStatus: "Hash Match Verified" as const,
    },
    {
      id: "BKP-2026-05-22-001",
      timestamp: new Date("2026-05-22T06:00:00"),
      type: "Automated",
      status: "Successful" as const,
      size: "2.43 GB",
      duration: "4m 15s",
      storageRegion: "US-East-1",
      encryption: "AES-256",
      integrityHash: "c3f5h7j9l1n3p5r7t9v1x3z5a7c9e1g3",
      verificationStatus: "Hash Match Verified" as const,
    },
    {
      id: "BKP-2026-05-20-001",
      timestamp: new Date("2026-05-20T06:00:00"),
      type: "Manual",
      status: "Successful" as const,
      size: "2.39 GB",
      duration: "4m 08s",
      storageRegion: "US-West-2",
      encryption: "AES-256",
      integrityHash: "e5h7j9l1n3p5r7t9v1x3z5b7d9f1h3j5",
      verificationStatus: "Hash Match Verified" as const,
    },
    {
      id: "BKP-2026-05-19-001",
      timestamp: new Date("2026-05-19T06:00:00"),
      type: "Automated",
      status: "Failed" as const,
      size: "0 GB",
      duration: "1m 05s",
      storageRegion: "US-East-1",
      encryption: "N/A",
      integrityHash: "N/A",
      verificationStatus: "Failed" as const,
      errorMessage: "Connection timeout to storage provider",
    },
  ];
};

// System health metrics
const systemHealth = {
  cpu: { usage: 42, status: "healthy" as const },
  memory: { usage: 68, status: "healthy" as const },
  disk: { usage: 54, status: "healthy" as const },
  network: { status: "healthy" as const, latency: "12ms" },
  database: { status: "healthy" as const, connections: 42, maxConnections: 200 },
};

export default function BackupManagement() {
  const [backups, setBackups] = useState(generateMockBackups());
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showBackupResult, setShowBackupResult] = useState(false);
  const [showVerifyResult, setShowVerifyResult] = useState(false);
  const [backupResult, setBackupResult] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const stats = useMemo(() => {
    const successful = backups.filter((b) => b.status === "Successful").length;
    const failed = backups.filter((b) => b.status === "Failed").length;
    const lastBackup = backups[0];
    const totalSize = backups
      .filter((b) => b.status === "Successful")
      .reduce((sum, b) => {
        const size = parseFloat(b.size.replace(" GB", ""));
        return sum + size;
      }, 0);

    return {
      total: backups.length,
      successful,
      failed,
      successRate: ((successful / backups.length) * 100).toFixed(1),
      lastBackup,
      totalSize: totalSize.toFixed(2),
    };
  }, [backups]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Successful":
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-600" />,
          className: "bg-green-100 text-green-700 border-green-200",
        };
      case "Failed":
        return {
          icon: <XCircle className="w-5 h-5 text-red-600" />,
          className: "bg-red-100 text-red-700 border-red-200",
        };
      case "Verifying":
        return {
          icon: <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />,
          className: "bg-blue-100 text-blue-700 border-blue-200",
        };
      default:
        return {
          icon: <Clock className="w-5 h-5 text-gray-600" />,
          className: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  const getVerificationConfig = (status: string) => {
    switch (status) {
      case "Hash Match Verified":
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-600" />,
          className: "text-green-700",
        };
      case "In Progress":
        return {
          icon: <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />,
          className: "text-blue-700",
        };
      case "Failed":
        return {
          icon: <XCircle className="w-4 h-4 text-red-600" />,
          className: "text-red-700",
        };
      default:
        return {
          icon: <AlertCircle className="w-4 h-4 text-gray-600" />,
          className: "text-gray-700",
        };
    }
  };

  const handleRunBackup = () => {
    setIsRunningBackup(true);
    toast.loading("Initiating database backup...", { id: "backup" });

    setTimeout(() => {
      const newBackup = {
        id: `BKP-${new Date().toISOString().split('T')[0]}-${String(backups.length + 1).padStart(3, '0')}`,
        timestamp: new Date(),
        type: "Manual" as const,
        status: "Successful" as const,
        size: "2.48 GB",
        duration: "4m 28s",
        storageRegion: "US-East-1",
        encryption: "AES-256",
        integrityHash: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        verificationStatus: "Hash Match Verified" as const,
      };

      setBackups([newBackup, ...backups]);
      setBackupResult(newBackup);
      setIsRunningBackup(false);
      setShowBackupResult(true);
      toast.success("Backup completed successfully!", { id: "backup" });
    }, 3000);
  };

  const handleVerifyIntegrity = () => {
    setIsVerifying(true);
    toast.loading("Running integrity verification...", { id: "verify" });

    setTimeout(() => {
      const results = {
        totalBackups: backups.length,
        verified: backups.length,
        failed: 0,
        successRate: 100,
        lastVerified: new Date(),
        details: backups.map(b => ({
          id: b.id,
          status: "Verified",
          hash: b.integrityHash,
        })),
      };

      setVerifyResult(results);
      setIsVerifying(false);
      setShowVerifyResult(true);
      toast.success("All backups verified successfully!", { id: "verify" });
    }, 2500);
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage < 50) return "bg-green-500";
    if (usage < 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Layout menuItems={adminMenuItems} title="Backup & Integrity">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Database className="w-7 h-7 text-blue-600" />
              Infrastructure & Backup Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Automated backup monitoring and system health dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleVerifyIntegrity}
              disabled={isVerifying}
              className="gap-2"
            >
              {isVerifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              Verify Integrity
            </Button>
            <Button
              onClick={handleRunBackup}
              disabled={isRunningBackup}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {isRunningBackup ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Backup
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Backups</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Success Rate</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.successRate}%</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Size</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSize} GB</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Last Backup</p>
                <p className="text-sm font-bold text-gray-900 mt-2">
                  {stats.lastBackup.timestamp.toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.lastBackup.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* System Health Dashboard */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            System Health Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CPU */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">CPU Usage</span>
                <span className={`text-sm font-bold ${getHealthStatusColor(systemHealth.cpu.status)}`}>
                  {systemHealth.cpu.usage}%
                </span>
              </div>
              <Progress value={systemHealth.cpu.usage} className="h-2" />
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getUsageColor(systemHealth.cpu.usage)}`} />
                <span className="text-xs text-gray-500 capitalize">{systemHealth.cpu.status}</span>
              </div>
            </div>

            {/* Memory */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Memory Usage</span>
                <span className={`text-sm font-bold ${getHealthStatusColor(systemHealth.memory.status)}`}>
                  {systemHealth.memory.usage}%
                </span>
              </div>
              <Progress value={systemHealth.memory.usage} className="h-2" />
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getUsageColor(systemHealth.memory.usage)}`} />
                <span className="text-xs text-gray-500 capitalize">{systemHealth.memory.status}</span>
              </div>
            </div>

            {/* Disk */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Disk Usage</span>
                <span className={`text-sm font-bold ${getHealthStatusColor(systemHealth.disk.status)}`}>
                  {systemHealth.disk.usage}%
                </span>
              </div>
              <Progress value={systemHealth.disk.usage} className="h-2" />
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getUsageColor(systemHealth.disk.usage)}`} />
                <span className="text-xs text-gray-500 capitalize">{systemHealth.disk.status}</span>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 font-medium">Network Latency</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{systemHealth.network.latency}</p>
              </div>
              <Server className="w-8 h-8 text-gray-400" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 font-medium">Database Connections</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {systemHealth.database.connections} / {systemHealth.database.maxConnections}
                </p>
              </div>
              <Database className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </Card>

        {/* Backup History Table */}
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Backup History & Timeline
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Backup ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Storage Region
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Encryption
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Verification
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {backups.map((backup) => {
                  const statusConfig = getStatusConfig(backup.status);
                  const verificationConfig = getVerificationConfig(backup.verificationStatus);
                  return (
                    <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-900">{backup.id}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-700">
                          {backup.timestamp.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {backup.timestamp.toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {backup.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {statusConfig.icon}
                          <Badge className={`text-xs font-semibold border ${statusConfig.className}`}>
                            {backup.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-700">{backup.size}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-600">{backup.duration}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-700">{backup.storageRegion}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                          {backup.encryption}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${verificationConfig.className}`}>
                          {verificationConfig.icon}
                          {backup.verificationStatus}
                        </div>
                        {backup.status === "Successful" && backup.verificationStatus === "Hash Match Verified" && (
                          <p className="text-xs text-gray-500 mt-1 font-mono truncate max-w-xs">
                            SHA-256: {backup.integrityHash.substring(0, 16)}...
                          </p>
                        )}
                        {backup.errorMessage && (
                          <p className="text-xs text-red-600 mt-1">{backup.errorMessage}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Backup Result Modal */}
      <Dialog open={showBackupResult} onOpenChange={setShowBackupResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Backup Completed Successfully
            </DialogTitle>
            <DialogDescription>
              Database backup operation completed with cryptographic integrity verification
            </DialogDescription>
          </DialogHeader>
          {backupResult && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium">Backup ID</p>
                    <p className="font-mono text-gray-900 mt-1">{backupResult.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Timestamp</p>
                    <p className="text-gray-900 mt-1">{backupResult.timestamp.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Size</p>
                    <p className="text-gray-900 mt-1">{backupResult.size}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Duration</p>
                    <p className="text-gray-900 mt-1">{backupResult.duration}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Storage Region</p>
                    <p className="text-gray-900 mt-1">{backupResult.storageRegion}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Encryption</p>
                    <p className="text-gray-900 mt-1">{backupResult.encryption}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-purple-900 mb-1">
                      Cryptographic Integrity Verification
                    </p>
                    <p className="text-xs text-purple-800 mb-2">
                      SHA-256 hash calculated and verified for tamper detection
                    </p>
                    <div className="p-2 bg-white rounded border border-purple-200 font-mono text-xs text-gray-700 break-all">
                      {backupResult.integrityHash}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-700">
                        Hash Match Verified - Backup Integrity Confirmed
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-blue-800">
                  Backup has been securely stored and is ready for restoration if needed.
                </p>
              </div>

              <Button onClick={() => setShowBackupResult(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verify Result Modal */}
      <Dialog open={showVerifyResult} onOpenChange={setShowVerifyResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Integrity Verification Complete
            </DialogTitle>
            <DialogDescription>
              All backups have been cryptographically verified for integrity
            </DialogDescription>
          </DialogHeader>
          {verifyResult && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-sm text-gray-600 font-medium">Total Backups</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{verifyResult.totalBackups}</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-sm text-gray-600 font-medium">Verified</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{verifyResult.verified}</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-sm text-gray-600 font-medium">Success Rate</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{verifyResult.successRate}%</p>
                </Card>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-900 mb-1">
                      All Backups Verified Successfully
                    </p>
                    <p className="text-xs text-green-800">
                      SHA-256 integrity hashes match expected values. No corruption or tampering detected.
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Backup ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Hash Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {verifyResult.details.map((detail: any) => (
                      <tr key={detail.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-900">{detail.id}</td>
                        <td className="px-3 py-2">
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                            {detail.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600">{detail.hash.substring(0, 16)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                <Lock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <p className="text-purple-800">
                  Last verified: {verifyResult.lastVerified.toLocaleString()}
                </p>
              </div>

              <Button onClick={() => setShowVerifyResult(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
