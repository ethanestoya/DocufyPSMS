// Confirm pricing: lets staff/admin check what the colour detector read on the
// uploaded file and correct a page that was priced at the wrong colour tier.
// The charged total is the anchor — every adjustment is a per-page rate delta
// against it, so a confirmed change can never silently contradict what the
// customer was billed at checkout.
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Loader2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { showDbError } from "../../../lib/db/errors";
import { BUCKETS, downloadObjectToBlob, getSignedObjectUrl } from "../../../lib/db/storage";
import { analyzeDocument } from "../../utils/colorAnalysis";
import { auditLogStore, type AuditEntry } from "../../utils/auditLogStore";
import { notificationStore } from "../../utils/notificationStore";
import { ordersStore } from "../../utils/ordersStore";
import {
  COLOR_TIER_LABELS,
  getPriceFromMatrix,
  mapPaperSizeKey,
  pricingStore,
  resolveColorTier,
  type ColorTier,
  type ContentType,
  type ServiceType,
} from "../../utils/pricingStore";

export type PricingOrder = {
  id: string;
  displayId?: string;
  customer?: string;
  customerEmail?: string;
  customerId?: string | null;
  orderSource?: "online" | "walkin";
  paperSize?: string;
  copies?: number;
  pages?: number;
  paymentVerified?: boolean;
  downPaymentRequired?: boolean;
  downPaymentVerified?: boolean;
  downPaymentAmount?: number;
  fullPaymentRequired?: boolean;
  fullPaymentVerified?: boolean;
  fullPaymentAmount?: number;
  addons?: { name: string; quantity: number; price: number }[];
  costBreakdown?: {
    printingCost: number;
    addonsCost: number;
    total: number;
  };
  manualTotal?: number;
  attachedFiles?: Array<{
    name: string;
    size?: string;
    type?: string;
    storagePath?: string;
    printType?: string;
    contentType?: string;
    paperSize?: string;
    pageCount?: number;
    copies?: number;
    colorMode?: string;
    photoSize?: string;
    photoQuantity?: number;
  }>;
};

const PRICE_REASONS = [
  "Some pages were misread as coloured",
  "Pages printed at a different colour tier",
  "Customer changed the print request",
  "Pages had to be reprinted",
  "Other (explain in the note)",
];

const PESO = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const round2 = (value: number) => Math.round(value * 100) / 100;

type Step = "summary" | "pages" | "adjust" | "confirm";
type TierFilter = "all" | ColorTier | "marked";

type AnalysisState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | {
      status: "ready";
      pageCount: number;
      pageTiers: Record<number, ColorTier>;
      percentages: Record<number, number>;
      estimated: boolean;
      method?: string;
    };

function financialsOf(order: PricingOrder) {
  const addonsCost =
    order.costBreakdown?.addonsCost ??
    (order.addons ?? []).reduce((sum, a) => sum + a.price * a.quantity, 0);
  const storedTotal = order.costBreakdown?.total ?? order.manualTotal ?? 0;
  const printingCost =
    order.costBreakdown?.printingCost ?? Math.max(storedTotal - addonsCost, 0);
  return { addonsCost, printingCost, storedTotal };
}

// How much of the order has actually been confirmed as paid — the same picture
// computeOrderPayment draws, kept local so the settlement line cannot drift.
function paidSoFar(order: PricingOrder, total: number): number {
  if (order.paymentVerified || order.fullPaymentVerified) return total;
  if (order.downPaymentVerified) {
    return Math.min(order.downPaymentAmount ?? 0, total);
  }
  return 0;
}

function orderLabel(order: PricingOrder) {
  return `Order ${order.displayId ?? order.id}`;
}

// A walk-in is settled at the counter; an online order is settled at pickup.
function isCounterSale(order: PricingOrder | null | undefined): boolean {
  return order?.orderSource === "walkin";
}

// dataStore invents an @example.com address for a walk-in with no account, so
// that address must never be treated as a real recipient.
function hasCustomerAccount(order: PricingOrder | null | undefined): boolean {
  const email = order?.customerEmail?.trim().toLowerCase() ?? "";
  return !!email && !email.includes("@example.com");
}

