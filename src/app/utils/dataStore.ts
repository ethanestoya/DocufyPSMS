// Centralized data store for orders.
//
// Supabase-backed facade: keeps the legacy synchronous read API
// (getOrders / getOrdersByCustomer / getOrderById / getOrderStats / subscribe)
// that every dashboard reads, hydrates once from the orders tables, refreshes
// on realtime changes (`orders` + `payments` publication), and performs ALL
// writes through the DB repos. The in-memory cache is mutated ONLY after a
// successful write, so a failed RLS/network write is never silently reflected
// in the UI (callers get an error to toast).
import {
  fetchOrders,
  fetchOrderById,
  createOrder,
  insertOrderFiles,
  insertOrderAddons,
  upsertCostBreakdown,
  insertStatusHistory,
  updateOrder as dbUpdateOrder,
  subscribeOrderChanges,
  type CreateOrderInput,
} from '../../lib/db/ordersRepo';
import { hasVerifiedPayment } from '../../lib/db/paymentsRepo';
import { createWalkInTransaction } from '../../lib/db/walkInRepo';
import { auditLogStore } from './auditLogStore';
import { pickupReview, CASH_ON_PICKUP_BLOCKED_MESSAGE } from './pickupReview';
import { resolveStorageUrl, BUCKETS, uploadObjectAndGetPath, removeObjectsIfPresent } from '../../lib/db/storage';
import { formatOrderNumber } from '../../lib/db/types';
import type { OrderDto, OrderFileDto } from '../../lib/db/types';
import { authReady } from '../../lib/supabaseClient';

export interface AttachedFile {
  name: string;
  size: string;
  type: string;
  url?: string;
  storagePath?: string;
  uploadedAt?: string;
  file?: File;
  mimeType?: string;
  sizeBytes?: number;
  photoSize?: string;
  photoQuantity?: number;
  contentType?: string;
  paperSize?: string;
  orientation?: string;
  printType?: string;
  copies?: number;
  twoSided?: string;
  pagesPerSheet?: string;
  colorMode?: string;
  pageRange?: string;
  specificPages?: string;
  margins?: string;
  scale?: string;
  customScale?: number;
  pageCount?: number;
  notes?: string;
}

export interface Order {
  id: string;
  // DB sequence number (identity) and its human-facing ORD-0001 form.
  orderNumber?: number;
  displayId?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status:
    | 'Awaiting Payment'
    | 'In Queue'
    | 'Printing'
    | 'Completed'
    | 'Released'
    | 'Canceled';
  holdReason?: string;
  cancellationReason?: string;
  // Payment confirmation/verification deadline (ISO). Cash-on-pickup orders
  // must be paid at the shop, online orders must be submitted + verified,
  // before this time or the order is auto-cancelled as expired.
  paymentDeadline?: string;
  // Amount the customer reports having paid (online submissions).
  paymentAmountPaid?: number;
  total: string;
  date: string;
  paperType?: string;
  paperSize?: string;
  printType?: string;
  copies?: number;
  paymentMethod?: string;
  paymentProof?: string;
  paymentReferenceNumber?: string;
  paymentVerified?: boolean;
  paymentProofUrl?: string;
  // Raw storage path of the upload payment proof (private `payment-proofs`
  // bucket) — needed to generate a signed URL at read time.
  proofStoragePath?: string;
  // DB payments row id for the order's latest payment (used by staff/admin to
  // mark the customer-submitted row verified/rejected).
  paymentRowId?: string;
  fileName?: string;
  pages?: number;
  attachedFiles?: AttachedFile[];
  orientation?: string;
  twoSided?: string;
  pagesPerSheet?: string;
  margins?: string;
  scale?: string;
  customScale?: number;
  colorMode?: string;
  pageRange?: string;
  specificPages?: string;
  notes?: string;
  addons?: Array<{ name: string; quantity: number; price: number }>;
  costBreakdown?: {
    printingCost: number;
    addonsCost: number;
    total: number;
  };
  orderSource?: 'online' | 'walkin';
  customerType?: 'printing' | 'photocopy';
  // Optional manual staff-entered total (overrides automatic pricing, e.g. walk-in photocopy).
  manualTotal?: number;
  // Down payment fields
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
  downPaymentVerified?: boolean;
  // Full payment fields (high-value orders ≥ fullPaymentThreshold — no 50% option)
  fullPaymentRequired?: boolean;
  fullPaymentAmount?: number;
  fullPaymentVerified?: boolean;
  expectedPaperUsage?: { size: string; sheets: number }[];
  paperDeductedOnCreate?: boolean;
  paperConfirmed?: boolean;
  errorUsage?: { noErrors: boolean; reason?: string; wastedSheets: number };
  // Timestamp tracking fields
  statusUpdatedAt?: string; // ISO string - tracks when status was last changed
  createdAt?: string; // ISO string - tracks when order was created
  lastUpdatedAt?: string; // ISO string - tracks any update to the order
}

