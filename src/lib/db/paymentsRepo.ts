import { supabase } from '../supabaseClient';
import { updateOrder, insertStatusHistory, type OrderUpdatePatch } from './ordersRepo';
import type { PaymentStatus } from './types';

// ── submit (customer side) ──────────────────────────────────────────────────

export interface SubmitPaymentInput {
  orderId: string;
  methodId: string | null;
  methodName: string;
  amount: number;
  referenceNumber?: string | null;
  proofStoragePath?: string | null;
  submittedBy: string | null;
}

// Insert a PENDING payment row for an order. RLS requires `submitted_by` to be
// the current user (so customers can only submit their own), and staff/admin
// pass their own uid.
export async function submitPayment(input: SubmitPaymentInput): Promise<string> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id: input.orderId,
      method_id: input.methodId,
      method_name: input.methodName,
      amount: input.amount,
      reference_number: input.referenceNumber ?? null,
      proof_storage_path: input.proofStoragePath ?? null,
      status: 'pending',
      rejection_reason: null,
      submitted_by: input.submittedBy,
      verified_by: null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ── verify / reject (staff / admin side) ────────────────────────────────────

export interface VerifyPaymentInput {
  paymentId: string;
  orderId: string;
  verifiedBy: string | null;
  verifiedAt?: Date;
  // Order-side side effects of verification (status → In Queue, down/full
  // payment flag updates, amount paid, etc.). Business logic lives in the UI;
  // this simply persists the resulting patch.
  orderPatch?: OrderUpdatePatch;
  oldStatus?: import('./types').OrderStatus | null;
  note?: string | null;
}

export async function verifyPayment(input: VerifyPaymentInput): Promise<void> {
  const verifiedAt = input.verifiedAt ?? new Date();
  const { error: paymentError } = await supabase
    .from('payments')
    .update({ status: 'verified', verified_by: input.verifiedBy, verified_at: verifiedAt.toISOString() })
    .eq('id', input.paymentId);
  if (paymentError) throw paymentError;

  if (input.orderPatch) {
    await updateOrder(input.orderId, {
      ...input.orderPatch,
      statusUpdatedAt: verifiedAt,
    });
    if (input.orderPatch.status && input.orderPatch.status !== input.oldStatus) {
      await insertStatusHistory(input.orderId, {
        oldStatus: input.oldStatus ?? null,
        newStatus: input.orderPatch.status,
        reason: input.note ?? null,
        changedBy: input.verifiedBy,
      }).catch((err) => console.warn('[verifyPayment] status history write failed', err));
    }
  }
}

export interface RejectPaymentInput {
  paymentId: string;
  rejectedBy: string | null;
  reason: string;
}

export async function rejectPayment(input: RejectPaymentInput): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'rejected',
      rejection_reason: input.reason,
      verified_at: new Date().toISOString(),
      verified_by: input.rejectedBy,
    })
    .eq('id', input.paymentId);
  if (error) throw error;
}

// ── confirm cash at the shop (staff / admin side) ──────────────────────────

export interface ConfirmCashPaymentInput {
  orderId: string;
  methodName: string; // "Cash"
  amount: number;
  verifiedBy: string | null;
  note?: string | null;
}

// Cash-on-pickup orders have NO customer-submitted payment row (the customer
// never uploads a proof / reference). When staff confirm the cash was received
// at the shop, this creates the VERIFIED audit row. RLS requires
// `submitted_by` = current user, so the recording staff member is used.
export async function confirmCashPayment(input: ConfirmCashPaymentInput): Promise<string> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id: input.orderId,
      method_id: null,
      method_name: input.methodName,
      amount: input.amount,
      reference_number: null,
      proof_storage_path: null,
      status: 'verified',
      rejection_reason: null,
      submitted_by: input.verifiedBy,
      verified_by: input.verifiedBy,
      verified_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
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
