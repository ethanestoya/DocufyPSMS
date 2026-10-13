import React from "react";
import { Info, Lock } from "lucide-react";

// Customer-facing notice shown when a payment restriction has been APPROVED by
// staff/admin (proposed policy). This is intentionally neutral — a calm
// blue/slate information card, NOT a red warning banner.
//
// UI PHASE ONLY: this component is not wired to real payment eligibility yet.
// Render it in a clearly-labeled preview/sample state. See OrderViolationsSection.
export interface PaymentRestrictionNoticeProps {
  /** Optional short reason, e.g. "Temporary payment restriction". */
  reason?: string;
  /** Optional restriction window, e.g. "15 days". Omit when policy is pending. */
  duration?: string;
  /** When true, adds a small "Preview" marker so it is never mistaken for live state. */
  preview?: boolean;
  className?: string;
}

export default function PaymentRestrictionNotice({
  reason,
  duration,
  preview = false,
  className = "",
}: PaymentRestrictionNoticeProps) {
  return (
    <div
      role="status"
      className={`rounded-xl border border-[#1D73EC]/20 bg-[#F2F7FF] p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1D73EC] ring-1 ring-[#1D73EC]/15">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#10316B]">
              Advance payment required
            </p>
            {preview && (
              <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1D73EC] ring-1 ring-[#1D73EC]/20">
                Preview
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Cash on Pickup is unavailable for your account. Please choose an
            available advance payment option.
          </p>
          {reason && (
            <p className="mt-1 text-xs text-slate-500">Reason: {reason}</p>
          )}
          {duration && (
            <p className="mt-1 text-xs text-slate-500">
              Restriction duration: {duration}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
