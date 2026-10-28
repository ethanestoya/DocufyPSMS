// Centralized system-wide notifications/announcements store.
// Admins broadcast a notification via the dashboard "Create Notification"
// button; broadcasts are customer-only and appear in every customer's
// Notifications section. Staff/admin never receive them. Read-state is
// tracked per user email so it survives page changes without a backend.
//
// The `type` field is intentionally open-ended so later system events can push
// their own notifications (e.g. pricing updates, order-status changes) through
// the SAME store without redesigning the Notifications section — just call
// createAnnouncement() with the right type from wherever the event happens.
//
// The store is a Supabase-backed facade: the localStorage mirror stays as the
// offline fallback, DB rows are adopted on hydrate + realtime change (DB wins
// when rows exist), and audience/read state syncs through `announcement_reads`
// (readBy = the current viewer's email when they've read the announcement).
import { toPHT, PHT_OFFSET_MS } from './pht';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import {
  fetchAnnouncements,
  insertAnnouncement,
  markAnnouncementRead,
  deleteAnnouncement,
  resolveProfileIdByEmail,
  sessionUserProfileId,
  subscribeAnnouncements,
} from '../../lib/db/notificationsRepo';
import type { AnnouncementDto } from '../../lib/db/notificationsRepo';

export type AnnouncementType =
  | 'announcement'
  | 'pricing'
  | 'maintenance'
  | 'reminder'
  | 'promo';

// Severity/visibility tier. `type` says WHAT the notice is about (used by
// future system events); `priority` says HOW prominently it must be shown.
export type AnnouncementPriority = 'regular' | 'important' | 'emergency';

export type Announcement = {
  id: string;
  // Server uuid once the row reaches Supabase; used to reconcile realtime
  // echoes (a broadcast pushed here and echoed back is the SAME announcement).
  dbId?: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  title: string;
  message: string;
  // Recipient scope for this announcement. Dashboard broadcasts ("Create
  // Notification") are 'customer'-only — staff/admin never receive them.
  recipientRole: 'customer' | 'all';
  sentBy: string; // sender email
  sentAt: string; // ISO string
  readBy: string[]; // user emails that have marked it read
};

type Subscriber = () => void;

const STORAGE_KEY = 'docufy_announcements_v1';

function isAnnouncementType(value: unknown): value is AnnouncementType {
  return (
    value === 'announcement' ||
    value === 'pricing' ||
    value === 'maintenance' ||
    value === 'reminder' ||
    value === 'promo'
  );
}

function isAnnouncementPriority(value: unknown): value is AnnouncementPriority {
  return value === 'regular' || value === 'important' || value === 'emergency';
}

function isRecipientRole(value: unknown): value is Announcement['recipientRole'] {
  return value === 'customer' || value === 'all';
}

function normalize(raw: unknown): Announcement[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Announcement => {
      if (!item || typeof item !== 'object') return false;
      const a = item as Announcement;
      return (
        typeof a.id === 'string' &&
        typeof a.title === 'string' &&
        typeof a.message === 'string' &&
        typeof a.sentAt === 'string'
      );
    })
    .map((a) => ({
      ...a,
      type: isAnnouncementType(a.type) ? a.type : 'announcement',
      priority: isAnnouncementPriority(a.priority) ? a.priority : 'regular',
      recipientRole: isRecipientRole(a.recipientRole) ? a.recipientRole : 'customer',
      sentBy: typeof a.sentBy === 'string' ? a.sentBy : '',
      readBy: Array.isArray(a.readBy) ? a.readBy.filter((e) => typeof e === 'string') : [],
    }));
}

