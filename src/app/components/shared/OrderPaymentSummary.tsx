// Financial summary for an order: Order Total / Amount Paid / Remaining Balance
// / Payment Status. Shown in the Order Details dialog so staff see the payment
// picture (including down-payment and full-payment requirements) immediately.
import { Badge } from "../ui/badge";
import { formatCurrency } from "../../utils/formatNumber";

type PaymentSummaryOrder = {
  total?: number;
  costBreakdown?: { total: number };
  paymentVerified?: boolean;
  paymentMethod?: string;
  downPaymentRequired?: boolean;
  downPaymentVerified?: boolean;
  downPaymentAmount?: number;
  fullPaymentRequired?: boolean;
  fullPaymentVerified?: boolean;
  fullPaymentAmount?: number;
};

export type OrderPaymentSummary = {
  total: number;
  amountPaid: number;
  remaining: number;
  status: "Paid" | "Partially Paid" | "Payment Due";
  fullPaymentRequired: boolean;
  downPaymentRequired: boolean;
};

export function computeOrderPayment(
  order: PaymentSummaryOrder,
  fallbackTotal = 0,
): OrderPaymentSummary {
  const total =
    order.total != null && Number.isFinite(order.total)
      ? order.total
      : order.costBreakdown?.total ?? fallbackTotal;

  const fullRequired = !!order.fullPaymentRequired;
  const downRequired = !!order.downPaymentRequired;

  if (fullRequired) {
    const paid =
      order.fullPaymentVerified || order.paymentVerified ? total : 0;
    return {
      total,
      amountPaid: paid,
      remaining: Math.max(total - paid, 0),
      status: paid >= total ? "Paid" : "Payment Due",
      fullPaymentRequired: true,
      downPaymentRequired: false,
    };
  }

  if (downRequired) {
    if (order.downPaymentVerified && order.downPaymentAmount) {
      const paid = Math.min(order.downPaymentAmount, total);
      return {
        total,
        amountPaid: paid,
        remaining: Math.max(total - paid, 0),
        status: "Partially Paid",
        fullPaymentRequired: false,
        downPaymentRequired: true,
      };
    }
    return {
      total,
      amountPaid: 0,
      remaining: total,
      status: "Payment Due",
      fullPaymentRequired: false,
      downPaymentRequired: true,
    };
  }

  const paid = order.paymentVerified ? total : 0;
  return {
    total,
    amountPaid: paid,
    remaining: Math.max(total - paid, 0),
    status: paid >= total ? "Paid" : "Payment Due",
    fullPaymentRequired: false,
    downPaymentRequired: false,
  };
}

function StatusBadgeView({ status }: { status: OrderPaymentSummary["status"] }) {
  const cls =
    status === "Paid"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "Partially Paid"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
  return (
    <Badge variant="outline" className={`text-xs font-semibold ${cls}`}>
      {status}
    </Badge>
  );
}

export default function OrderPaymentSummary({
  order,
  fallbackTotal,
}: {
  order: PaymentSummaryOrder;
  fallbackTotal?: number;
}) {
  const summary = computeOrderPayment(order, fallbackTotal);
  const method = order.paymentMethod;

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-gray-100">
        <div className="bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Order Total
          </p>
          <p className="text-base font-bold text-[#2F6FD6]">
            {formatCurrency(summary.total)}
          </p>
        </div>

        <div className="bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Amount Paid
          </p>
          <p className="text-base font-semibold text-[#1c1f26]">
            {formatCurrency(summary.amountPaid)}
          </p>
        </div>

        <div className="bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Remaining Balance
          </p>
          <p className="text-base font-semibold text-[#1c1f26]">
            {formatCurrency(summary.remaining)}
          </p>
        </div>

        <div className="bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Payment Status
          </p>
          <StatusBadgeView status={summary.status} />
        </div>
      </div>

      {(summary.fullPaymentRequired || summary.downPaymentRequired) && (
        <div
          className={`p-4 border-t border-gray-100 text-sm ${
            summary.fullPaymentRequired ? "bg-amber-50" : "bg-blue-50"
          }`}
        >
          <p
            className={
              summary.fullPaymentRequired ? "text-amber-800" : "text-blue-800"
            }
          >
            {summary.fullPaymentRequired ? (
              <>
                <strong>Full payment required</strong>
                {summary.status === "Payment Due" ? (
                  <>
                    {" — "}
                    {formatCurrency(summary.total)}
                    {" must be verified before this order can be printed."}
                  </>
                ) : (
                  " — verified. Order is cleared for printing."
                )}
              </>
            ) : (
              <>
                <strong>Down payment (50%) required</strong>
                {order.downPaymentAmount != null &&
                  ` — ${formatCurrency(order.downPaymentAmount)} verified; the remaining balance is collected at pickup.`}
              </>
            )}
          </p>
        </div>
      )}

      {method && (
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Payment method: <strong className="text-gray-700">{method}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
