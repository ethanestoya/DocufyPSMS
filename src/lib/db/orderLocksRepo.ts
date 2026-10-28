// Order session-lock repository: the cross-MACHINE "who is reviewing this order
// right now" mechanism. One row per order (`order_id` PK) — a lock is live only
// while `expires_at` is in the future, so a dead tab/PC frees the order on its
// own without a janitor. `locked_by` is the acting `profiles.id` (authoritative
// holder identity); the display name for the "X is managing" banners is joined
// back from `profiles.full_name` so a lock claimed on ANY machine renders a
// human-readable holder.
//
// RLS: SELECT/INSERT/UPDATE/DELETE all staff/admin only via
// `public.is_staff_or_admin()`. The CLAIM is a security-definer RPC so the
// "never steal a live lock held by someone else" decision is atomic on the
// server (a plain upsert could overwrite); release + reads are conditional
// queries straight through RLS.

import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type { OrderLockRow } from './types';

// Matches orderLocks.LOCK_TIMEOUT_MS — whole-page readers treat anything past
// this as expired even if the DB row is unreachable.
export const ORDER_LOCK_TTL_SECONDS = 5 * 60;

const nowIso = (): string => new Date().toISOString();

const LOCK_SELECT = '*, profiles!order_locks_locked_by_fkey(full_name)';

function mapRow(raw: unknown): OrderLockRow {
  const r = raw as (Partial<OrderLockRow> & { profiles?: { full_name?: string | null } | null });
  return {
    order_id: r.order_id ?? '',
    locked_by: r.locked_by ?? '',
    locked_at: r.locked_at ?? '',
    expires_at: r.expires_at ?? '',
    locked_by_name: r.profiles?.full_name ?? r.locked_by_name ?? null,
  } as OrderLockRow;
}

export async function sessionUserProfileId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// All currently-live locks (expiry in the future), for initial hydration and
// cross-device row indicators.
export async function fetchOrderLocks(): Promise<OrderLockRow[]> {
  const { data, error } = await supabase
    .from('order_locks')
    .select(LOCK_SELECT)
    .gt('expires_at', nowIso());
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// The live lock for one order, if any (null when none / expired / RLS-hidden).
export async function getOrderLockById(orderId: string): Promise<OrderLockRow | null> {
  const { data, error } = await supabase
    .from('order_locks')
    .select(LOCK_SELECT)
    .eq('order_id', orderId)
    .gt('expires_at', nowIso())
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

// Atomic claim/renewal. Runs the `claim_order_lock` security-definer RPC so the
// conditional update — only take the lock if it's OURS or it already expired —
// happens on the server, never "stealing" a live lock held by another reviewer.
// Returns the resulting row, or NULL when a live lock is held by someone else
// (the conflicting row was left untouched). The function is cast because it is
// not yet part of the typed RPC schema.
export async function claimOrderLock(
  orderId: string,
  profileId: string,
  ttlSeconds: number = ORDER_LOCK_TTL_SECONDS,
): Promise<OrderLockRow | null> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: 'claim_order_lock',
    args: {
      p_order_id: string;
      p_locked_by: string;
      p_ttl_seconds: number;
    },
  ) => Promise<{ data: unknown; error: unknown }>)('claim_order_lock', {
    p_order_id: orderId,
    p_locked_by: profileId,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw error;
  if (!data) return null;
  return mapRow(Array.isArray(data) ? (data[0] ?? null) : data);
}

// Release OUR hold. The `locked_by = profileId` condition means a closed
// dialog/browser can never free another reviewer's lock.
export async function releaseOrderLock(orderId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('order_locks')
    .delete()
    .eq('order_id', orderId)
    .eq('locked_by', profileId);
  if (error) throw error;
}

// Re-verification right before a final confirm: WE are the current lock holder
// (matched by profile id against a live row).
export async function stillHoldsOrderLock(
  orderId: string,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('order_locks')
    .select('order_id')
    .eq('order_id', orderId)
    .eq('locked_by', profileId)
    .gt('expires_at', nowIso())
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Best-effort housekeeping: drop every expired lock row so the table never
// grows without bound (expired rows are already invisible to all readers).
export async function pruneExpiredOrderLocks(): Promise<void> {
  const { error } = await supabase
    .from('order_locks')
    .delete()
    .lt('expires_at', nowIso());
  if (error) throw error;
}

// Realtime subscription: fires on any machine's claim, heartbeat renewal or
// release, and the facade re-hydrates so every panel stays live.
export function subscribeOrderLocks(cb: () => void): () => void {
  return subscribeTableChanges('order_locks', () => cb());
}