/** Audit rows written by a confirmed price change, newest first. */
export function getPriceAdjustments(orderId: string): AuditEntry[] {
  return auditLogStore
    .getEntries()
    .filter((entry) => entry.entityId === orderId && entry.title === "Price Adjusted");
}

/** Live list of this order's price changes, re-read as the log hydrates. */
export function usePriceAdjustments(orderId: string | undefined): AuditEntry[] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = auditLogStore.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, []);
  return useMemo(
    () => (orderId ? getPriceAdjustments(orderId) : []),
    [orderId, tick],
  );
}

type TierCounts = { bw: number; partial: number; full: number };

function countTiers(
  pageCount: number,
  tierOf: (page: number) => ColorTier | undefined,
): TierCounts {
  const counts: TierCounts = { bw: 0, partial: 0, full: 0 };
  for (let page = 1; page <= pageCount; page += 1) {
    const tier = tierOf(page);
    if (tier) counts[tier] += 1;
  }
  return counts;
}

function tierClass(tier: ColorTier): string {
  if (tier === "full") return "border-[#1668D9] bg-[#EAF2FF] text-[#10316B]";
  if (tier === "partial") return "border-[#F0C36D] bg-[#FFF8EB] text-[#8A5007]";
  return "border-[#DDE3EC] bg-white text-[#111827]";
}

