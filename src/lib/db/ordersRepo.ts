import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type {
  OrderDto,
  OrderFileDto,
  OrderAddonDto,
  CostBreakdownDto,
  PaymentDto,
  StatusHistoryDto,
  OrderRow,
  OrderFileRow,
  OrderAddonRow,
  CostBreakdownRow,
  PaymentRow,
  StatusHistoryRow,
  OrderUpdate,
  OrderStatus,
  OrderSource,
  OrderFileInsert,
  OrderAddonInsert,
  CostBreakdownInsert,
  StatusHistoryInsert,
} from './types';
import type { Json } from '../database.types';

// ── small converters ────────────────────────────────────────────────────────

const toDateOrNull = (v: string | null | undefined): Date | null =>
  v ? new Date(v) : null;

function toFileDto(row: OrderFileRow): OrderFileDto {
  return {
    id: row.id,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    printType: row.print_type,
    contentType: row.content_type,
    paperSize: row.paper_size,
    copies: row.copies,
    colorMode: row.color_mode,
    pageRange: row.page_range,
    specificPages: row.specific_pages,
    pagesPerSheet: row.pages_per_sheet,
    orientation: row.orientation,
    twoSided: row.two_sided,
    margins: row.margins,
    scale: row.scale,
    customScale: row.custom_scale,
    photoSize: row.photo_size,
    photoQuantity: row.photo_quantity,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  };
}

function toPaymentDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    orderId: row.order_id,
    methodId: row.method_id,
    methodName: row.method_name,
    amount: row.amount,
    referenceNumber: row.reference_number,
    proofStoragePath: row.proof_storage_path,
    status: row.status,
    rejectionReason: row.rejection_reason,
    submittedBy: row.submitted_by,
    verifiedBy: row.verified_by,
    submittedAt: new Date(row.submitted_at),
    verifiedAt: toDateOrNull(row.verified_at),
  };
}

function toStatusHistoryDto(row: StatusHistoryRow): StatusHistoryDto {
  return {
    id: row.id,
    orderId: row.order_id,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    reason: row.reason,
    changedBy: row.changed_by,
    createdAt: new Date(row.created_at),
  };
}

function toOrderDto(
  row: OrderRow,
  files: OrderFileRow[],
  addons: OrderAddonRow[],
  breakdown: CostBreakdownRow | undefined,
  payments: PaymentRow[],
  statusHistory: StatusHistoryRow[],
  statusHistoryUnavailable: boolean,
): OrderDto {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    status: row.status,
    orderSource: row.order_source,
    customerType: row.customer_type,
    subtotal: row.subtotal,
    addonsTotal: row.addons_total,
    total: row.total,
    manualTotal: row.manual_total,
    holdReason: row.hold_reason,
    cancellationReason: row.cancellation_reason,
    paymentDeadline: toDateOrNull(row.payment_deadline),
    downPaymentRequired: row.down_payment_required,
    downPaymentAmount: row.down_payment_amount,
    downPaymentVerified: row.down_payment_verified,
    fullPaymentRequired: row.full_payment_required,
    fullPaymentAmount: row.full_payment_amount,
    fullPaymentVerified: row.full_payment_verified,
    paymentAmountPaid: row.payment_amount_paid,
    expectedPaperUsage: (row.expected_paper_usage as OrderDto['expectedPaperUsage'] | null) ?? null,
    paperDeductedOnCreate: row.paper_deducted_on_create,
    paperConfirmed: row.paper_confirmed,
    errorUsage: (row.error_usage as OrderDto['errorUsage'] | null) ?? null,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    statusUpdatedAt: new Date(row.status_updated_at),
    files: files.map(toFileDto),
    addons: addons.map((a) => ({
      id: a.id,
      name: a.name,
      quantity: a.quantity,
      unitPrice: a.unit_price,
    })),
    costBreakdown: breakdown
      ? {
          printingCost: breakdown.printing_cost,
          addonsCost: breakdown.addons_cost,
          total: breakdown.total,
        }
      : null,
    payments: payments.map(toPaymentDto),
    statusHistory: statusHistory.map(toStatusHistoryDto),
    statusHistoryUnavailable,
  };
}

