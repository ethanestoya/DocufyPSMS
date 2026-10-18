// Order Receipt utilities.
//
// One adaptive receipt document replaces the old invoice for customer,
// staff, and admin. Everything here is built STRICTLY from stored order
// data: the checkout-time costBreakdown, the stored addons list, and the
// verified payments already mapped onto the order by dataStore. Nothing is
// recomputed from live pricing, and no field (email, tax id, per-file price)
// is ever fabricated — a value the data doesn't have simply doesn't render.

import { computeOrderPayment } from "../components/shared/OrderPaymentSummary";
import { formatPHDate, formatPHTime } from "./pht";

// ── Input (accepts both the dataStore app Order and the ordersStore shape) ───

export interface ReceiptFileInput {
  name: string;
  printType?: string;
  contentType?: string;
  paperSize?: string;
  pageCount?: number;
  copies?: number;
  colorMode?: string;
  photoSize?: string;
  photoQuantity?: number;
  notes?: string;
}

export interface ReceiptOrderInput {
  id: string;
  displayId?: string;
  orderNumber?: number;
  customerName?: string;
  customer?: string;
  customerEmail?: string;
  status?: string;
  orderSource?: string;
  customerType?: string;
  // Preformatted legacy date string (dataStore `date` is an ISO string; the
  // old callers sometimes passed an already-formatted label).
  date?: string;
  createdAt?: string | Date;
  submittedAt?: string | Date;
  total?: string | number;
  manualTotal?: number;
  costBreakdown?: {
    printingCost?: number;
    addonsCost?: number;
    total?: number;
  };
  addons?: { name: string; quantity: number; price: number }[];
  attachedFiles?: ReceiptFileInput[];
  fileName?: string;
  notes?: string;
  pages?: number;
  copies?: number;
  paperSize?: string;
  colorMode?: string;
  printType?: string;
  type?: string;
  paymentMethod?: string;
  paymentVerified?: boolean;
  paymentReferenceNumber?: string;
  paymentVerifiedAt?: string | Date;
  downPaymentRequired?: boolean;
  downPaymentAmount?: number;
  downPaymentVerified?: boolean;
  fullPaymentRequired?: boolean;
  fullPaymentAmount?: number;
  fullPaymentVerified?: boolean;
  cancellationReason?: string;
}

// ── Output ──────────────────────────────────────────────────────────────────

export interface ReceiptFileItem {
  name: string;
  printTypeLabel?: string;
  contentTypeLabel?: string;
  paperSizeLabel?: string;
  pageCount?: number;
  copies: number;
  colorModeLabel?: string;
  photoSize?: string;
  photoQuantity?: number;
  notes?: string;
}

export interface ReceiptAddonItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type ReceiptPaymentStatus =
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "pending_verification";

export interface ReceiptData {
  receiptNumber: string;
  orderDisplayId: string;
  orderId: string;
  orderDate: string;
  statusLabel: string;
  isCanceled: boolean;
  cancellationReason?: string;
  customerName: string;
  /** Only set when the order actually carries a (non-fabricated) email. */
  customerEmail?: string;
  isWalkin: boolean;
  files: ReceiptFileItem[];
  /** Order-level line for file-less walk-ins (photocopy). */
  orderSummaryLine?: string;
  notes?: string;
  addons: ReceiptAddonItem[];
  printingCost: number;
  addonsCost: number;
  total: number;
  payment: {
    method: string;
    status: ReceiptPaymentStatus;
    statusLabel: string;
    amountPaid: number;
    balance: number;
    reference?: string;
    verifiedAtLabel?: string;
  };
  generatedAtLabel: string;
}

// ── Label helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  awaitingPayment: "Awaiting Payment",
  inQueue: "In Queue",
  printing: "Printing",
  completed: "Completed",
  released: "Released",
  canceled: "Canceled",
  "Awaiting Payment": "Awaiting Payment",
  "In Queue": "In Queue",
  Printing: "Printing",
  Completed: "Completed",
  Released: "Released",
  Canceled: "Canceled",
};