function moneyRow(label: string, value: string, emphasis = false) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5" key={label}>
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span
        className={
          emphasis
            ? "text-[16px] font-semibold text-[#111827]"
            : "text-[14px] font-medium text-[#111827]"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function ConfirmPricingDialog({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PricingOrder | null;
  onSaved?: (orderId: string) => void;
}) {
  const [step, setStep] = useState<Step>("summary");
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "loading" });
  const [overrides, setOverrides] = useState<Record<number, ColorTier>>({});
  const [filter, setFilter] = useState<TierFilter>("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeTier, setRangeTier] = useState<ColorTier>("bw");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);

  const orderId = order?.id ?? "";

  const primaryFile = useMemo(() => {
    const files = (order?.attachedFiles ?? []).filter(
      (file) => (file.printType ?? "document").toLowerCase() !== "photo",
    );
    return files.find((file) => file.storagePath) ?? null;
  }, [order]);

  const copies = Math.max(
    1,
    primaryFile?.copies ?? order?.copies ?? 1,
  );

  const service = useMemo<ServiceType>(() => {
    const printType = (primaryFile?.printType ?? "document").toLowerCase();
    if (printType === "vellum" || printType === "sticker") return printType;
    return "document";
  }, [primaryFile]);

  const contentType = (primaryFile?.contentType ?? "text") as ContentType;
  const sizeKey = mapPaperSizeKey(primaryFile?.paperSize ?? order?.paperSize);

  const { addonsCost, printingCost, storedTotal } = useMemo(
    () => financialsOf(order ?? ({ id: "" } as PricingOrder)),
    [order],
  );

  const matrix = pricingStore.getMatrix();
  const rateFor = (tier: ColorTier) =>
    getPriceFromMatrix(matrix, service, { contentType, colorTier: tier, sizeKey });

  // Reset the flow and re-analyse the stored file every time the dialog opens
  // for an order. The page percentages are not persisted on the order, so the
  // file is the only honest source for them.
  useEffect(() => {
    if (!open || !order) return;
    let cancelled = false;
    setStep("summary");
    setOverrides({});
    setFilter("all");
    setRangeFrom("");
    setRangeTo("");
    setRangeTier("bw");
    setReason("");
    setNote("");

    const file = primaryFile;
    if (!file?.storagePath) {
      setAnalysis({
        status: "unavailable",
        message:
          "This order has no stored file, so page colour detection cannot run.",
      });
      return;
    }

    setAnalysis({ status: "loading" });
    (async () => {
      const downloaded = await downloadObjectToBlob(
        BUCKETS.orderFiles,
        file.storagePath,
      );
      if (cancelled) return;
      if (!downloaded) {
        setAnalysis({
          status: "unavailable",
          message:
            "The uploaded file could not be read. Page colour detection is unavailable for this order.",
        });
        return;
      }
      try {
        const doc = await analyzeDocument(
          new File([downloaded.blob], file.name, {
            type: downloaded.blob.type || "application/pdf",
          }),
        );
        if (cancelled) return;
        const pageCount = Math.max(1, doc.analysis.totalPages || doc.pageCount);
        const pageTiers: Record<number, ColorTier> = {};
        const percentages: Record<number, number> = {};
        for (let page = 1; page <= pageCount; page += 1) {
          const raw = doc.analysis.colorPercentages?.[page];
          // The analyzer owns the page decision (fraction + pixel floor); this
          // path only buckets a page it flagged into partial/full, so a page it
          // rejected can't be re-admitted by a different rule here.
          const isColorPage = doc.analysis.colorPages.includes(page);
          const pct =
            typeof raw === "number"
              ? raw
              : isColorPage
                ? 100
                : 0;
          percentages[page] = pct;
          pageTiers[page] = isColorPage ? resolveColorTier("colored", pct) : "bw";
        }
        setAnalysis({
          status: "ready",
          pageCount,
          pageTiers,
          percentages,
          estimated: !!doc.analysis.estimated,
          method: doc.analysis.method,
        });
      } catch (error) {
        console.warn("[pricing] colour analysis failed:", error);
        if (cancelled) return;
        setAnalysis({
          status: "unavailable",
          message:
            "The uploaded file could not be analysed. Page colour detection is unavailable for this order.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orderId, primaryFile?.storagePath]);

  const detectedTier = (page: number): ColorTier | undefined =>
    analysis.status === "ready" ? analysis.pageTiers[page] : undefined;
  const effectiveTier = (page: number): ColorTier | undefined =>
    overrides[page] ?? detectedTier(page);

  const pageCount = analysis.status === "ready" ? analysis.pageCount : 0;

  const changes = useMemo(() => {
    if (analysis.status !== "ready") return [];
    return Object.entries(overrides)
      .map(([page, tier]) => ({
        page: Number(page),
        from: analysis.pageTiers[Number(page)],
        to: tier,
      }))
      .filter((change) => change.from && change.from !== change.to)
      .map((change) => ({
        ...change,
        amount: round2((rateFor(change.to) - rateFor(change.from)) * copies),
      }))
      .sort((a, b) => a.page - b.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, analysis, copies, service, contentType, sizeKey]);

  const delta = round2(changes.reduce((sum, change) => sum + change.amount, 0));
  const adjustedPrinting = round2(printingCost + delta);
  const adjustedTotal = round2(adjustedPrinting + addonsCost);

  const before = countTiers(pageCount, detectedTier);
  const after = countTiers(pageCount, effectiveTier);

  const paid = paidSoFar(order ?? ({ id: "" } as PricingOrder), storedTotal);
  const balanceAfter = round2(adjustedTotal - paid);
  const counterSale = isCounterSale(order);
  const settlePlace = counterSale ? "at the counter" : "at pickup";
  const settlement =
    paid <= 0
      ? `Full amount of ${PESO(adjustedTotal)} is due ${settlePlace}.`
      : balanceAfter > 0
        ? `${PESO(balanceAfter)} balance is collected ${settlePlace}.`
        : balanceAfter < 0
          ? `${PESO(Math.abs(balanceAfter))} is returned ${settlePlace}.`
          : `Nothing is left to settle ${settlePlace}.`;

  // The comparison must say which price is which, so the adjustment carries an
  // explicit "was" alongside the new figure.
  const ranges = useMemo(() => {
    const groups: {
      start: number;
      end: number;
      from: ColorTier;
      to: ColorTier;
      amount: number;
    }[] = [];
    for (const change of changes) {
      const last = groups[groups.length - 1];
      if (
        last &&
        change.page === last.end + 1 &&
        change.from === last.from &&
        change.to === last.to
      ) {
        last.end = change.page;
        last.amount = round2(last.amount + change.amount);
      } else {
        groups.push({
          start: change.page,
          end: change.page,
          from: change.from,
          to: change.to,
          amount: change.amount,
        });
      }
    }
    return groups;
  }, [changes]);

  const setPageTier = (page: number, tier: ColorTier) => {
    const base = detectedTier(page);
    setOverrides((current) => {
      const next = { ...current };
      if (base === tier) delete next[page];
      else next[page] = tier;
      return next;
    });
  };

  const cyclePage = (page: number) => {
    const current = effectiveTier(page) ?? "bw";
    const next: ColorTier =
      current === "bw" ? "partial" : current === "partial" ? "full" : "bw";
    setPageTier(page, next);
  };

  const applyRange = () => {
    if (analysis.status !== "ready") return;
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to > analysis.pageCount ||
      from > to
    ) {
      toast.error("Enter a page range inside this document.");
      return;
    }
    setOverrides((current) => {
      const next = { ...current };
      for (let page = from; page <= to; page += 1) {
        if (analysis.pageTiers[page] === rangeTier) delete next[page];
        else next[page] = rangeTier;
      }
      return next;
    });
    setRangeFrom("");
    setRangeTo("");
  };

  // order-files is a private bucket, so the preview goes through a signed URL
  // exactly like the staff/admin Order Details "View" button.
  const openStoredFile = async () => {
    const path = primaryFile?.storagePath;
    if (!path || openingFile) return;
    setOpeningFile(true);
    try {
      const url = await getSignedObjectUrl(BUCKETS.orderFiles, path);
      if (!url) {
        toast.error("Couldn't open the file from the server. Please try again.");
        return;
      }
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      if (!tab) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener,noreferrer";
        anchor.click();
      }
    } finally {
      setOpeningFile(false);
    }
  };

  const cellCount = (tier: TierFilter) => {
    if (analysis.status !== "ready") return 0;
    if (tier === "all") return analysis.pageCount;
    if (tier === "marked") return changes.length;
    return after[tier];
  };

  const confirmAsIs = () => {
    if (!order) return;
    auditLogStore.record({
      module: "Orders",
      action: "Updated",
      reference: orderLabel(order),
      entityType: "Order",
      entityId: order.id,
      title: "Pricing Confirmed",
      description: `The auto-detected page colours were checked and the total was kept at ${PESO(storedTotal)}.`,
      changes: [],
    });
    toast.success("Pricing confirmed", {
      description: `The total stays at ${PESO(storedTotal)}.`,
    });
    onOpenChange(false);
  };

  const confirmChange = async () => {
    if (!order || changes.length === 0) return;
    if (!reason) {
      toast.error("Choose a reason for the change.");
      return;
    }
    setSaving(true);
    const nextBreakdown = {
      printingCost: adjustedPrinting,
      addonsCost,
      total: adjustedTotal,
    };
    try {
      await ordersStore.updateOrder(order.id, {
        manualTotal: adjustedTotal,
        costBreakdown: nextBreakdown,
      });

      const label = orderLabel(order);
      const reasonLabel = reason;
      const description = `${ranges
        .map(
          (range) =>
            `Page${range.end > range.start ? "s" : ""} ${
              range.end > range.start
                ? `${range.start}-${range.end}`
                : range.start
            } moved from ${COLOR_TIER_LABELS[range.from]} to ${COLOR_TIER_LABELS[range.to]}`,
        )
        .join("; ")}. Reason: ${reasonLabel}${note.trim() ? ` — ${note.trim()}` : ""}. Total ${PESO(storedTotal)} → ${PESO(adjustedTotal)}.`;

      auditLogStore.record({
        module: "Orders",
        action: "Updated",
        reference: label,
        entityType: "Order",
        entityId: order.id,
        title: "Price Adjusted",
        description,
        changes: [
          { field: "Total", previous: PESO(storedTotal), next: PESO(adjustedTotal) },
          { field: "Reason for change", previous: "—", next: reasonLabel },
          ...ranges.map((range) => ({
            field:
              range.end > range.start
                ? `Pages ${range.start}-${range.end}`
                : `Page ${range.start}`,
            previous: COLOR_TIER_LABELS[range.from],
            next: COLOR_TIER_LABELS[range.to],
          })),
        ],
      });

      if (hasCustomerAccount(order)) {
        notificationStore.addNotification(
          "order",
          "Order price updated",
          `${label} was repriced from ${PESO(storedTotal)} to ${PESO(adjustedTotal)}. ${settlement} Reason: ${reasonLabel}.`,
          {
            clickable: true,
            priority: "important",
            relatedOrderId: order.id,
            relatedRoute: `/customer/track/${order.id}`,
            recipientRole: "customer",
            recipientEmail: order.customerEmail,
            recipientProfileId: order.customerId ?? null,
          },
        );
      }

      toast.success("Price updated", {
        description: `${PESO(storedTotal)} → ${PESO(adjustedTotal)}${
          hasCustomerAccount(order) ? " · customer notified" : ""
        }`,
      });
      onSaved?.(order.id);
      onOpenChange(false);
    } catch (error) {
      showDbError("price update", error);
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  const title =
    step === "summary"
      ? "Confirm pricing"
      : step === "pages"
        ? "Mark pages"
        : step === "adjust"
          ? "Review adjusted price"
          : "Confirm new price";

  const subtitle =
    step === "summary"
      ? `${primaryFile?.name ?? "Print job"}${pageCount ? ` · ${pageCount} ${pageCount === 1 ? "page" : "pages"} · ${copies} ${copies === 1 ? "copy" : "copies"}` : ""}`
      : step === "pages"
        ? "Tap a page to change its colour tier, or mark a range."
        : step === "adjust"
          ? "Check the reclassified pages and the amount they move the total by."
          : "Review what the customer is told before you save the change.";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        className="sm:max-w-[640px] max-h-[calc(100dvh-2rem)] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl [font-family:inherit] [&_[data-slot=dialog-close]]:hidden"
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="flex-row items-start justify-between gap-3 space-y-0 px-6 pt-6 pb-0 text-left">
          <div className="min-w-0">
            <DialogTitle className="text-[20px] font-bold leading-tight text-[#111827]">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 break-words text-[13.5px] leading-relaxed text-[#4B5563]">
              {subtitle}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {primaryFile?.storagePath && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-[13px]"
                loading={openingFile}
                loadingText="Opening…"
                onClick={openStoredFile}
                title={`Open ${primaryFile.name} in a new tab`}
              >
                <Eye className="mr-1.5 size-3.5" aria-hidden="true" />
                Preview file
              </Button>
            )}
            <button
              type="button"
              onClick={() => !saving && onOpenChange(false)}
              aria-label="Close pricing"
              className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#D5DBE5] bg-white text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
            >
              <span aria-hidden="true" className="text-[18px] leading-none">
                ×
              </span>
            </button>
          </div>
        </DialogHeader>

        <div className="mt-5 h-px bg-[#E5E7EB]" />

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "summary" && (
            <div className="space-y-4">
              {analysis.status === "loading" && (
                <div className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-5 text-[13.5px] text-[#4B5563]">
                  <Loader2 className="size-4 animate-spin text-[#1668D9]" />
                  Reading the file to detect coloured pages…
                </div>
              )}

              {analysis.status === "unavailable" && (
                <div className="flex items-start gap-3 rounded-[12px] border border-[#F5CE8A] bg-[#FFF8EB] px-4 py-4 text-[13.5px] leading-relaxed text-[#8A5007]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {analysis.message} The charged total below is still correct
                    for what was detected at checkout.
                  </span>
                </div>
              )}

              {analysis.status === "ready" && (
                <>
                  <div className="rounded-[12px] border border-[#E5E7EB] px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-[#6B7280]">
                        Detected colour area
                      </span>
                      <span className="text-[15px] font-semibold text-[#111827]">
                        {before.partial + before.full} of {pageCount}{" "}
                        {pageCount === 1 ? "page" : "pages"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["bw", "partial", "full"] as ColorTier[]).map((tier) => (
                        <span
                          key={tier}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${tierClass(tier)}`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {COLOR_TIER_LABELS[tier]} · {before[tier]}
                        </span>
                      ))}
                    </div>
                    {analysis.estimated && (
                      <p className="mt-3 text-[12px] leading-relaxed text-[#6B7280]">
                        This reading is an estimate from the document's contents,
                        not a pixel scan.
                      </p>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB]">
                    <table className="w-full text-left">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                            Tier
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                            Rate / page
                          </th>
                          <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                            Pages
                          </th>
                          <th className="px-4 py-2.5 text-right text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                            Sheets
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(["bw", "partial", "full"] as ColorTier[]).map((tier) => (
                          <tr key={tier} className="border-t border-[#EEF1F5]">
                            <td className="px-4 py-2.5 text-[13.5px] text-[#111827]">
                              {COLOR_TIER_LABELS[tier]}
                            </td>
                            <td className="px-3 py-2.5 text-right text-[13.5px] text-[#111827]">
                              {PESO(rateFor(tier))}
                            </td>
                            <td className="px-3 py-2.5 text-right text-[13.5px] text-[#111827]">
                              {before[tier]}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[13.5px] text-[#111827]">
                              {before[tier] * copies}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-[12px] border border-[#E5E7EB] px-4 py-3">
                    {moneyRow("Printing (charged)", PESO(printingCost))}
                    {moneyRow("Add-ons", PESO(addonsCost))}
                    <div className="mt-1 border-t border-[#EEF1F5] pt-1">
                      {moneyRow("Total", PESO(storedTotal), true)}
                    </div>
                  </div>

                  <p className="text-[12.5px] leading-relaxed text-[#6B7280]">
                    Pages below 2% colour print as black &amp; white. Detection
                    can misread a page — review it before printing. Saving a
                    change updates the total
                    {counterSale
                      ? " and records it on the order."
                      : " and notifies the customer."}
                  </p>
                </>
              )}
            </div>
          )}

          {step === "pages" && analysis.status === "ready" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["bw", "Black & white"],
                    ["partial", "Partly coloured"],
                    ["full", "Fully coloured"],
                    ["marked", "Marked"],
                  ] as Array<[TierFilter, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      filter === value
                        ? "border-[#1668D9] bg-[#EAF2FF] text-[#10316B]"
                        : "border-[#D5DBE5] bg-white text-[#4B5563] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {label} · {cellCount(value)}
                  </button>
                ))}
              </div>

              <div className="grid max-h-[min(52vh,560px)] grid-cols-6 gap-1.5 overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-2.5 sm:grid-cols-8">
                {Array.from({ length: pageCount }, (_, index) => index + 1)
                  .filter((page) => {
                    if (filter === "all") return true;
                    if (filter === "marked") return !!overrides[page];
                    return effectiveTier(page) === filter;
                  })
                  .map((page) => {
                    const tier = effectiveTier(page) ?? "bw";
                    const marked = !!overrides[page];
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => cyclePage(page)}
                        title={`Page ${page} · ${Math.round(
                          analysis.percentages[page] ?? 0,
                        )}% colour · ${COLOR_TIER_LABELS[tier]}`}
                        aria-label={`Page ${page}, ${COLOR_TIER_LABELS[tier]}, ${Math.round(
                          analysis.percentages[page] ?? 0,
                        )} percent colour`}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-1 ${tierClass(tier)} ${
                          marked ? "ring-2 ring-[#1668D9] ring-offset-1" : ""
                        }`}
                      >
                        {page}
                        <span className="text-[9.5px] font-medium opacity-70">
                          {Math.round(analysis.percentages[page] ?? 0)}%
                        </span>
                      </button>
                    );
                  })}
              </div>

              <div className="rounded-[12px] border border-[#E5E7EB] p-4">
                <p className="text-[13px] font-semibold text-[#111827]">
                  Mark a range
                </p>
                <div className="mt-2.5 flex flex-wrap items-end gap-2">
                  <div className="w-[76px]">
                    <Label className="text-[11.5px] text-[#6B7280]">From</Label>
                    <input
                      inputMode="numeric"
                      value={rangeFrom}
                      onChange={(event) =>
                        setRangeFrom(event.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="1"
                      className="mt-1 h-9 w-full rounded-[10px] border border-[#D5DBE5] px-2.5 text-[13.5px] text-[#111827] focus:border-[#1668D9] focus:outline-none focus:ring-[3px] focus:ring-[#1668D9]/20"
                    />
                  </div>
                  <div className="w-[76px]">
                    <Label className="text-[11.5px] text-[#6B7280]">To</Label>
                    <input
                      inputMode="numeric"
                      value={rangeTo}
                      onChange={(event) =>
                        setRangeTo(event.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder={String(pageCount)}
                      className="mt-1 h-9 w-full rounded-[10px] border border-[#D5DBE5] px-2.5 text-[13.5px] text-[#111827] focus:border-[#1668D9] focus:outline-none focus:ring-[3px] focus:ring-[#1668D9]/20"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto h-9 px-3 text-[13px]"
                    onClick={applyRange}
                    disabled={!rangeFrom || !rangeTo}
                  >
                    Mark
                  </Button>
                </div>
                {/* The tier is chosen inline: a list that floats over this card
                    is clipped by the dialog's own scroll container and the
                    browser scrolls the panel to reveal it, so the whole card
                    jumps. Static chips cannot move anything. */}
                <Label className="mt-3 block text-[11.5px] text-[#6B7280]">
                  Mark those pages as
                </Label>
                <div
                  role="group"
                  aria-label="Colour tier to mark"
                  className="mt-1.5 flex flex-wrap gap-2"
                >
                  {(["bw", "partial", "full"] as ColorTier[]).map((tier) => {
                    const active = rangeTier === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setRangeTier(tier)}
                        className={`h-9 flex-1 whitespace-nowrap rounded-[10px] border px-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] ${
                          active
                            ? `${tierClass(tier)} ring-2 ring-[#1668D9]`
                            : "border-[#D5DBE5] bg-white text-[#4B5563] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        {COLOR_TIER_LABELS[tier]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-semibold text-[#111827]">
                  Marked so far
                </p>
                {changes.length === 0 ? (
                  <p className="mt-2 text-[13px] text-[#6B7280]">
                    No pages changed. Every page keeps its detected tier.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#EEF1F5] rounded-[12px] border border-[#E5E7EB]">
                    {changes.map((change) => (
                      <li
                        key={change.page}
                        className="flex items-center gap-3 px-3.5 py-2.5"
                      >
                        <span className="w-[58px] shrink-0 text-[13px] font-semibold text-[#111827]">
                          Page {change.page}
                        </span>
                        <span className="min-w-0 flex-1 text-[12.5px] text-[#4B5563]">
                          {COLOR_TIER_LABELS[change.from]} →{" "}
                          {COLOR_TIER_LABELS[change.to]}
                        </span>
                        <span
                          className={`text-[12.5px] font-semibold ${
                            change.amount < 0 ? "text-[#14532D]" : "text-[#991B1B]"
                          }`}
                        >
                          {change.amount < 0 ? "−" : "+"}
                          {PESO(Math.abs(change.amount))}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOverrides((current) => {
                              const next = { ...current };
                              delete next[change.page];
                              return next;
                            })
                          }
                          aria-label={`Undo page ${change.page}`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                        >
                          <Undo2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {step === "adjust" && analysis.status === "ready" && (
            <div className="space-y-4">
              <div className="divide-y divide-[#EEF1F5] rounded-[12px] border border-[#E5E7EB]">
                {ranges.map((range) => (
                  <div
                    key={`${range.start}-${range.end}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="w-[92px] shrink-0 text-[13.5px] font-semibold text-[#111827]">
                      {range.end > range.start
                        ? `Pages ${range.start}-${range.end}`
                        : `Page ${range.start}`}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] text-[#4B5563]">
                      {COLOR_TIER_LABELS[range.from]} →{" "}
                      {COLOR_TIER_LABELS[range.to]}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        range.amount < 0 ? "text-[#14532D]" : "text-[#991B1B]"
                      }`}
                    >
                      {range.amount < 0 ? "−" : "+"}
                      {PESO(Math.abs(range.amount))}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-[12px] border border-[#E5E7EB] px-4 py-3">
                <div className="flex items-baseline justify-between gap-3 pb-2">
                  <span className="text-[13px] text-[#6B7280]">Tier counts</span>
                  <span className="text-[12.5px] text-[#4B5563]">
                    {after.bw} B&amp;W · {after.partial} partial · {after.full} full
                  </span>
                </div>
                <div className="border-t border-[#EEF1F5] pt-1">
                  {moneyRow("Original total", PESO(storedTotal))}
                  {moneyRow("New total", PESO(adjustedTotal), true)}
                </div>
                <div className="mt-2 rounded-[10px] bg-[#F4F8FE] px-3 py-2">
                  <p className="text-[12.5px] leading-relaxed text-[#1F4E9C]">
                    {settlement} Nothing is charged or refunded online.
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-[13px] font-semibold text-[#111827]">
                  Reason for change
                </Label>
                {/* The reason is chosen from a standing list, not a dropdown:
                    a floating list is clipped by this dialog's own scroll
                    container and the browser scrolls the panel to reveal it,
                    so the whole card jumps when it opens. */}
                <div
                  role="group"
                  aria-label="Reason for change"
                  className="mt-1.5 space-y-1.5"
                >
                  {PRICE_REASONS.map((value) => {
                    const active = reason === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setReason(value)}
                        className={`flex h-9 w-full items-center gap-2.5 rounded-[10px] border px-3 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] ${
                          active
                            ? "border-[#9CBBEC] bg-[#F4F8FE] font-semibold text-[#1F4E9C]"
                            : "border-[#D5DCE6] bg-white text-[#4B5563] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                            active ? "border-[#2F6FD6]" : "border-[#C3CBD8]"
                          }`}
                        >
                          {active && (
                            <span className="size-2 rounded-full bg-[#2F6FD6]" />
                          )}
                        </span>
                        {value}
                      </button>
                    );
                  })}
                </div>
                <Label className="mt-3 block text-[13px] font-semibold text-[#111827]">
                  Note{" "}
                  <span className="font-normal text-[#6B7280]">(optional)</span>
                </Label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Anything the customer or the next reviewer should know."
                  className="mt-1.5 min-h-[64px] text-[13.5px]"
                />
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-[#E5E7EB] px-4 py-3">
                {moneyRow("Original total", PESO(storedTotal))}
                {moneyRow("New total", PESO(adjustedTotal), true)}
                {moneyRow("Settlement", settlement)}
                {moneyRow(
                  "Pages changed",
                  `${changes.length} ${changes.length === 1 ? "page" : "pages"}`,
                )}
                {moneyRow("Reason", reason || "—")}
              </div>
              <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {hasCustomerAccount(order) ? "Customer notification" : "Order record"}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#111827]">
                  {orderLabel(order)} {hasCustomerAccount(order) ? "was" : "is"}{" "}
                  repriced from {PESO(storedTotal)} to {PESO(adjustedTotal)}.{" "}
                  {!hasCustomerAccount(order) &&
                    `${counterSale ? "This is a counter sale with no customer account" : "This order has no customer account"}, so the change is written to the order and the audit trail. `}
                  {settlement} Reason: {reason}.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E7EB] px-6 py-4">
          {step === "summary" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-[13px]"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {analysis.status === "ready" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 text-[13px]"
                      onClick={() => setStep("pages")}
                    >
                      Mark pages
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3 text-[13px]"
                      onClick={confirmAsIs}
                    >
                      Confirm as is
                    </Button>
                  </>
                )}
                {analysis.status !== "ready" && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-3 text-[13px]"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === "pages" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-[13px]"
                onClick={() => setStep("summary")}
              >
                <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                className="ml-auto h-9 px-3 text-[13px]"
                disabled={changes.length === 0}
                onClick={() => setStep("adjust")}
              >
                Apply {changes.length} page
                {changes.length === 1 ? " change" : " changes"}
              </Button>
            </div>
          )}

          {step === "adjust" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-[13px]"
                onClick={() => setStep("pages")}
              >
                <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                className="ml-auto h-9 px-3 text-[13px]"
                disabled={!reason}
                onClick={() => setStep("confirm")}
              >
                Review change
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-[13px]"
                disabled={saving}
                onClick={() => setStep("adjust")}
              >
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                Keep current price
              </Button>
              <Button
                type="button"
                size="sm"
                className="ml-auto h-9 px-3 text-[13px]"
                loading={saving}
                loadingText="Saving…"
                onClick={confirmChange}
              >
                Confirm new price
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