// ── create ──────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  orderSource: OrderSource;
  customerType?: string | null;
  subtotal?: number;
  addonsTotal?: number;
  total: number;
  manualTotal?: number | null;
  holdReason?: string | null;
  cancellationReason?: string | null;
  paymentDeadline?: Date | string | null;
  downPaymentRequired?: boolean;
  downPaymentAmount?: number | null;
  downPaymentVerified?: boolean;
  fullPaymentRequired?: boolean;
  fullPaymentAmount?: number | null;
  fullPaymentVerified?: boolean;
  paymentAmountPaid?: number;
  expectedPaperUsage?: Json | null;
  paperDeductedOnCreate?: boolean;
  paperConfirmed?: boolean;
  errorUsage?: Json | null;
  notes?: string | null;
}

// Insert the parent ORDER row. `order_number` is server-assigned (identity
// column), so this returns it so the caller can mint the display ID.
export async function createOrder(input: CreateOrderInput): Promise<{ id: string; orderNumber: number }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_id: input.customerId ?? null,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      status: input.status,
      order_source: input.orderSource,
      customer_type: input.customerType ?? null,
      subtotal: input.subtotal ?? 0,
      addons_total: input.addonsTotal ?? 0,
      total: input.total,
      manual_total: input.manualTotal ?? null,
      hold_reason: input.holdReason ?? null,
      cancellation_reason: input.cancellationReason ?? null,
      payment_deadline: input.paymentDeadline ? new Date(input.paymentDeadline).toISOString() : null,
      down_payment_required: input.downPaymentRequired ?? false,
      down_payment_amount: input.downPaymentAmount ?? null,
      down_payment_verified: input.downPaymentVerified ?? false,
      full_payment_required: input.fullPaymentRequired ?? false,
      full_payment_amount: input.fullPaymentAmount ?? null,
      full_payment_verified: input.fullPaymentVerified ?? false,
      payment_amount_paid: input.paymentAmountPaid ?? 0,
      expected_paper_usage: input.expectedPaperUsage ?? null,
      paper_deducted_on_create: input.paperDeductedOnCreate ?? false,
      paper_confirmed: input.paperConfirmed ?? false,
      error_usage: input.errorUsage ?? null,
      notes: input.notes ?? null,
      status_updated_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('id, order_number')
    .single();
  if (error) throw error;
  return { id: data.id, orderNumber: data.order_number };
}

export interface NewOrderFile {
  storagePath?: string | null;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  pageCount?: number | null;
  printType?: string | null;
  contentType?: string | null;
  paperSize?: string | null;
  copies?: number;
  colorMode?: string | null;
  pageRange?: string | null;
  specificPages?: string | null;
  pagesPerSheet?: string | null;
  orientation?: string | null;
  twoSided?: string | null;
  margins?: string | null;
  scale?: string | null;
  customScale?: number | null;
  photoSize?: string | null;
  photoQuantity?: number | null;
  notes?: string | null;
}

export async function insertOrderFiles(orderId: string, files: NewOrderFile[]): Promise<void> {
  if (files.length === 0) return;
  const rows: OrderFileInsert[] = files.map((f) => ({
    order_id: orderId,
    storage_path: f.storagePath ?? null,
    original_name: f.originalName,
    mime_type: f.mimeType ?? null,
    size_bytes: f.sizeBytes ?? null,
    page_count: f.pageCount ?? null,
    print_type: f.printType ?? null,
    content_type: f.contentType ?? null,
    paper_size: f.paperSize ?? null,
    copies: f.copies ?? 1,
    color_mode: f.colorMode ?? null,
    page_range: f.pageRange ?? null,
    specific_pages: f.specificPages ?? null,
    pages_per_sheet: f.pagesPerSheet ?? null,
    orientation: f.orientation ?? null,
    two_sided: f.twoSided ?? null,
    margins: f.margins ?? null,
    scale: f.scale ?? null,
    custom_scale: f.customScale ?? null,
    photo_size: f.photoSize ?? null,
    photo_quantity: f.photoQuantity ?? null,
    notes: f.notes ?? null,
  }));
  const { error } = await supabase.from('order_files').insert(rows);
  if (error) throw error;
}

export interface NewOrderAddon {
  name: string;
  quantity?: number;
  unitPrice?: number;
}

export async function insertOrderAddons(orderId: string, addons: NewOrderAddon[]): Promise<void> {
  if (addons.length === 0) return;
  const rows: OrderAddonInsert[] = addons.map((a) => ({
    order_id: orderId,
    name: a.name,
    quantity: a.quantity ?? 1,
    unit_price: a.unitPrice ?? 0,
  }));
  const { error } = await supabase.from('order_addons').insert(rows);
  if (error) throw error;
}

