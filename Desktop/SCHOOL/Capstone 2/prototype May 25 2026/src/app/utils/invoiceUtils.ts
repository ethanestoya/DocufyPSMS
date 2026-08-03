// Invoice utilities for dynamic invoice generation
// Ensures consistent invoice data across Admin, Staff, and Customer modules

export interface InvoiceData {
  invoiceNumber: string;
  orderId: string;
  date: string;
  status: string;
  customerName: string;
  customerEmail: string;
  fileName: string;
  totalPages: number;
  copies: number;
  colorMode: string;
  paperSize: string;
  paperSizeDisplay: string;
  orientation: string;
  twoSided: string;
  pagesPerSheet: string;
  pageRange: string;
  specificPages?: string;
  notes?: string;
  orderSource: string;
  paymentMethod: string;
  paymentStatus: 'verified' | 'pending' | 'cash';
  paymentReferenceNumber?: string;
  addons: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  costBreakdown: {
    printingCost: number;
    addonsCost: number;
    total: number;
  };
  totalAmount: string;
  createdAt?: string;
  completedAt?: string;
}

/**
 * Generates invoice data from order data
 * This function ensures all invoice displays use the same calculation logic
 */
export function generateInvoiceData(orderData: any): InvoiceData {
  if (!orderData) {
    throw new Error('Order data is required to generate invoice');
  }

  // Calculate costs dynamically
  const printingCost = orderData.costBreakdown?.printingCost ||
    calculatePrintingCost(orderData.pages || 0, orderData.copies || 0, orderData.printType || orderData.colorMode);

  const addonsWithSubtotal = (orderData.addons || []).map((addon: any) => ({
    name: addon.name,
    quantity: addon.quantity,
    price: addon.price,
    subtotal: addon.price * addon.quantity,
  }));

  const addonsCost = addonsWithSubtotal.reduce((sum, addon) => sum + addon.subtotal, 0);
  const totalCost = printingCost + addonsCost;

  // Format paper size display
  const paperSizeDisplay = formatPaperSize(orderData.paperSize);

  // Determine payment status
  let paymentStatus: 'verified' | 'pending' | 'cash' = 'pending';
  if (orderData.paymentMethod === 'Cash' || orderData.orderSource === 'walkin') {
    paymentStatus = 'cash';
  } else if (orderData.paymentVerified) {
    paymentStatus = 'verified';
  }

  // Format color mode
  const colorMode = formatColorMode(orderData.printType || orderData.colorMode);

  return {
    invoiceNumber: `INV-${orderData.id}`,
    orderId: orderData.id,
    date: orderData.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    status: orderData.status || 'Received',
    customerName: orderData.customerName || orderData.customer || 'N/A',
    customerEmail: orderData.customerEmail || `${(orderData.customerName || orderData.customer || 'customer').toLowerCase().replace(/\s+/g, '.')}@example.com`,
    fileName: orderData.fileName || orderData.attachedFiles?.[0]?.name || 'document.pdf',
    totalPages: orderData.pages || 0,
    copies: orderData.copies || 1,
    colorMode,
    paperSize: orderData.paperSize || 'a4',
    paperSizeDisplay,
    orientation: orderData.orientation || 'portrait',
    twoSided: orderData.twoSided === 'yes' ? 'Yes (Double-Sided)' : 'No (Single-Sided)',
    pagesPerSheet: orderData.pagesPerSheet || '1',
    pageRange: orderData.pageRange === 'specific' ? 'Specific Pages' : 'All Pages',
    specificPages: orderData.specificPages,
    notes: orderData.notes,
    orderSource: orderData.orderSource || 'online',
    paymentMethod: orderData.paymentMethod || (orderData.orderSource === 'walkin' ? 'Cash' : 'GCash'),
    paymentStatus,
    paymentReferenceNumber: orderData.paymentReferenceNumber,
    addons: addonsWithSubtotal,
    costBreakdown: {
      printingCost,
      addonsCost,
      total: totalCost,
    },
    totalAmount: `₱${totalCost.toFixed(2)}`,
    createdAt: orderData.createdAt || orderData.date,
    completedAt: orderData.statusUpdatedAt || orderData.lastUpdatedAt,
  };
}

/**
 * Calculate printing cost based on pages, copies, and color mode
 */
function calculatePrintingCost(pages: number, copies: number, colorMode: string): number {
  let pricePerPage = 1; // Default B&W price

  const colorModeStr = (colorMode || '').toLowerCase();
  if (colorModeStr.includes('color') || colorModeStr === 'colored') {
    pricePerPage = 5; // Colored pages
  } else if (colorModeStr === 'bw' || colorModeStr === 'black & white') {
    pricePerPage = 1; // B&W pages
  }

  return pages * copies * pricePerPage;
}

/**
 * Format paper size for display
 */
function formatPaperSize(paperSize: string): string {
  const sizeMap: Record<string, string> = {
    'a4': 'A4 (210 × 297 mm)',
    'letter': 'Letter (8.5 × 11 in)',
    'legal': 'Legal (8.5 × 14 in)',
    'short': 'Short Bond (8.5 × 11 in)',
    'long': 'Long Bond (8.5 × 13 in)',
    'a5': 'A5 (148 × 210 mm)',
    'a3': 'A3 (297 × 420 mm)',
  };
  return sizeMap[paperSize?.toLowerCase()] || paperSize || 'N/A';
}