class AnnouncementsStore {
  private announcements: Announcement[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private initialized = false;
  private remoteStarted = false;

  constructor() {
    this.load();

    // Cross-tab live sync: announcements broadcast in ANOTHER tab/window
    // persist to localStorage, which fires a `storage` event HERE. Reload and
    // notify so the bell badge and the full Notifications page update live.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      this.reload();
    });
  }

  // ── Supabase: hydrate + live sync ────────────────────────────────────────

  private startRemote(): void {
    if (this.remoteStarted) return;
    this.remoteStarted = true;
    subscribeAnnouncements(() => {
      void this.refreshRemote();
    });
    void this.refreshRemote();
  }

  // Merge DB rows into the mirror, keyed by dbId. The DB is source of truth for
  // the rows it has, but an empty/unreachable backend NEVER wipes the
  // localStorage mirror — that is the offline fallback.
  private async refreshRemote(): Promise<void> {
    await authReady;
    try {
      const dtos = await fetchAnnouncements();
      if (dtos.length === 0) return;
      const remote = dtos.map(toLocalAnnouncement);
      const merged = new Map<string, Announcement>();
      for (const a of this.announcements) merged.set(a.dbId ?? a.id, a);
      for (const r of remote) merged.set(r.dbId ?? r.id, r);
      this.announcements = Array.from(merged.values()).sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );
      this.save();
    } catch {
      // keep the local mirror
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles: a fresh
  // incognito boot ran with the anonymous token, so DB rows appear the moment
  // a user logs in without needing a page reload).
  async refreshFromBackend(): Promise<void> {
    await this.refreshRemote();
  }

  // ── localStorage mirror ──────────────────────────────────────────────────

  private load(): void {
    if (this.initialized) return;
    this.reload();
    this.initialized = true;
    this.startRemote();
  }

  // Re-read unconditionally (ignores the `initialized` guard) and notify — used
  // by the cross-tab `storage` listener.
  private reload(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.announcements = normalize(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      this.announcements = [];
    }
    this.notify();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.announcements));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
    this.notify();
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }

  // Arrow-function field (not a method shorthand) so `this` stays bound even
  // when consumers pass it as a detached reference (e.g. to useSyncExternalStore).
  subscribe = (listener: Subscriber): () => void => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  getAnnouncements(): Announcement[] {
    this.load();
    return [...this.announcements].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    );
  }

  // Announcements are scoped by recipientRole: dashboard "Create Notification"
  // broadcasts are 'customer'-only, so staff/admin pass their role and never
  // see them. 'all' announcements are visible to every role.
  getAnnouncementsFor(email: string, viewerRole?: string): Announcement[] {
    const role = viewerRole || '';
    return this.getAnnouncements().filter(
      (a) => a.recipientRole === 'all' || a.recipientRole === 'customer' && role === 'customer',
    );
  }

  getUnreadCount(email: string, viewerRole?: string): number {
    return this.getAnnouncementsFor(email, viewerRole).filter(
      (a) => !a.readBy.includes(email),
    ).length;
  }

  // Unread important/emergency announcements — surfaced as a subtle "needs
  // attention" indicator in the sidebar so urgent items can't get lost.
  getUrgentUnreadCount(email: string, viewerRole?: string): number {
    return this.getAnnouncementsFor(email, viewerRole).filter(
      (a) => a.priority !== 'regular' && !a.readBy.includes(email),
    ).length;
  }

  markRead(id: string, email: string): boolean {
    const index = this.announcements.findIndex((a) => a.id === id);
    if (index === -1) return false;
    if (this.announcements[index].readBy.includes(email)) return true;
    this.announcements = this.announcements.map((a) =>
      a.id === id ? { ...a, readBy: [...a.readBy, email] } : a,
    );
    this.save();
    this.notify();
    const target = this.announcements[index];
    if (target.dbId) {
      void this.syncRead(target.dbId, email);
    } else {
      console.warn(
        '[db:announcement-mark-read] local announcement has no dbId (not synced) — will revert on reload:',
        target.title,
      );
    }
    return true;
  }

  markAllRead(email: string): void {
    const dbIds: string[] = [];
    this.announcements = this.announcements.map((a) => {
      if (a.readBy.includes(email)) return a;
      if (a.dbId) dbIds.push(a.dbId);
      else {
        console.warn(
          '[db:announcement-mark-read] local announcement has no dbId (not synced) — will revert on reload:',
          a.title,
        );
      }
      return { ...a, readBy: [...a.readBy, email] };
    });
    this.save();
    this.notify();
    for (const dbId of dbIds) {
      void this.syncRead(dbId, email);
    }
  }

  // Create a new announcement broadcast. Dashboard broadcasts are customer-only
  // (staff/admin never receive them).
  createAnnouncement(data: {
    title: string;
    message: string;
    type?: AnnouncementType;
    priority?: AnnouncementPriority;
    sentBy: string; // admin email
    recipientRole?: Announcement['recipientRole'];
  }): Announcement {
    const announcement: Announcement = {
      id: `an-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: data.type || 'announcement',
      // Regular notifications are the safe default; anything else asks for
      // a more prominent treatment.
      priority: isAnnouncementPriority(data.priority) ? data.priority : 'regular',
      title: data.title.trim(),
      message: data.message.trim(),
      recipientRole: data.recipientRole || 'customer',
      sentBy: data.sentBy,
      sentAt: new Date().toISOString(),
      // The sender has already seen it — don't count it as unread for them.
      readBy: data.sentBy ? [data.sentBy] : [],
    };
    this.announcements = [announcement, ...this.announcements];
    this.save();
    this.notify();
    void this.syncPush(announcement);
    return announcement;
  }

  deleteAnnouncement(id: string): boolean {
    const target = this.announcements.find((a) => a.id === id || a.dbId === id);
    const next = this.announcements.filter((a) => a.id !== id && a.dbId !== id);
    if (next.length === this.announcements.length) return false;
    this.announcements = next;
    this.save();
    this.notify();
    if (target?.dbId) {
      void this.syncDelete(target.dbId);
    }
    return true;
  }

  private async syncPush(announcement: Announcement): Promise<void> {
    try {
      const dbId = await insertAnnouncement({
        type: announcement.type,
        priority: announcement.priority,
        title: announcement.title,
        message: announcement.message,
        recipientRole: announcement.recipientRole,
        sentBy: announcement.sentBy,
      });
      if (dbId) {
        const item = this.announcements.find((a) => a.id === announcement.id);
        if (item) {
          item.dbId = dbId;
          this.save();
        }
      }
      console.info(
        '[db:announcement-push] ok',
        dbId,
        announcement.type,
        announcement.recipientRole ?? null,
      );
    } catch (err) {
      if (isRlsDenied(err)) {
        console.warn('[db:announcement-push] RLS denied', announcement.type, announcement.title);
      } else {
        showDbError('announcement sync', err);
      }
    }
  }

  private async syncRead(dbId: string, email: string): Promise<void> {
    try {
      // Identity is resolved session-first: `announcement_reads` is read back by
      // the viewer's auth uid, so the write MUST land on that same uid or the
      // mark never persists (the announcement "reverts to unread" after reload).
      // Email→profiles lookup can return null when `profiles.email` is empty,
      // hence the fallback rather than the sole resolution path.
      const profileId = (await sessionUserProfileId()) ?? (await resolveProfileIdByEmail(email));
      if (!profileId) {
        console.warn(
          '[db:announcement-mark-read] no profile id resolved — read state NOT synced to Supabase (will revert on reload):',
          email,
        );
        return;
      }
      await markAnnouncementRead(dbId, profileId);
    } catch (err) {
      if (isRlsDenied(err)) {
        console.warn('[db:announcement-mark-read] RLS denied', dbId, email);
      } else {
        showDbError('announcement mark-read', err);
      }
    }
  }

  private async syncDelete(dbId: string): Promise<void> {
    try {
      await deleteAnnouncement(dbId);
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('announcement delete', err);
    }
  }
}

function toLocalAnnouncement(dto: AnnouncementDto): Announcement {
  return { ...dto };
}

export const announcementsStore = new AnnouncementsStore();

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  announcement: 'Announcement',
  pricing: 'Pricing Update',
  maintenance: 'Maintenance Notice',
  reminder: 'Important Reminder',
  promo: 'Promotion',
};

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  regular: 'Regular',
  important: 'Important',
  emergency: 'Emergency',
};

export function formatSentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Everything is pinned to Philippines time (PHT, UTC+8) so a shared "Today /
  // Yesterday" label reads correctly even when the device isn't in the PH timezone.
  const phtDate = toPHT(date);
  const nowPHT = new Date(Date.now() + PHT_OFFSET_MS);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const time = phtDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay(phtDate, nowPHT)) return `Today • ${time}`;
  const yesterday = new Date(nowPHT);
  yesterday.setDate(nowPHT.getDate() - 1);
  if (sameDay(phtDate, yesterday)) return `Yesterday • ${time}`;
  if (phtDate.getFullYear() === nowPHT.getFullYear()) {
    return `${phtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${time}`;
  }
  return phtDate.toLocaleDateString('en-US') + ` • ${time}`;
}
