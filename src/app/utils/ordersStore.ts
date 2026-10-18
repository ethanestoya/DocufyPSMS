// Shared orders store for queue management
import { dataStore } from './dataStore';

type OrderType = {
  id: string;
  // Human-facing ORD-0001 form (DB uuid stays in `id`; consumers display this).
  displayId?: string;
  customer: string;
  customerEmail?: string;
  customerType?: 'printing' | 'photocopy';
  pages: number;
  type: string;
  notes: string;
  status: 'inQueue' | 'printing' | 'completed' | 'released' | 'canceled' | 'awaitingPayment';
  time: string;
  paperSize: string;
  copies: number;
  submittedAt: Date;
  // Optional manual staff-entered total (overrides automatic pricing, e.g. walk-in photocopy).
  manualTotal?: number;
  holdReason?: string;
  cancellationReason?: string;
  // Payment confirmation/verification deadline for awaiting-payment orders.
  paymentDeadline?: Date;
  // Amount the customer reports having paid (online submissions).
  paymentAmountPaid?: number;
  // Full AttachedFile objects flow through from dataStore at runtime; the
  // optional spec fields power the order receipt's per-file rows.
  attachedFiles?: {
    name: string;
    size: string;
    type: string;
    url?: string;
    printType?: string;
    contentType?: string;
    paperSize?: string;
    pageCount?: number;
    copies?: number;
    colorMode?: string;
    photoSize?: string;
    photoQuantity?: number;
    notes?: string;
  }[];
  paymentVerified?: boolean;
  paymentReferenceNumber?: string;
  // When the order's verified payment was recorded (Date), for the receipt.
  paymentVerifiedAt?: Date;
  paymentMethod?: string;
  paymentProofUrl?: string;
  orderSource: 'online' | 'walkin';
  // Additional print job details
  orientation?: string;
  twoSided?: string;
  pagesPerSheet?: string;
  margins?: string;
  scale?: string;
  customScale?: number;
  colorMode?: string;
  pageRange?: string;
  specificPages?: string;
  totalPages?: number;
  addons?: { name: string; quantity: number; price: number }[];
  costBreakdown?: {
    printingCost: number;
    addonsCost: number;
    total: number;
  };
  // Down payment fields
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
  downPaymentVerified?: boolean;
  // Full payment fields (high-value orders ≥ fullPaymentThreshold — no 50% option)
  fullPaymentRequired?: boolean;
  fullPaymentAmount?: number;
  fullPaymentVerified?: boolean;
  // Paper usage confirmation fields
  expectedPaperUsage?: { size: string; sheets: number }[];
  paperDeductedOnCreate?: boolean;
  paperConfirmed?: boolean;
  errorUsage?: { noErrors: boolean; reason?: string; wastedSheets: number };
  // Timestamp tracking fields
  statusUpdatedAt?: Date; // Tracks when status was last changed
  createdAt?: Date; // Tracks when order was created
  lastUpdatedAt?: Date; // Tracks any update to the order
};

type Subscriber = () => void;

// Safely serialize a date field. Malformed/absent timestamps (e.g. a stale
// stored value that `new Date()` can't parse) become `undefined` instead of
// throwing — a single bad order must never abort a full queue sync.
const toIso = (d: unknown): string | undefined =>
  d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : undefined;

// Safely parse a date field back into a Date; unparseable values become
// `undefined` (never an Invalid Date, which would throw on `.toISOString()`).
const asDate = (v: unknown): Date | undefined => {
  if (v == null) return undefined;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? undefined : d;
};

