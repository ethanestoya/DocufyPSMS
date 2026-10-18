// Order Receipt utilities.
//
// One adaptive receipt document replaces the old invoice for customer,
// staff, and admin. Everything here is built STRICTLY from stored order
// data: the checkout-time costBreakdown, the stored addons list, and the
// verified payments already mapped onto the order by dataStore. Nothing is
// recomputed from live pricing, and no field (email, tax id, per-file price)
// is ever fabricated — a value the data doesn't have simply doesn't render.

import { computeOrderPayment } from "../components/shared/OrderPaymentSummary";
import { formatPHDate, formatPHTime, formatPHDateTime } from "./pht";

// ── Input (accepts both the dataStore app Order and the ordersStore shape) ───

export interface ReceiptFileInput {
  name: string;
  /** File format label (PDF / Document / Image …) — shown under the file name. */
  type?: string;
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
  /** File format label (PDF / Document / Image …). */
  fileType?: string;
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
  const verifiedAtLabel = verifiedAt ? formatPHDateTime(verifiedAt) : undefined;

  // ── Files ────────────────────────────────────────────────────────────────
  const rawFiles = order.attachedFiles ?? (order.fileName ? [{ name: order.fileName }] : []);
  const files: ReceiptFileItem[] = rawFiles.map((f) => {
    const isPhoto = (f.printType || "").toLowerCase() === "photo";
    return {
      name: f.name,
      fileType: f.type,
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

  // Order date: prefer real timestamps (date + time), fall back to the string.
  const created = asDate(order.createdAt) ?? asDate(order.submittedAt);
  const orderDate = created ? formatPHDateTime(created) : order.date || "—";

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

export function generateReceiptHTML(
  data: ReceiptData,
  logoDataUrl?: string,
): string {
  // One file: a compact detail block. Several files: a traditional itemized
  // table whose long names wrap inside their cell (table-fixed + word-break)
  // instead of widening the table.
  const photoSuffix = (f: (typeof data.files)[number]) =>
    f.photoSize
      ? ` <span class="muted">(${esc(f.photoSize)}${f.photoQuantity ? ` × ${f.photoQuantity}` : ""})</span>`
      : "";

  const fileRows = data.files
    .map(
      (f, i) => `<tr>
        <td class="c-num">${i + 1}</td>
        <td><span class="fname">${esc(f.name)}</span>${photoSuffix(f)}${f.fileType ? `<br><span class="muted">${esc(f.fileType)}</span>` : ""}</td>
        <td>${f.pageCount ?? "—"}</td>
        <td>${f.copies}</td>
        <td>${esc(f.paperSizeLabel || "—")}</td>
        <td>${esc(f.colorModeLabel || "—")}</td>
      </tr>`,
    )
    .join("\n      ");

  const singleFileHTML = (() => {
    const f = data.files[0];
    return `<div class="file-card">
    <div class="fname" style="font-size:13.5px">${esc(f.name)}${photoSuffix(f)}</div>
    ${f.fileType ? `<div class="muted" style="margin-top:2px">${esc(f.fileType)}</div>` : ""}
    <div class="specgrid">
      <div><div class="k">Pages</div><div class="v">${f.pageCount ?? "—"}</div></div>
      <div><div class="k">Copies</div><div class="v">${f.copies}</div></div>
      <div><div class="k">Paper</div><div class="v">${esc(f.paperSizeLabel || "—")}</div></div>
      <div><div class="k">Color Mode</div><div class="v">${esc(f.colorModeLabel || "—")}</div></div>
    </div>
    ${f.notes ? `<div class="muted" style="margin-top:8px">Notes: ${esc(f.notes)}</div>` : ""}
  </div>`;
  })();

  const itemsHTML =
    data.files.length === 1
      ? singleFileHTML
      : data.files.length > 1
        ? `<table>
    <colgroup><col style="width:6%"><col><col style="width:11%"><col style="width:11%"><col style="width:17%"><col style="width:21%"></colgroup>
    <thead>
      <tr><th>No.</th><th>File Name</th><th>Pages</th><th>Copies</th><th>Paper</th><th>Color Mode</th></tr>
    </thead>
    <tbody>
      ${fileRows}
    </tbody>
  </table>`
        : data.orderSummaryLine
          ? `<div class="file-card"><div class="fname">${esc(data.orderSummaryLine)}</div></div>`
          : "";

  const addonsHTML =
    data.addons.length > 0
      ? `
  <h3>Add-ons</h3>
  <table>
    <colgroup><col><col style="width:14%"><col style="width:22%"><col style="width:22%"></colgroup>
    <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${data.addons
        .map(
          (a) =>
            `<tr><td><span class="fname">${esc(a.name)}</span></td><td>${a.quantity}</td><td>${php(a.unitPrice)}</td><td>${php(a.subtotal)}</td></tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>`
      : "";

  const cancellationHTML = data.isCanceled
    ? `<div class="canceled-banner">This order was canceled${data.cancellationReason ? ` — ${esc(data.cancellationReason)}` : "."}</div>`
    : "";

  const badgeClass =
    data.payment.status === "paid"
      ? "paid"
      : data.payment.status === "partially_paid"
        ? "partial"
        : data.payment.status === "pending_verification"
          ? "pending"
          : "due";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt ${esc(data.receiptNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  /* The exported file is a document: always render it light, even when the
     viewer's browser is in dark mode. */
  html { color-scheme: only light; background: #e9edf3; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1c1f26; background: #fff; margin: 0 auto; padding: 26px 28px; max-width: 794px; font-size: 12.5px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .brand { display: flex; gap: 11px; align-items: center; }
  .brand img { width: 44px; height: 44px; object-fit: contain; }
  .word { font-size: 24px; font-weight: 800; color: #2F6FD6; letter-spacing: -0.5px; line-height: 1; }
  .sub { font-size: 12px; font-weight: 700; color: #2F6FD6; margin-top: 3px; }
  .addr { margin-top: 9px; color: #4b5563; font-size: 11px; line-height: 1.55; }
  .rt { text-align: right; }
  .rt h1 { margin: 0; font-size: 22px; font-weight: 800; color: #2F6FD6; letter-spacing: 0.5px; }
  .rno { margin-top: 6px; font-size: 11px; color: #6b7280; }
  .rno b { color: #1c1f26; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; }
  .rule { height: 2.5px; background: #2F6FD6; border-radius: 2px; margin: 14px 0; }
  .canceled-banner { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; border-radius: 8px; padding: 10px 14px; margin: 0 0 14px; font-weight: 600; }
  .info { background: #F2F7FF; border: 1px solid #dbe9fb; border-radius: 8px; display: flex; padding: 14px 18px; gap: 0 22px; }
  .info .col { flex: 1; min-width: 0; }
  .info .col:first-child { border-right: 1px solid #cfe0f7; padding-right: 22px; }
  .info h3 { margin: 0 0 9px; font-size: 12px; color: #2F6FD6; font-weight: 700; }
  .fld { margin-bottom: 8px; }
  .fld .k { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 700; }
  .fld .v { font-size: 12.5px; font-weight: 600; margin-top: 1px; word-break: break-word; }
  .vrow { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; margin-bottom: 8px; }
  .vrow .k { color: #4b5563; }
  .vrow .v { font-weight: 600; text-align: right; }
  .pill { display: inline-block; background: #dbe9fb; color: #2557b8; border-radius: 999px; padding: 1px 11px; font-size: 10.5px; font-weight: 700; }
  .sec { margin-top: 15px; }
  .sec h3, h3 { margin: 0 0 5px; color: #2F6FD6; font-size: 12.5px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; table-layout: fixed; margin-top: 6px; }
  thead th { background: #F6F9FE; color: #4b5563; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; }
  tbody td { padding: 8px; border-bottom: 1px solid #eef2f6; vertical-align: top; word-break: break-word; }
  .c-num { width: 26px; }
  .fname { font-weight: 600; }
  .muted { color: #9ca3af; font-size: 10px; }
  .file-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-top: 6px; }
  .specgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 18px; margin-top: 10px; }
  .specgrid .k { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 700; }
  .specgrid .v { font-size: 12.5px; font-weight: 600; margin-top: 1px; word-break: break-word; }
  @media (max-width: 520px) { .specgrid { grid-template-columns: repeat(2, 1fr); } }
  .sumwrap { display: flex; justify-content: flex-end; margin-top: 12px; }
  .sum { width: 280px; }
  .sum .row { display: flex; justify-content: space-between; padding: 5px 2px; font-size: 12px; color: #374151; }
  .sum .totrow { display: flex; justify-content: space-between; padding: 8px 2px 0; margin-top: 5px; border-top: 1.5px solid #2F6FD6; font-size: 15px; font-weight: 800; color: #2F6FD6; }
  .payrow { display: flex; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; gap: 12px; }
  .payrow .k { flex: 0 0 180px; width: 180px; color: #4b5563; }
  .payrow .v { font-weight: 600; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 11px; font-size: 10.5px; font-weight: 700; }
  .badge.paid { background: #dcfce7; color: #15803d; }
  .badge.partial { background: #fef3c7; color: #b45309; }
  .badge.due { background: #fee2e2; color: #b91c1c; }
  .badge.pending { background: #fef3c7; color: #92400e; }
  .foot { margin-top: 18px; padding-top: 13px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .disc { font-size: 10px; color: #6b7280; line-height: 1.55; max-width: 360px; }
  .thanks { text-align: right; }
  .thanks .t { font-family: "Segoe Script", "Brush Script MT", cursive; font-size: 21px; color: #2F6FD6; }
  .thanks .s { font-size: 10.5px; color: #6b7280; }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="brand">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="">` : ""}
        <div><div class="word">DocuFy</div><div class="sub">Printing Services</div></div>
      </div>
      <div class="addr">${LOCATION_LINES.map(esc).join("<br>")}<br>${esc(CONTACT_EMAIL)}</div>
    </div>
    <div class="rt">
      <h1>ORDER RECEIPT</h1>
      <div class="rno">Receipt No. : <b>${esc(data.receiptNumber)}</b></div>
    </div>
  </div>

  <div class="rule"></div>

  ${cancellationHTML}

  <div class="info">
    <div class="col">
      <h3>Customer Information</h3>
      <div class="fld"><div class="k">Name</div><div class="v">${esc(data.customerName)}</div></div>
      ${data.customerEmail ? `<div class="fld"><div class="k">Email</div><div class="v">${esc(data.customerEmail)}</div></div>` : ""}
    </div>
    <div class="col">
      <h3>Order Information</h3>
      <div class="vrow"><span class="k">Order No.</span><span class="v">${esc(data.orderDisplayId)}</span></div>
      <div class="vrow"><span class="k">Order Date</span><span class="v">${esc(data.orderDate)}</span></div>
      <div class="vrow"><span class="k">Order Status</span><span class="v"><span class="pill">${esc(data.statusLabel)}</span></span></div>
      <div class="vrow"><span class="k">Order Source</span><span class="v">${data.isWalkin ? "Walk-in" : "Online"}</span></div>
    </div>
  </div>

  <div class="rule"></div>

  <h3>Order Items</h3>
  ${itemsHTML}
  ${data.notes && data.files.length !== 1 ? `<p class="muted" style="margin-top:6px">Notes: ${esc(data.notes)}</p>` : ""}
  ${addonsHTML}

  <div class="sumwrap">
    <div class="sum">
      <div class="row"><span>Printing Cost</span><span>${php(data.printingCost)}</span></div>
      ${data.addons.length > 0 ? `<div class="row"><span>Add-ons</span><span>${php(data.addonsCost)}</span></div>` : ""}
      <div class="totrow"><span>Order Total</span><span>${php(data.total)}</span></div>
    </div>
  </div>

  <div class="rule"></div>

  <div class="sec">
    <h3>Payment Summary</h3>
    <div class="payrow"><span class="k">Payment Method</span><span class="v">${esc(data.payment.method)}</span></div>
    ${data.payment.reference ? `<div class="payrow"><span class="k">Payment Reference</span><span class="v">${esc(data.payment.reference)}</span></div>` : ""}
    ${data.payment.verifiedAtLabel ? `<div class="payrow"><span class="k">Payment Date</span><span class="v">${esc(data.payment.verifiedAtLabel)}</span></div>` : ""}
    <div class="payrow"><span class="k">Status</span><span class="v"><span class="badge ${badgeClass}">${esc(data.payment.statusLabel)}</span></span></div>
    <div class="payrow"><span class="k">Amount Paid</span><span class="v">${php(data.payment.amountPaid)}</span></div>
    <div class="payrow"><span class="k">Remaining Balance</span><span class="v">${php(data.payment.balance)}</span></div>
  </div>

  <div class="foot">
    <div class="disc">This receipt serves as a record of your order and, where applicable, payment recorded by DocuFy PSMS. It is not a tax invoice.<br>Generated ${esc(data.generatedAtLabel)}</div>
    <div class="thanks"><div class="t">Thank you</div><div class="s">for choosing DocuFy!</div></div>
  </div>
</body>
</html>`;
}
