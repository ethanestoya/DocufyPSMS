import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import { isUuid } from './uuid';
import type {
  AppRole,
  NotificationRow,
  NotificationInsert,
  AnnouncementRow,
  AnnouncementInsert,
  AnnouncementReadRow,
  AnnouncementReadInsert,
  NotificationDto,
  NotificationKind,
  NotificationPriority,
  NotificationRecipientRole,
  AnnouncementDto,
  AnnouncementType,
  AnnouncementPriority,
  AnnouncementRecipientRole,
} from './types';

export type {
  NotificationDto,
  NotificationKind,
  NotificationPriority,
  NotificationRecipientRole,
  AnnouncementDto,
  AnnouncementType,
  AnnouncementPriority,
  AnnouncementRecipientRole,
} from './types';

// Realtime-backed persistence for the two notification surfaces:
//   * `notifications` — per-recipient notifications (order / payment / status
//     update / inventory alerts). Unread = `read_at IS NULL`. RLS scopes every
//     row to the recipient: rows with a `recipient_profile_id` are visible only
//     to that profile, rows with a `recipient_role` are visible to matching
//     roles, NULL `recipient_role` rows are visible to every authenticated user.
//   * `announcements` — admin broadcasts visible to customers/all. Read state is
//     per-profile in the `announcement_reads` join table.
//
// The app's stores key notifications by email and announcements by an email
// `readBy` list. This repo resolves email → profile_id (cached, mirroring the
// attendanceRepo identity approach) so the exact store APIs keep working, and
// strips data that RLS would hide so nothing leaks to the wrong viewer.

// ── Identity resolution ──────────────────────────────────────────────────────

const profileIdCache = new Map<string, string | null>();

function cacheKey(email: string): string {
  return (email || '').trim().toLowerCase();
}

// Resolve an email to its `profiles.id` (a real Supabase account). Null when the
// email has no profile row (e.g. demo roster staff). Results are cached per
// email for the session.
export async function resolveProfileIdByEmail(email: string): Promise<string | null> {
  const key = cacheKey(email);
  if (!key) return null;
  const cached = profileIdCache.get(key);
  if (cached !== undefined) return cached;

  let id: string | null = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', key)
      .maybeSingle();
    if (data) id = data.id;
  } catch {
    // keep null
  }
  profileIdCache.set(key, id);
  return id;
}

// The AUTHORITATIVE viewer identity: the signed-in user's auth uid, which is by
// construction the same `profiles.id` the read paths filter on. `announcement_reads`
// is keyed by this uid, so writes must resolve to it — email→profiles lookups can
// return null when `profiles.email` is empty, which silently breaks read-state
// persistence (announcements "revert to unread" after a reload).
export async function sessionUserProfileId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Recipient scoping: the local store's union includes convenience values
// ('all', 'staff_admin') that don't exist as app_role values.
function mapRecipientRole(role: NotificationRecipientRole | null | undefined): AppRole | null {
  switch (role) {
    case 'customer':
      return 'customer';
    case 'admin':
      return 'admin';
    case 'staff':
      return 'staff';
    case 'staff_admin':
      // RLS grants staff AND admin read for the 'staff' target, so a single
      // 'staff_admin' local target collapses to the 'staff' DB value.
      return 'staff';
    case 'all':
    case undefined:
    case null:
    default:
      return null;
  }
}

function mapNotificationType(value: string): NotificationKind {
  return value === 'order' ||
    value === 'payment' ||
    value === 'status_update' ||
    value === 'inventory'
    ? value
    : 'status_update';
}

// ── Notifications: reads ─────────────────────────────────────────────────────

function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    dbId: row.id,
    type: mapNotificationType(row.notification_type),
    priority:
      row.priority === 'important' || row.priority === 'emergency' ? row.priority : null,
    title: row.title,
    message: row.message,
    timestamp: new Date(row.created_at),
    read: row.read_at != null,
    clickable: row.clickable === true,
    relatedOrderId: row.related_order_id,
    relatedRoute: row.related_route,
    recipientRole:
      row.recipient_role === 'customer' ||
      row.recipient_role === 'staff' ||
      row.recipient_role === 'admin'
        ? row.recipient_role
        : 'all',
    // The DB doesn't store the intended email — RLS already scoped the row to
    // this viewer, so local role filtering is all that's needed.
    recipientEmail: null,
  };
}

// All notifications the caller can see (RLS scoped), newest first.
export async function fetchNotifications(): Promise<NotificationDto[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(toNotificationDto);
}

// ── Notifications: writes ────────────────────────────────────────────────────

export interface NotificationWrite {
  type: NotificationKind;
  priority?: NotificationPriority | null;
  title: string;
  message: string;
  clickable: boolean;
  relatedOrderId?: string | null;
  relatedRoute?: string | null;
  recipientRole?: NotificationRecipientRole | null;
  recipientEmail?: string | null;
}

