import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "./dialog";
import { Button } from "./button";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText,
  Loader2, AlertCircle, ChevronDown, ChevronUp, Settings2,
  Layers,
} from "lucide-react";

// ── PDF.js CDN loader ─────────────────────────────────────────────────────────
const PDF_JS_CDN    = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;
  if ((window as any).pdfjsLib) {
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;
    pdfjsPromise = Promise.resolve((window as any).pdfjsLib);
    return pdfjsPromise;
  }
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDF_JS_CDN; s.async = true;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error("PDF.js failed to load")); return; }
      lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_CDN;
      resolve(lib);
    };
    s.onerror = () => reject(new Error("PDF.js CDN unreachable"));
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

// ── Paper dimension map (mm) ──────────────────────────────────────────────────
const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  a4:     { w: 210,   h: 297   },
  a5:     { w: 148,   h: 210   },
  a3:     { w: 297,   h: 420   },
  short:  { w: 215.9, h: 279.4 },
  letter: { w: 215.9, h: 279.4 },
  long:   { w: 215.9, h: 355.6 },
  legal:  { w: 215.9, h: 355.6 },
};
function getPaperDims(paperSize: string, orientation: string) {
  const b = PAPER_DIMS[paperSize.toLowerCase()] ?? PAPER_DIMS["a4"];
  return orientation === "landscape" ? { w: b.h, h: b.w } : { w: b.w, h: b.h };
}

// ── Margin config ─────────────────────────────────────────────────────────────
type MarginMode = "default" | "none" | "minimum" | "custom";
const MARGIN_INCH: Record<MarginMode, number> = {
  default: 1, none: 0, minimum: 0.25, custom: 1,
};
const MARGIN_LABEL: Record<MarginMode, string> = {
  default: "Default (1 in)", none: "None (0 in)", minimum: "Minimum (0.25 in)", custom: "Custom",
};

// ── Pages-per-sheet grid config ───────────────────────────────────────────────
const PPS_GRID: Record<number, { cols: number; rows: number }> = {
  1: { cols: 1, rows: 1 }, 2: { cols: 1, rows: 2 },
  4: { cols: 2, rows: 2 }, 6: { cols: 2, rows: 3 }, 9: { cols: 3, rows: 3 },
};

// ── Scale config ──────────────────────────────────────────────────────────────
type ScaleMode = "fit" | "actual" | "fill" | "custom";
const SCALE_LABELS: Record<ScaleMode, string> = {
  fit: "Fit to Printable Area", actual: "Actual Size (100%)",
  fill: "Fit to Paper", custom: "Custom %",
};

// ── Tier rates ────────────────────────────────────────────────────────────────
interface TierRates {
  bw: number;          // ₱/page — B&W
  lowColor: number;    // ₱/page — color ≤50%
  highColor: number;   // ₱/page — color >50%
  longSurcharge: number;  // extra ₱/page for long/legal
  a3Surcharge: number;    // extra ₱/page for A3
  duplex: number;         // ₱ savings per page when two-sided
}
const DEFAULT_TIER_RATES: TierRates = {
  bw: 1, lowColor: 3, highColor: 5, longSurcharge: 11, a3Surcharge: 1.5, duplex: 0.5,
};

