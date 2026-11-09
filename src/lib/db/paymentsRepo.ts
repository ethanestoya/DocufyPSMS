import { supabase } from '../supabaseClient';
import { updateOrder, insertStatusHistory } from './ordersRepo';
import type { PaymentStatus } from './types';

// The generated database types do not include the new RPCs yet, so `rpc` is
// widened once here instead of casting at every call site.
type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: any; error: any }>;
// Keep the call bound to the client: supabase-js reads `this.rest` inside rpc(),
// so a detached reference throws "Cannot read properties of undefined (reading 'rest')".
const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

export type AmountChoice = 'down' | 'full';

// ── submit (customer side) ──────────────────────────────────────────────────

export interface SubmitPaymentInput {
  orderId: string;
  methodId: string | null;
  methodName: string;
  /** Kept for call-site compatibility; the RPC derives the real amount from the order tier. */
  amount?: number;
  referenceNumber?: string | null;
  proofStoragePath?: string | null;
  /** Kept for call-site compatibility; the RPC sets submitted_by = auth.uid(). */
  submittedBy?: string | null;
  amountChoice?: AmountChoice | null;
}

// The RPC owns the payment row, the planned-amount choice and the order flags.
// It rejects orders the caller does not own and orders that are not Awaiting
// Payment, and it clears the checkout deadline so the order cannot auto-expire
// while staff review the proof.
export async function submitPayment(input: SubmitPaymentInput): Promise<string> {
  const { data, error } = await rpc('submit_payment', {
    p_order_id: input.orderId,
    p_method_id: input.methodId,
    p_method_name: input.methodName,
    p_reference: input.referenceNumber ?? null,
    p_proof_path: input.proofStoragePath ?? null,
    p_amount_choice: input.amountChoice ?? null,
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

// ── verify / reject (staff / admin side) ────────────────────────────────────

export interface VerifyPaymentInput {
  paymentId: string;
  /** For cash-down orders: what was actually collected, 50% or full. */
  amountChoice?: AmountChoice | null;
}

// The RPC flips the payment row, applies the down/full flags, clears the hold,
// records the amount and auto-queues an Awaiting Payment order. UI-side order
// patches are no longer accepted — the server is the only writer.
export async function verifyPayment(input: VerifyPaymentInput): Promise<void> {
  const { error } = await rpc('verify_payment', {
    p_payment_id: input.paymentId,
    p_amount_choice: input.amountChoice ?? null,
  });
  if (error) throw error;
}

export interface RejectPaymentInput {
  paymentId: string;
  reason: string;
  /** Kept for call-site compatibility; the RPC records auth.uid(). */
  rejectedBy?: string | null;
}

export async function rejectPayment(input: RejectPaymentInput): Promise<void> {
  const { error } = await rpc('reject_payment', {
    p_payment_id: input.paymentId,
    p_reason: input.reason,
  });
  if (error) throw error;
}

// ── confirm cash at the shop (staff / admin side) ──────────────────────────

export interface ConfirmCashPaymentInput {
  orderId: string;
  amountChoice?: AmountChoice | null;
}

// Cash-on-pickup orders have no customer-submitted row. The RPC records the
// verified cash payment, applies the 50%/Full choice, clears the deadline/hold
// and queues the order when it is still Awaiting Payment.
export async function confirmCashPayment(input: ConfirmCashPaymentInput): Promise<string> {
  const { data, error } = await rpc('confirm_cash_payment', {
    p_order_id: input.orderId,
    p_amount_choice: input.amountChoice ?? null,
  });
  if (error) throw error;
  return (data as { paymentId: string }).paymentId;
}

// ── expiry (auto-cancel awaiting-payment orders past their deadline) ────────

export const PAYMENT_DEADLINE_EXPIRED_REASON = 'Payment Deadline Expired';

// Auto-cancel any Awaiting Payment order whose deadline has passed AND that has
// no verified payment. Returns the number of orders cancelled. Idempotent:
// cancelled orders leave Awaiting Payment, so they never re-fire.
export async function expireOverdueOrders(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const { data: overdue, error } = await supabase
    .from('orders')
    .select('id, payment_deadline')
    .eq('status', 'Awaiting Payment')
    .not('payment_deadline', 'is', null)
    .lte('payment_deadline', nowIso);
  if (error) throw error;
  if (!overdue || overdue.length === 0) return 0;

  const ids = overdue.map((o) => o.id);
  const { data: verifiedPayments, error: payError } = await supabase
    .from('payments')
    .select('order_id')
    .eq('status', 'verified')
    .in('order_id', ids);
  if (payError) throw payError;

  const verifiedOrderIds = new Set((verifiedPayments ?? []).map((p) => p.order_id));
  let cancelled = 0;
  for (const row of overdue) {
    if (verifiedOrderIds.has(row.id)) continue;
    await updateOrder(row.id, {
      status: 'Canceled',
      cancellationReason: PAYMENT_DEADLINE_EXPIRED_REASON,
      statusUpdatedAt: now,
    });
    await insertStatusHistory(row.id, {
      oldStatus: 'Awaiting Payment',
      newStatus: 'Canceled',
      reason: PAYMENT_DEADLINE_EXPIRED_REASON,
      changedBy: null,
    }).catch((err) => console.warn('[expireOverdue] history write failed', err));
    cancelled += 1;
  }
  return cancelled;
}

// Small helper: did ANY of this order's payments reach 'verified'?
export function hasVerifiedPayment(statuses: readonly PaymentStatus[]): boolean {
  return statuses.includes('verified');
}

// Human label for a payment row's status.
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
  canceled: 'Canceled',
};