/**
 * Format color mode for display
 */
function formatColorMode(colorMode: string): string {
  const modeStr = (colorMode || '').toLowerCase();
  if (modeStr === 'bw' || modeStr === 'b&w') return 'Black & White';
  if (modeStr === 'color' || modeStr === 'colored') return 'Colored';
  return colorMode || 'N/A';
}

/**
 * Generate HTML invoice content for download
 */
export function generateInvoiceHTML(invoiceData: InvoiceData): string {
  const addonsHTML = invoiceData.addons.length > 0
    ? `
    <h3 style="color: #2F6FD6; margin-top: 30px;">Add-ons</h3>
    <div class="invoice-details">
      ${invoiceData.addons.map(addon => `
        <div class="detail-row">
          <span class="label">${addon.name} × ${addon.quantity}:</span>
          <span class="value">₱${addon.subtotal.toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="detail-row" style="border-top: 2px solid #2F6FD6; margin-top: 10px; padding-top: 10px;">
        <span class="label"><strong>Add-ons Subtotal:</strong></span>
        <span class="value"><strong>₱${invoiceData.costBreakdown.addonsCost.toFixed(2)}</strong></span>
      </div>
    </div>
    `
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${invoiceData.orderId}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2F6FD6; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #2F6FD6; }
    .invoice-details { margin: 30px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    .total-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #2F6FD6; }
    .total { font-size: 24px; font-weight: bold; color: #2F6FD6; text-align: right; }
    .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
    .cost-breakdown { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">DocuFy</div>
    <p style="color: #666;">Printing Services</p>
    <p style="font-size: 12px;">Room 4, Palawan State University - Main Campus, TBI Building, Puerto Princesa City, 5300 Palawan</p>
  </div>

  <h2 style="color: #2F6FD6;">INVOICE</h2>

  <div class="invoice-details">
    <div class="detail-row">
      <span class="label">Invoice Number:</span>
      <span class="value">${invoiceData.invoiceNumber}</span>
    </div>
    <div class="detail-row">
      <span class="label">Order ID:</span>
      <span class="value">${invoiceData.orderId}</span>
    </div>
    <div class="detail-row">
      <span class="label">Date:</span>
      <span class="value">${invoiceData.date}</span>
    </div>
    <div class="detail-row">
      <span class="label">Status:</span>
      <span class="value">${invoiceData.status}</span>
    </div>
    <div class="detail-row">
      <span class="label">Customer:</span>
      <span class="value">${invoiceData.customerName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Payment Method:</span>
      <span class="value">${invoiceData.paymentMethod}</span>
    </div>
  </div>

  <h3 style="color: #2F6FD6; margin-top: 30px;">Order Details</h3>
  <div class="invoice-details">
    <div class="detail-row">
      <span class="label">Document:</span>
      <span class="value">${invoiceData.fileName}</span>
    </div>
    <div class="detail-row">
      <span class="label">Total Pages:</span>
      <span class="value">${invoiceData.totalPages} pages</span>
    </div>
    <div class="detail-row">
      <span class="label">Copies:</span>
      <span class="value">${invoiceData.copies}</span>
    </div>
    <div class="detail-row">
      <span class="label">Color Mode:</span>
      <span class="value">${invoiceData.colorMode}</span>
    </div>
    <div class="detail-row">
      <span class="label">Paper Size:</span>
      <span class="value">${invoiceData.paperSizeDisplay}</span>
    </div>
    <div class="detail-row">
      <span class="label">Orientation:</span>
      <span class="value">${invoiceData.orientation}</span>
    </div>
    <div class="detail-row">
      <span class="label">Two-Sided:</span>
      <span class="value">${invoiceData.twoSided}</span>
    </div>
    ${invoiceData.notes ? `
    <div class="detail-row">
      <span class="label">Special Instructions:</span>
      <span class="value">${invoiceData.notes}</span>
    </div>
    ` : ''}
  </div>

  ${addonsHTML}

  <div class="cost-breakdown">
    <h3 style="color: #2F6FD6; margin-top: 0;">Cost Breakdown</h3>
    <div class="detail-row">
      <span class="label">Printing Cost (${invoiceData.totalPages} pages × ${invoiceData.copies} copies):</span>
      <span class="value">₱${invoiceData.costBreakdown.printingCost.toFixed(2)}</span>
    </div>
    ${invoiceData.addons.length > 0 ? `
    <div class="detail-row">
      <span class="label">Add-ons:</span>
      <span class="value">₱${invoiceData.costBreakdown.addonsCost.toFixed(2)}</span>
    </div>
    ` : ''}
  </div>

  <div class="total-section">
    <div class="total">Total Amount: ${invoiceData.totalAmount}</div>
  </div>

  <div class="footer">
    <p>Thank you for choosing DocuFy!</p>
    <p>For inquiries, please contact us at support@docufy.com</p>
    <p style="margin-top: 15px; font-size: 10px;">Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
}
