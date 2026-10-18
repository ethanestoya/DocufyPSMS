// The customer-facing Order Receipt — one adaptive document replacing the old
// invoice across customer Order Tracking and the staff/admin Orders queue.
//
// The sheet renders purely from ReceiptData (see invoiceUtils.generateReceiptData,
// which reads stored order values only). The dialog adds Print (browser print →
// Save as PDF via the @media print rules in tailwind.css) and Download (the
// self-contained HTML export) on top of the view.

import React from "react";
import { Printer, Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { formatCurrency } from "../../utils/formatNumber";
import {
  generateReceiptHTML,
  type ReceiptData,
  type ReceiptFileItem,
} from "../../utils/invoiceUtils";
import { landingContentStore } from "../../utils/landingContentStore";

// ── The receipt sheet ───────────────────────────────────────────────────────

function specLine(f: ReceiptFileItem): string {
  const parts: string[] = [];
  if (f.printTypeLabel) parts.push(f.printTypeLabel);
  if (f.contentTypeLabel) parts.push(f.contentTypeLabel);
  if (f.paperSizeLabel) parts.push(f.paperSizeLabel);
  if (f.pageCount != null) parts.push(`${f.pageCount} page${f.pageCount === 1 ? "" : "s"}`);
  parts.push(`${f.copies} cop${f.copies === 1 ? "y" : "ies"}`);
  if (f.colorModeLabel) parts.push(f.colorModeLabel);
  if (f.photoSize) parts.push(`${f.photoSize}${f.photoQuantity ? ` · ${f.photoQuantity} pcs` : ""}`);
  return parts.join(" · ");
}

function PaymentBadge({ data }: { data: ReceiptData }) {
  const cls =
    data.payment.status === "paid"
      ? "bg-green-50 text-green-700 border-green-200"
      : data.payment.status === "partially_paid"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : data.payment.status === "pending_verification"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {data.payment.statusLabel}
    </span>
  );
}

