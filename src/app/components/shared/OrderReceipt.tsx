// The customer-facing Order Receipt — one adaptive document replacing the old
// invoice across customer Order Tracking and the staff/admin Orders queue.
//
// The sheet renders purely from ReceiptData (see invoiceUtils.generateReceiptData,
// which reads stored order values only). It is a standalone business document:
// brand + shop details at the top, customer/order information in balanced
// columns, an itemized table (or a single-file block), a right-aligned totals
// block, a plain payment summary and a footer disclaimer. It is an order
// receipt, not a tax invoice.
//
// The dialog shows that document in a near-full-screen VIEWER (its own class
// `order-receipt-viewer` in tailwind.css): a control toolbar pinned across the
// top and the A4-width page on a neutral surface below, scrolling only at the
// viewer's own edge — never a small modal with a scroll box around the page.
// The same markup is what prints (Print / Save as PDF via @media print) and
// what downloads (the self-contained HTML export).

import React from "react";
import { Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { formatCurrency } from "../../utils/formatNumber";
import {
  generateReceiptHTML,
  type ReceiptData,
  type ReceiptFileItem,
} from "../../utils/invoiceUtils";
import { landingContentStore } from "../../utils/landingContentStore";
import { useLogo } from "../../hooks/useLogo";

// ── The receipt sheet ───────────────────────────────────────────────────────

function PaymentBadge({ data }: { data: ReceiptData }) {
  const cls =
    data.payment.status === "paid"
      ? "bg-green-100 text-green-700"
      : data.payment.status === "partially_paid"
        ? "bg-amber-100 text-amber-700"
        : data.payment.status === "pending_verification"
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-700";
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${cls}`}>
      {data.payment.statusLabel}
    </span>
  );
}

// A small label/value pair used by the single-file item block.
function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[12.5px] font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function photoSuffix(f: ReceiptFileItem): string {
  if (!f.photoSize) return "";
  return ` (${f.photoSize}${f.photoQuantity ? ` × ${f.photoQuantity}` : ""})`;
}

// One file as a compact detail block: the file name, its format, and the stored
// print specification. No per-file price is shown because the order data does
// not carry one (only the order-level breakdown does).
function FileCard({ file, index }: { file: ReceiptFileItem; index?: number }) {
  return (
    <div className="order-receipt-keep mt-2 rounded-lg border border-gray-200 px-3.5 py-3">
      <p className="break-words text-sm font-semibold text-gray-900">
        {typeof index === "number" && (
          <span className="mr-1.5 text-gray-400">{index}.</span>
        )}
        {file.name}
        {photoSuffix(file) && (
          <span className="text-gray-500">{photoSuffix(file)}</span>
        )}
      </p>
      {file.fileType && (
        <p className="mt-0.5 text-[11px] text-gray-500">{file.fileType}</p>
      )}
      <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Spec label="Pages" value={String(file.pageCount ?? "—")} />
        <Spec label="Copies" value={String(file.copies)} />
        <Spec label="Paper" value={file.paperSizeLabel || "—"} />
        <Spec label="Color Mode" value={file.colorModeLabel || "—"} />
      </div>
      {file.notes && (
        <p className="mt-2 text-[11px] text-gray-500">Notes: {file.notes}</p>
      )}
    </div>
  );
}

export function OrderReceipt({ data }: { data: ReceiptData }) {
  const logo = useLogo();
  const content = landingContentStore.getContent();
  const locationLines = content.locationLines?.length
    ? content.locationLines
    : [
        "Palawan State University - Main Campus",
        "Room 4, TBI Building",
        "Puerto Princesa City, 5300 Palawan",
      ];
  const contactEmail = content.contactEmail || "printwithdocufy@gmail.com";

  const singleFile = data.files.length === 1 ? data.files[0] : null;

  return (
    <div className="order-receipt-print-area mx-auto w-full max-w-[794px] bg-white px-6 py-8 text-[#1c1f26] shadow-sm sm:px-[53px] sm:py-[53px]">
      {/* Header: brand + shop information on the left, document title on the
          right. The shop address lives here only (no second copy below). */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {logo && (
              <img src={logo} alt="" className="h-11 w-11 shrink-0 object-contain" />
            )}
            <div>
              <div className="text-2xl font-extrabold leading-none tracking-tight text-[#2F6FD6]">
                Docufy
              </div>
              <div className="mt-1 text-xs font-bold text-[#2F6FD6]">
                Printing Services
              </div>
            </div>
          </div>
          <div className="mt-2.5 text-[11px] leading-relaxed text-gray-600">
            {locationLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>{contactEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-[22px] font-extrabold tracking-wide text-[#2F6FD6]">
            ORDER RECEIPT
          </h1>
          <p className="mt-1.5 text-[11px] text-gray-500">
            Receipt No. :{" "}
            <span className="font-mono text-[11.5px] font-semibold text-[#1c1f26]">
              {data.receiptNumber}
            </span>
          </p>
        </div>
      </div>

      {/* Blue rule */}
      <div className="my-3.5 h-[2.5px] rounded-full bg-[#2F6FD6]" />

      {/* Cancellation banner */}
      {data.isCanceled && (
        <div className="mb-3.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          This order was canceled
          {data.cancellationReason ? ` — ${data.cancellationReason}` : "."}
        </div>
      )}

      {/* Customer information + order information */}
      <div className="order-receipt-keep flex flex-col gap-4 rounded-lg border border-blue-100 bg-[#F2F7FF] px-4 py-3.5 sm:flex-row sm:gap-0">
        <div className="min-w-0 sm:flex-1 sm:pr-6">
          <h3 className="text-xs font-bold text-[#2F6FD6]">Customer Information</h3>
          <div className="mt-2.5">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-500">
              Name
            </p>
            <p className="mt-0.5 break-words text-[13px] font-semibold text-gray-900">
              {data.customerName}
            </p>
          </div>
          {data.customerEmail && (
            <div className="mt-2">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-500">
                Email
              </p>
              <p className="mt-0.5 break-words text-[13px] font-semibold text-gray-900">
                {data.customerEmail}
              </p>
            </div>
          )}
        </div>
        <div className="min-w-0 border-t border-blue-200 pt-4 sm:flex-1 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <h3 className="text-xs font-bold text-[#2F6FD6]">Order Information</h3>
          <div className="mt-2.5 space-y-2">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-gray-600">Order No.</span>
              <span className="text-right font-semibold text-gray-900">
                {data.orderDisplayId}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-gray-600">Order Date</span>
              <span className="text-right font-semibold text-gray-900">
                {data.orderDate}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-gray-600">Order Status</span>
              <span className="inline-block rounded-full bg-blue-100 px-3 py-0.5 text-[11px] font-bold text-[#2557b8]">
                {data.statusLabel}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="text-gray-600">Order Source</span>
              <span className="text-right font-semibold text-gray-900">
                {data.isWalkin ? "Walk-in" : "Online"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Blue rule */}
      <div className="my-3.5 h-[2.5px] rounded-full bg-[#2F6FD6]" />

      {/* Order items */}
      <h3 className="text-xs font-bold text-[#2F6FD6]">Order Items</h3>

      {/* One file — a compact detail block instead of a one-row table. */}
      {singleFile && <FileCard file={singleFile} />}

      {/* Several files — stacked cards on a phone (a six-column table cannot be
          read at that width), and the traditional itemized table from tablet
          width up. Both show the same stored values. */}
      {data.files.length > 1 && (
        <>
          <div className="mt-2 space-y-2 sm:hidden">
            {data.files.map((f, i) => (
              <FileCard key={`${f.name}-${i}`} file={f} index={i + 1} />
            ))}
          </div>
          <table className="mt-2 hidden w-full table-fixed border-collapse text-[11.5px] sm:table">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F6F9FE] text-left text-[9px] uppercase tracking-wider text-gray-500">
                <th className="w-[6%] px-2 py-2 font-semibold">No.</th>
                <th className="px-2 py-2 font-semibold">File Name</th>
                <th className="w-[11%] px-2 py-2 font-semibold">Pages</th>
                <th className="w-[11%] px-2 py-2 font-semibold">Copies</th>
                <th className="w-[17%] px-2 py-2 font-semibold">Paper</th>
                <th className="w-[21%] px-2 py-2 font-semibold">Color Mode</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((f, i) => (
                <tr key={`${f.name}-${i}`} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                  <td className="break-words px-2 py-2">
                    <span className="font-semibold text-gray-900">{f.name}</span>
                    {f.photoSize && (
                      <span className="text-gray-500">{photoSuffix(f)}</span>
                    )}
                    {f.fileType && (
                      <span className="mt-0.5 block text-[10px] text-gray-400">
                        {f.fileType}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-700">{f.pageCount ?? "—"}</td>
                  <td className="px-2 py-2 text-gray-700">{f.copies}</td>
                  <td className="break-words px-2 py-2 text-gray-700">
                    {f.paperSizeLabel || "—"}
                  </td>
                  <td className="break-words px-2 py-2 text-gray-700">
                    {f.colorModeLabel || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* File-less order (e.g. a photocopy walk-in) — an honest summary line. */}
      {data.files.length === 0 && data.orderSummaryLine && (
        <div className="mt-2 rounded-lg border border-gray-200 px-3.5 py-3 text-sm font-semibold text-gray-900">
          {data.orderSummaryLine}
        </div>
      )}

      {data.notes && data.files.length !== 1 && (
        <p className="mt-2 text-[11px] text-gray-500">Notes: {data.notes}</p>
      )}

      {/* Add-ons */}
      {data.addons.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-bold text-[#2F6FD6]">Add-ons</h3>
          <table className="mt-2 w-full table-fixed border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F6F9FE] text-left text-[9px] uppercase tracking-wider text-gray-500">
                <th className="px-2 py-2 font-semibold">Item</th>
                <th className="w-[14%] px-2 py-2 font-semibold">Qty</th>
                <th className="w-[22%] px-2 py-2 text-right font-semibold">Unit Price</th>
                <th className="w-[22%] px-2 py-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.addons.map((a, i) => (
                <tr key={`${a.name}-${i}`} className="border-b border-gray-100 align-top last:border-0">
                  <td className="break-words px-2 py-2 font-semibold text-gray-900">
                    {a.name}
                  </td>
                  <td className="px-2 py-2 text-gray-700">{a.quantity}</td>
                  <td className="px-2 py-2 text-right text-gray-700">
                    {formatCurrency(a.unitPrice)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">
                    {formatCurrency(a.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Right-aligned totals */}
      <div className="order-receipt-keep mt-3 flex justify-end">
        <div className="w-full max-w-[280px]">
          <div className="flex justify-between py-1 text-[12.5px] text-gray-600">
            <span>Printing Cost</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(data.printingCost)}
            </span>
          </div>
          {data.addons.length > 0 && (
            <div className="flex justify-between py-1 text-[12.5px] text-gray-600">
              <span>Add-ons</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(data.addonsCost)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t-2 border-[#2F6FD6] pt-2 text-base font-extrabold text-[#2F6FD6]">
            <span>Order Total</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Blue rule */}
      <div className="my-3.5 h-[2.5px] rounded-full bg-[#2F6FD6]" />

      {/* Payment summary */}
      <h3 className="text-xs font-bold text-[#2F6FD6]">Payment Summary</h3>
      <div className="order-receipt-keep mt-2">
        <div className="flex gap-3 border-b border-gray-100 py-1.5 text-[12.5px]">
          <span className="w-[180px] shrink-0 text-gray-600">Payment Method</span>
          <span className="font-semibold text-gray-900">{data.payment.method}</span>
        </div>
        {data.payment.reference && (
          <div className="flex gap-3 border-b border-gray-100 py-1.5 text-[12.5px]">
            <span className="w-[180px] shrink-0 text-gray-600">Payment Reference</span>
            <span className="break-words font-semibold text-gray-900">
              {data.payment.reference}
            </span>
          </div>
        )}
        {data.payment.verifiedAtLabel && (
          <div className="flex gap-3 border-b border-gray-100 py-1.5 text-[12.5px]">
            <span className="w-[180px] shrink-0 text-gray-600">Payment Date</span>
            <span className="font-semibold text-gray-900">
              {data.payment.verifiedAtLabel}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 border-b border-gray-100 py-1.5 text-[12.5px]">
          <span className="w-[180px] shrink-0 text-gray-600">Status</span>
          <PaymentBadge data={data} />
        </div>
        <div className="flex gap-3 border-b border-gray-100 py-1.5 text-[12.5px]">
          <span className="w-[180px] shrink-0 text-gray-600">Amount Paid</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(data.payment.amountPaid)}
          </span>
        </div>
        <div className="flex gap-3 border-b border-gray-100 py-1.5 text-[12.5px]">
          <span className="w-[180px] shrink-0 text-gray-600">Remaining Balance</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(data.payment.balance)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 flex flex-col justify-between gap-4 border-t border-gray-200 pt-3.5 sm:flex-row sm:items-end">
        <div className="max-w-[360px] text-[10px] leading-relaxed text-gray-500">
          <p>
            This receipt serves as a record of your order and, where applicable,
            payment recorded by DocuFy PSMS. It is not a tax invoice.
          </p>
          <p className="mt-1">Generated {data.generatedAtLabel}</p>
        </div>
        <div className="text-right">
          <p
            className="text-xl text-[#2F6FD6]"
            style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive' }}
          >
            Thank you
          </p>
          <p className="text-[10.5px] text-gray-500">for choosing DocuFy!</p>
        </div>
      </div>
    </div>
  );
}

// ── View / Print / Download viewer ──────────────────────────────────────────

// Inline the logo into the downloaded HTML so it renders standalone. A custom
// logo is already a data URL; the bundled default is fetched and converted. If
// it cannot be read, the HTML falls back to the plain wordmark (no image).
async function logoToDataUrl(src: string): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function downloadReceipt(data: ReceiptData, logo: string) {
  const logoDataUrl = await logoToDataUrl(logo);
  const html = generateReceiptHTML(data, logoDataUrl);
  const blob = new Blob([html], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Receipt-${data.receiptNumber}.html`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * The receipt viewer. It opens over the current screen as a spacious document
 * WINDOW — never a new tab, never a route change: a compact header (document
 * icon, title, receipt number, subtitle, close), the A4-width receipt centered
 * on a neutral surface, and a footer holding Download and Close. The document
 * surface is the ONLY scroll region, so the page itself never sits inside a
 * scroll box. Printing is deliberately not offered here (the browser's own
 * print still yields a clean receipt via the `@media print` rules). Nothing
 * here touches order, payment, pricing, permission or status logic.
 */
export function OrderReceiptDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}) {
  const logo = useLogo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="order-receipt-viewer order-receipt-print-shell grid grid-rows-[auto_minmax(0,1fr)_auto]"
      >
        {/* Header — visually separate from the document and never printed. Its
            right padding leaves room for the dialog's own close button, which
            the viewer CSS pins inside this band. */}
        <div className="order-receipt-toolbar flex items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 pr-12 sm:px-6 sm:py-4 sm:pr-14">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <FileText className="h-4 w-4 text-[#2F6FD6]" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <DialogTitle className="truncate text-sm font-bold text-[#1c1f26] sm:text-base">
                Order Receipt
              </DialogTitle>
              {data && (
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-700">
                  {data.receiptNumber}
                </span>
              )}
            </div>
            <DialogDescription className="mt-0.5 text-xs text-gray-500 sm:text-[13px]">
              Review or download the receipt for this order.
            </DialogDescription>
          </div>
        </div>

        {/* Document surface — the ONLY scroll region. The A4-width receipt is
            centered here at full size on a neutral surface. */}
        <div className="order-receipt-print-frame min-h-0 overflow-y-auto bg-[#f1f3f6] px-3 py-5 sm:px-8 sm:py-8">
          {data ? (
            <OrderReceipt data={data} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
              <FileText className="h-8 w-8 text-gray-300" />
              <p className="text-sm">Receipt data is not available.</p>
            </div>
          )}
        </div>

        {/* Footer — outside the document, never printed. Download stays
            secondary; Close carries the primary styling and the Enter key. */}
        <div className="order-receipt-footer flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:gap-4 sm:px-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => data && downloadReceipt(data, logo)}
            disabled={!data}
            title="Downloads a standalone HTML copy of the receipt"
            className="border-2 border-blue-200 text-[#2F6FD6] hover:bg-white hover:text-[#2F6FD6]"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download
          </Button>
          <Button
            data-primary-action
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
