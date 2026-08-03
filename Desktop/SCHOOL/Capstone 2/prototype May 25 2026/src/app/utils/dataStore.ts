// Centralized data store for orders and inventory
// This ensures all dashboards show consistent data
import { orderCounter } from './orderCounter';

export interface AttachedFile {
  name: string;
  size: string;
  type: string;
  url?: string;
  uploadedAt?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: 'Received' | 'In Queue' | 'Printing' | 'Completed' | 'Released' | 'On Hold' | 'Canceled';
  holdReason?: string;
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
  fileName?: string;
  pages?: number;
  attachedFiles?: AttachedFile[];
  orientation?: string;
  twoSided?: string;
  pagesPerSheet?: string;
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
  // Down payment fields
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
  downPaymentVerified?: boolean;
  // Timestamp tracking fields
  statusUpdatedAt?: string; // ISO string - tracks when status was last changed
  createdAt?: string; // ISO string - tracks when order was created
  lastUpdatedAt?: string; // ISO string - tracks any update to the order
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  lastUpdated: string;
  supplier?: string;
  cost?: number;
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

// Mock Orders Data - Comprehensive dataset covering ALL order statuses
const initialOrders: Order[] = [
  // RECEIVED status
  {
    id: 'ORD-001',
    customerId: 'customer@test.com',
    customerName: 'Ethan Laureen',
    customerEmail: 'customer@test.com',
    status: 'Received',
    total: '₱45.00',
    date: '2026-04-27T08:15:00',
    paperType: 'Bond Paper',
    paperSize: 'Short',
    printType: 'Black & White',
    copies: 15,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-001.jpg',
    paymentReferenceNumber: 'GC-20260427-001',
    paymentVerified: true,
    fileName: 'document1.pdf',
    pages: 3,
    attachedFiles: [
      { name: 'document1.pdf', size: '1.2 MB', type: 'PDF', uploadedAt: '2026-04-27T08:15:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'no',
    pagesPerSheet: '1',
    colorMode: 'bw',
    pageRange: 'all',
    notes: 'Please staple pages together',
    addons: [
      { name: 'Stapler Wire', quantity: 1, price: 15 }
    ],
    costBreakdown: {
      printingCost: 30.00,
      addonsCost: 15.00,
      total: 45.00
    },
    orderSource: 'online',
  },
  // IN QUEUE status
  {
    id: 'ORD-002',
    customerId: 'test@example.com',
    customerName: 'Jane Smith',
    customerEmail: 'test@example.com',
    status: 'In Queue',
    total: '₱120.00',
    date: '2026-04-27T09:30:00',
    paperType: 'Bond Paper',
    paperSize: 'Long',
    printType: 'Colored',
    copies: 40,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-002.jpg',
    paymentReferenceNumber: 'GC-20260427-002',
    paymentVerified: true,
    fileName: 'presentation.pdf',
    pages: 12,
    attachedFiles: [
      { name: 'presentation.pdf', size: '8.5 MB', type: 'PDF', uploadedAt: '2026-04-27T09:30:00' }
    ],
    orientation: 'Landscape',
    twoSided: 'yes',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'all',
    notes: 'High-quality print needed for presentation',
    addons: [
      { name: 'Plastic Folder (Long)', quantity: 2, price: 15 }
    ],
    costBreakdown: {
      printingCost: 90.00,
      addonsCost: 30.00,
      total: 120.00
    },
    orderSource: 'online',
  },
  {
    id: 'ORD-003',
    customerId: 'test2@example.com',
    customerName: 'Bob Johnson',
    customerEmail: 'test2@example.com',
    status: 'In Queue',
    total: '₱35.00',
    date: '2026-04-27T10:30:00',
    paperType: 'Bond Paper',
    paperSize: 'Short',
    printType: 'Black & White',
    copies: 14,
    paymentMethod: 'Cash',
    paymentVerified: true,
    fileName: 'assignment.pdf',
    pages: 7,
    attachedFiles: [
      { name: 'assignment.pdf', size: '890 KB', type: 'PDF', uploadedAt: '2026-04-27T10:30:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'no',
    pagesPerSheet: '2',
    colorMode: 'bw',
    pageRange: 'specific',
    specificPages: '1-5, 7',
    notes: '',
    addons: [],
    orderSource: 'walkin',
  },
  // PRINTING status
  {
    id: 'ORD-004',
    customerId: 'test3@example.com',
    customerName: 'Alice Brown',
    customerEmail: 'test3@example.com',
    status: 'Printing',
    total: '₱150.00',
    date: '2026-04-27T07:45:00',
    paperType: 'Glossy Paper',
    paperSize: 'Long',
    printType: 'Colored',
    copies: 50,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-004.jpg',
    paymentReferenceNumber: 'GC-20260427-004',
    paymentVerified: true,
    fileName: 'portfolio.pdf',
    pages: 20,
    attachedFiles: [
      { name: 'portfolio.pdf', size: '25.6 MB', type: 'PDF', uploadedAt: '2026-04-27T07:45:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'no',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'all',
    notes: 'Print on glossy paper for professional look',
    addons: [
      { name: 'Folder Paper (Long)', quantity: 5, price: 10 },
      { name: 'Envelope (Large)', quantity: 3, price: 5 }
    ],
    costBreakdown: {
      printingCost: 85.00,
      addonsCost: 65.00,
      total: 150.00
    },
    orderSource: 'online',
  },
  {
    id: 'ORD-005',
    customerId: 'test5@example.com',
    customerName: 'Emma Wilson',
    customerEmail: 'test5@example.com',
    status: 'Printing',
    total: '₱80.00',
    date: '2026-04-27T08:45:00',
    paperType: 'Bond Paper',
    paperSize: 'Short',
    printType: 'Colored',
    copies: 20,
    paymentMethod: 'Cash',
    paymentVerified: true,
    fileName: 'flyers.pdf',
    pages: 8,
    attachedFiles: [
      { name: 'flyers.pdf', size: '4.3 MB', type: 'PDF', uploadedAt: '2026-04-27T08:45:00' }
    ],
    orientation: 'Landscape',
    twoSided: 'yes',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'all',
    notes: 'Urgent - need within 2 hours',
    addons: [
      { name: 'Staples', quantity: 20, price: 1 }
    ],
    orderSource: 'walkin',
  },
  // COMPLETED status
  {
    id: 'ORD-006',
    customerId: 'test4@example.com',
    customerName: 'Charlie Davis',
    customerEmail: 'test4@example.com',
    status: 'Completed',
    total: '₱90.00',
    date: '2026-04-26T13:00:00',
    paperType: 'Bond Paper',
    paperSize: 'Short',
    printType: 'Colored',
    copies: 30,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-006.jpg',
    paymentReferenceNumber: 'GC-20260426-006',
    paymentVerified: true,
    fileName: 'brochure.pdf',
    pages: 6,
    attachedFiles: [
      { name: 'brochure.pdf', size: '5.7 MB', type: 'PDF', uploadedAt: '2026-04-26T13:00:00' }
    ],
    orientation: 'Landscape',
    twoSided: 'no',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'all',
    notes: 'Fold each brochure in half',
    addons: [
      { name: 'Plastic Folder (Short)', quantity: 10, price: 12 }
    ],
    orderSource: 'online',
  },
  {
    id: 'ORD-007',
    customerId: 'test6@example.com',
    customerName: 'David Martinez',
    customerEmail: 'test6@example.com',
    status: 'Completed',
    total: '₱65.00',
    date: '2026-04-26T15:45:00',
    paperType: 'Bond Paper',
    paperSize: 'Long',
    printType: 'Black & White',
    copies: 22,
    paymentMethod: 'Cash',
    paymentVerified: true,
    fileName: 'research.pdf',
    pages: 18,
    attachedFiles: [
      { name: 'research.pdf', size: '6.8 MB', type: 'PDF', uploadedAt: '2026-04-26T15:45:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'yes',
    pagesPerSheet: '1',
    colorMode: 'bw',
    pageRange: 'all',
    notes: 'Bind with staples on the left side',
    addons: [
      { name: 'Staples', quantity: 25, price: 1 },
      { name: 'Folder Paper (A4)', quantity: 1, price: 10 }
    ],
    orderSource: 'walkin',
  },
  // RELEASED status
  {
    id: 'ORD-008',
    customerId: 'test7@example.com',
    customerName: 'Sophia Garcia',
    customerEmail: 'test7@example.com',
    status: 'Released',
    total: '₱55.00',
    date: '2026-04-25T08:45:00',
    paperType: 'Bond Paper',
    paperSize: 'Long',
    printType: 'Black & White',
    copies: 25,
    paymentMethod: 'Cash',
    paymentVerified: true,
    fileName: 'report.pdf',
    pages: 15,
    attachedFiles: [
      { name: 'report.pdf', size: '3.2 MB', type: 'PDF', uploadedAt: '2026-04-25T08:45:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'yes',
    pagesPerSheet: '2',
    colorMode: 'bw',
    pageRange: 'all',
    notes: '',
    addons: [],
    orderSource: 'walkin',
  },
  {
    id: 'ORD-009',
    customerId: 'test8@example.com',
    customerName: 'Michael Lee',
    customerEmail: 'test8@example.com',
    status: 'Released',
    total: '₱125.00',
    date: '2026-04-25T11:30:00',
    paperType: 'Photo Paper',
    paperSize: 'Short',
    printType: 'Colored',
    copies: 35,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-009.jpg',
    paymentReferenceNumber: 'GC-20260425-009',
    paymentVerified: true,
    fileName: 'certificates.pdf',
    pages: 10,
    attachedFiles: [
      { name: 'certificates.pdf', size: '15.2 MB', type: 'PDF', uploadedAt: '2026-04-25T11:30:00' }
    ],
    orientation: 'Landscape',
    twoSided: 'no',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'all',
    notes: 'Print on high-quality photo paper',
    addons: [
      { name: 'Envelope (Medium)', quantity: 35, price: 4 }
    ],
    orderSource: 'online',
  },
  // ON HOLD status
  {
    id: 'ORD-010',
    customerId: 'test9@example.com',
    customerName: 'Olivia Taylor',
    customerEmail: 'test9@example.com',
    status: 'On Hold',
    holdReason: 'Waiting for customer to confirm paper size change due to stock availability',
    total: '₱200.00',
    date: '2026-04-26T16:20:00',
    paperType: 'Photo Paper',
    paperSize: 'Short',
    printType: 'Colored',
    copies: 100,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-010.jpg',
    paymentReferenceNumber: 'GC-20260426-010',
    paymentVerified: true,
    fileName: 'marketing.pdf',
    pages: 25,
    attachedFiles: [
      { name: 'marketing.pdf', size: '18.4 MB', type: 'PDF', uploadedAt: '2026-04-26T16:20:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'no',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'specific',
    specificPages: '1-10, 15-25',
    notes: 'Customer requested glossy finish for marketing materials',
    addons: [
      { name: 'Plastic Folder (Short)', quantity: 50, price: 12 },
      { name: 'Envelope (Small)', quantity: 100, price: 3 }
    ],
    costBreakdown: {
      printingCost: 125.00,
      addonsCost: 75.00,
      total: 200.00
    },
    orderSource: 'online',
  },
  {
    id: 'ORD-011',
    customerId: 'test10@example.com',
    customerName: 'James Anderson',
    customerEmail: 'test10@example.com',
    status: 'On Hold',
    holdReason: 'Payment verification pending - uploaded receipt is unclear',
    total: '₱75.00',
    date: '2026-04-26T14:15:00',
    paperType: 'Bond Paper',
    paperSize: 'Long',
    printType: 'Black & White',
    copies: 30,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-011.jpg',
    paymentReferenceNumber: 'GC-20260426-011',
    paymentVerified: false,
    fileName: 'thesis.pdf',
    pages: 20,
    attachedFiles: [
      { name: 'thesis.pdf', size: '9.1 MB', type: 'PDF', uploadedAt: '2026-04-26T14:15:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'yes',
    pagesPerSheet: '1',
    colorMode: 'bw',
    pageRange: 'all',
    notes: 'Thesis document - handle with care',
    addons: [
      { name: 'Staples', quantity: 30, price: 1 },
      { name: 'Folder Paper (Long)', quantity: 2, price: 10 }
    ],
    orderSource: 'online',
  },
  // CANCELED status
  {
    id: 'ORD-012',
    customerId: 'test11@example.com',
    customerName: 'Isabella Robinson',
    customerEmail: 'test11@example.com',
    status: 'Canceled',
    total: '₱40.00',
    date: '2026-04-24',
    paperType: 'Bond Paper',
    paperSize: 'Short',
    printType: 'Black & White',
    copies: 12,
    paymentMethod: 'Cash',
    fileName: 'notes.pdf',
    pages: 8,
    attachedFiles: [
      { name: 'notes.pdf', size: '1.5 MB', type: 'PDF', uploadedAt: '2026-04-24T10:00:00' }
    ],
    orientation: 'Portrait',
    twoSided: 'no',
    pagesPerSheet: '2',
    colorMode: 'bw',
    pageRange: 'all',
    notes: 'Customer canceled due to change in requirements',
    addons: [],
    orderSource: 'online',
  },
  {
    id: 'ORD-013',
    customerId: 'test12@example.com',
    customerName: 'Ethan White',
    customerEmail: 'test12@example.com',
    status: 'Canceled',
    total: '₱110.00',
    date: '2026-04-23',
    paperType: 'Glossy Paper',
    paperSize: 'Long',
    printType: 'Colored',
    copies: 28,
    paymentMethod: 'GCash',
    paymentProof: 'gcash-ref-013.jpg',
    fileName: 'posters.pdf',
    pages: 14,
    attachedFiles: [
      { name: 'posters.pdf', size: '22.8 MB', type: 'PDF', uploadedAt: '2026-04-23T13:45:00' }
    ],
    orientation: 'Landscape',
    twoSided: 'no',
    pagesPerSheet: '1',
    colorMode: 'color',
    pageRange: 'all',
    notes: 'Canceled - customer found another print shop',
    addons: [],
    orderSource: 'online',
  },
];

// Mock Inventory Data
const initialInventory: InventoryItem[] = [
  // Paper
  {
    id: 'INV-001',
    name: 'Bond Paper (A4)',
    category: 'Paper',
    quantity: 5000,
    unit: 'sheets',
    reorderLevel: 1000,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 0.50,
  },
  {
    id: 'INV-002',
    name: 'Bond Paper (Long)',
    category: 'Paper',
    quantity: 650, // Low stock - below reorder level of 800
    unit: 'sheets',
    reorderLevel: 800,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 0.75,
  },
  {
    id: 'INV-003',
    name: 'Bond Paper (Short)',
    category: 'Paper',
    quantity: 450, // Critical stock - 50% below reorder level of 1000
    unit: 'sheets',
    reorderLevel: 1000,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 0.60,
  },
  // Ink Cartridges
  {
    id: 'INV-004',
    name: 'BK - 65 mL (Black Ink Cartridge)',
    category: 'Ink',
    quantity: 25,
    unit: 'units',
    reorderLevel: 10,
    lastUpdated: '2026-04-27',
    supplier: 'Printer Supplies Ltd.',
    cost: 450.00,
  },
  {
    id: 'INV-005',
    name: 'C - 65 mL (Cyan Ink Cartridge)',
    category: 'Ink',
    quantity: 18,
    unit: 'units',
    reorderLevel: 8,
    lastUpdated: '2026-04-27',
    supplier: 'Printer Supplies Ltd.',
    cost: 420.00,
  },
  {
    id: 'INV-006',
    name: 'M - 65 mL (Magenta Ink Cartridge)',
    category: 'Ink',
    quantity: 20,
    unit: 'units',
    reorderLevel: 8,
    lastUpdated: '2026-04-27',
    supplier: 'Printer Supplies Ltd.',
    cost: 420.00,
  },
  {
    id: 'INV-007',
    name: 'Y - 65 mL (Yellow Ink Cartridge)',
    category: 'Ink',
    quantity: 22,
    unit: 'units',
    reorderLevel: 8,
    lastUpdated: '2026-04-27',
    supplier: 'Printer Supplies Ltd.',
    cost: 420.00,
  },
  // Add-ons
  {
    id: 'INV-008',
    name: 'Staples',
    category: 'Add-ons',
    quantity: 150,
    unit: 'boxes',
    reorderLevel: 30,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 15.00,
  },
  // Plastic Folders
  {
    id: 'INV-009',
    name: 'Plastic Folder (Long)',
    category: 'Add-ons',
    quantity: 200,
    unit: 'pieces',
    reorderLevel: 50,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 8.00,
  },
  {
    id: 'INV-010',
    name: 'Plastic Folder (Short)',
    category: 'Add-ons',
    quantity: 180,
    unit: 'pieces',
    reorderLevel: 50,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 7.00,
  },
  // Paper Folders
  {
    id: 'INV-011',
    name: 'Folder (Paper) - A4',
    category: 'Add-ons',
    quantity: 250,
    unit: 'pieces',
    reorderLevel: 60,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 5.00,
  },
  {
    id: 'INV-012',
    name: 'Folder (Paper) - Long',
    category: 'Add-ons',
    quantity: 220,
    unit: 'pieces',
    reorderLevel: 60,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 5.50,
  },
  {
    id: 'INV-013',
    name: 'Folder (Paper) - Short',
    category: 'Add-ons',
    quantity: 240,
    unit: 'pieces',
    reorderLevel: 60,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 4.50,
  },
  // Envelopes
  {
    id: 'INV-014',
    name: 'Envelope - Small (4x6 in)',
    category: 'Add-ons',
    quantity: 300,
    unit: 'pieces',
    reorderLevel: 80,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 2.00,
  },
  {
    id: 'INV-015',
    name: 'Envelope - Medium (6x9 in)',
    category: 'Add-ons',
    quantity: 280,
    unit: 'pieces',
    reorderLevel: 70,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 3.00,
  },
  {
    id: 'INV-016',
    name: 'Envelope - Large (9x12 in)',
    category: 'Add-ons',
    quantity: 260,
    unit: 'pieces',
    reorderLevel: 60,
    lastUpdated: '2026-04-27',
    supplier: 'Office Supplies Co.',
    cost: 4.00,
  },
];

// In-memory store with event listeners
class DataStore {
  private orders: Order[] = [...initialOrders];
  private inventory: InventoryItem[] = [...initialInventory];
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Initialize order counter from existing orders
    this.initializeOrderCounter();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  // Order methods
  getOrders(): Order[] {
    return [...this.orders];
  }

  getOrdersByCustomer(customerEmail: string): Order[] {
    return this.orders.filter(order => order.customerEmail === customerEmail);
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find(order => order.id === id);
  }

  addOrder(order: Order) {
    // Automatically add timestamp when creating a new order
    const now = new Date().toISOString();
    const orderWithTimestamps = {
      ...order,
      createdAt: order.createdAt || now,
      statusUpdatedAt: order.statusUpdatedAt || now,
      lastUpdatedAt: now
    };
    this.orders.unshift(orderWithTimestamps);
    this.notify();
  }

  updateOrder(id: string, updates: Partial<Order>) {
    const index = this.orders.findIndex(order => order.id === id);
    if (index !== -1) {
      const now = new Date().toISOString();
      const previousStatus = this.orders[index].status;

      // Automatically update timestamps
      const timestampedUpdates = {
        ...updates,
        lastUpdatedAt: now,
        // Update statusUpdatedAt only if status is actually changing
        ...(updates.status && updates.status !== previousStatus
          ? { statusUpdatedAt: now }
          : {})
      };

      this.orders[index] = { ...this.orders[index], ...timestampedUpdates };
      this.notify();
    }
  }

  updateOrderStatus(id: string, status: Order['status'], holdReason?: string) {
    this.updateOrder(id, { status, holdReason });
  }

  deleteOrder(id: string) {
    this.orders = this.orders.filter(order => order.id !== id);
    this.notify();
  }

  getOrderStats(customerEmail?: string) {
    const orders = customerEmail
      ? this.getOrdersByCustomer(customerEmail)
      : this.orders;

    const received  = orders.filter(o => o.status === 'Received').length;
    const inQueue   = orders.filter(o => o.status === 'In Queue').length;
    const printing  = orders.filter(o => o.status === 'Printing').length;
    const completed = orders.filter(o => o.status === 'Completed').length;
    const released  = orders.filter(o => o.status === 'Released').length;
    const onHold    = orders.filter(o => o.status === 'On Hold').length;

    // "In Progress" = all orders actively being handled (received + queued + printing)
    const inProgress = received + inQueue + printing;
    // "All Completed" = done + picked up
    const allCompleted = completed + released;
    // "Active" = all orders not yet finished/picked up (includes onHold)
    const allActive = inProgress + onHold;
    // "Finished" = completed + released (alias)
    const allFinished = allCompleted;
    // Total = onHold + inProgress + allCompleted (no canceled) — always matches sum of status cards
    const total = onHold + inProgress + allCompleted;

    return {
      total,        // = onHold + inProgress + allCompleted (consistent with dashboard cards)
      received,
      inQueue,
      printing,
      completed,
      released,
      onHold,
      inProgress,   // received + inQueue + printing
      allCompleted, // completed + released
      // Legacy aliases kept for backward compatibility
      allActive,    // inProgress + onHold
      allFinished,  // completed + released
    };
  }

  // Inventory methods
  getInventory(): InventoryItem[] {
    return [...this.inventory];
  }

  getInventoryById(id: string): InventoryItem | undefined {
    return this.inventory.find(item => item.id === id);
  }

  addInventoryItem(item: InventoryItem) {
    this.inventory.push(item);
    this.notify();
  }

  updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    const index = this.inventory.findIndex(item => item.id === id);
    if (index !== -1) {
      this.inventory[index] = {
        ...this.inventory[index],
        ...updates,
        lastUpdated: new Date().toISOString().split('T')[0],
      };
      this.notify();
    }
  }

  deleteInventoryItem(id: string) {
    this.inventory = this.inventory.filter(item => item.id !== id);
    this.notify();
  }

  getLowStockItems(): InventoryItem[] {
    return this.inventory.filter(item => item.quantity <= item.reorderLevel);
  }

  // Get stock status for an item
  getStockStatus(item: InventoryItem): 'in-stock' | 'low-stock' | 'critical' {
    const percentageOfReorder = item.quantity / item.reorderLevel;

    if (item.quantity <= item.reorderLevel * 0.5) {
      return 'critical'; // 50% or less of reorder level
    } else if (item.quantity <= item.reorderLevel) {
      return 'low-stock'; // At or below reorder level
    }
    return 'in-stock'; // Above reorder level
  }

  // Get stock status label
  getStockStatusLabel(item: InventoryItem): string {
    const status = this.getStockStatus(item);
    if (status === 'critical') return 'Critical Stock';
    if (status === 'low-stock') return 'Low Stock';
    return 'In Stock';
  }

  // Get stock status color class
  getStockStatusColor(item: InventoryItem): string {
    const status = this.getStockStatus(item);
    if (status === 'critical') return 'bg-red-100 text-red-800 border-red-300';
    if (status === 'low-stock') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-green-100 text-green-800 border-green-300';
  }

  // Get available paper sizes from inventory (for customer order form)
  getAvailablePaperSizes(): Array<{ id: string; name: string; displayName: string; inStock: boolean }> {
    const paperItems = this.inventory.filter(item => item.category === 'Paper' && !item.archived);
    return paperItems.map(item => {
      // Extract size from name format: "Bond Paper (A4)" -> "A4"
      const match = item.name.match(/\(([^)]+)\)/);
      const size = match ? match[1] : item.name;
      return {
        id: item.id,
        name: size.toLowerCase().replace(/\s+/g, ''),
        displayName: size,
        inStock: item.quantity > 0
      };
    });
  }

  // Get available add-ons from inventory (for customer order form)
  getAvailableAddons(): Array<{
    id: string;
    name: string;
    price: number;
    inStock: boolean;
    unit: string;
    category: string;
    description: string;
  }> {
    const addonItems = this.inventory.filter(item => item.category === 'Add-ons' && !item.archived);
    return addonItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.cost || 0,
      inStock: item.quantity > 0,
      unit: item.unit || 'piece',
      category: 'supplies',
      description: `${item.name} for printing needs`
    }));
  }

  // Generate next sequential order ID using centralized counter
  getNextOrderId(): string {
    return orderCounter.getNextOrderId();
  }

  // Initialize the order counter from existing orders (call once on app start)
  initializeOrderCounter(): void {
    const orderIds = this.orders.map(order => order.id);
    orderCounter.initializeFromOrders(orderIds);
  }
}

export const dataStore = new DataStore();