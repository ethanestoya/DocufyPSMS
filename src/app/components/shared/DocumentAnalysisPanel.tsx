import { useState } from "react";
import type { ColorAnalysis } from "../../utils/colorAnalysis";

type AnalysisTab = "color" | "bw";

/**
 * Page-by-page colour breakdown: headline count, colour share bar, a Color /
 * Black & white filter and one scrollable page list. Shared by the staff print
 * screen and the customer's Cost Breakdown so both read the same analysis the
 * same way.
 */
export function DocumentAnalysisPanel({
  analysis,
  listClassName = "max-h-[min(19rem,calc(86vh-18rem))] space-y-2 overflow-y-auto pr-1",
  fadeList = true,
}: {
  analysis: ColorAnalysis;
  /** Cap + scroller for the page list, sized by the host surface. */
  listClassName?: string;
  /** Show the bottom fade that signals the list scrolls. */
  fadeList?: boolean;
}) {
  const colorCount = analysis.colorPages.length;
  const bwCount = analysis.bwPages.length;
  // Every page is classified into exactly one of the two lists, so if the
  // estimator counted fewer pages than it listed the list sum wins.
  const total = Math.max(analysis.totalPages, colorCount + bwCount, 1);
  const colorSharePct = Math.round((colorCount / total) * 100);
  const [tab, setTab] = useState<AnalysisTab>(colorCount > 0 ? "color" : "bw");
  const isColorTab = tab === "color";
  const pages = isColorTab ? analysis.colorPages : analysis.bwPages;

  const renderRow = (page: number) => {
    const pct = analysis.colorPercentages[page] ?? 0;
    return (
      <div
        key={page}
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
          isColorTab ? "border-blue-100 bg-[#F2F7FF]" : "border-gray-200 bg-white"
        }`}
      >
        <span className="w-16 shrink-0 font-semibold text-gray-900">
          Page {page}
        </span>
        <div
          className={`h-1.5 min-w-0 flex-1 overflow-hidden rounded-full ${
            isColorTab ? "bg-blue-200/60" : "bg-gray-200"
          }`}
        >
          {isColorTab && (
            // A presence-based gate can flag a page whose coverage rounds to a
            // hairline; the floor keeps the flagged pages visible.
            <div
              className="h-full rounded-full bg-[#2F6FD6]"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          )}
        </div>
        <span
          className={`w-[4.5rem] shrink-0 text-right tabular-nums ${
            isColorTab ? "font-medium text-gray-900" : "text-xs text-gray-500"
          }`}
        >
          {isColorTab ? `${pct}%` : "Grayscale"}
        </span>
      </div>
    );
  };

  return (
    <div className="text-sm">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none tabular-nums text-[#2F6FD6]">
          {colorCount}
        </span>
        <span className="text-gray-600">
          of {total} page{total !== 1 ? "s" : ""} contain color
        </span>
      </p>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full bg-[#2F6FD6]"
          style={{ width: `${colorCount > 0 ? Math.max(colorSharePct, 2) : 0}%` }}
        />
        <div className="h-full grow bg-gray-300" />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-gray-500">
        {colorSharePct}% color · {100 - colorSharePct}% black and white
      </p>

      <div className="mt-3 inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          aria-pressed={isColorTab}
          disabled={colorCount === 0}
          onClick={() => setTab("color")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            isColorTab
              ? "bg-[#2F6FD6] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          } ${colorCount === 0 ? "cursor-not-allowed opacity-40" : ""}`}
        >
          Color
          <span className={isColorTab ? "text-blue-100" : "text-gray-400"}>
            {colorCount}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={!isColorTab}
          disabled={bwCount === 0}
          onClick={() => setTab("bw")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            !isColorTab
              ? "bg-[#2F6FD6] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          } ${bwCount === 0 ? "cursor-not-allowed opacity-40" : ""}`}
        >
          Black &amp; white
          <span className={isColorTab ? "text-gray-400" : "text-blue-100"}>
            {bwCount}
          </span>
        </button>
      </div>

      {/* The list scrolls inside its own cap so the summary above stays visible
          instead of pushing the host surface into a second, nested scroll. */}
      <div className="relative mt-3">
        <div className={listClassName}>{pages.map(renderRow)}</div>
        {fadeList && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent" />
        )}
      </div>
    </div>
  );
}