// Create a notification row. `recipientEmail` resolves to `recipient_profile_id`
// (RLS = only that profile can see it). A role-targeted row keeps its role so
// staff/admin can see it from any device. Unresolvable emails become a
// role-scoped ('customer') row with no profile link — RLS keeps it invisible
// until the profile exists, so it never leaks.
export async function pushNotification(write: NotificationWrite): Promise<string | null> {
  const emailTargeted = !!write.recipientEmail;
  const recipientProfileId = emailTargeted
    ? await resolveProfileIdByEmail(write.recipientEmail ?? '')
    : null;

  let recipientRole = mapRecipientRole(write.recipientRole);
  if (emailTargeted && (write.recipientRole == null || write.recipientRole === 'all')) {
    recipientRole = 'customer';
  }

  const row: NotificationInsert = {
    notification_type: write.type,
    priority: write.priority ?? null,
    title: write.title,
    message: write.message,
    recipient_profile_id: recipientProfileId,
    recipient_role: recipientRole,
    related_order_id: isUuid(write.relatedOrderId) ? write.relatedOrderId : null,
    related_route: write.relatedRoute ?? null,
    clickable: write.clickable === true,
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// Mark a single notification read (RLS scopes it to the owner's row).
export async function markNotificationRead(dbId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', dbId);
  if (error) throw error;
}

// Mark every visible, unread notification read.
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
  const { count, error: checkError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (!checkError && (count ?? 0) > 0) {
    console.warn(
      `[db:notification:mark-all-read] ${count} visible notifications still unread after update — check the notifications UPDATE RLS policy`,
    );
  }
}

// Delete a notification row.
export async function deleteNotification(dbId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', dbId);
  if (error) throw error;
}

// ── Notifications: realtime ──────────────────────────────────────────────────

export function subscribeNotifications(cb: () => void): () => void {
  return subscribeTableChanges('notifications', cb);
}

// ── Announcements: reads ─────────────────────────────────────────────────────

function mapAnnouncementType(value: string | null): AnnouncementType {
  return value === 'announcement' ||
    value === 'pricing' ||
    value === 'maintenance' ||
    value === 'reminder' ||
    value === 'promo'
    ? value
    : 'announcement';
}

function mapAnnouncementPriority(value: string): AnnouncementPriority {
  return value === 'regular' || value === 'important' || value === 'emergency'
    ? value
    : 'regular';
}

function mapAnnouncementRecipientRole(value: AppRole | null): AnnouncementRecipientRole {
  return value === 'customer' ? 'customer' : 'all';
}

// All announcements the caller can see (RLS), newest first, with the CURRENT
// viewer's read state resolved from `announcement_reads` (readBy = [my email]
// when I've read it, else []).
export async function fetchAnnouncements(): Promise<AnnouncementDto[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('sent_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as AnnouncementRow[];
  if (rows.length === 0) return [];

  // Resolve the current viewer's profile id + email once. The email prefers the
  // session's auth user (auth.users always carries it), falling back to the
  // profiles row — `profiles.email` is nullable so it alone can leave readBy empty.
  let uid: string | null = null;
  let myEmail: string | null = null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    uid = sessionData.session.user.id;
    myEmail = sessionData.session.user.email ?? null;
    const { data: me } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', uid)
      .maybeSingle();
    if (me?.email) myEmail = me.email;
  }

  let readIds = new Set<string>();
  if (uid && myEmail) {
    const { data: reads } = await supabase
      .from('announcement_reads')
      .select('announcement_id, profile_id')
      .eq('profile_id', uid)
      .in(
        'announcement_id',
        rows.map((r) => r.id),
      );
    if (reads) {
      readIds = new Set(
        (reads as AnnouncementReadRow[]).map((r) => r.announcement_id),
      );
    }
  }

  return rows.map((row) => ({
    id: row.id,
    dbId: row.id,
    type: mapAnnouncementType(row.announcement_type),
    priority: mapAnnouncementPriority(row.priority),
    title: row.title,
    message: row.message,
    recipientRole: mapAnnouncementRecipientRole(row.recipient_role),
    sentBy: row.sent_by ?? '',
    sentAt: row.sent_at,
    readBy: myEmail && readIds.has(row.id) ? [myEmail] : [],
  }));
}

// ── Announcements: writes ────────────────────────────────────────────────────

export interface AnnouncementWrite {
  type: AnnouncementType;
  priority: AnnouncementPriority;
  title: string;
  message: string;
  recipientRole: AnnouncementRecipientRole;
  sentBy: string; // sender email
}

// Create an announcement row and, when the sender's email maps to a profile,
// mark it read for them immediately (the sender already saw it — it shouldn't
// count as unread on their other devices).
export async function insertAnnouncement(write: AnnouncementWrite): Promise<string | null> {
  const row: AnnouncementInsert = {
    title: write.title,
    message: write.message,
    announcement_type: write.type,
    priority: write.priority,
    recipient_role: write.recipientRole === 'customer' ? 'customer' : null,
    recipient_email: null,
    sent_by: write.sentBy || null,
    sent_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('announcements')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;

  if (write.sentBy) {
    const senderProfileId = await resolveProfileIdByEmail(write.sentBy);
    if (senderProfileId) {
      await markAnnouncementRead(data.id, senderProfileId).catch(() => {
        // best-effort — read state is never critical
      });
    }
  }
  return data.id;
}

// Mark an announcement read for a specific profile (upsert on the natural key).
export async function markAnnouncementRead(
  announcementId: string,
  profileId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('announcement_id', announcementId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (existing) return;

  const row: AnnouncementReadInsert = {
    announcement_id: announcementId,
    profile_id: profileId,
    read_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('announcement_reads').insert(row);
  if (error) throw error;

  // Verify the row actually persisted: a write that RLS silently drops (or one
  // that never lands) would otherwise surface later as the announcement
  // "reverting to unread" after a reload with no warning at all.
  const { data: check, error: checkError } = await supabase
    .from('announcement_reads')
    .select('read_at')
    .eq('announcement_id', announcementId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!checkError && !check) {
    console.warn(
      '[db:announcement:mark-read] row did not persist',
      announcementId,
      profileId,
      '— check the announcement_reads INSERT RLS policy',
    );
  }
}

// Delete an announcement row.
export async function deleteAnnouncement(dbId: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', dbId);
  if (error) throw error;
}

// ── Announcements: realtime ──────────────────────────────────────────────────

export function subscribeAnnouncements(cb: () => void): () => void {
  return subscribeTableChanges('announcements', cb);
}