export async function upsertCostBreakdown(
  orderId: string,
  breakdown: { printingCost: number; addonsCost: number; total: number },
): Promise<void> {
  const row: CostBreakdownInsert = {
    order_id: orderId,
    printing_cost: breakdown.printingCost,
    addons_cost: breakdown.addonsCost,
    total: breakdown.total,
  };
  const { error } = await supabase.from('order_cost_breakdowns').upsert(row);
  if (error) throw error;
}

export interface StatusHistoryEntry {
  oldStatus?: OrderStatus | null;
  newStatus: OrderStatus;
  reason?: string | null;
  changedBy?: string | null;
}

export async function insertStatusHistory(orderId: string, entry: StatusHistoryEntry): Promise<void> {
  const row: StatusHistoryInsert = {
    order_id: orderId,
    old_status: entry.oldStatus ?? null,
    new_status: entry.newStatus,
    reason: entry.reason ?? null,
    changed_by: entry.changedBy ?? null,
  };
  const { error } = await supabase.from('order_status_history').insert(row);
  if (error) throw error;
}

// ── update ──────────────────────────────────────────────────────────────────

// Patch shape mirrors the orders columns BUT keeps the domain-friendly names
// so callers don't think in snake_case. Optional keys only.
export type OrderUpdatePatch = Partial<{
  status: OrderStatus;
  statusUpdatedAt: Date | string;
  holdReason: string | null;
  cancellationReason: string | null;
  paymentDeadline: Date | string | null;
  downPaymentRequired: boolean;
  downPaymentAmount: number | null;
  downPaymentVerified: boolean;
  fullPaymentRequired: boolean;
  fullPaymentAmount: number | null;
  fullPaymentVerified: boolean;
  paymentAmountPaid: number;
  expectedPaperUsage: Json | null;
  paperDeductedOnCreate: boolean;
  paperConfirmed: boolean;
  errorUsage: Json | null;
  notes: string | null;
  customerName: string;
  customerEmail: string;
  manualTotal: number | null;
}>;

export async function updateOrder(id: string, patch: OrderUpdatePatch): Promise<void> {
  const col: OrderUpdate = { updated_at: new Date().toISOString() };
  if ('status' in patch) col['status'] = patch.status as OrderStatus;
  if ('statusUpdatedAt' in patch) col['status_updated_at'] = new Date(patch.statusUpdatedAt as Date | string).toISOString();
  if ('holdReason' in patch) col['hold_reason'] = patch.holdReason ?? null;
  if ('cancellationReason' in patch) col['cancellation_reason'] = patch.cancellationReason ?? null;
  if ('paymentDeadline' in patch) col['payment_deadline'] = patch.paymentDeadline ? new Date(patch.paymentDeadline as Date | string).toISOString() : null;
  if ('downPaymentRequired' in patch) col['down_payment_required'] = patch.downPaymentRequired;
  if ('downPaymentAmount' in patch) col['down_payment_amount'] = patch.downPaymentAmount ?? null;
  if ('downPaymentVerified' in patch) col['down_payment_verified'] = patch.downPaymentVerified;
  if ('fullPaymentRequired' in patch) col['full_payment_required'] = patch.fullPaymentRequired;
  if ('fullPaymentAmount' in patch) col['full_payment_amount'] = patch.fullPaymentAmount ?? null;
  if ('fullPaymentVerified' in patch) col['full_payment_verified'] = patch.fullPaymentVerified;
  if ('paymentAmountPaid' in patch) col['payment_amount_paid'] = patch.paymentAmountPaid;
  if ('expectedPaperUsage' in patch) col['expected_paper_usage'] = patch.expectedPaperUsage ?? null;
  if ('paperDeductedOnCreate' in patch) col['paper_deducted_on_create'] = patch.paperDeductedOnCreate;
  if ('paperConfirmed' in patch) col['paper_confirmed'] = patch.paperConfirmed;
  if ('errorUsage' in patch) col['error_usage'] = patch.errorUsage ?? null;
  if ('notes' in patch) col['notes'] = patch.notes ?? null;
  if ('customerName' in patch) col['customer_name'] = patch.customerName;
  if ('customerEmail' in patch) col['customer_email'] = patch.customerEmail;
  if ('manualTotal' in patch) col['manual_total'] = patch.manualTotal ?? null;

  const { error } = await supabase.from('orders').update(col).eq('id', id);
  if (error) throw error;
}

// ── read ────────────────────────────────────────────────────────────────────

