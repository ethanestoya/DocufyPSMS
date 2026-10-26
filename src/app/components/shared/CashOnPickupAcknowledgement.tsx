// Cash on Pickup acknowledgment — required before a cash order can be placed.
// Implemented at checkout (PrintTransaction) and on the customer payment page.
// Basis (client-intended): cash orders must be claimed + paid on pickup;
// unclaimed orders may lead to restrictions on future cash-on-pickup orders.
export function CashOnPickupAcknowledgement({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={`p-4 rounded-lg border-2 transition-colors ${
        checked
          ? "border-blue-200 bg-[#F2F7FF]"
          : "border-amber-300 bg-amber-50"
      } ${className}`}
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#1668D9] shrink-0"
        />
        <span className="text-sm text-gray-700 leading-relaxed">
          By selecting <strong>Cash on Pickup</strong>, you agree to{" "}
          <strong>claim and pay for your order in full upon pickup</strong>.
          Unclaimed orders may result in restrictions on future Cash on Pickup
          orders.
        </span>
      </label>
    </div>
  );
}