const PRINT_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  vellum: "Vellum",
  sticker: "Sticker",
  photo: "Photo",
  photocopy: "Photocopy",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textWithImage: "Text + Image",
  imageOnly: "Image Only",
};

const COLOR_MODE_LABELS: Record<string, string> = {
  bw: "Black & White",
  color: "Colored",
  partial: "Colored (Partial)",
  full: "Colored (Full)",
  "Black & White": "Black & White",
  Colored: "Colored",
};

const PAPER_SIZE_LABELS: Record<string, string> = {
  a4: "A4",
  letter: "Letter",
  legal: "Legal",
  short: "Short Bond",
  long: "Long Bond",
  a5: "A5",
  a3: "A3",
  "A4 (Photo)": "A4 (Photo)",
};

const label = (map: Record<string, string>, raw?: string): string | undefined => {
  if (!raw) return undefined;
  return map[raw] ?? map[raw.toLowerCase()] ?? raw;
};

// Strip a "₱1,234.56" / "1234.56" / number down to a finite number.
const parseTotal = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const asDate = (v: unknown): Date | undefined => {
  if (v == null || v === "") return undefined;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const isRealEmail = (email?: string): boolean =>
  !!email &&
  !email.includes("@example.com") &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// ── Builder ─────────────────────────────────────────────────────────────────

export function generateReceiptData(order: ReceiptOrderInput): ReceiptData {
  if (!order) throw new Error("Order data is required to generate receipt");

  // Receipt number derives from the human-facing display id; the full DB uuid
  // is carried separately as the secondary reference. No counters are minted.
  const orderDisplayId = order.displayId ?? order.id;
  const receiptNumber = `RCPT-${orderDisplayId}`;

  // ── Money: stored checkout values only ───────────────────────────────────
  const storedTotal = parseTotal(order.costBreakdown?.total);
  const manualTotal = parseTotal(order.manualTotal);
  const legacyTotal = parseTotal(order.total);
  const total = storedTotal ?? manualTotal ?? legacyTotal ?? 0;

  const addons: ReceiptAddonItem[] = (order.addons ?? []).map((a) => ({
    name: a.name,
    quantity: a.quantity,
    unitPrice: a.price,
    subtotal: a.price * a.quantity,
  }));
  const addonsSum = addons.reduce((s, a) => s + a.subtotal, 0);
  const storedAddonsCost = parseTotal(order.costBreakdown?.addonsCost);
  const addonsCost = storedAddonsCost ?? addonsSum;
  const storedPrintingCost = parseTotal(order.costBreakdown?.printingCost);
  // When the breakdown lacks an explicit printing figure but carries a total,
  // printing = total − addons (still derived from stored values, never from
  // live pricing).
  const printingCost =
    storedPrintingCost ??
    (storedTotal != null ? Math.max(storedTotal - addonsCost, 0) : addons.length ? Math.max(total - addonsCost, 0) : total);

  // ── Payment picture (authoritative shared logic, unchanged) ──────────────
  const paymentSummary = computeOrderPayment(
    {
      total,
      costBreakdown: order.costBreakdown ? { total: order.costBreakdown.total ?? total } : undefined,
      paymentVerified: order.paymentVerified,
      downPaymentRequired: order.downPaymentRequired,
      downPaymentVerified: order.downPaymentVerified,
      downPaymentAmount: order.downPaymentAmount,
      fullPaymentRequired: order.fullPaymentRequired,
      fullPaymentVerified: order.fullPaymentVerified,
      fullPaymentAmount: order.fullPaymentAmount,
    },
    total,
  );

  const hasVerified =
    !!order.paymentVerified ||
    !!order.downPaymentVerified ||
    !!order.fullPaymentVerified;
  const awaitingSubmission =
    !hasVerified &&
    !!order.paymentReferenceNumber;

  let paymentStatus: ReceiptPaymentStatus;
  let paymentStatusLabel: string;
  if (awaitingSubmission) {
    paymentStatus = "pending_verification";
    paymentStatusLabel = "Pending Verification";
  } else if (paymentSummary.status === "Paid") {
    paymentStatus = "paid";
    paymentStatusLabel = "Paid";
  } else if (paymentSummary.status === "Partially Paid") {
    paymentStatus = "partially_paid";
    paymentStatusLabel = "Partially Paid";
  } else {
    paymentStatus = "unpaid";
    paymentStatusLabel = "Payment Due";
  }

  const verifiedAt = asDate(order.paymentVerifiedAt);
  const verifiedAtLabel = verifiedAt
    ? `${formatPHDate(verifiedAt, "short")} · ${formatPHTime(verifiedAt)}`
    : undefined;

  // ── Files ────────────────────────────────────────────────────────────────
  const rawFiles = order.attachedFiles ?? (order.fileName ? [{ name: order.fileName }] : []);
  const files: ReceiptFileItem[] = rawFiles.map((f) => {
    const isPhoto = (f.printType || "").toLowerCase() === "photo";
    return {
      name: f.name,
      printTypeLabel: label(PRINT_TYPE_LABELS, f.printType),
      contentTypeLabel: isPhoto ? undefined : label(CONTENT_TYPE_LABELS, f.contentType),
      paperSizeLabel: label(PAPER_SIZE_LABELS, f.paperSize),
      pageCount: f.pageCount,
      copies: f.copies ?? order.copies ?? 1,
      colorModeLabel: isPhoto ? undefined : label(COLOR_MODE_LABELS, f.colorMode),
      photoSize: f.photoSize,
      photoQuantity: f.photoQuantity,
      notes: f.notes,
    };
  });

  // File-less walk-ins (photocopy) get one honest order-level line built from
  // the order's own specs — no invented per-file rows.
  let orderSummaryLine: string | undefined;
  if (files.length === 0) {
    const parts: string[] = [];
    if ((order.customerType || "").toLowerCase() === "photocopy") parts.push("Photocopy");
    const paper = label(PAPER_SIZE_LABELS, order.paperSize);
    if (paper) parts.push(paper);
    if (order.pages && order.copies) parts.push(`${order.pages} page${order.pages === 1 ? "" : "s"} × ${order.copies} cop${order.copies === 1 ? "y" : "ies"}`);
    else if (order.copies) parts.push(`${order.copies} cop${order.copies === 1 ? "y" : "ies"}`);
    const color = label(COLOR_MODE_LABELS, order.colorMode || order.type);
    if (color) parts.push(color);
    orderSummaryLine = parts.length ? parts.join(" · ") : undefined;
  }

  // Order date: prefer real timestamps, fall back to the preformatted string.
  const created = asDate(order.createdAt) ?? asDate(order.submittedAt);
  const orderDate = created
    ? formatPHDate(created, "long")
    : order.date || "—";

  const statusKey = order.status ?? "";
  const statusLabel = STATUS_LABELS[statusKey] ?? (statusKey || "—");

  const isWalkin = (order.orderSource || "").toLowerCase() === "walkin";
  const method = order.paymentMethod || (isWalkin ? "Cash" : undefined);

  return {
    receiptNumber,
    orderDisplayId,
    orderId: order.id,
    orderDate,
    statusLabel,
    isCanceled: statusLabel === "Canceled",
    cancellationReason: order.cancellationReason,
    customerName: order.customerName || order.customer || "Walk-in Customer",
    // A fabricated `@example.com` address must never reach the receipt.
    customerEmail: isRealEmail(order.customerEmail) ? order.customerEmail!.trim() : undefined,
    isWalkin,
    files,
    orderSummaryLine,
    notes: order.notes,
    addons,
    printingCost,
    addonsCost,
    total,
    payment: {
      method: method || "—",
      status: paymentStatus,
      statusLabel: paymentStatusLabel,
      amountPaid: awaitingSubmission ? 0 : paymentSummary.amountPaid,
      balance: awaitingSubmission ? total : paymentSummary.remaining,
      reference: order.paymentReferenceNumber,
      verifiedAtLabel,
    },
    generatedAtLabel: `${formatPHDate(new Date(), "short")} · ${formatPHTime(new Date())}`,
  };
}

// ── HTML export (Download button — same data, self-contained document) ──────

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const php = (n: number): string => `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LOCATION_LINES = [
  "Palawan State University - Main Campus",
  "Room 4, TBI Building",
  "Puerto Princesa City, 5300 Palawan",
];
const CONTACT_EMAIL = "printwithdocufy@gmail.com";

export function generateReceiptHTML(data: ReceiptData): string {
  const filesHTML =
    data.files.length === 1
      ? (() => {
          const f = data.files[0];
          const specs: string[] = [];
          if (f.printTypeLabel) specs.push(esc(f.printTypeLabel));
          if (f.contentTypeLabel) specs.push(esc(f.contentTypeLabel));
          if (f.paperSizeLabel) specs.push(esc(f.paperSizeLabel));
          if (f.pageCount != null) specs.push(`${f.pageCount} page${f.pageCount === 1 ? "" : "s"}`);
          specs.push(`${f.copies} cop${f.copies === 1 ? "y" : "ies"}`);
          if (f.colorModeLabel) specs.push(esc(f.colorModeLabel));
          if (f.photoSize) specs.push(`${esc(f.photoSize)}${f.photoQuantity ? ` · ${f.photoQuantity} pcs` : ""}`);
          return `
  <div class="file-card">
    <div class="file-name">${esc(f.name)}</div>
    <div class="file-specs">${specs.join(" · ")}</div>
    ${f.notes ? `<div class="file-notes">Notes: ${esc(f.notes)}</div>` : ""}
  </div>`;
        })()
      : data.files.length > 1
        ? `
  <table>
    <thead>
      <tr><th>File</th><th>Type</th><th>Paper</th><th>Pages</th><th>Copies</th><th>Color</th></tr>
    </thead>
    <tbody>
      ${data.files
        .map(
          (f) => `<tr>
        <td>${esc(f.name)}${f.photoSize ? ` (${esc(f.photoSize)}${f.photoQuantity ? ` × ${f.photoQuantity}` : ""})` : ""}</td>
        <td>${esc(f.printTypeLabel || "—")}${f.contentTypeLabel ? `<br><span class="muted">${esc(f.contentTypeLabel)}</span>` : ""}</td>
        <td>${esc(f.paperSizeLabel || "—")}</td>
        <td>${f.pageCount ?? "—"}</td>
        <td>${f.copies}</td>
        <td>${esc(f.colorModeLabel || "—")}</td>
      </tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>`
        : data.orderSummaryLine
          ? `<div class="file-card"><div class="file-name">${esc(data.orderSummaryLine)}</div></div>`
          : "";

  const addonsHTML =
    data.addons.length > 0
      ? `
  <h3>Add-ons</h3>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${data.addons
        .map(
          (a) =>
            `<tr><td>${esc(a.name)}</td><td>${a.quantity}</td><td>${php(a.unitPrice)}</td><td>${php(a.subtotal)}</td></tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>`
      : "";

  const cancellationHTML = data.isCanceled
    ? `<div class="canceled-banner">This order was canceled${data.cancellationReason ? ` — ${esc(data.cancellationReason)}` : "."}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt ${esc(data.receiptNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1c1f26; margin: 0; padding: 28px; max-width: 720px; margin: 0 auto; font-size: 13px; }
  .header { text-align: center; border-bottom: 3px solid #2F6FD6; padding-bottom: 16px; margin-bottom: 20px; }
  .logo { font-size: 26px; font-weight: bold; color: #2F6FD6; letter-spacing: -0.5px; }
  .sub { color: #555; margin: 4px 0 0; }
  .addr { font-size: 11px; color: #777; margin: 6px 0 0; line-height: 1.5; }
  h2.title { color: #2F6FD6; font-size: 20px; margin: 0 0 12px; }
  .meta { background: #F2F7FF; border: 1px solid #D6E7FB; border-radius: 8px; padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 18px; }
  .meta div { font-size: 12px; }
  .meta .k { color: #666; font-weight: 600; }
  .canceled-banner { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-weight: 600; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
  .party { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .party h4 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  .party p { margin: 2px 0; font-size: 12px; }
  h3 { color: #2F6FD6; font-size: 14px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #F8FAFC; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .file-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .file-name { font-weight: 600; }
  .file-specs { color: #666; font-size: 12px; margin-top: 4px; }
  .file-notes { color: #888; font-size: 11px; margin-top: 4px; }
  .muted { color: #888; font-size: 11px; }
  .cost { background: #F8FAFC; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-top: 14px; }
  .cost .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
  .total { background: #2F6FD6; color: #fff; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 15px; font-weight: 700; }
  .payment { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-top: 14px; }
  .payment .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .badge.paid { background: #ECFDF5; color: #047857; }
  .badge.partial { background: #FFFBEB; color: #B45309; }
  .badge.due { background: #FEF2F2; color: #B91C1C; }
  .badge.pending { background: #FEF3C7; color: #92400E; }
  .footer { margin-top: 28px; text-align: center; color: #777; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 14px; line-height: 1.6; }
  .disclaimer { font-size: 10px; color: #999; font-style: italic; margin-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">Docufy</div>
    <p class="sub">Printing Services</p>
    <p class="addr">${LOCATION_LINES.map(esc).join("<br>")}</p>
  </div>

  ${cancellationHTML}

  <h2 class="title">ORDER RECEIPT</h2>
  <div class="meta">
    <div><span class="k">Receipt No.</span><br>${esc(data.receiptNumber)}</div>
    <div><span class="k">Order No.</span><br>${esc(data.orderDisplayId)}</div>
    <div><span class="k">Order Date</span><br>${esc(data.orderDate)}</div>
    <div><span class="k">Order Status</span><br>${esc(data.statusLabel)}</div>
    <div><span class="k">Source</span><br>${data.isWalkin ? "Walk-in" : "Online"}</div>
  </div>

  <div class="parties">
    <div class="party">
      <h4>Billed To</h4>
      <p><strong>${esc(data.customerName)}</strong></p>
      ${data.customerEmail ? `<p>${esc(data.customerEmail)}</p>` : ""}
    </div>
    <div class="party">
      <h4>Docufy Printing Services</h4>
      ${LOCATION_LINES.map((l) => `<p>${esc(l)}</p>`).join("")}
      <p>${esc(CONTACT_EMAIL)}</p>
    </div>
  </div>

  <h3>Order Items</h3>
  ${filesHTML || `<div class="file-card"><div class="file-name">—</div></div>`}
  ${data.notes ? `<p class="muted" style="margin-top:8px">Notes: ${esc(data.notes)}</p>` : ""}
  ${addonsHTML}

  <div class="cost">
    <div class="row"><span>Printing cost</span><span>${php(data.printingCost)}</span></div>
    ${
      data.addons.length > 0
        ? `<div class="row"><span>Add-ons (${data.addons.length})</span><span>${php(data.addonsCost)}</span></div>`
        : ""
    }
  </div>
  <div class="total"><span>Total</span><span>${php(data.total)}</span></div>

  <h3>Payment</h3>
  <div class="payment">
    <div class="row"><span>Method</span><span><strong>${esc(data.payment.method)}</strong></span></div>
    <div class="row"><span>Status</span><span class="badge ${data.payment.status === "paid" ? "paid" : data.payment.status === "partially_paid" ? "partial" : data.payment.status === "pending_verification" ? "pending" : "due"}">${esc(data.payment.statusLabel)}</span></div>
    <div class="row"><span>Amount paid</span><span>${php(data.payment.amountPaid)}</span></div>
    <div class="row"><span>Balance</span><span>${php(data.payment.balance)}</span></div>
    ${data.payment.reference ? `<div class="row"><span>Reference No.</span><span>${esc(data.payment.reference)}</span></div>` : ""}
    ${data.payment.verifiedAtLabel ? `<div class="row"><span>Payment recorded</span><span>${esc(data.payment.verifiedAtLabel)}</span></div>` : ""}
  </div>

  <div class="footer">
    <p>Thank you for choosing Docufy!</p>
    <p>For inquiries, please contact us at ${esc(CONTACT_EMAIL)}</p>
    <p class="disclaimer">This receipt serves as a record of your order and, where applicable, payment recorded by Docufy PSMS. It is not a tax invoice.</p>
    <p class="disclaimer">Generated ${esc(data.generatedAtLabel)}</p>
  </div>
</body>
</html>`;
}