class OrdersStore {
  private orders: OrderType[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private initialized: boolean = false;
  private syncing: boolean = false;

  constructor() {
    // Subscribe to dataStore changes for bidirectional sync
    dataStore.subscribe(() => {
      if (this.initialized && !this.syncing) {
        this.loadFromDataStore(true);
      }
    });
  }

  // Initialize from dataStore on first access
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.loadFromDataStore(false);
      this.initialized = true;
    }
  }

  // Load orders from dataStore and convert to OrderType format
  private loadFromDataStore(notify: boolean = true): void {
    const dataStoreOrders = dataStore.getOrders();
    this.orders = dataStoreOrders.map(order => this.convertFromDataStore(order));
    if (notify) {
      this.notify();
    }
  }

  getOrders(): OrderType[] {
    this.ensureInitialized();
    return [...this.orders];
  }

  // Persist a single order update. Delegates to dataStore (Supabase-backed) and
  // only mirrors the change into the local list after the DB write succeeds, so
  // a failed write never leaves a phantom status in the UI. Callers should
  // await this and surface errors.
  async updateOrder(id: string, updates: Partial<OrderType>): Promise<void> {
    this.ensureInitialized();
    const now = new Date();
    const previousOrder = this.orders.find(o => o.id === id);

    // Automatically add timestamps
    const timestampedUpdates = {
      ...updates,
      lastUpdatedAt: now,
      // Update statusUpdatedAt only if status is actually changing
      ...(updates.status && previousOrder && updates.status !== previousOrder.status
        ? { statusUpdatedAt: now }
        : {})
    };

    const updatedOrder = { ...previousOrder, ...timestampedUpdates } as OrderType;

    // Update in dataStore first (throws on failure). The dataStore notify fired
    // by this write is suppressed by the `syncing` flag; we mirror + notify
    // ourselves afterwards.
    this.syncing = true;
    try {
      await dataStore.updateOrder(id, {
        status: this.convertStatus(updatedOrder.status),
        holdReason: updatedOrder.holdReason,
        cancellationReason: updatedOrder.cancellationReason,
        paymentDeadline: toIso(updatedOrder.paymentDeadline),
        paymentAmountPaid: updatedOrder.paymentAmountPaid,
        downPaymentVerified: updatedOrder.downPaymentVerified,
        downPaymentRequired: updatedOrder.downPaymentRequired,
        downPaymentAmount: updatedOrder.downPaymentAmount,
        fullPaymentVerified: updatedOrder.fullPaymentVerified,
        fullPaymentRequired: updatedOrder.fullPaymentRequired,
        fullPaymentAmount: updatedOrder.fullPaymentAmount,
        expectedPaperUsage: updatedOrder.expectedPaperUsage,
        paperDeductedOnCreate: updatedOrder.paperDeductedOnCreate,
        paperConfirmed: updatedOrder.paperConfirmed,
        errorUsage: updatedOrder.errorUsage,
        statusUpdatedAt: toIso(updatedOrder.statusUpdatedAt),
        lastUpdatedAt: toIso(updatedOrder.lastUpdatedAt),
      });
    } finally {
      this.syncing = false;
    }

    this.orders = this.orders.map(order =>
      order.id === id ? updatedOrder : order
    );
    this.notify();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback());
  }

  // Convert dataStore Order to OrderType format
  private convertFromDataStore(order: any): OrderType {
    const submitted = asDate(order.date) ?? new Date(0);
    return {
      id: order.id,
      displayId: order.displayId,
      customer: order.customerName,
      pages: order.pages || 0,
      type: order.printType === 'Colored' ? 'Colored' : 'B&W',
      notes: order.notes || order.holdReason || '',
      status: this.convertStatusReverse(order.status),
      time: submitted.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      paperSize: order.paperSize || 'A4',
      copies: order.copies || 1,
      submittedAt: submitted,
      holdReason: order.holdReason,
      cancellationReason: order.cancellationReason,
      paymentDeadline: asDate(order.paymentDeadline),
      paymentAmountPaid: order.paymentAmountPaid,
      attachedFiles: order.attachedFiles || (order.fileName ? [{ name: order.fileName, size: '0 MB', type: 'PDF' }] : []),
      paymentVerified: order.paymentVerified || false,
      paymentReferenceNumber: order.paymentReferenceNumber,
      paymentVerifiedAt: asDate(order.paymentVerifiedAt),
      paymentMethod: order.paymentMethod,
      orderSource: order.orderSource || (order.paymentMethod === 'Cash' ? 'walkin' : 'online'),
      customerEmail: order.customerEmail,
      customerType: order.customerType,
      orientation: order.orientation as 'portrait' | 'landscape' | undefined,
      twoSided: order.twoSided as 'yes' | 'no' | undefined,
      pagesPerSheet: order.pagesPerSheet as '1' | '2' | '4' | undefined,
      margins: order.margins,
      scale: order.scale,
      customScale: order.customScale,
      colorMode: order.colorMode as 'bw' | 'color' | undefined,
      pageRange: order.pageRange as 'all' | 'specific' | undefined,
      specificPages: order.specificPages,
      addons: order.addons,
      costBreakdown: order.costBreakdown,
      downPaymentRequired: order.downPaymentRequired,
      downPaymentAmount: order.downPaymentAmount,
      downPaymentVerified: order.downPaymentVerified,
      fullPaymentRequired: order.fullPaymentRequired,
      fullPaymentAmount: order.fullPaymentAmount,
      fullPaymentVerified: order.fullPaymentVerified,
      expectedPaperUsage: order.expectedPaperUsage,
      paperDeductedOnCreate: order.paperDeductedOnCreate,
      paperConfirmed: order.paperConfirmed,
      errorUsage: order.errorUsage,
      statusUpdatedAt: asDate(order.statusUpdatedAt),
      createdAt: asDate(order.createdAt),
      lastUpdatedAt: asDate(order.lastUpdatedAt),
      manualTotal: order.manualTotal,
    };
  }

  private convertStatus(status: OrderType['status']): 'In Queue' | 'Printing' | 'Completed' | 'Released' | 'Canceled' | 'Awaiting Payment' {
    const statusMap: Record<OrderType['status'], 'In Queue' | 'Printing' | 'Completed' | 'Released' | 'Canceled' | 'Awaiting Payment'> = {
      'inQueue': 'In Queue',
      'printing': 'Printing',
      'completed': 'Completed',
      'released': 'Released',
      'canceled': 'Canceled',
      'awaitingPayment': 'Awaiting Payment',
    };
    return statusMap[status];
  }

  private convertStatusReverse(status: string): OrderType['status'] {
    const statusMap: Record<string, OrderType['status']> = {
      'In Queue': 'inQueue',
      'Printing': 'printing',
      'Completed': 'completed',
      'Released': 'released',
      'Canceled': 'canceled',
      'Awaiting Payment': 'awaitingPayment',
      // Legacy statuses folded into the new workflow
      'Received': 'inQueue',
      'On Hold': 'inQueue',
    };
    return statusMap[status] || 'awaitingPayment';
  }
}

export const ordersStore = new OrdersStore();
export type { OrderType };