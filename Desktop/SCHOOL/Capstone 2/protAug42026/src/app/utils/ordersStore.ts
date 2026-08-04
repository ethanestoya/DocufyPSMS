// Shared orders store for queue management
import { dataStore } from './dataStore';

type OrderType = {
  id: string;
  customer: string;
  pages: number;
  type: string;
  notes: string;
  status: 'received' | 'inQueue' | 'printing' | 'completed' | 'released' | 'canceled' | 'onHold';
  time: string;
  paperSize: string;
  copies: number;
  submittedAt: Date;
  holdReason?: string;
  attachedFiles?: { name: string; size: string; type: string }[];
  paymentVerified?: boolean;
  paymentReferenceNumber?: string;
  paymentMethod?: string;
  paymentProofUrl?: string;
  orderSource: 'online' | 'walkin';
  // Additional print job details
  orientation?: string;
  twoSided?: string;
  pagesPerSheet?: string;
  colorMode?: string;
  pageRange?: string;
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
  // Timestamp tracking fields
  statusUpdatedAt?: Date; // Tracks when status was last changed
  createdAt?: Date; // Tracks when order was created
  lastUpdatedAt?: Date; // Tracks any update to the order
};

type Subscriber = () => void;

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

  setOrders(orders: OrderType[]): void {
    this.ensureInitialized();
    this.orders = orders;
    this.syncing = true;
    this.syncToDataStore();
    this.syncing = false;
    this.notify();
  }

  addOrder(order: OrderType): void {
    this.ensureInitialized();
    this.orders = [...this.orders, order].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    // Add to dataStore as well
    this.syncing = true;
    const dataStoreOrder = this.convertToDataStore(order);
    dataStore.addOrder(dataStoreOrder);
    this.syncing = false;
    this.notify();
  }

  updateOrder(id: string, updates: Partial<OrderType>): void {
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

    this.orders = this.orders.map(order =>
      order.id === id ? { ...order, ...timestampedUpdates } : order
    );
    // Update in dataStore as well
    this.syncing = true;
    const updatedOrder = this.orders.find(o => o.id === id);
    if (updatedOrder) {
      dataStore.updateOrder(id, {
        status: this.convertStatus(updatedOrder.status),
        holdReason: updatedOrder.holdReason,
        downPaymentVerified: updatedOrder.downPaymentVerified,
        downPaymentRequired: updatedOrder.downPaymentRequired,
        downPaymentAmount: updatedOrder.downPaymentAmount,
        statusUpdatedAt: updatedOrder.statusUpdatedAt?.toISOString(),
        lastUpdatedAt: updatedOrder.lastUpdatedAt?.toISOString(),
      });
    }
    this.syncing = false;
    this.notify();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback());
  }

  // Sync all queue orders to dataStore (only called during setOrders for initial setup)
  private syncToDataStore(): void {
    const currentDataStoreOrders = dataStore.getOrders();
    const currentIds = new Set(currentDataStoreOrders.map(o => o.id));

    // Add or update orders
    this.orders.forEach(order => {
      const dataStoreOrder = this.convertToDataStore(order);
      if (currentIds.has(order.id)) {
        dataStore.updateOrder(order.id, dataStoreOrder);
      } else {
        dataStore.addOrder(dataStoreOrder);
      }
    });
  }

  // Convert OrderType to dataStore Order format
  private convertToDataStore(order: OrderType) {
    return {
      id: order.id,
      customerId: order.customer,
      customerName: order.customer,
      customerEmail: order.customerEmail || `${order.customer.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      status: this.convertStatus(order.status),
      holdReason: order.holdReason,
      total: `₱${(order.pages * order.copies * (order.type === 'Colored' ? 5 : 1)).toFixed(2)}`,
      date: order.submittedAt.toISOString().split('T')[0],
      paperSize: order.paperSize,
      printType: order.type === 'Colored' ? 'Colored' : 'Black & White',
      copies: order.copies,
      paymentMethod: order.orderSource === 'walkin' ? 'Cash' : 'GCash',
      fileName: order.attachedFiles?.[0]?.name || 'document.pdf',
      pages: order.pages,
      attachedFiles: order.attachedFiles || [],
      orderSource: order.orderSource,
      orientation: order.orientation,
      twoSided: order.twoSided,
      pagesPerSheet: order.pagesPerSheet,
      colorMode: order.colorMode,
      pageRange: order.pageRange,
      specificPages: order.specificPages,
      notes: order.notes,
      addons: order.addons,
      costBreakdown: order.costBreakdown,
      downPaymentRequired: order.downPaymentRequired,
      downPaymentAmount: order.downPaymentAmount,
      downPaymentVerified: order.downPaymentVerified,
      statusUpdatedAt: order.statusUpdatedAt?.toISOString(),
      createdAt: order.createdAt?.toISOString(),
      lastUpdatedAt: order.lastUpdatedAt?.toISOString(),
    };
  }

  // Convert dataStore Order to OrderType format
  private convertFromDataStore(order: any): OrderType {
    return {
      id: order.id,
      customer: order.customerName,
      pages: order.pages || 0,
      type: order.printType === 'Colored' ? 'Colored' : 'B&W',
      notes: order.notes || order.holdReason || '',
      status: this.convertStatusReverse(order.status),
      time: new Date(order.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      paperSize: order.paperSize || 'A4',
      copies: order.copies || 1,
      submittedAt: new Date(order.date),
      holdReason: order.holdReason,
      attachedFiles: order.attachedFiles || (order.fileName ? [{ name: order.fileName, size: '0 MB', type: 'PDF' }] : []),
      paymentVerified: order.paymentVerified || false,
      paymentReferenceNumber: order.paymentReferenceNumber,
      orderSource: order.orderSource || (order.paymentMethod === 'Cash' ? 'walkin' : 'online'),
      customerEmail: order.customerEmail,
      orientation: order.orientation as 'portrait' | 'landscape' | undefined,
      twoSided: order.twoSided as 'yes' | 'no' | undefined,
      pagesPerSheet: order.pagesPerSheet as '1' | '2' | '4' | undefined,
      colorMode: order.colorMode as 'bw' | 'color' | undefined,
      pageRange: order.pageRange as 'all' | 'specific' | undefined,
      specificPages: order.specificPages,
      addons: order.addons,
      costBreakdown: order.costBreakdown,
      downPaymentRequired: order.downPaymentRequired,
      downPaymentAmount: order.downPaymentAmount,
      downPaymentVerified: order.downPaymentVerified,
      statusUpdatedAt: order.statusUpdatedAt ? new Date(order.statusUpdatedAt) : undefined,
      createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
      lastUpdatedAt: order.lastUpdatedAt ? new Date(order.lastUpdatedAt) : undefined,
    };
  }

  private convertStatus(status: OrderType['status']): 'Received' | 'In Queue' | 'Printing' | 'Completed' | 'Released' | 'On Hold' | 'Canceled' {
    const statusMap: Record<OrderType['status'], 'Received' | 'In Queue' | 'Printing' | 'Completed' | 'Released' | 'On Hold' | 'Canceled'> = {
      'received': 'Received',
      'inQueue': 'In Queue',
      'printing': 'Printing',
      'completed': 'Completed',
      'released': 'Released',
      'canceled': 'Canceled',
      'onHold': 'On Hold',
    };
    return statusMap[status];
  }

  private convertStatusReverse(status: string): OrderType['status'] {
    const statusMap: Record<string, OrderType['status']> = {
      'Received': 'received',
      'In Queue': 'inQueue',
      'Printing': 'printing',
      'Completed': 'completed',
      'Released': 'released',
      'Canceled': 'canceled',
      'On Hold': 'onHold',
    };
    return statusMap[status] || 'received';
  }
}

export const ordersStore = new OrdersStore();
export type { OrderType };