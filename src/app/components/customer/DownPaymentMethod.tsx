import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FileText,
  Package,
  Briefcase,
  Banknote,
  Smartphone,
  Wallet,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { dataStore } from "../../utils/dataStore";
import { formatCurrency } from "../../utils/formatNumber";
import { pricingStore } from "../../utils/pricingStore";
import { paymentMethodsStore, type PaymentMethodType } from "../../utils/paymentMethodsStore";
import { applyDownPaymentPlan } from "../../utils/pendingOrderStore";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

const menuItems = [
  {
    label: "Dashboard",
    path: "/customer/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Print Request",
    path: "/customer/new-request",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "My Orders",
    path: "/customer/orders",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/customer/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
];

export default function DownPaymentMethod() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [amountChoice, setAmountChoice] = useState<"down" | "full">("down");
  const [showConfirm, setShowConfirm] = useState(false);
  const [onlineMethods, setOnlineMethods] = useState<PaymentMethodType[]>([]);

  // Which venue does the stored order point to (from checkout)? Cash → shop;
  // an online method chosen at checkout → Pay Online with that wallet selected.
  const [venue, setVenue] = useState<"shop" | "online">(() => {
    const m = String(dataStore.getOrderById(orderId!)?.paymentMethod || "");
    return m && m !== "Cash" ? "online" : "shop";
  });
  const [wallet, setWallet] = useState<string>(() => {
    const m = String(dataStore.getOrderById(orderId!)?.paymentMethod || "");
    const active = paymentMethodsStore.getPaymentMethods();
    return m && m !== "Cash" && active.some((x) => x.name === m)
      ? m
      : active[0]?.name ?? "";
  });

  const total = useMemo(() => {
    if (!orderId) return 0;
    const raw = dataStore.getOrderById(orderId)?.total || "₱0";
    const n = parseFloat(String(raw).replace(/[₱,]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  }, [orderId]);

  const isDownTier = useMemo(() => {
    const p = pricingStore.getPricing();
    return total >= p.downPaymentThreshold && total < p.fullPaymentThreshold;
  }, [total]);

  useEffect(() => {
    const loadMethods = () =>
      setOnlineMethods(paymentMethodsStore.getPaymentMethods());
    loadMethods();
    const unsubscribe = paymentMethodsStore.subscribe(loadMethods);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isDownTier && total > 0) {
      navigate(`/customer/payment/${orderId}`, { replace: true });
    }
  }, [isDownTier, total, orderId, navigate]);

  if (!isDownTier) {
    return null;
  }

  const downDue = total * 0.5;
  const isOnlineVenue = venue === "online";
  const amountNow = amountChoice === "down" ? downDue : total;

  const applyPlan = () => {
    if (isOnlineVenue && !wallet) {
      toast.error("Please choose a payment method first");
      return;
    }
    const decision = applyDownPaymentPlan(orderId!, total, {
      venue: isOnlineVenue ? "online" : "shop",
      amountChoice,
      wallet: isOnlineVenue ? wallet : "",
    });
    if (isOnlineVenue) {
      // Online payment: the order stays held until the customer submits their
      // reference on the Payment Verification page, then it is verified
      // normally by staff/admin like any online payment.
      toast.success(
        decision.isFull ? "Full payment selected" : "Down payment selected",
      );
      navigate(`/customer/payment/${orderId}`, {
        state: {
          paymentMethod: wallet,
          total,
        },
      });
    } else {
      // Pay at the shop: the order already exists (created at checkout) and
      // applyDownPaymentPlan has written the cash choice onto it, so the order
      // stays on hold until staff/admin verifies the down payment, then enters
      // the queue. Send the customer straight to order tracking.
      toast.success(
        decision.isFull ? "Full payment selected" : "Down payment selected",
      );
      navigate(`/customer/track/${orderId}`);
    }
  };

  return (
    <Layout
      menuItems={menuItems}
      title="Down Payment Method"
      showBackButton
      backButtonPath="/customer/dashboard"
      hideMobileBackButton
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">
            Down Payment Method
          </h2>
          <p className="text-gray-500 mt-1">
            Choose how you'd like to pay for{" "}
            {dataStore.getOrderById(orderId!)?.displayId
              ? `order ${dataStore.getOrderById(orderId!)?.displayId}`
              : `your order (${orderId})`}
            . Order total{" "}
            {formatCurrency(total)}.
          </p>
        </div>

        {/* Venue: Pay at the Shop or Pay Online */}
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            How you'll pay
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Pay the down payment in cash at the shop, or settle it online with
            a wallet.
          </p>
          <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVenue("shop")}
              className={`relative flex items-start gap-3 p-4 border-2 rounded-lg text-left transition-all active:scale-[0.98] ${
                venue === "shop"
                  ? "border-[#2F6FD6] bg-white"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {venue === "shop" && (
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
              )}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
                <Banknote className="w-5 h-5 text-[#2F6FD6]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Pay at the Shop
                </p>
                <p className="text-xs text-gray-500">
                  Visit the shop and pay in cash. Staff verifies your payment
                  at the counter before your order is printed.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVenue("online")}
              className={`relative flex items-start gap-3 p-4 border-2 rounded-lg text-left transition-all active:scale-[0.98] ${
                venue === "online"
                  ? "border-[#2F6FD6] bg-white"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {venue === "online" && (
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
              )}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
                <Smartphone className="w-5 h-5 text-[#2F6FD6]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Pay Online</p>
                <p className="text-xs text-gray-500">
                  Pay with a mobile wallet and upload your receipt on Payment
                  Verification.
                </p>
              </div>
            </button>
          </div>
        </Card>

        {/* Wallet picker (Pay Online only) */}
        {isOnlineVenue && (
          <Card className="p-6 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Choose your payment method
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              You'll pay online with a wallet, then upload your receipt on the
              next step.
            </p>
            {onlineMethods.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                No online payment methods are available right now. Please come
                back later or choose Pay at the Shop.
              </p>
            ) : (
              <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3">
                {onlineMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setWallet(method.name)}
                    className={`relative flex items-center gap-3 p-4 border-2 rounded-lg text-left transition-all active:scale-[0.98] ${
                      wallet === method.name
                        ? "border-[#2F6FD6] bg-white"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {wallet === method.name && (
                      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
                    )}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
                      <Smartphone className="w-5 h-5 text-[#2F6FD6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {method.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {method.accountName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Step: amount */}
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            How much would you like to pay today?
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            You can pay a 50% down payment now and the rest on pickup, or settle
            the full amount now.
          </p>
          <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAmountChoice("down")}
              className={`relative flex items-start gap-3 p-4 border-2 rounded-lg text-left transition-all active:scale-[0.98] ${
                amountChoice === "down"
                  ? "border-[#2F6FD6] bg-white"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {amountChoice === "down" && (
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
              )}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
                <Wallet className="w-5 h-5 text-[#2F6FD6]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Down Payment (50%)</p>
                <p className="text-sm text-[#2F6FD6] font-semibold">
                  {formatCurrency(downDue)}{" "}
                  <span className="font-normal text-xs text-gray-500">
                    now
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  Balance of {formatCurrency(total - downDue)} due on pickup.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAmountChoice("full")}
              className={`relative flex items-start gap-3 p-4 border-2 rounded-lg text-left transition-all active:scale-[0.98] ${
                amountChoice === "full"
                  ? "border-[#2F6FD6] bg-white"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {amountChoice === "full" && (
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F6FD6] rounded-full" />
              )}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
                <CheckCircle2 className="w-5 h-5 text-[#2F6FD6]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Full Amount</p>
                <p className="text-sm text-[#2F6FD6] font-semibold">
                  {formatCurrency(total)}{" "}
                  <span className="font-normal text-xs text-gray-500">
                    now
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  No balance due on pickup.
                </p>
              </div>
            </button>
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-6 bg-[#F2F7FF] border border-blue-200 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Order Total</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
            <span className="font-semibold text-gray-900">
              {amountChoice === "down"
                ? "Down Payment Due Now"
                : "Full Payment Due Now"}
            </span>
            <span className="font-bold text-[#2F6FD6]">
              {formatCurrency(amountNow)}
            </span>
          </div>
          {amountChoice === "down" && (
            <div className="flex justify-between text-sm pt-1">
              <span className="text-gray-600">Balance on Pickup</span>
              <span className="font-semibold text-gray-700">
                {formatCurrency(total - downDue)}
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            {isOnlineVenue ? (
              <>
                Paying <strong>{formatCurrency(amountNow)}</strong> via{" "}
                <strong>{wallet || "your chosen method"}</strong>. You'll upload
                your receipt on Payment Verification.
              </>
            ) : (
              <>
                Paying via <strong>cash at the shop</strong>. Visit the shop to
                pay in cash before your payment deadline; staff will verify your
                payment.
              </>
            )}
          </p>
        </Card>

        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-100">
          <Button
            className="h-11 w-full bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
            disabled={isOnlineVenue && onlineMethods.length === 0}
            onClick={() => setShowConfirm(true)}
          >
            {isOnlineVenue ? "Proceed to Payment Verification" : "Confirm & Track Order"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={() => {
          setShowConfirm(false);
          applyPlan();
        }}
        title="Confirm your payment plan?"
        description={
          isOnlineVenue
            ? `You'll pay ${formatCurrency(amountNow)} ${amountChoice === "down" ? "(50% down)" : "(full amount)"} via ${wallet || "your chosen method"}. You'll upload your receipt on Payment Verification, and your order is only placed once staff verifies the payment.`
            : `You'll pay ${formatCurrency(amountNow)} ${amountChoice === "down" ? "(50% down)" : "(full amount)"} in cash at the shop. Your order stays on hold until staff verifies your payment.`
        }
        confirmLabel={
          isOnlineVenue ? "Proceed to Payment Verification" : "Confirm & Track Order"
        }
        cancelLabel="Go Back"
        destructive={false}
      />
    </Layout>
  );
}