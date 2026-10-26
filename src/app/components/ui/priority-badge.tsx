// Processing-priority badge used by the Orders queue and Payment Verification.
// The number is the processing/verification sequence (who to handle next), not
// the order/generation index. The first actionable item gets an active ring and
// a "Start Here" / "Next to Verify" tag so staff always know what to do next.
import React from "react";

export function PriorityBadge({
  number,
  active = false,
  className = "",
}: {
  /** Sequence number (1 = highest priority). */
  number: number;
  /** True for the next item to process/verify — adds a ring + emphasis. */
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-[#1668D9] text-white transition-shadow ${
        active
          ? "shadow-[0_0_0_4px_rgba(29,115,236,0.18)]"
          : "shadow-none"
      } ${className}`}
    >
      {number}
    </div>
  );
}

export function StartHereTag({
  label = "Start Here",
  className = "",
  onClick,
}: {
  label?: string;
  className?: string;
  /** When provided, renders an actionable button (e.g. "start this order"). */
  onClick?: (e: React.MouseEvent) => void;
}) {
  const content = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-[#1668D9] animate-pulse" />
      {label}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        title={`${label} — click to start this item`}
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1668D9] cursor-pointer hover:text-[#10316B] hover:underline ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1668D9] ${className}`}
    >
      {content}
    </span>
  );
}