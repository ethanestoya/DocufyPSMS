import { Download, QrCode, User, Hash, Wallet } from "lucide-react";
import type { PaymentMethodType } from "../../utils/paymentMethodsStore";
import { downloadQRCode, methodQRFilename } from "../../utils/paymentMethodsStore";
import { Button } from "../ui/button";

// Reusable online-payment instruction block: shows the method's QR code
// prominently plus its account/payment details and a Download QR button.
// Used on the customer payment page, the admin/staff verification dialog,
// and the admin Payment Methods management cards.
export default function PaymentMethodQRPanel({
  method,
  qrSize = "w-40 h-40",
}: {
  method: PaymentMethodType;
  qrSize?: string;
}) {
  const qr = method.qrCode;
  const filename = methodQRFilename(method);

  return (
    <div className="p-4 sm:p-5 bg-white border-2 border-[#1668D9]/15 rounded-xl">
      <div className="flex flex-col md:flex-row gap-5">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="inline-block rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
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
          <div className="flex items-start gap-2.5">
            <Hash className="w-4 h-4 text-[#1668D9] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-gray-500 text-xs">Account / Payment Number</p>
              <p className="font-medium text-[#1c1f26] font-mono">
                {method.accountNumber}
              </p>
            </div>
          </div>
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