// ── Color analysis type (mirrors NewPrintRequest) ─────────────────────────────
interface ColorAnalysis {
  totalPages: number;
  colorPages: number[];
  bwPages: number[];
  colorPercentages: { [page: number]: number };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PrintOptions {
  paperType?: string;
  paperSize: string;
  printType: string;
  copies: number;
  orientation?: "portrait" | "landscape";
  pagesPerSheet?: string;
  twoSided?: string;
  pageRange?: string;
  specificPages?: string;
}

export interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file?: File;
  fileName: string;
  pageCount?: number;
  options: PrintOptions;
  colorAnalysis?: ColorAnalysis;
  userRole?: "customer" | "staff" | "admin";
  /** Shows order ID in toolbar and scopes context */
  orderId?: string;
  /** Hides interactive page-setup controls — for customer read-only views */
  readOnly?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function renderPageToDataUrl(doc: any, pageNum: number, targetW: number): Promise<string> {
  const page     = await doc.getPage(pageNum);
  const natural  = page.getViewport({ scale: 1 });
  const scale    = targetW / natural.width;
  const vp       = page.getViewport({ scale });
  const offscreen = document.createElement("canvas");
  offscreen.width  = vp.width;
  offscreen.height = vp.height;
  const ctx = offscreen.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return offscreen.toDataURL("image/jpeg", 0.88);
}

function calcEstimatedCost(
  totalPg: number, copies: number, pps: number, printType: string,
  twoSided: string, paperSize: string, colorAnalysis: ColorAnalysis | undefined,
  rates: TierRates,
): number {
  const isColor    = printType.toLowerCase().includes("color");
  const isLong     = paperSize === "long" || paperSize === "legal";
  const isA3       = paperSize === "a3";
  const duplexSave = twoSided === "yes" ? rates.duplex : 0;

  let basePerPage = (p: number, colorPct: number): number => {
    let r = isColor
      ? (colorPct > 50 ? rates.highColor : colorPct > 0 ? rates.lowColor : rates.bw)
      : rates.bw;
    if (isLong) r += rates.longSurcharge;
    if (isA3)   r += rates.a3Surcharge;
    r -= duplexSave;
    return Math.max(0.5, r);
  };

  let costPerSheet = 0;
  if (isColor && colorAnalysis) {
    let total = 0;
    for (let i = 1; i <= colorAnalysis.totalPages; i++) {
      const pct = colorAnalysis.colorPercentages[i] ?? 0;
      total += basePerPage(i, pct);
    }
    costPerSheet = total / pps;
  } else {
    costPerSheet = basePerPage(0, isColor ? 60 : 0) * Math.ceil(totalPg / pps);
  }

  return costPerSheet * copies;
}

// ── Main component ────────────────────────────────────────────────────────────
export function PrintPreviewDialog({
  open, onOpenChange,
  file, fileName, pageCount = 1,
  options, colorAnalysis, userRole,
  orderId, readOnly = false,
}: PrintPreviewDialogProps) {

  // Core canvas / document state
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(pageCount);
  const [zoom,         setZoom]         = useState(100);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [imageUrl,     setImageUrl]     = useState<string | null>(null);
  const [pdfDoc,       setPdfDoc]       = useState<any>(null);
  const [pageImages,   setPageImages]   = useState<Record<number, string>>({});
  const [renderingGrid, setRenderingGrid] = useState(false);

  // ── Page-setup controls (local to preview modal) ──────────────────────────
  const [marginMode,     setMarginMode]     = useState<MarginMode>("default");
  const [customMarginIn, setCustomMarginIn] = useState(0.5);
  const [previewPps,     setPreviewPps]     = useState<number>(
    parseInt(options.pagesPerSheet ?? "1") || 1,
  );
  const [scaleMode,      setScaleMode]      = useState<ScaleMode>("fit");
  const [customScalePct, setCustomScalePct] = useState(100);

  // ── Tier rates (admin/staff editable) ────────────────────────────────────
  const [tierRates, setTierRates] = useState<TierRates>({ ...DEFAULT_TIER_RATES });
  const [showTierPanel, setShowTierPanel] = useState(false);

  // ── Derived values ────────────────────────────────────────────────────────
  const isColored  = options.printType.toLowerCase().includes("color");
  const dims       = getPaperDims(options.paperSize, options.orientation ?? "portrait");
  const BASE_PX    = 520;
  const paperW     = BASE_PX;
  const paperH     = Math.round((dims.h / dims.w) * BASE_PX);

  const effectiveMarginIn = marginMode === "custom" ? customMarginIn : MARGIN_INCH[marginMode];
  // margin as fraction of paper width (at 8.5in reference)
  const marginPct  = (effectiveMarginIn / dims.w) * 25.4; // approx %, using mm
  // actual margin in display-px for the current paper width
  const marginPx   = Math.round((effectiveMarginIn / (dims.w / 25.4)) * paperW);

  const grid       = PPS_GRID[previewPps] ?? PPS_GRID[1];
  const cellW      = Math.floor((paperW - marginPx * 2) / grid.cols);
  const cellH      = Math.floor((paperH - marginPx * 2) / grid.rows);

  const sheetsTotal     = Math.ceil(totalPages / previewPps);
  const currentSheet    = Math.ceil(currentPage / previewPps);
  const sheetStartPage  = (currentSheet - 1) * previewPps + 1;

  const isImage = file?.type.startsWith("image/");
  const isPdf   = file?.type === "application/pdf";
  const isOther = file && !isImage && !isPdf;

  const canEdit = userRole === "admin" || userRole === "staff";

  const estimatedCost = calcEstimatedCost(
    totalPages, options.copies, previewPps,
    options.printType, options.twoSided ?? "no",
    options.paperSize, colorAnalysis, tierRates,
  );

  // ── Content scale multiplier ──────────────────────────────────────────────
  function getContentScaleMultiplier(naturalW: number): number {
    const printableW = paperW - marginPx * 2;
    switch (scaleMode) {
      case "fit":    return printableW / naturalW;
      case "fill":   return paperW / naturalW;
      case "actual": return 1;
      case "custom": return (customScalePct / 100) * (printableW / naturalW);
    }
  }

  // ── Reset on open/close ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      if (imageUrl) { URL.revokeObjectURL(imageUrl); setImageUrl(null); }
      setPdfDoc(null); setPageImages({});
      setCurrentPage(1); setError(null); setLoading(false);
    }
  }, [open]);

  // ── Load file ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !file) return;
    if (isImage) {
      const url = URL.createObjectURL(file);
      setImageUrl(url); setTotalPages(1);
      return () => URL.revokeObjectURL(url);
    }
    if (isPdf) {
      setLoading(true); setError(null);
      let cancelled = false;
      loadPdfJs()
        .then(lib => file.arrayBuffer().then(buf => cancelled ? null : lib.getDocument({ data: buf }).promise))
        .then((doc: any) => {
          if (cancelled || !doc) return;
          setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1); setLoading(false);
        })
        .catch((e: Error) => { if (!cancelled) { setError("Could not render: " + e.message); setLoading(false); } });
      return () => { cancelled = true; };
    }
  }, [open, file]);

  // ── Render single PDF page to main canvas ─────────────────────────────────
  const renderSinglePage = useCallback(async (doc: any, pageNum: number) => {
    if (!canvasRef.current || !doc) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (_) {}
      renderTaskRef.current = null;
    }
    try {
      const page    = await doc.getPage(pageNum);
      const natural = page.getViewport({ scale: 1 });
      const contentScale = getContentScaleMultiplier(natural.width);
      const scale   = (zoom / 100) * contentScale;
      const vp      = page.getViewport({ scale });
      const canvas  = canvasRef.current;
      const ctx     = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width  = vp.width;
      canvas.height = vp.height;
      const task = page.render({ canvasContext: ctx, viewport: vp });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (e: any) {
      if (e?.name !== "RenderingCancelledException") setError("Page render failed.");
    }
  }, [zoom, marginPx, scaleMode, customScalePct, paperW]);

  // ── Render grid of pages (pps > 1) ────────────────────────────────────────
  const renderGridPages = useCallback(async (doc: any, startPg: number) => {
    if (!doc) return;
    setRenderingGrid(true);
    const imgs: Record<number, string> = {};
    for (let i = 0; i < previewPps; i++) {
      const pg = startPg + i;
      if (pg > doc.numPages) break;
      try { imgs[pg] = await renderPageToDataUrl(doc, pg, cellW * 2); } catch (_) {}
    }
    setPageImages(imgs);
    setRenderingGrid(false);
  }, [previewPps, cellW]);

  // ── Trigger re-render when relevant state changes ─────────────────────────
  useEffect(() => {
    if (!pdfDoc || !open) return;
    if (previewPps === 1) {
      renderSinglePage(pdfDoc, currentPage);
    } else {
      renderGridPages(pdfDoc, sheetStartPage);
    }
  }, [pdfDoc, currentPage, zoom, open, previewPps, marginMode, customMarginIn, scaleMode, customScalePct]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const step = previewPps;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setCurrentPage(p => Math.min(totalPages, p + step));
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setCurrentPage(p => Math.max(1, p - step));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, totalPages, previewPps]);

  // ── Grayscale ─────────────────────────────────────────────────────────────
  const grayFilter: React.CSSProperties = !isColored
    ? { filter: "grayscale(100%)", transition: "filter 0.2s" }
    : { transition: "filter 0.2s" };

  // ── Badge string ──────────────────────────────────────────────────────────
  const scaleBadge = scaleMode === "custom" ? `${customScalePct}%` : SCALE_LABELS[scaleMode].split(" ")[0];
  const badgeText  = [
    options.paperSize.toUpperCase(),
    options.orientation ?? "Portrait",
    previewPps > 1 ? `${previewPps}/Sheet` : null,
    `Margin: ${marginMode === "custom" ? customMarginIn + " in" : MARGIN_LABEL[marginMode].split(" ")[0]}`,
    `Scale: ${scaleBadge}`,
  ].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full lg:max-w-7xl h-[90vh] p-0 overflow-hidden flex flex-col gap-0 border-none shadow-2xl">
        <DialogDescription className="sr-only">
          Print preview of {fileName} — {totalPages} pages
        </DialogDescription>

        {/* ── TOOLBAR ───────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b shrink-0 z-10 gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <DialogTitle className="sr-only">Print Preview</DialogTitle>
            <FileText className="w-4 h-4 text-[#1D73EC] shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{fileName}</span>
            {orderId && (
              <span className="text-[10px] font-mono text-gray-400 shrink-0">· {orderId}</span>
            )}

            {/* Active layout badge */}
            <span
              className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: "#F2F7FF", color: "#10316B", border: "1px solid #1D73EC30" }}
            >
              <Layers size={9} />
              {readOnly ? "Read-Only · " : ""}{badgeText}
            </span>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center bg-gray-100 rounded-md p-0.5 border">
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.max(1, p - previewPps))}
                disabled={currentPage <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[11px] font-bold px-2 min-w-[80px] text-center whitespace-nowrap">
                {previewPps > 1
                  ? `Sheet ${currentSheet} / ${sheetsTotal}`
                  : `Page ${currentPage} / ${totalPages}`}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + previewPps))}
                disabled={currentPage >= totalPages - previewPps + 1}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-5 w-px bg-gray-200" />
            {/* Zoom */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(40, z - 20))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-bold w-10 text-center">{zoom}%</span>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setZoom(z => Math.min(200, z + 20))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* ── BODY ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden bg-[#2a2a2a]">

          {/* Canvas workspace */}
          <main className="flex-1 overflow-auto p-8 flex justify-center items-start" style={{ scrollbarWidth: "thin" }}>
            {/* Paper */}
            <div
              className="relative bg-white shadow-[0_24px_64px_rgba(0,0,0,0.55)] shrink-0 mb-12 transition-all duration-200"
              style={{ width: (paperW * zoom) / 100, height: (paperH * zoom) / 100, overflow: "hidden" }}
            >
              {/* Loading */}
              {(loading || renderingGrid) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 gap-3">
                  <Loader2 className="w-7 h-7 text-[#1D73EC] animate-spin" />
                  <p className="text-xs text-gray-500 font-medium">Rendering…</p>
                </div>
              )}
              {/* Error */}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 gap-2 p-8">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                  <p className="text-xs text-red-600 font-medium text-center">{error}</p>
                </div>
              )}

              {/* ── PDF · single page ── */}
              {isPdf && !error && previewPps === 1 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    padding: (marginPx * zoom) / 100,
                    boxSizing: "border-box",
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{
                      display: "block", width: "100%", height: "100%",
                      objectFit: "contain", ...grayFilter,
                    }}
                  />
                </div>
              )}

              {/* ── PDF · grid (pps > 1) ── */}
              {isPdf && !error && previewPps > 1 && (
                <div
                  style={{
                    position: "absolute", inset: 0,
                    padding: (marginPx * zoom) / 100,
                    display: "grid",
                    gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                    gridTemplateRows:    `repeat(${grid.rows}, 1fr)`,
                    gap: Math.max(1, (zoom / 100) * 4),
                    boxSizing: "border-box",
                    background: "#e8e8e8",
                  }}
                >
                  {Array.from({ length: previewPps }).map((_, i) => {
                    const pg = sheetStartPage + i;
                    return (
                      <div
                        key={i}
                        className="bg-white overflow-hidden flex items-center justify-center"
                        style={{ border: "1px solid #d1d5db", ...grayFilter }}
                      >
                        {pg <= totalPages && pageImages[pg] ? (
                          <img
                            src={pageImages[pg]}
                            alt={`Page ${pg}`}
                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                          />
                        ) : pg <= totalPages ? (
                          <span className="text-[8px] text-gray-400">p.{pg}</span>
                        ) : (
                          <span className="text-[8px] text-gray-300">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Image ── */}
              {isImage && imageUrl && (
                <div style={{ position: "absolute", inset: 0, padding: (marginPx * zoom) / 100, boxSizing: "border-box" }}>
                  <img
                    src={imageUrl} alt={fileName}
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", ...grayFilter }}
                  />
                </div>
              )}

              {/* ── Placeholder ── */}
              {(!file || isOther) && !loading && !error && (
                <PlaceholderPage
                  fileName={fileName} currentPage={currentPage} totalPages={totalPages}
                  isColored={isColored} zoom={zoom} grayFilter={grayFilter}
                  marginPx={marginPx}
                />
              )}

              {/* Margin guides overlay (subtle dashed border) */}
              {marginMode !== "none" && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    inset: (marginPx * zoom) / 100,
                    border: "1px dashed rgba(29,115,236,0.18)",
                    borderRadius: 1,
                    zIndex: 5,
                  }}
                />
              )}
            </div>
          </main>

          {/* ── SIDEBAR ───────────────────────────────────────────────── */}
          <aside className="w-80 bg-white border-l overflow-y-auto hidden lg:flex flex-col shrink-0 text-[13px]">
            <div className="p-5 space-y-5">

              {/* Print configuration (read-only summary) */}
              <Section title="Print Configuration">
                <SettingRow label="Paper Size"   value={options.paperSize.toUpperCase()} />
                <SettingRow label="Print Type"   value={options.printType}
                  color={isColored ? "text-[#1D73EC]" : ""} />
                <SettingRow label="Orientation"  value={options.orientation ?? "Portrait"} />
                <SettingRow label="Copies"       value={String(options.copies)} />
                {options.twoSided && (
                  <SettingRow label="Two-Sided"  value={options.twoSided === "yes" ? "Double-Sided" : "Single-Sided"} />
                )}
                <div className="pt-1">
                  <div className="p-2.5 bg-[#F2F7FF] rounded-lg border border-blue-100 text-center">
                    <span className="text-xs font-bold text-[#10316B]">
                      {dims.w.toFixed(1)} × {dims.h.toFixed(1)} mm
                    </span>
                    <p className="text-[10px] text-gray-500 mt-0.5 capitalize">{options.orientation ?? "Portrait"}</p>
                  </div>
                </div>
              </Section>

              {/* ── PAGE SETUP & SCALING ─────────────────────────────── */}
              <Section title="Page Setup & Scaling">
                {readOnly ? (
                  /* Customer read-only: show fixed values from submitted options */
                  <div className="space-y-0">
                    <SettingRow label="Margin"          value="Default (1 in)" />
                    <SettingRow label="Pages per Sheet" value={`${previewPps} per sheet`} />
                    <SettingRow label="Scale"           value="Fit to Printable Area" />
                    {previewPps > 1 && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {grid.cols}×{grid.rows} grid · {sheetsTotal} physical sheet{sheetsTotal !== 1 ? "s" : ""}
                      </p>
                    )}
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[10px] text-amber-700 font-semibold">
                        Print settings are locked to your submitted configuration.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Margin */}
                    <div className="mb-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Margin
                      </label>
                      <select
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1D73EC]"
                        value={marginMode}
                        onChange={e => setMarginMode(e.target.value as MarginMode)}
                      >
                        {(Object.keys(MARGIN_LABEL) as MarginMode[]).map(m => (
                          <option key={m} value={m}>{MARGIN_LABEL[m]}</option>
                        ))}
                      </select>
                      {marginMode === "custom" && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="range" min={0} max={3} step={0.05}
                            value={customMarginIn}
                            onChange={e => setCustomMarginIn(parseFloat(e.target.value))}
                            className="flex-1 accent-[#1D73EC]"
                          />
                          <span className="text-xs font-bold text-gray-700 w-14 text-right">
                            {customMarginIn.toFixed(2)} in
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pages per Sheet */}
                    <div className="mb-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Pages per Sheet
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[1, 2, 4, 6, 9].map(n => (
                          <button
                            key={n}
                            onClick={() => { setPreviewPps(n); setCurrentPage(1); }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border"
                            style={{
                              background:  previewPps === n ? "#1D73EC" : "#f9fafb",
                              color:       previewPps === n ? "#fff"    : "#374151",
                              borderColor: previewPps === n ? "#1D73EC" : "#e5e7eb",
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      {previewPps > 1 && (
                        <p className="text-[10px] text-gray-500 mt-1.5">
                          {grid.cols}×{grid.rows} grid · {sheetsTotal} physical sheet{sheetsTotal !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    {/* Scale */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Scale
                      </label>
                      <select
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1D73EC]"
                        value={scaleMode}
                        onChange={e => setScaleMode(e.target.value as ScaleMode)}
                      >
                        {(Object.keys(SCALE_LABELS) as ScaleMode[]).map(m => (
                          <option key={m} value={m}>{SCALE_LABELS[m]}</option>
                        ))}
                      </select>
                      {scaleMode === "custom" && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="range" min={10} max={200} step={5}
                              value={customScalePct}
                              onChange={e => setCustomScalePct(parseInt(e.target.value))}
                              className="flex-1 accent-[#1D73EC]"
                            />
                            <input
                              type="number" min={10} max={200}
                              value={customScalePct}
                              onChange={e => setCustomScalePct(Math.min(200, Math.max(10, parseInt(e.target.value) || 10)))}
                              className="w-14 text-xs text-center border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-[#1D73EC]"
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Section>

              {/* ── PRICING ESTIMATE ─────────────────────────────────── */}
              <Section title="Pricing Estimate">
                <div className="space-y-1.5">
                  <SettingRow label="Doc pages"     value={String(totalPages)} />
                  <SettingRow label="Pages/Sheet"   value={String(previewPps)} />
                  <SettingRow label="Physical sheets" value={`${sheetsTotal} × ${options.copies} cop${options.copies !== 1 ? "ies" : "y"}`} />
                  <SettingRow label="Print type"    value={isColored ? "Color (tiered)" : "B&W (₱" + tierRates.bw + "/pg)"} />
                </div>

                <div className="mt-3 p-3 rounded-xl border-2 border-[#1D73EC] text-center"
                  style={{ background: "#F2F7FF" }}>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                    Estimated Total
                  </p>
                  <p className="text-2xl font-black text-[#10316B]">
                    ₱{estimatedCost.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {sheetsTotal * options.copies} sheets printed
                  </p>
                </div>

                {isColored && colorAnalysis && (
                  <div className="mt-2 space-y-1 p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-700 mb-1">Color breakdown</p>
                    {(() => {
                      const hi  = colorAnalysis.colorPages.filter(p => (colorAnalysis.colorPercentages[p] ?? 0) > 50).length;
                      const lo  = colorAnalysis.colorPages.filter(p => (colorAnalysis.colorPercentages[p] ?? 0) <= 50).length;
                      const bw  = colorAnalysis.bwPages.length;
                      return (
                        <>
                          {hi > 0  && <ColorBreakRow label={`>50% color (₱${tierRates.highColor}/pg)`} count={hi} />}
                          {lo > 0  && <ColorBreakRow label={`≤50% color (₱${tierRates.lowColor}/pg)`}  count={lo} />}
                          {bw > 0  && <ColorBreakRow label={`B&W (₱${tierRates.bw}/pg)`}              count={bw} />}
                        </>
                      );
                    })()}
                  </div>
                )}
              </Section>

              {/* ── ADMIN/STAFF TIER RATES ─────────────────────────── */}
              {canEdit && (
                <Section
                  title="Tier Rate Settings"
                  rightEl={
                    <button
                      onClick={() => setShowTierPanel(v => !v)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-[#1D73EC] hover:underline"
                    >
                      <Settings2 size={11} />
                      {showTierPanel ? "Collapse" : "Edit Rates"}
                    </button>
                  }
                >
                  {!showTierPanel ? (
                    <div className="space-y-0">
                      <SettingRow label="B&W"       value={`₱${tierRates.bw}/pg`} />
                      <SettingRow label="Low color (≤50%)"  value={`₱${tierRates.lowColor}/pg`} />
                      <SettingRow label="High color (>50%)" value={`₱${tierRates.highColor}/pg`} color="text-[#1D73EC]" />
                      <SettingRow label="Long/Legal surcharge" value={`+₱${tierRates.longSurcharge}`} />
                      <SettingRow label="A3 surcharge"        value={`+₱${tierRates.a3Surcharge}`} />
                      <SettingRow label="Duplex savings"      value={`-₱${tierRates.duplex}/pg`} />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(
                        [
                          ["bw",            "B&W (₱/page)"],
                          ["lowColor",      "Low Color ≤50% (₱/page)"],
                          ["highColor",     "High Color >50% (₱/page)"],
                          ["longSurcharge", "Long/Legal surcharge"],
                          ["a3Surcharge",   "A3 surcharge"],
                          ["duplex",        "Duplex savings"],
                        ] as [keyof TierRates, string][]
                      ).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <label className="text-[11px] text-gray-600 flex-1">{label}</label>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-400">₱</span>
                            <input
                              type="number" min={0} step={0.5}
                              value={tierRates[key]}
                              onChange={e => setTierRates(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                              className="w-16 text-xs text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#1D73EC]"
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setTierRates({ ...DEFAULT_TIER_RATES })}
                        className="w-full text-[10px] text-gray-500 underline mt-1"
                      >
                        Reset to defaults
                      </button>
                    </div>
                  )}
                </Section>
              )}

              {/* Grayscale notice */}
              {!isColored && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-500">
                    Grayscale filter active — preview reflects B&W output
                  </p>
                </div>
              )}

            </div>
          </aside>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <footer className="px-5 py-3 bg-white border-t flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-400">← → to navigate · Scroll to pan</span>
          <Button variant="outline" className="font-bold text-sm h-8" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, rightEl }: {
  title: string; children: React.ReactNode; rightEl?: React.ReactNode;
}) {
  return (
    <div className="pt-4 border-t first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
        {rightEl}
      </div>
      {children}
    </div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function SettingRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-semibold capitalize ${color ?? "text-gray-800"}`}>{value}</span>
    </div>
  );
}

// ── Color breakdown row ───────────────────────────────────────────────────────
function ColorBreakRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-blue-700">{label}</span>
      <span className="font-bold text-blue-900">{count} pg{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

// ── Placeholder (DOC/PPT/XLS/TXT) ────────────────────────────────────────────
function PlaceholderPage({
  fileName, currentPage, totalPages, isColored, zoom, grayFilter, marginPx,
}: {
  fileName: string; currentPage: number; totalPages: number;
  isColored: boolean; zoom: number; grayFilter: React.CSSProperties; marginPx: number;
}) {
  const scale = zoom / 100;
  const pad   = (marginPx * zoom) / 100;

  return (
    <div
      className="absolute inset-0 flex flex-col select-none pointer-events-none"
      style={{ padding: pad, ...grayFilter }}
    >
      {/* Heading bars */}
      <div className="mb-3 space-y-1.5">
        <div style={{ height: Math.max(5, 9 * scale), width: "65%", borderRadius: 3,
          background: isColored ? "#1D73EC" : "#1c1f26", opacity: 0.8 }} />
        <div style={{ height: Math.max(3, 6 * scale), width: "40%", borderRadius: 2, background: "#cbd5e1" }} />
      </div>
      {/* Body lines */}
      <div className="flex-1 overflow-hidden" style={{ display: "flex", flexDirection: "column", gap: Math.max(2, 3 * scale) }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            height: Math.max(2, 4 * scale), borderRadius: 2,
            width: i % 5 === 4 ? "70%" : i % 3 === 0 ? "85%" : "100%",
            background: isColored && i % 7 === 0 ? "#dbeafe" : "#f1f5f9",
          }} />
        ))}
      </div>
      {/* Footer */}
      <div className="mt-auto flex justify-between items-center" style={{ paddingTop: 6, borderTop: "1px solid #e2e8f0", opacity: 0.45 }}>
        <span style={{ fontSize: Math.max(6, 9 * scale), color: "#64748b" }} className="truncate max-w-[60%]">{fileName}</span>
        <span style={{ fontSize: Math.max(6, 9 * scale), color: "#64748b", fontWeight: 700 }}>
          {currentPage} / {totalPages}
        </span>
      </div>
      {/* Overlay badge */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-xl px-3 py-2 text-center"
          style={{ background: "rgba(255,255,255,0.9)", border: "1px solid #e2e8f0", maxWidth: "70%" }}>
          <p className="text-[11px] font-semibold text-gray-600">Live preview unavailable for this file type</p>
          <p className="text-[9px] text-gray-400 mt-0.5">PDF and image files render in real-time</p>
        </div>
      </div>
    </div>
  );
}
