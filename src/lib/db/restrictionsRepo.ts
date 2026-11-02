// Unclaimed-order restriction repository.
//
// Two new tables back the admin-controlled half of the unclaimed-order
// policy. The BASE detection stays derived from real order + status-history
// data (see `utils/unclaimedOrders.ts`) — that part is still never stored.
// What these tables persist is the human decisions layered on top of it:
//
//   • `unclaimed_offense_overrides` — one row per order recording an admin's
//     explicit decision about a derived offense: `confirmed` (it counts, as
//     the derivation already implies) or `excused` (it does NOT count). An
//     absence of a row simply means "no override — treat the derivation as-is".
//
//   • `customer_restrictions` — one row per customer recording whether Cash on
//     Pickup is currently blocked for them, which advance arrangement was
//     accepted (50% deposit vs full advance), who applied/removed it and why.
//     This row is the AUTHORITATIVE answer to "is this customer restricted?"
//     so an admin can forgive a restriction early, or change the arrangement,
//     without the derived count fighting back.
//
// RLS: staff/admin only via `public.is_staff_or_admin()`. Customers can read
// nothing here — their own surfaces read the derived count instead.
import { supabase as typedSupabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type { SupabaseClient } from '@supabase/supabase-js';

// Neither table is in the generated schema yet, so route through an untyped
// client view (same pattern the RPC casts use).
const supabase = typedSupabase as unknown as SupabaseClient;

export type OffenseDecision = 'confirmed' | 'excused';
export type PaymentArrangement = 'deposit_50' | 'full_advance';

export interface OffenseOverride {
  orderId: string;
  customerKey: string;
  decision: OffenseDecision;
  reason: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string;
}

export interface CustomerRestriction {
  customerKey: string;
  customerName: string | null;
  customerEmail: string | null;
  active: boolean;
  arrangement: PaymentArrangement;
  reason: string | null;
  removedReason: string | null;
  setBy: string | null;
  setByName: string | null;
  setAt: string;
  updatedAt: string;
}

interface OverrideRow {
  order_id: string;
  customer_key: string;
  decision: string;
  reason: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string;
}

interface RestrictionRow {
  customer_key: string;
  customer_name: string | null;
  customer_email: string | null;
  active: boolean;
  arrangement: string;
  reason: string | null;
  removed_reason: string | null;
  set_by: string | null;
  set_by_name: string | null;
  set_at: string;
  updated_at: string;
}

const OVERRIDE_SELECT = 'order_id, customer_key, decision, reason, decided_by, decided_by_name, decided_at';
const RESTRICTION_SELECT =
  'customer_key, customer_name, customer_email, active, arrangement, reason, removed_reason, set_by, set_by_name, set_at, updated_at';

function mapOverride(row: OverrideRow): OffenseOverride {
  return {
    orderId: row.order_id,
    customerKey: (row.customer_key ?? '').toLowerCase(),
    decision: row.decision === 'excused' ? 'excused' : 'confirmed',
    reason: row.reason ?? null,
    decidedBy: row.decided_by ?? null,
    decidedByName: row.decided_by_name ?? null,
    decidedAt: row.decided_at,
  };
}

function mapRestriction(row: RestrictionRow): CustomerRestriction {
  return {
    customerKey: (row.customer_key ?? '').toLowerCase(),
    customerName: row.customer_name ?? null,
    customerEmail: row.customer_email ?? null,
    active: row.active !== false,
    arrangement: row.arrangement === 'full_advance' ? 'full_advance' : 'deposit_50',
    reason: row.reason ?? null,
    removedReason: row.removed_reason ?? null,
    setBy: row.set_by ?? null,
    setByName: row.set_by_name ?? null,
    setAt: row.set_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchOverrides(): Promise<Map<string, OffenseOverride>> {
  const { data, error } = await supabase
    .from('unclaimed_offense_overrides')
    .select(OVERRIDE_SELECT);
  if (error) throw error;
  const map = new Map<string, OffenseOverride>();
  for (const row of (data ?? []) as OverrideRow[]) map.set(row.order_id, mapOverride(row));
  return map;
}

export async function fetchRestrictions(): Promise<Map<string, CustomerRestriction>> {
  const { data, error } = await supabase
    .from('customer_restrictions')
    .select(RESTRICTION_SELECT);
  if (error) throw error;
  const map = new Map<string, CustomerRestriction>();
  for (const row of (data ?? []) as RestrictionRow[]) {
    map.set((row.customer_key ?? '').toLowerCase(), mapRestriction(row));
  }
  return map;
}

export async function saveOverride(input: {
  orderId: string;
  customerKey: string;
  decision: OffenseDecision;
  reason: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
}): Promise<void> {
  const { error } = await supabase.from('unclaimed_offense_overrides').upsert(
    {
      order_id: input.orderId,
      customer_key: input.customerKey.toLowerCase(),
      decision: input.decision,
      reason: input.reason,
      decided_by: input.decidedBy,
      decided_by_name: input.decidedByName,
      decided_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' },
  );
  if (error) throw error;
}

export async function deleteOverride(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('unclaimed_offense_overrides')
    .delete()
    .eq('order_id', orderId);
  if (error) throw error;
}

export async function saveRestriction(input: {
  customerKey: string;
  customerName: string | null;
  customerEmail: string | null;
  active: boolean;
  arrangement: PaymentArrangement;
  reason: string | null;
  removedReason: string | null;
  setBy: string | null;
  setByName: string | null;
}): Promise<void> {
  const { error } = await supabase.from('customer_restrictions').upsert(
    {
      customer_key: input.customerKey.toLowerCase(),
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      active: input.active,
      arrangement: input.arrangement,
      reason: input.reason,
      removed_reason: input.removedReason,
      set_by: input.setBy,
      set_by_name: input.setByName,
      set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'customer_key' },
  );
  if (error) throw error;
}

export function subscribeOverrides(cb: () => void): () => void {
  return subscribeTableChanges('unclaimed_offense_overrides', () => cb());
}

export function subscribeRestrictions(cb: () => void): () => void {
  return subscribeTableChanges('customer_restrictions', () => cb());
}
