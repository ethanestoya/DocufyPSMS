// SIEM (Security Information and Event Management) Alert Store
// Manages security alerts for real-time threat monitoring

export type SIEMAlertType =
  | 'impossible_travel'
  | 'brute_force'
  | 'suspicious_upload'
  | 'unusual_access'
  | 'repeated_failures';

export type SIEMAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SIEMAlert {
  id: string;
  type: SIEMAlertType;
  severity: SIEMAlertSeverity;
  title: string;
  description: string;
  affectedAccount?: string;
  timestamp: Date;
  read: boolean;
  investigateUrl?: string;
}

class SIEMAlertStore {
  private alerts: SIEMAlert[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initializeMockAlerts();
  }

  private initializeMockAlerts() {
    // Generate realistic SIEM alerts for demonstration
    this.alerts = [
      {
        id: 'SIEM-001',
        type: 'impossible_travel',
        severity: 'critical',
        title: 'Impossible Travel Detected',
        description: 'User logged in from Berlin, Germany 10 minutes after Manila, Philippines login',
        affectedAccount: 'customer@test.com',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        read: false,
        investigateUrl: '/admin/audit-logs',
      },
      {
        id: 'SIEM-002',
        type: 'brute_force',
        severity: 'critical',
        title: 'Brute Force Attack Detected',
        description: '15 failed login attempts from IP 45.142.212.61 in 2 minutes',
        affectedAccount: 'multiple',
        timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        read: false,
        investigateUrl: '/admin/audit-logs',
      },
      {
        id: 'SIEM-003',
        type: 'suspicious_upload',
        severity: 'high',
        title: 'Suspicious File Upload Blocked',
        description: 'Malware scanner flagged uploaded file: potential.exe',
        affectedAccount: 'staff@test.com',
        timestamp: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
        read: false,
        investigateUrl: '/admin/audit-logs',
      },
      {
        id: 'SIEM-004',
        type: 'unusual_access',
        severity: 'medium',
        title: 'Administrator Access at Unusual Time',
        description: 'Admin panel accessed at 11:20 PM (outside normal hours)',
        affectedAccount: 'admin@test.com',
        timestamp: new Date(Date.now() - 180 * 60 * 1000), // 3 hours ago
        read: false,
        investigateUrl: '/admin/audit-logs',
      },
      {
        id: 'SIEM-005',
        type: 'repeated_failures',
        severity: 'medium',
        title: 'Repeated Password Reset Attempts',
        description: '5 password reset requests in 10 minutes from same user',
        affectedAccount: 'customer@test.com',
        timestamp: new Date(Date.now() - 300 * 60 * 1000), // 5 hours ago
        read: true,
        investigateUrl: '/admin/audit-logs',
      },
    ];
  }

  addAlert(alert: Omit<SIEMAlert, 'id' | 'timestamp' | 'read'>) {
    const newAlert: SIEMAlert = {
      ...alert,
      id: `SIEM-${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };
    this.alerts.unshift(newAlert);
    this.notifyListeners();
  }

  getAlerts(roleFilter?: 'admin' | 'staff' | 'customer'): SIEMAlert[] {
    // SIEM alerts are typically only visible to admins
    if (roleFilter && roleFilter !== 'admin') {
      return [];
    }
    return [...this.alerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getUnreadCount(roleFilter?: 'admin' | 'staff' | 'customer'): number {
    if (roleFilter && roleFilter !== 'admin') {
      return 0;
    }
    return this.alerts.filter((alert) => !alert.read).length;
  }

  getCriticalUnreadCount(roleFilter?: 'admin' | 'staff' | 'customer'): number {
    if (roleFilter && roleFilter !== 'admin') {
      return 0;
    }
    return this.alerts.filter(
      (alert) => !alert.read && (alert.severity === 'critical' || alert.severity === 'high')
    ).length;
  }

  markAsRead(alertId: string) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.read = true;
      this.notifyListeners();
    }
  }

  markAllAsRead(roleFilter?: 'admin' | 'staff' | 'customer') {
    if (roleFilter && roleFilter !== 'admin') {
      return;
    }
    this.alerts.forEach((alert) => {
      alert.read = true;
    });
    this.notifyListeners();
  }

  deleteAlert(alertId: string) {
    this.alerts = this.alerts.filter((a) => a.id !== alertId);
    this.notifyListeners();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

export const siemAlertStore = new SIEMAlertStore();