// Fetch ALL orders (+ children + payments) for the caller's role. RLS filters
// to the signed-in customer's own orders for customers, and to all orders for
// staff/admin. Child tables may be more restricted per-role, so a failed child
// read degrades to empty arrays rather than failing the whole list. Payment
// rows are sorted newest-first so the first element is the latest submission.
export async function fetchOrders(): Promise<OrderDto[]> {
  const [ordersRes, filesRes, addonsRes, breakdownRes, paymentsRes, historyRes] = await Promise.all([
    supabase.from('orders').select('*'),
    supabase.from('order_files').select('*'),
    supabase.from('order_addons').select('*'),
    supabase.from('order_cost_breakdowns').select('*'),
    supabase.from('payments').select('*').order('submitted_at', { ascending: false }),
    supabase.from('order_status_history').select('*').order('created_at', { ascending: true }),
  ]);
  if (ordersRes.error) throw ordersRes.error;

  const filesByOrder = new Map<string, OrderFileRow[]>();
  if (filesRes.error) {
    console.warn(
      '[db:orders] order_files read FAILED (%s) — data may be missing or RLS is misconfigured:',
      filesRes.error.code ?? filesRes.error.message,
      filesRes.error.message,
    );
  } else {
    for (const f of filesRes.data) {
      const list = filesByOrder.get(f.order_id) ?? [];
      list.push(f);
      filesByOrder.set(f.order_id, list);
    }
  }

  const addonsByOrder = new Map<string, OrderAddonRow[]>();
  if (addonsRes.error) {
    console.warn(
      '[db:orders] order_addons read FAILED (%s) — data may be missing or RLS is misconfigured:',
      addonsRes.error.code ?? addonsRes.error.message,
      addonsRes.error.message,
    );
  } else {
    for (const a of addonsRes.data) {
      const list = addonsByOrder.get(a.order_id) ?? [];
      list.push(a);
      addonsByOrder.set(a.order_id, list);
    }
  }

  const breakdownByOrder = new Map<string, CostBreakdownRow>();
  if (breakdownRes.error) {
    console.warn(
      '[db:orders] order_cost_breakdowns read FAILED (%s) — data may be missing or RLS is misconfigured:',
      breakdownRes.error.code ?? breakdownRes.error.message,
      breakdownRes.error.message,
    );
  } else {
    for (const b of breakdownRes.data) breakdownByOrder.set(b.order_id, b);
  }

  const paymentsByOrder = new Map<string, PaymentRow[]>();
  if (paymentsRes.error) {
    console.warn(
      '[db:orders] payments read FAILED (%s) — data may be missing or RLS is misconfigured:',
      paymentsRes.error.code ?? paymentsRes.error.message,
      paymentsRes.error.message,
    );
  } else {
    for (const pay of paymentsRes.data) {
      const list = paymentsByOrder.get(pay.order_id) ?? [];
      list.push(pay);
      paymentsByOrder.set(pay.order_id, list);
    }
  }

  const historyByOrder = new Map<string, StatusHistoryRow[]>();
  const historyUnavailable = !!historyRes.error;
  if (historyRes.error) {
    console.warn(
      '[db:orders] order_status_history read FAILED (%s) — unclaimed-order info may be unavailable or RLS is misconfigured:',
      historyRes.error.code ?? historyRes.error.message,
      historyRes.error.message,
    );
  } else {
    for (const h of historyRes.data) {
      const list = historyByOrder.get(h.order_id) ?? [];
      list.push(h);
      historyByOrder.set(h.order_id, list);
    }
  }

  return ordersRes.data.map((o) =>
    toOrderDto(
      o,
      filesByOrder.get(o.id) ?? [],
      addonsByOrder.get(o.id) ?? [],
      breakdownByOrder.get(o.id),
      paymentsByOrder.get(o.id) ?? [],
      historyByOrder.get(o.id) ?? [],
      historyUnavailable,
    ),
  );
}

export async function fetchOrderById(id: string): Promise<OrderDto | null> {
  const orders = await fetchOrders();
  return orders.find((o) => o.id === id) ?? null;
}

// Realtime: notify `cb` (after a debounce) whenever orders OR their payments
// change, so the local cache can refetch and re-render live.
const CHANGE_BUFFER_MS = 350;

export function subscribeOrderChanges(cb: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onEvent = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      cb();
    }, CHANGE_BUFFER_MS);
  };
  const unsubOrders = subscribeTableChanges('orders', onEvent);
  const unsubPayments = subscribeTableChanges('payments', onEvent);
  return () => {
    unsubOrders();
    unsubPayments();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}