// Centralized notification store
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import {
  fetchNotifications,
  pushNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  subscribeNotifications,
} from '../../lib/db/notificationsRepo';
import type { NotificationDto } from '../../lib/db/notificationsRepo';

type Notification = {
  id: string;
  // Server uuid once the row reaches Supabase; used to reconcile realtime
  // echoes (a row pushed here and echoed back is the SAME notification).
  dbId?: string;
  type: 'order' | 'payment' | 'status_update' | 'inventory';
  priority?: 'important' | 'emergency';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  clickable: boolean;
  relatedOrderId?: string;
  relatedRoute?: string;
  recipientRole?: 'customer' | 'staff' | 'admin' | 'staff_admin' | 'all';
  recipientEmail?: string;
};

type Subscriber = () => void;

// The store is a Supabase-backed facade over the localStorage mirror: every
// public method keeps its signature, DOM mutations are local-first with a
// best-effort push to the backend, DB rows are adopted on hydrate + realtime
// change (DB wins when rows exist; an empty/errored DB keeps the mirror as the
// offline fallback). RLS-denied writes stay local silently; other failures
// surface via showDbError.
class NotificationStore {
  private notifications: Notification[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private initialized: boolean = false;
  private remoteStarted = false;

  constructor() {
    this.loadFromStorage();

    // Cross-tab live sync: notifications added in ANOTHER tab/window (e.g. the
    // staff tab where an order was placed, while the admin Notifications page
    // is open in a second tab) persist to localStorage, which fires a `storage`
    // event HERE. Reload from storage and re-render every subscriber live — the
    // bell badge, the Notifications dropdown, and the full Notifications page
    // all update without a page refresh.
    window.addEventListener('storage', (e) => {
      if (e.key !== 'notifications' || e.newValue == null) return;
      this.reloadFromStorage();
    });
  }

  // ── Supabase: hydrate + live sync ────────────────────────────────────────

  private startRemote(): void {
    if (this.remoteStarted) return;
    this.remoteStarted = true;
    // Any change (another tab, another device) → refetch and merge. The store
    // passes a no-arg callback; the payload is deliberately ignored because the
    // refetch is the single canonical merge path (dedupes our own echoes too).
    subscribeNotifications(() => {
      void this.refreshRemote();
    });
    void this.refreshRemote();
  }

  // Merge DB rows into the mirror, keyed by dbId so a pushed local row and its
  // realtime echo collapse into one. The DB is source of truth for the rows it
  // has, but an empty/unreachable backend NEVER wipes the localStorage mirror —
  // that is the offline fallback.
  private async refreshRemote(): Promise<void> {
    await authReady;
    try {
      const dtos = await fetchNotifications();
      if (dtos.length === 0) return;
      const remote = dtos.map(toLocalNotification);
      const merged = new Map<string, Notification>();
      for (const n of this.notifications) merged.set(n.dbId ?? n.id, n);
      for (const r of remote) merged.set(r.dbId ?? r.id, r);
      this.notifications = Array.from(merged.values()).sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
      this.saveToStorage();
    } catch {
      // keep the local mirror
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles: a fresh
  // incognito boot ran with the anonymous token, so the DB rows appear the
  // moment the user logs in without needing a page reload).
  async refreshFromBackend(): Promise<void> {
    await this.refreshRemote();
  }

  // ── localStorage mirror ──────────────────────────────────────────────────

  private parseNotifications(raw: string): Notification[] {
    try {
      const parsed = JSON.parse(raw);
      return parsed.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));
    } catch (e) {
      console.error('Failed to parse notifications:', e);
      return [];
    }
  }

  private loadFromStorage() {
    if (this.initialized) return;

    const saved = localStorage.getItem('notifications');
    if (saved) {
      this.notifications = this.parseNotifications(saved);
    }
    this.initialized = true;
    this.startRemote();
  }

  // Re-read unconditionally (ignores the `initialized` guard) and notify. Used
  // by the cross-tab `storage` listener so a fresh snapshot from another tab
  // replaces the in-memory list and every subscriber re-renders.
  private reloadFromStorage() {
    const saved = localStorage.getItem('notifications');
    this.notifications = saved ? this.parseNotifications(saved) : [];
    this.notify();
  }

  private saveToStorage() {
    localStorage.setItem('notifications', JSON.stringify(this.notifications));
    this.notify();
  }

  private notify() {
    this.subscribers.forEach((callback) => callback());
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  // Add a new notification
  addNotification(
    type: Notification['type'],
    title: string,
    message: string,
    options?: {
      clickable?: boolean;
      priority?: Notification['priority'];
      relatedOrderId?: string;
      relatedRoute?: string;
      recipientRole?: Notification['recipientRole'];
      recipientEmail?: string;
    }
  ) {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      priority: options?.priority,
      title,
      message,
      timestamp: new Date(),
      read: false,
      clickable: options?.clickable || false,
      relatedOrderId: options?.relatedOrderId,
      relatedRoute: options?.relatedRoute,
      recipientRole: options?.recipientRole || 'all',
      recipientEmail: options?.recipientEmail,
    };

    this.notifications.unshift(notification);
    this.saveToStorage();
    void this.syncPush(notification);
    return notification.id;
  }

  // Best-effort: write to Supabase, then adopt the server uuid so a later
  // realtime echo of the same row merges onto it instead of duplicating.
  private async syncPush(notification: Notification): Promise<void> {
    try {
      const dbId = await pushNotification({
        type: notification.type,
        priority: notification.priority ?? null,
        title: notification.title,
        message: notification.message,
        clickable: notification.clickable,
        relatedOrderId: notification.relatedOrderId,
        relatedRoute: notification.relatedRoute,
        recipientRole: notification.recipientRole,
        recipientEmail: notification.recipientEmail,
      });
      if (dbId) {
        const item = this.notifications.find((n) => n.id === notification.id);
        if (item) {
          item.dbId = dbId;
          this.saveToStorage();
        }
      }
      console.info(
        '[db:notification-push] ok',
        dbId,
        notification.type,
        notification.recipientRole ?? null,
        notification.recipientEmail ?? null,
      );
    } catch (err) {
      if (isRlsDenied(err)) {
        console.warn('[db:notification-push] RLS denied', notification.type, notification.title);
      } else {
        showDbError('notification sync', err);
      }
    }
  }

  // Get notifications for a specific user
  getNotifications(userRole?: string, userEmail?: string): Notification[] {
    if (!userRole) return this.notifications;

    return this.notifications.filter((n) => {
      // Role match: 'staff_admin' targets staff and admin only (inventory alerts).
      const roleMatch =
        n.recipientRole === 'all' ||
        n.recipientRole === userRole ||
        (n.recipientRole === 'staff_admin' &&
          (userRole === 'staff' || userRole === 'admin'));
      // Check email match (if specified)
      const emailMatch = !n.recipientEmail || n.recipientEmail === userEmail;
      return roleMatch && emailMatch;
    });
  }

  // Get unread count for a user
  getUnreadCount(userRole?: string, userEmail?: string): number {
    const userNotifications = this.getNotifications(userRole, userEmail);
    return userNotifications.filter((n) => !n.read).length;
  }

  // Mark notification as read
  markAsRead(notificationId: string) {
    const notification = this.findNotification(notificationId);
    if (!notification || notification.read) return;
    notification.read = true;
    this.saveToStorage();
    if (notification.dbId) {
      void this.syncRead(notification.dbId);
    }
  }

  // Mark all notifications as read for a user
  markAllAsRead(userRole?: string, userEmail?: string) {
    const userNotifications = this.getNotifications(userRole, userEmail);
    if (userNotifications.length === 0) return;
    userNotifications.forEach((n) => {
      n.read = true;
    });
    this.saveToStorage();
    void this.syncReadAll();
  }

  // Delete notification
  deleteNotification(notificationId: string) {
    const target = this.findNotification(notificationId);
    this.notifications = this.notifications.filter(
      (n) => n.id !== notificationId && n.dbId !== notificationId,
    );
    this.saveToStorage();
    if (target?.dbId) {
      void this.syncDelete(target.dbId);
    }
  }

  // Clear all notifications (admin only)
  clearAll() {
    const dbIds = this.notifications.map((n) => n.dbId).filter((v): v is string => !!v);
    this.notifications = [];
    this.saveToStorage();
    for (const dbId of dbIds) {
      void this.syncDelete(dbId);
    }
  }

  // Get notification by ID
  getNotificationById(id: string): Notification | undefined {
    return this.findNotification(id);
  }

  private findNotification(id: string): Notification | undefined {
    return this.notifications.find((n) => n.id === id || n.dbId === id);
  }

  private async syncRead(dbId: string): Promise<void> {
    try {
      await markNotificationRead(dbId);
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('mark notification read', err);
    }
  }

  private async syncReadAll(): Promise<void> {
    try {
      await markAllNotificationsRead();
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('mark all notifications read', err);
    }
  }

  private async syncDelete(dbId: string): Promise<void> {
    try {
      await deleteNotification(dbId);
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('delete notification', err);
    }
  }
}

function toLocalNotification(dto: NotificationDto): Notification {
  return {
    id: dto.id,
    dbId: dto.dbId,
    type: dto.type,
    priority: dto.priority ?? undefined,
    title: dto.title,
    message: dto.message,
    timestamp: dto.timestamp,
    read: dto.read,
    clickable: dto.clickable,
    relatedOrderId: dto.relatedOrderId ?? undefined,
    relatedRoute: dto.relatedRoute ?? undefined,
    recipientRole: dto.recipientRole,
    recipientEmail: dto.recipientEmail ?? undefined,
  };
}

export const notificationStore = new NotificationStore();
export type { Notification };
