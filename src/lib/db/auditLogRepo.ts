import { supabase } from '../supabaseClient';
import { isRlsDenied } from './errors';
import { subscribeTableChanges } from './hooks';
import { isUuid } from './uuid';
import type { AuditLogInsert, AuditLogRow } from './types';

// SuAppan-backed persistence for the Admin Audit Trail.
//
// `audit_logs` has NO relationship declared on `actor_id`, so the actor's
// display name / role / email are snapshotted inside the jsonb `metadata` at
// write time (the "auth.uid() + name/email snapshot" deferred from the UI
// pass). The scalar columns carry the filterable facts; `metadata` carries the
// human-readable narrative (title, description, changes, device) that the page
// renders in the View Details dialog.
//
// RLS contract (SQL the user runs in Supabase): INSERT for staff/admin only
// (so the trail records what staff do), SELECT ADMIN-only (only admins view
// the log), and no UPDATE/DELETE policies so the log is append-only.
//
// Because SELECT is admin-only, a STAFF actor's successful INSERT returns no
// row to the returning `.select()`. The insert MUST therefore use
// `.maybeSingle()` — `.single()` would throw PGRST116 ("no rows returned")
// and surface a spurious error toast for a write that actually landed.

// The shape of an audited action, decoupled from the DB row so the store can
// build entries without knowing the column layout.
export interface AuditLogWrite {
  /** Supabase auth uid of the actor when known. */
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  action: string;
  /** Structured reference, e.g. "Order" / "ORD-1024". Maps to entity_type/entity_id. */
  entityType?: string | null;
  entityId?: string | null;
  /** Module label, e.g. "Orders"/"Payments". Stored in metadata for the UI filter. */
  module?: string | null;
  reference?: string | null;
  title?: string | null;
  description?: string | null;
  changes?: { field: string; previous: string; next: string }[];
  ipAddress?: string | null;
  device?: string | null;
  transactionId?: string | null;
  timestamp?: string;
}

/** The read view of one audit row for the store facade. */
export type AuditLogDto = Pick<AuditLogRow, 'id' | 'action' | 'created_at'> & {
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  actorName: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  module: string | null;
  reference: string | null;
  title: string | null;
  description: string | null;
  changes: { field: string; previous: string; next: string }[];
  device: string | null;
  transactionId: string | null;
};

function isChangesArray(value: unknown): value is { field: string; previous: string; next: string }[] {
  return Array.isArray(value) && value.every(
    (c) =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as { field?: unknown }).field === 'string' &&
      typeof (c as { previous?: unknown }).previous === 'string' &&
      typeof (c as { next?: unknown }).next === 'string',
  );
}

async function rowToDto(row: AuditLogRow): Promise<AuditLogDto> {
  const m = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ipAddress: row.ip_address,
    action: row.action,
    created_at: row.created_at,
    actorName: typeof m.actorName === 'string' ? m.actorName : null,
    actorRole: typeof m.actorRole === 'string' ? m.actorRole : null,
    actorEmail: typeof m.actorEmail === 'string' ? m.actorEmail : null,
    module: typeof m.module === 'string' ? m.module : null,
    reference: typeof m.reference === 'string' ? m.reference : null,
    title: typeof m.title === 'string' ? m.title : null,
    description: typeof m.description === 'string' ? m.description : null,
    changes: isChangesArray(m.changes) ? m.changes : [],
    device: typeof m.device === 'string' ? m.device : null,
    transactionId: typeof m.transactionId === 'string' ? m.transactionId : null,
  };
}

// Append one audit entry. The DB row id (uuid) is the identity once the write
// succeeds; returns null when the write is blocked (RLS) or failed, or when
// the row was inserted but is not visible to the acting role (a staff write
// under the admin-only SELECT policy) — all of which are normal outcomes.
export async function insertAuditEntry(write: AuditLogWrite): Promise<string | null> {
  const changes = Array.isArray(write.changes) ? write.changes : [];
  const row: AuditLogInsert = {
    actor_id: isUuid(write.actorId) ? write.actorId : null,
    action: write.action,
    entity_type: write.entityType ?? null,
    entity_id: isUuid(write.entityId) ? write.entityId : null,
    ip_address: write.ipAddress ?? null,
    user_agent: null,
    metadata: {
      actorName: write.actorName ?? null,
      actorRole: write.actorRole ?? null,
      actorEmail: write.actorEmail ?? null,
      module: write.module ?? null,
      reference: write.reference ?? null,
      title: write.title ?? null,
      description: write.description ?? null,
      changes,
      device: write.device ?? null,
      transactionId: write.transactionId ?? null,
    },
    ...(write.timestamp ? { created_at: write.timestamp } : {}),
  };

  const { data, error } = await supabase
    .from('audit_logs')
    .insert(row)
    .select('id')
    .maybeSingle();
  if (error) {
    // RLS-denied writes (e.g. a customer-originated event, or an anon tab) are
    // a normal keep-local outcome; anything else is a real sync failure the
    // store should surface.
    if (isRlsDenied(error)) {
      console.warn('[db:audit] insert not synced (RLS):', error.message);
      return null;
    }
    throw error;
  }
  return data?.id ?? null;
}

// Newest first — the order a reviewer reads a log in.
export async function fetchAuditEntries(limit = 500): Promise<AuditLogDto[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[db:audit] fetch failed:', error.message);
    return [];
  }
  const rows = (data ?? []) as AuditLogRow[];
  return Promise.all(rows.map(rowToDto));
}

/** Realtime hook: re-read the log when any row changes on any device. */
export function subscribeAuditLogs(cb: () => void): () => void {
  return subscribeTableChanges('audit_logs', () => cb());
}
