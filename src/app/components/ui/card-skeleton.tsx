import { Skeleton } from "./skeleton";
import { cn } from "./utils";

interface CardSkeletonProps {
  /** How many placeholder cards to draw. */
  cards?: number;
  /** Widest grid the real cards use: 1 column, 2, or 3. */
  columns?: 1 | 2 | 3;
  /** Announced to assistive tech while the list loads. */
  label?: string;
  className?: string;
}

/**
 * Placeholder for a list of CARDS (job postings, announcements, KPI tiles)
 * that is still loading.
 *
 * The app paints its local mirror first and then swaps in server data, so an
 * empty list is ambiguous: it can mean "loading", "filtered to nothing", or
 * "genuinely no records". The skeleton covers the loading case so the real
 * empty state keeps meaning what it says.
 */
export function CardSkeleton({
  cards = 3,
  columns = 1,
  label = "Loading data",
  className,
}: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn("w-full", className)}
    >
      <div className="flex items-center gap-2 py-3 text-sm font-medium text-slate-500">
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#2F6FD6]"
          aria-hidden="true"
        />
        Loading…
      </div>
      <div
        className={cn(
          "grid gap-3",
          columns === 1
            ? "grid-cols-1"
            : columns === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-5/6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DetailSkeletonProps {
  /** How many stacked panels to draw. */
  blocks?: number;
  label?: string;
  className?: string;
}

/**
 * Placeholder for a single-record page (an order, a payment) that is still
 * loading: a heading line and a few stacked panels instead of the detail.
 */
export function DetailSkeleton({
  blocks = 2,
  label = "Loading details",
  className,
}: DetailSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn("w-full space-y-4", className)}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#2F6FD6]"
          aria-hidden="true"
        />
        Loading…
      </div>
      {Array.from({ length: blocks }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <Skeleton className="h-4 w-40 rounded-full" />
          <div className="mt-4 space-y-2.5">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-11/12 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
