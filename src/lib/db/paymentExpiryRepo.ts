// Payment-deadline expiry — server-side half.
//
// The client-side interval in `src/app/utils/paymentExpiry.ts` used to be the
// ONLY thing that auto-cancelled overdue orders, which meant nothing expired
// (and nobody was notified) while no browser was open. `expire_overdue_orders`
// moves that work into Postgres so it runs continuously; pg_cron schedules it
// every minute. The client still calls it on its own interval for
// responsiveness, and keeps its local loop as an idempotent fallback when the
// SQL function hasn't been installed yet.
//
// The function is SECURITY DEFINER and inserts its own notification rows, so
// it works for every role and needs no caller privileges on `orders`.
import { supabase as typedSupabase } from '../supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// The function isn't in the generated RPC schema yet, so route through an
// untyped client view (same pattern `deduct_paper_pieces` uses).
const supabase = typedSupabase as unknown as SupabaseClient;

/**
 * Runs the shared expiry sweep on the server. Returns the number of orders it
 * cancelled, or `null` when the call failed (function not installed, no
 * permission, network) — the caller then falls back to the local loop.
 */
export async function runServerExpiry(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('expire_overdue_orders');
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err);
    if (/row-level security|permission denied|JWT|not authenticated/i.test(msg)) {
      // Not signed in — nothing to sweep from here; the local fallback covers it.
      return null;
    }
    console.warn(
      '[paymentExpiry] server expiry unavailable — falling back to the local sweep:',
      err,
    );
    return null;
  }
}
