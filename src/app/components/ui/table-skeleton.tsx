import { Skeleton } from "./skeleton";
import { cn } from "./utils";

interface TableSkeletonProps {
  /** Column count of the real table this stands in for. */
  columns?: number;
  /** How many placeholder rows to draw. */
  rows?: number;
  className?: string;
}

/**
 * Placeholder for a data table that is still loading.
 *
 * The app paints its local mirror first and then swaps in server data, so an
 * empty list is ambiguous: it can mean "loading", "filtered to nothing", or
 * "genuinely no records". The skeleton covers the loading case so the real
 * empty state keeps meaning what it says.
 */
export function TableSkeleton({
  columns = 6,
  rows = 8,
  className,
}: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading data"
      className={cn("w-full", className)}
    >
      <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#2F6FD6]" aria-hidden="true" />
        Loading data…
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  "h-3.5 rounded-full",
                  // Vary the widths so the placeholder reads as content rather
                  // than as a ruler.
                  colIndex === 0 ? "w-32" : "w-full max-w-[120px]",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
