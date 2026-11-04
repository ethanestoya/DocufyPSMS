import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type {
  ReleasedOrderTransactionDto,
  ReleasedOrderTransactionRow,
} from './types';
import type { Json } from '../database.types';

function parseStatusHistory(value: Json): { status: string; at: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const status = entry.status;
    const at = entry.at;
    return typeof status === 'string' && typeof at === 'string'
      ? [{ status, at }]
      : [];
  });
}

function toReleasedOrderTransactionDto(
  row: ReleasedOrderTransactionRow,
): ReleasedOrderTransactionDto {
  return {
    archivedOrderId: row.archived_order_id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    orderSource: row.order_source,
    customerType: row.customer_type,
    serviceCategory: row.service_category,
    subtotal: row.subtotal,
    printingCost: row.printing_cost,
    addonsCost: row.addons_cost,
    total: row.total,
    amountPaid: row.amount_paid,
    balance: row.balance,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentReferenceNumber: row.payment_reference_number,
    paymentDetails: row.payment_details,
    statusHistory: parseStatusHistory(row.status_history),
    transactionNumber: row.transaction_number,
    placedAt: new Date(row.placed_at),
    releasedAt: new Date(row.released_at),
    archivedAt: new Date(row.archived_at),
  };
}

export async function fetchReleasedOrderTransactions(): Promise<
  ReleasedOrderTransactionDto[]
> {
  const { data, error } = await supabase
    .from('released_order_transactions')
    .select('*')
    .order('released_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toReleasedOrderTransactionDto);
}

export function subscribeReleasedOrderTransactions(
  callback: () => void,
): () => void {
  return subscribeTableChanges('released_order_transactions', callback);
}