export function OrderReceipt({ data }: { data: ReceiptData }) {
  const content = landingContentStore.getContent();
  const locationLines = content.locationLines?.length
    ? content.locationLines
    : [
        "Palawan State University - Main Campus",
        "Room 4, TBI Building",
        "Puerto Princesa City, 5300 Palawan",
      ];
  const contactEmail = content.contactEmail || "printwithdocufy@gmail.com";

  return (
    <div className="order-receipt-print-area mx-auto max-w-[720px] bg-white p-6 text-[#1c1f26] sm:p-8">
      {/* Header */}
      <div className="border-b-[3px] border-[#2F6FD6] pb-4 text-center">
        <div className="text-[26px] font-bold tracking-tight text-[#2F6FD6]">
          Docufy
        </div>
        <p className="mt-1 text-sm text-gray-600">Printing Services</p>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
          {locationLines.join(", ")}
        </p>
      </div>

      {/* Cancellation banner */}
      {data.isCanceled && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          This order was canceled
          {data.cancellationReason ? ` — ${data.cancellationReason}` : "."}
        </div>
      )}

      {/* Title + meta panel */}
      <h2 className="mt-5 text-xl font-bold text-[#2F6FD6]">ORDER RECEIPT</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-blue-100 bg-[#F2F7FF] px-4 py-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-gray-500">Receipt No.</p>
          <p className="font-medium text-gray-900">{data.receiptNumber}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">Order No.</p>
          <p className="font-medium text-gray-900">{data.orderDisplayId}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">Order Date</p>
          <p className="font-medium text-gray-900">{data.orderDate}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">Order Status</p>
          <p className="font-medium text-gray-900">{data.statusLabel}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">Source</p>
          <p className="font-medium text-gray-900">
            {data.isWalkin ? "Walk-in" : "Online"}
          </p>
        </div>
      </div>

      {/* Billed to / shop */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Billed To
          </p>
          <p className="mt-1.5 text-sm font-semibold text-gray-900">
            {data.customerName}
          </p>
          {data.customerEmail && (
            <p className="mt-0.5 text-sm text-gray-600">{data.customerEmail}</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Docufy Printing Services
          </p>
          {locationLines.map((line) => (
            <p key={line} className="mt-0.5 text-sm text-gray-600">
              {line}
            </p>
          ))}
          <p className="mt-0.5 text-sm text-gray-600">{contactEmail}</p>
        </div>
      </div>

      {/* Order items */}
      <h3 className="mt-5 text-sm font-bold text-[#2F6FD6]">Order Items</h3>

      {data.files.length === 1 && (
        <div className="mt-2 rounded-lg border border-gray-200 p-3.5">
          <p className="text-sm font-semibold text-gray-900">
            {data.files[0].name}
          </p>
          <p className="mt-1 text-xs text-gray-600">{specLine(data.files[0])}</p>
          {data.files[0].notes && (
            <p className="mt-1 text-xs text-gray-500">
              Notes: {data.files[0].notes}
            </p>
          )}
        </div>
      )}

      {data.files.length > 1 && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-semibold">File</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Paper</th>
                <th className="px-3 py-2 font-semibold">Pages</th>
                <th className="px-3 py-2 font-semibold">Copies</th>
                <th className="px-3 py-2 font-semibold">Color</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((f, i) => (
                <tr key={`${f.name}-${i}`} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {f.name}
                    {f.photoSize && (
                      <span className="text-gray-500">
                        {` (${f.photoSize}${f.photoQuantity ? ` × ${f.photoQuantity}` : ""})`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {f.printTypeLabel || "—"}
                    {f.contentTypeLabel && (
                      <span className="block text-[10px] text-gray-500">
                        {f.contentTypeLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{f.paperSizeLabel || "—"}</td>
                  <td className="px-3 py-2 text-gray-700">{f.pageCount ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-700">{f.copies}</td>
                  <td className="px-3 py-2 text-gray-700">{f.colorModeLabel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.files.length === 0 && data.orderSummaryLine && (
        <div className="mt-2 rounded-lg border border-gray-200 p-3.5">
          <p className="text-sm font-semibold text-gray-900">
            {data.orderSummaryLine}
          </p>
        </div>
      )}

      {data.notes && (
        <p className="mt-2 text-xs text-gray-500">Notes: {data.notes}</p>
      )}

      {/* Add-ons */}
      {data.addons.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-bold text-[#2F6FD6]">Add-ons</h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.addons.map((a, i) => (
                  <tr key={`${a.name}-${i}`} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-gray-900">{a.name}</td>
                    <td className="px-3 py-2 text-gray-700">{a.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {formatCurrency(a.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {formatCurrency(a.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Cost summary */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-gray-600">Printing cost</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(data.printingCost)}
          </span>
        </div>
        {data.addons.length > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Add-ons ({data.addons.length})</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(data.addonsCost)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#2F6FD6] px-4 py-3 text-white">
        <span className="text-sm font-bold">Total</span>
        <span className="text-base font-bold">{formatCurrency(data.total)}</span>
      </div>

      {/* Payment */}
      <h3 className="mt-5 text-sm font-bold text-[#2F6FD6]">Payment</h3>
      <div className="mt-2 rounded-lg border border-gray-200 px-4 py-3 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-gray-600">Method</span>
          <span className="font-semibold text-gray-900">{data.payment.method}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-gray-600">Status</span>
          <PaymentBadge data={data} />
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-600">Amount paid</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(data.payment.amountPaid)}
          </span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-600">Balance</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(data.payment.balance)}
          </span>
        </div>
        {data.payment.reference && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Reference No.</span>
            <span className="font-medium text-gray-900">
              {data.payment.reference}
            </span>
          </div>
        )}
        {data.payment.verifiedAtLabel && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Payment recorded</span>
            <span className="font-medium text-gray-900">
              {data.payment.verifiedAtLabel}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-7 border-t border-gray-200 pt-3.5 text-center text-xs leading-relaxed text-gray-500">
        <p className="font-medium text-gray-600">Thank you for choosing Docufy!</p>
        <p className="mt-0.5">For inquiries, please contact us at {contactEmail}</p>
        <p className="mt-3 text-[10px] italic text-gray-400">
          This receipt serves as a record of your order and, where applicable,
          payment recorded by Docufy PSMS. It is not a tax invoice.
        </p>
        <p className="mt-1 text-[10px] italic text-gray-400">
          Generated {data.generatedAtLabel}
        </p>
      </div>
    </div>
  );
}

// ── View / Print / Download dialog ──────────────────────────────────────────

function downloadReceipt(data: ReceiptData) {
  const html = generateReceiptHTML(data);
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

export function OrderReceiptDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="order-receipt-print-shell max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Order Receipt — {data?.receiptNumber || data?.orderDisplayId || ""}
          </DialogTitle>
          <DialogDescription>
            Review, print, or download the receipt for order{" "}
            {data?.orderDisplayId || ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="order-receipt-print-frame overflow-auto max-h-[68vh] rounded-lg border border-gray-200 bg-white p-4">
          {data ? (
            <OrderReceipt data={data} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
              <FileText className="w-8 h-8 text-gray-300" />
              <p className="text-sm">Receipt data is not available.</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => data && downloadReceipt(data)}
            disabled={!data}
            className="border-2 border-blue-200 text-[#2F6FD6] hover:bg-white hover:text-[#2F6FD6]"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button
            onClick={() => window.print()}
            disabled={!data}
            className="border-2 border-blue-200 bg-white text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Save as PDF
          </Button>
          <Button
            data-primary-action
            onClick={() => onOpenChange(false)}
            className="bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
