import * as React from "react";

import { cn } from "./utils";

/**
 * The small caption above a filter control.
 *
 * A filter that is narrowing a list is marked with blue rather than left
 * looking untouched: when `applied` is set the caption turns Docufy blue and
 * gains a dot, so a filtered list is readable at a glance without opening
 * anything. Callers keep their own label typography through `className`.
 */
export function FilterLabel({
  applied = false,
  className,
  children,
}: {
  applied?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500",
        className,
        applied && "text-[#2F6FD6]",
      )}
    >
      {applied ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F6FD6]"
        />
      ) : null}
      {children}
    </span>
  );
}