export interface Notification {
  id: number;
  type: string;
  message: string;
  time: string;
  read: boolean;
  icon: string;
  link?: string;
  orderId?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const money = (n: number): string => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SIZE_KEY_MAP: Record<string, string> = {
  a4: 'A4',
  short: 'Short',
  long: 'Long',
  folio: 'Folio',
  legal: 'Legal',
  a3: 'A3',
};

const fileSizeLabel = (bytes: number | null): string => {
  if (bytes == null) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 0.01 ? `${mb.toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const fileTypeLabel = (mime: string | null, fallback: string | null): string => {
  const src = mime || '';
  if (src.includes('pdf')) return 'PDF';
  if (src.includes('word') || src.includes('document')) return 'Document';
  if (src.includes('powerpoint') || src.includes('presentation')) return 'PowerPoint';
  if (src.includes('excel') || src.includes('spreadsheet')) return 'Excel';
  if (src.includes('image')) return 'Image';
  return fallback || 'Document';
};

function toAttachedFile(f: OrderFileDto): AttachedFile {
  return {
    name: f.originalName,
    size: fileSizeLabel(f.sizeBytes),
    type: fileTypeLabel(f.mimeType, f.printType),
    url: resolveStorageUrl(BUCKETS.orderFiles, f.storagePath) || undefined,
    storagePath: f.storagePath || undefined,
    uploadedAt: f.createdAt.toISOString(),
    paperSize: f.paperSize || undefined,
    orientation: f.orientation || undefined,
    copies: f.copies,
    twoSided: f.twoSided || undefined,
    pagesPerSheet: f.pagesPerSheet || undefined,
    colorMode: f.colorMode || undefined,
    pageRange: f.pageRange || undefined,
    specificPages: f.specificPages || undefined,
    margins: f.margins || undefined,
    scale: f.scale || undefined,
    customScale: f.customScale ?? undefined,
    pageCount: f.pageCount ?? undefined,
  };
}

// Map a DB OrderDto back into the legacy app Order shape that all consumers
// read. Payment-derived fields (verified flag, reference, proof, method) come
// from the order's payments rows.
export function orderDtoToApp(dto: OrderDto): Order {
  const verifiedPayments = dto.payments.filter((p) => p.status === 'verified').sort((a, b) => b.verifiedAt?.getTime()! - a.verifiedAt?.getTime()! || b.submittedAt.getTime() - a.submittedAt.getTime());
  const latestPayment = dto.payments
    .slice()
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
  const vp = verifiedPayments[0];
  const firstFile = dto.files[0];
  const pages = dto.files.reduce((sum, f) => sum + (f.pageCount ?? 0) * f.copies, 0);
  const total = dto.manualTotal ?? dto.total;

  return {
    id: dto.id,
    orderNumber: dto.orderNumber,
    displayId: formatOrderNumber(dto.orderNumber),
    customerId: dto.customerId ?? dto.customerEmail,
    customerName: dto.customerName,
    customerEmail: dto.customerEmail,
    status: dto.status,
    holdReason: dto.holdReason ?? undefined,
    cancellationReason: dto.cancellationReason ?? undefined,
    paymentDeadline: dto.paymentDeadline?.toISOString(),
    paymentAmountPaid: dto.paymentAmountPaid,
    total: money(total),
    date: dto.createdAt.toISOString(),
    paperType: firstFile?.printType || undefined,
    paperSize: firstFile?.paperSize ? (SIZE_KEY_MAP[firstFile.paperSize] ?? firstFile.paperSize) : undefined,
    printType: dto.files.some((f) => f.colorMode && f.colorMode !== 'bw')
      ? 'Colored'
      : 'Black & White',
    copies: firstFile?.copies || undefined,
    paymentMethod:
      vp?.methodName ??
      latestPayment?.methodName ??
      (dto.orderSource === 'walkin' ? 'Cash' :
       // Customer cash-on-pickup orders have no payment row; the holdReason is
       // the tell ("Cash on Pickup: …").
       dto.holdReason?.includes('Cash on Pickup') ? 'Cash' : undefined),
    paymentProof: undefined,
    paymentRowId: latestPayment?.id,
    paymentReferenceNumber: vp?.referenceNumber ?? undefined,
    paymentVerified: hasVerifiedPayment(dto.payments.map((p) => p.status)),
    paymentProofUrl: resolveStorageUrl(BUCKETS.paymentProofs, vp?.proofStoragePath ?? null) || undefined,
    proofStoragePath: vp?.proofStoragePath ?? undefined,
    fileName: firstFile?.originalName,
    pages: pages || firstFile?.pageCount || undefined,
    attachedFiles: dto.files.map(toAttachedFile),
    orientation: firstFile?.orientation || undefined,
    twoSided: firstFile?.twoSided || undefined,
    pagesPerSheet: firstFile?.pagesPerSheet || undefined,
    margins: firstFile?.margins || undefined,
    scale: firstFile?.scale || undefined,
    customScale: firstFile?.customScale ?? undefined,
    colorMode: firstFile?.colorMode || undefined,
    pageRange: firstFile?.pageRange || undefined,
    specificPages: firstFile?.specificPages || undefined,
    notes: dto.notes ?? undefined,
    addons: dto.addons.map((a) => ({ name: a.name, quantity: a.quantity, price: a.unitPrice })),
    costBreakdown: dto.costBreakdown ?? undefined,
    orderSource: dto.orderSource,
    customerType: (dto.customerType as Order['customerType']) || undefined,
    manualTotal: dto.manualTotal ?? undefined,
    downPaymentRequired: dto.downPaymentRequired,
    downPaymentAmount: dto.downPaymentAmount ?? undefined,
    downPaymentVerified: dto.downPaymentVerified,
    fullPaymentRequired: dto.fullPaymentRequired,
    fullPaymentAmount: dto.fullPaymentAmount ?? undefined,
    fullPaymentVerified: dto.fullPaymentVerified,
    expectedPaperUsage: dto.expectedPaperUsage ?? undefined,
    paperDeductedOnCreate: dto.paperDeductedOnCreate,
    paperConfirmed: dto.paperConfirmed,
    errorUsage: dto.errorUsage ?? undefined,
    statusUpdatedAt: dto.statusUpdatedAt.toISOString(),
    createdAt: dto.createdAt.toISOString(),
    lastUpdatedAt: dto.updatedAt.toISOString(),
  };
}

// Input accepted by addOrder — deliberately loose: it accepts BOTH the
// customer-flow app Order (minus its pre-minted display id) and the walk-in
// ordersStore shape (lowercase `customer`, legacy lowercase status).
export type OrderInput = Partial<Order> &
  Pick<Order, 'notes'> & {
    id?: string;
    customer?: string;
    submittedAt?: Date;
    // Real Supabase auth uid of whoever is creating the order (customer for the
    // checkout flow, staff/admin for walk-ins). Used for status-history actor.
    actorId?: string | null;
    status?:
      | Order['status']
      | 'inQueue'
      | 'printing'
      | 'completed'
      | 'released'
      | 'canceled'
      | 'awaitingPayment';
  };

export type OrderUploadProgress = {
  // 1-based index of the file currently uploading, within the total files that
  // actually carry bytes (files without a File object are skipped).
  fileIndex: number;
  fileCount: number;
  fileName: string;
  percent: number; // 0-100 for the current file
};

const STATUS_MAP: Record<string, Order['status']> = {
  'Awaiting Payment': 'Awaiting Payment',
  awaitingPayment: 'Awaiting Payment',
  'In Queue': 'In Queue',
  inQueue: 'In Queue',
  Printing: 'Printing',
  printing: 'Printing',
  Completed: 'Completed',
  completed: 'Completed',
  Released: 'Released',
  released: 'Released',
  Canceled: 'Canceled',
  canceled: 'Canceled',
  Received: 'In Queue',
  'On Hold': 'In Queue',
};

function parseMoney(v: string | number | undefined, fallback: number): number {
  if (typeof v === 'number') return isNaN(v) ? fallback : v;
  if (v == null) return fallback;
  const n = parseFloat(String(v).replace(/[₱,]/g, ''));
  return isNaN(n) ? fallback : n;
}

// ─── Store ──────────────────────────────────────────────────────────────────

class DataStore {
  private orders: Order[] = [];
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private lastRefreshAt = 0;

  constructor() {
    this.hydrate();
    this.initialized = true;

    subscribeOrderChanges(() => {
      void this.refresh();
    });
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Full re-read from Supabase (used on initial load + realtime events). A
  // failed fetch keeps the previous cache so transient RLS/network errors do
  // not blank the UI.
  private async refresh(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefreshAt < 400) return; // cheap re-entry guard
    this.lastRefreshAt = now;
    try {
      const dtos = await fetchOrders();
      this.orders = dtos.map(orderDtoToApp);
      this.notify();
    } catch (err) {
      console.warn('[dataStore] order refresh failed (stale cache retained)', err);
    }
  }

  async hydrate(): Promise<void> {
    await authReady;
    try {
      const dtos = await fetchOrders();
      this.orders = dtos.map(orderDtoToApp);
    } catch (err) {
      console.warn('[dataStore] initial order hydrate failed', err);
    }
    this.notify();
  }

  // Public force-refetch entry (used by storeSync after auth settles); failures
  // keep the current snapshot so a transient RLS/network error never blanks UI.
  refreshFromBackend(): Promise<void> {
    return this.hydrate();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Order read methods (sync — these power every dashboard/list)
  getOrders(): Order[] {
    return [...this.orders];
  }

  getOrdersByCustomer(customerEmail: string): Order[] {
    return this.orders.filter((o) => o.customerEmail === customerEmail);
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find((o) => o.id === id);
  }

  async getOrderByIdAsync(id: string): Promise<Order | undefined> {
    const cached = this.orders.find((o) => o.id === id);
    if (cached) return cached;
    try {
      const dto = await fetchOrderById(id);
      if (!dto) return undefined;
      const app = orderDtoToApp(dto);
      this.orders = [app, ...this.orders];
      return app;
    } catch (err) {
      console.warn('[dataStore] fetch by id failed', err);
      return undefined;
    }
  }

  // Create an order in Supabase (plus its files/addons/cost breakdown/history),
  // then adopt the result locally. Returns the created app Order — its `id` is
  // the DB uuid and `displayId` is the ORD-0001 form. The input's pre-minted
  // display `id` (legacy counter) is ignored.
  async addOrder(input: OrderInput, onProgress?: (p: OrderUploadProgress) => void): Promise<Order> {
    const status = STATUS_MAP[input.status ?? 'Awaiting Payment'] ?? 'Awaiting Payment';
    const total = parseMoney(input.total, 0);
    const printingCost = input.costBreakdown?.printingCost ?? total - (input.costBreakdown?.addonsCost ?? 0);
    const addonsCost = input.addons?.reduce((s, a) => s + a.price * a.quantity, 0) ?? input.costBreakdown?.addonsCost ?? Math.max(0, total - printingCost);

    const isWalkin = input.orderSource === 'walkin';
    const suppliedCustomerId = input.customerId ?? (isWalkin ? null : input.customerEmail);
    const customerId =
      isWalkin
        ? null
        : typeof suppliedCustomerId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(suppliedCustomerId)
          ? suppliedCustomerId
          : input.actorId ?? null;

    // FINALIZED RULE — second confirmed unclaimed-order offense blocks Cash on
    // Pickup for future orders. This is enforced HERE at the single order-
    // submission chokepoint (the same path every print request flows through),
    // NOT only in the checkout UI, so a bypassed/manipulated selection is still
    // rejected before any row or file is written. Walk-in (staff-assisted) sales
    // are exempt. NOTE: the offense ledger is the in-memory preview store, so in
    // this prototype the check is client-trusted; when the penalty workflow is
    // backed by a server table this guard moves server-side with no caller change.
    if (!isWalkin && input.paymentMethod === 'Cash') {
      const customerKey = input.customerEmail ?? input.actorId ?? null;
      if (pickupReview.isCashOnPickupRestricted(customerKey)) {
        throw new Error(CASH_ON_PICKUP_BLOCKED_MESSAGE);
      }
    }

    const row: CreateOrderInput = {
      customerId,
      customerName: input.customerName ?? input.customer ?? 'Customer',
      customerEmail: input.customerEmail ?? `${(input.customerName ?? 'customer').toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`,
      status,
      orderSource: input.orderSource ?? 'online',
      customerType: input.customerType ?? null,
      subtotal: printingCost,
      addonsTotal: addonsCost,
      total,
      manualTotal: input.manualTotal ?? null,
      holdReason: input.holdReason ?? null,
      cancellationReason: input.cancellationReason ?? null,
      paymentDeadline: input.paymentDeadline ? new Date(input.paymentDeadline) : null,
      paymentAmountPaid: input.paymentAmountPaid ?? 0,
      downPaymentRequired: input.downPaymentRequired ?? false,
      downPaymentAmount: input.downPaymentAmount ?? null,
      downPaymentVerified: input.downPaymentVerified ?? false,
      fullPaymentRequired: input.fullPaymentRequired ?? false,
      fullPaymentAmount: input.fullPaymentAmount ?? null,
      fullPaymentVerified: input.fullPaymentVerified ?? false,
      expectedPaperUsage: input.expectedPaperUsage ?? null,
      paperDeductedOnCreate: input.paperDeductedOnCreate ?? false,
      paperConfirmed: input.paperConfirmed ?? false,
      errorUsage: input.errorUsage ?? null,
      notes: input.notes ?? '',
    };

    const createdById = input.actorId ?? null;

    // Upload attached file bytes to Storage BEFORE any DB write so a storage
    // failure (bucket missing, RLS, offline) blocks placement cleanly with no
    // orphaned order row. If any file upload fails, best-effort remove whatever
    // was already uploaded and rethrow so the caller aborts before touching the DB.
    const files = input.attachedFiles ?? [];
    const uploadFolder = `${input.actorId ?? 'anonymous'}/orders`;
    const storagePaths: (string | null)[] = [];

    // Pre-count the files that actually carry bytes so the progress callback can
    // report "file 2 of 3" accurately (files without a File object are skipped).
    const uploadable = files.filter((f) => Boolean(f.file));
    let uploadIndex = 0;

    for (const f of files) {
      if (!f.file) {
        storagePaths.push(null);
        continue;
      }
      uploadIndex += 1;
      const fileIndex = uploadIndex;
      const fileCount = uploadable.length;
      try {
        const path = await uploadObjectAndGetPath({
          bucket: BUCKETS.orderFiles,
          folder: uploadFolder,
          file: f.file,
          fileName: f.name,
          contentType: f.mimeType || f.file.type,
          onProgress: onProgress
            ? (loaded, total) => {
                onProgress({
                  fileIndex,
                  fileCount,
                  fileName: f.name,
                  percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
                });
              }
            : undefined,
        });
        storagePaths.push(path);
      } catch (err) {
        await removeObjectsIfPresent(BUCKETS.orderFiles, storagePaths);
        throw err;
      }
    }

    let id: string;
    let orderNumber: number;
    try {
      ({ id, orderNumber } = await createOrder(row));
    } catch (err) {
      // The order row failed — remove the files we just uploaded so storage
      // never holds orphans for an order that doesn't exist.
      await removeObjectsIfPresent(BUCKETS.orderFiles, storagePaths);
      throw err;
    }

    // Walk-in companion log: only AFTER the order row is confirmed, write the
    // `walk_in_transactions` entry (best-effort — a failed log write must never
    // block or reverse the already-placed order). No rows are written at all if
    // `createOrder` above threw, so the log can only ever reference a placed order.
    if (isWalkin) {
      createWalkInTransaction({
        orderId: id,
        customerName: input.customer ?? input.customerName ?? 'Walk-in Customer',
        customerType: input.customerType ?? 'printing',
        total: input.manualTotal ?? input.costBreakdown?.total ?? total,
        paymentMethod: 'Cash',
        createdBy: createdById,
      }).catch((err) => console.warn('[dataStore] walk-in transaction log write failed:', err));

      // Audit the walk-in sale — captured at the single placement chokepoint so
      // both print and photocopy walk-ins are covered.
      const walkInCustomerName = input.customer ?? input.customerName ?? 'Walk-in Customer';
      const walkInTotal = input.manualTotal ?? input.costBreakdown?.total ?? total;
      auditLogStore.record({
        module: 'Walk-in',
        action: 'Created',
        reference: `${walkInCustomerName} — Walk-in`,
        entityType: 'Order',
        entityId: id,
        title: 'Walk-in Transaction Placed',
        description: `A walk-in ${input.customerType === 'photocopy' ? 'photocopy' : 'printing'} transaction for ${walkInCustomerName} was placed. Total to collect: ₱${String(walkInTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}.`,
        changes: walkInTotal > 0
          ? [{ field: 'Total', previous: '—', next: `₱${String(walkInTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}` }]
          : [],
      });
    }

    if (files.length > 0) {
      await insertOrderFiles(
        id,
        files.map((f, i) => ({
          storagePath: storagePaths[i],
          originalName: f.name,
          mimeType: f.mimeType ?? f.file?.type ?? null,
          sizeBytes: f.sizeBytes ?? f.file?.size ?? null,
          pageCount: f.pageCount ?? null,
          printType: f.printType ?? null,
          contentType: f.contentType ?? null,
          paperSize: f.paperSize ?? null,
          copies: f.copies ?? 1,
          colorMode: f.colorMode ?? null,
          pageRange: f.pageRange ?? null,
          specificPages: f.specificPages ?? null,
          pagesPerSheet: f.pagesPerSheet ?? null,
          orientation: f.orientation ?? null,
          twoSided: f.twoSided ?? null,
          margins: f.margins ?? null,
          scale: f.scale ?? null,
          customScale: f.customScale ?? null,
          photoSize: f.photoSize ?? null,
          photoQuantity: f.photoQuantity ?? null,
          notes: f.notes ?? null,
        })),
      ).catch((err) => console.warn('[dataStore] order files write failed (order placed without file rows):', err));
    }

    if (input.addons && input.addons.length > 0) {
      await insertOrderAddons(
        id,
        input.addons.map((a) => ({ name: a.name, quantity: a.quantity, unitPrice: a.price })),
      ).catch((err) => console.warn('[dataStore] order addons write failed (order placed without addon rows):', err));
    }

    if (input.costBreakdown) {
      await upsertCostBreakdown(id, {
        printingCost: input.costBreakdown.printingCost,
        addonsCost: input.costBreakdown.addonsCost,
        total: input.costBreakdown.total,
      }).catch((err) => console.warn('[dataStore] cost breakdown write failed:', err));
    }

    await insertStatusHistory(id, {
      oldStatus: null,
      newStatus: status,
      reason: input.holdReason ?? null,
      changedBy: createdById,
    }).catch((err) => console.warn('[dataStore] initial history write failed', err));

    const dto = await fetchOrderById(id);
    if (!dto) throw new Error('Order was created but could not be reloaded.');
    const app = orderDtoToApp(dto);
    this.orders = [app, ...this.orders];
    this.notify();
    return app;
  }

  // DB-backed partial update. Persists, then mutates cache only on success.
  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const current = this.orders.find((o) => o.id === id);

    const patch: Parameters<typeof dbUpdateOrder>[1] = {};
    if ('status' in updates && updates.status) patch.status = updates.status;
    if ('holdReason' in updates) patch.holdReason = updates.holdReason ?? null;
    if ('cancellationReason' in updates) patch.cancellationReason = updates.cancellationReason ?? null;
    if ('paymentDeadline' in updates)
      patch.paymentDeadline = updates.paymentDeadline ? new Date(updates.paymentDeadline) : null;
    if ('paymentAmountPaid' in updates && updates.paymentAmountPaid != null)
      patch.paymentAmountPaid = updates.paymentAmountPaid;
    if ('downPaymentRequired' in updates) patch.downPaymentRequired = updates.downPaymentRequired;
    if ('downPaymentAmount' in updates) patch.downPaymentAmount = updates.downPaymentAmount ?? null;
    if ('downPaymentVerified' in updates) patch.downPaymentVerified = updates.downPaymentVerified;
    if ('fullPaymentRequired' in updates) patch.fullPaymentRequired = updates.fullPaymentRequired;
    if ('fullPaymentAmount' in updates) patch.fullPaymentAmount = updates.fullPaymentAmount ?? null;
    if ('fullPaymentVerified' in updates) patch.fullPaymentVerified = updates.fullPaymentVerified;
    if ('expectedPaperUsage' in updates) patch.expectedPaperUsage = updates.expectedPaperUsage ?? null;
    if ('paperDeductedOnCreate' in updates) patch.paperDeductedOnCreate = updates.paperDeductedOnCreate;
    if ('paperConfirmed' in updates) patch.paperConfirmed = updates.paperConfirmed;
    if ('errorUsage' in updates) patch.errorUsage = updates.errorUsage ?? null;
    if ('notes' in updates) patch.notes = updates.notes ?? null;
    if ('manualTotal' in updates) patch.manualTotal = updates.manualTotal ?? null;
    if ('customerName' in updates) patch.customerName = updates.customerName;
    if ('customerEmail' in updates) patch.customerEmail = updates.customerEmail;

    const oldStatus = current?.status ?? null;
    const newStatus = patch.status ?? oldStatus;

    await dbUpdateOrder(id, patch);
    if (patch.status && newStatus && newStatus !== oldStatus) {
      await insertStatusHistory(id, {
        oldStatus,
        newStatus,
        reason: patch.cancellationReason ?? null,
        changedBy: null,
      }).catch((err) => console.warn('[dataStore] status history write failed', err));
    }

    // Re-read the fresh row so order_number + payments stay consistent.
    const fresh = await fetchOrderById(id);
    if (fresh) {
      const app = orderDtoToApp(fresh);
      this.orders = [app, ...this.orders.filter((o) => o.id !== id)];
      this.notify();
      return app;
    }
    return undefined;
  }

  updateOrderStatus(id: string, status: Order['status'], holdReason?: string) {
    return this.updateOrder(id, { status, holdReason });
  }

  async deleteOrder(id: string): Promise<void> {
    this.orders = this.orders.filter((o) => o.id !== id);
    this.notify();
  }

  getOrderStats(customerEmail?: string) {
    const orders = customerEmail
      ? this.getOrdersByCustomer(customerEmail)
      : this.orders;

    const awaitingPayment = orders.filter((o) => o.status === 'Awaiting Payment').length;
    const inQueue = orders.filter((o) => o.status === 'In Queue').length;
    const printing = orders.filter((o) => o.status === 'Printing').length;
    const completed = orders.filter((o) => o.status === 'Completed').length;
    const released = orders.filter((o) => o.status === 'Released').length;
    const canceled = orders.filter((o) => o.status === 'Canceled').length;

    // "In Progress" = orders actively being printed (queued + printing)
    const inProgress = inQueue + printing;
    // "All Completed" = done + picked up
    const allCompleted = completed + released;
    // "Active" = not yet finished or picked up (includes awaiting payment)
    const allActive = inQueue + printing + awaitingPayment;
    // "Finished" = completed + released (alias)
    const allFinished = allCompleted;
    // Total = awaitingPayment + inProgress + allCompleted (no canceled)
    const total = awaitingPayment + inProgress + allCompleted;

    return {
      total,
      awaitingPayment,
      inQueue,
      printing,
      completed,
      released,
      canceled,
      inProgress,
      allCompleted,
      allActive,
      allFinished,
    };
  }
}

export const dataStore = new DataStore();