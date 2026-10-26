import { Download, Maximize2, QrCode, User, Hash, Wallet } from "lucide-react";
import type { PaymentMethodType } from "../../utils/paymentMethodsStore";
import { downloadQRCode, methodQRFilename } from "../../utils/paymentMethodsStore";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

// Reusable online-payment instruction block: shows the method's QR code
// prominently plus its account/payment details and a Download QR button.
// Used on the customer payment page, the admin/staff verification dialog,
// the customer print request's View QR modal, and the admin Payment Methods
// management cards.
export default function PaymentMethodQRPanel({
  method,
  qrSize = "w-40 h-40",
  onExpand,
}: {
  method: PaymentMethodType;
  qrSize?: string;
  /**
   * When provided, the QR preview becomes a button that opens a larger,
   * scannable view (so a customer can scan the code straight off the screen
   * instead of downloading it first).
   */
  onExpand?: () => void;
}) {
  const qr = method.qrCode;
  const filename = methodQRFilename(method);
  const canExpand = Boolean(onExpand && qr);

  const qrCard = (
    <div
      className={`inline-block rounded-xl border border-gray-100 bg-white p-2 shadow-sm ${
        canExpand
          ? "transition-all group-hover:border-[#1668D9]/50 group-hover:ring-2 group-hover:ring-[#1668D9]/25"
          : ""
      }`}
    >
      {qr ? (
        <img
          src={qr}
          alt={`${method.name} QR Code`}
          className={`${qrSize} object-contain`}
        />
      ) : (
        <div
          className={`${qrSize} flex items-center justify-center text-gray-300`}
        >
          <QrCode className="w-16 h-16" />
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-5 bg-white border-2 border-[#1668D9]/15 rounded-xl">
      <div className="flex flex-col md:flex-row gap-5">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          {canExpand ? (
            <button
              type="button"
              onClick={onExpand}
              title={`View ${method.name} QR code at full size`}
              aria-label={`View ${method.name} QR code at full size`}
              className="group cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-2"
            >
              {qrCard}
            </button>
          ) : (
            qrCard
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs border-2 border-[#1668D9]/40 text-[#1668D9] hover:bg-[#1668D9] hover:text-white transition-all"
            onClick={() => downloadQRCode(qr, filename)}
            disabled={!qr}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Download QR Code
          </Button>
          {canExpand && (
            <p className="-mt-1 flex items-center gap-1 text-[11px] text-gray-500">
              <Maximize2 className="h-3 w-3 shrink-0" />
              Tap the QR code to view it full size
            </p>
          )}
        </div>

        {/* Account / Payment Details */}
        <div className="flex-1 space-y-3 text-sm min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {method.name} Payment Details
          </p>
          <div className="flex items-start gap-2.5">
            <User className="w-4 h-4 text-[#1668D9] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-gray-500 text-xs">Account Name</p>
              <p className="font-semibold text-[#1c1f26]">
                {method.accountName}
              </p>
            </div>
          </div>
          {method.accountNumber?.trim() && (
            <div className="flex items-start gap-2.5">
              <Hash className="w-4 h-4 text-[#1668D9] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-gray-500 text-xs">Account / Payment Number</p>
                <p className="font-medium text-[#1c1f26] font-mono">
                  {method.accountNumber}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <Wallet className="w-4 h-4 text-[#1668D9] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-gray-500 text-xs">Payment Method</p>
              <p className="font-medium text-[#1c1f26]">{method.name}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 pt-1">
            Scan this QR code with your <strong>{method.name}</strong> app to
            pay, then upload your receipt below.
          </p>
        </div>
      </div>
    </div>
  );
}

// Full-size view of a payment method's QR, opened from the panel's preview so
// a customer can scan the code straight off the screen instead of downloading
// it first. It is its own dialog (rendered as a sibling of whatever dialog
// holds the panel) so the code can grow without resizing the instructions.
export function PaymentMethodQRFullView({
  method,
  open,
  onOpenChange,
}: {
  method?: PaymentMethodType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open && Boolean(method?.qrCode)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#10316B]">
            {method ? `${method.name} QR Code` : "Payment QR Code"}
          </DialogTitle>
          <DialogDescription>
            Point your {method?.name ?? "payment"} app at this code to scan it.
            No download needed.
          </DialogDescription>
        </DialogHeader>
        {method?.qrCode && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <img
                src={method.qrCode}
                alt={`${method.name} QR Code`}
                className="h-auto max-h-[55vh] w-[min(72vw,20rem)] object-contain"
              />
            </div>
            <div className="text-center text-sm">
              <p className="font-semibold text-[#1c1f26]">{method.accountName}</p>
              {method.accountNumber?.trim() && (
                <p className="font-mono text-gray-600">{method.accountNumber}</p>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto h-10"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
