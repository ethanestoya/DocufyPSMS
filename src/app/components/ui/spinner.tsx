import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "./utils";

export interface SpinnerProps extends React.ComponentProps<"span"> {
  /** Any lucide size token, e.g. "sm" | "md" | "lg". Defaults to "sm". */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Visible text beside the spinner. Hidden from screen readers when set. */
  label?: string;
  /** Place the spinner above the label instead of beside it. */
  stack?: boolean;
}

const SIZE_CLASS: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

/**
 * The single busy indicator for the whole app.
 *
 * Replaces the handful of hand-rolled spinner divs that drifted apart in size
 * and color. `label` carries the "what am I waiting for" half of a pending
 * state, which a bare spinner can't communicate.
 */
export function Spinner({
  size = "sm",
  label,
  stack = false,
  className,
  ...props
}: SpinnerProps) {
  const glyph = (
    <Loader2
      className={cn("animate-spin", SIZE_CLASS[size])}
      aria-hidden="true"
    />
  );

  if (!label) {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn("inline-flex items-center text-[#2F6FD6]", className)}
        {...props}
      >
        {glyph}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "inline-flex items-center gap-2 text-[#2F6FD6]",
        stack ? "flex-col" : "flex-row",
        className,
      )}
      {...props}
    >
      {glyph}
      <span className="text-sm font-medium">{label}</span>
    </span>
  );
}
