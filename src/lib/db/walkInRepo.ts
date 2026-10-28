import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type { WalkInTransactionRow, WalkInTransactionDto } from './types';

// Walk-in transaction persistence.
//
// Every successfully-placed walk-in order writes BOTH its `orders` row (which
// drives the queue/print pipeline) and a companion `walk_in_transactions` row
// linked back via `order_id`, so the shop keeps a dedicated transaction log
// with its own server-assigned `transaction_number` identity. The caller
// (dataStore.addOrder) always writes this AFTER the order row is confirmed.

// ── create ──────────────────────────────────────────────────────────────────

export interface CreateWalkInTransactionInput {
  orderId: string;
  customerName: string | null;
  customerType: string;
  total: number;
  paymentMethod: string;
  createdBy: string | null;
}

// Insert a walk-in transaction log row. `transaction_number` is the DB
// identity (auto-incrementing) and is intentionally not part of the input.
export async function createWalkInTransaction(input: CreateWalkInTransactionInput): Promise<void> {
  const { error } = await supabase.from('walk_in_transactions').insert({
    order_id: input.orderId,
    customer_name: input.customerName,
    customer_type: input.customerType,
    total: input.total,
    payment_method: input.paymentMethod,
    created_by: input.createdBy,
  });
  if (error) throw error;
}

// ── read ────────────────────────────────────────────────────────────────────

function toWalkInDto(row: WalkInTransactionRow): WalkInTransactionDto {
  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    orderId: row.order_id,
    customerName: row.customer_name,
    customerType: row.customer_type,
    total: row.total,
    paymentMethod: row.payment_method,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  };
}

// Fetch ALL walk-in transaction log rows, newest first.
export async function fetchWalkInTransactions(): Promise<WalkInTransactionDto[]> {
  const { data, error } = await supabase
    .from('walk_in_transactions')
    .select('*')
    .order('transaction_number', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toWalkInDto);
}

// Realtime: notify `cb` whenever walk_in_transactions changes (new walk-ins,
// so a log page can refetch and re-render live).
export function subscribeWalkInTransactions(cb: () => void): () => void {
  return subscribeTableChanges('walk_in_transactions', cb);
}
