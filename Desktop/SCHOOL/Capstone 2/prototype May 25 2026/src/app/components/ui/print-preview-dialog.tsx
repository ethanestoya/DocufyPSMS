import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";

interface PrintOptions {
  paperType: string;
  paperSize: string;
  printType: string;
  copies: number;
  orientation?: "portrait" | "landscape";
  pages?: string;
  pagesPerSheet?: string;
  twoSided?: string;
  pageRange?: string;
  specificPages?: string;
}

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  pageCount?: number;
  options: PrintOptions;
}

export function PrintPreviewDialog({
  open,
  onOpenChange,
  fileName,
  pageCount = 1,
  options,
}: PrintPreviewDialogProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  const getPaperDimensions = () => {
    if (options.paperSize === "Long") {
      return options.orientation === "landscape"
        ? { width: 13, height: 8.5 }
        : { width: 8.5, height: 13 };
    }
    // Default/Short
    return options.orientation === "landscape"
      ? { width: 11, height: 8.5 }
      : { width: 8.5, height: 11 };
  };

  const dimensions = getPaperDimensions();
  const isColored = options.printType
    .toLowerCase()
    .includes("color");
  const pageContent = (() => {
    const variations = [
      {
        lines: 15,
        hasImage: isColored && currentPage % 2 === 0,
        gradient: "from-blue-200 to-blue-300",
      },
      {
        lines: 18,
        hasImage: isColored && currentPage % 3 === 0,
        gradient: "from-blue-300 to-blue-400",
      },
      {
        lines: 16,
        hasImage: isColored,
        gradient: "from-blue-200 to-blue-500",
      },
    ];
    return variations[(currentPage - 1) % variations.length];
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* FIX: Used h-[90vh] and p-0 to allow the workspace to fill the area.
          Added overflow-hidden to prevent the whole window from scrolling.
      */}
      <DialogContent className="max-w-[95vw] w-full lg:max-w-7xl h-[90vh] p-0 overflow-hidden flex flex-col gap-0 border-none shadow-2xl">
        <DialogDescription className="sr-only">
          Preview of {fileName} with {pageCount} pages before printing
        </DialogDescription>
        {/* TOP TOOLBAR - Pinned */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b shrink-0 z-10">
          <div className="flex items-center gap-3">
            <DialogTitle className="sr-only">
              Print Preview
            </DialogTitle>
          </div>

          {/* Pagination Controls in Header for better UX */}
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-md p-1 border">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.max(1, prev - 1),
                  )
                }
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-bold px-3 min-w-[80px] text-center">
                Page {currentPage} of {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(pageCount, prev + 1),
                  )
                }
                disabled={currentPage === pageCount}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="h-6 w-px bg-gray-200 mx-1" />

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setZoom((z) => Math.max(50, z - 25))
                }
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-bold w-12 text-center">
                {zoom}%
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setZoom((z) => Math.min(150, z + 25))
                }
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* MAIN BODY - Split View */}
        <div className="flex-1 flex overflow-hidden bg-slate-100">
          {/* PREVIEW WORKSPACE - Dark background to highlight the white paper */}
          <main className="flex-1 overflow-auto p-12 flex justify-center items-start custom-scrollbar">
            <div
              className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative transition-all duration-300 origin-top mb-12"
              style={{
                width: `${(dimensions.width * 60 * zoom) / 100}px`,
                aspectRatio: `${dimensions.width} / ${dimensions.height}`,
              }}
            >
              {/* Paper Content */}
              <div className="p-[10%] h-full flex flex-col pointer-events-none select-none">
                <div className="space-y-4">
                  <div
                    className={`h-[4%] rounded ${isColored ? "bg-green-600" : "bg-gray-800"}`}
                    style={{ width: "60%" }}
                  />
                  <div className="h-[1.5%] bg-gray-200 rounded w-[40%]" />

                  <div className="space-y-3 py-6">
                    {[...Array(pageContent.lines)].map(
                      (_, i) => (
                        <div
                          key={i}
                          className="h-1.5 bg-gray-100 rounded"
                          style={{
                            width: i % 5 === 0 ? "80%" : "100%",
                            backgroundColor:
                              isColored && i % 4 === 0
                                ? "#dbeafe"
                                : "#f3f4f6",
                          }}
                        />
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center opacity-50">
                  <span className="text-[10px] font-medium">
                    {fileName}
                  </span>
                  <span className="text-[10px] font-bold">
                    Page {currentPage}
                  </span>
                </div>
              </div>

              {/* Badges pinned to paper for visual flair */}
              <div className="absolute -top-3 -right-3 z-20"></div>
            </div>
          </main>

          {/* SETTINGS SIDEBAR - Pinned Right */}
          <aside className="w-80 bg-white border-l overflow-y-auto hidden lg:flex flex-col shrink-0">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Print Configuration
                </h3>
                <div className="space-y-3">
                  <SettingItem
                    label="Paper Size"
                    value={options.paperSize}
                  />
                  <SettingItem
                    label="Print Type"
                    value={options.printType}
                    color={isColored ? "text-blue-600" : ""}
                  />
                  <SettingItem
                    label="Orientation"
                    value={options.orientation || "Portrait"}
                  />
                  <SettingItem
                    label="Copies"
                    value={options.copies.toString()}
                  />
                  {options.pagesPerSheet && (
                    <SettingItem
                      label="Pages/Sheet"
                      value={options.pagesPerSheet}
                    />
                  )}
                  {options.twoSided && (
                    <SettingItem
                      label="Two-Sided"
                      value={options.twoSided}
                    />
                  )}
                  {options.pageRange && options.pageRange !== "All" && (
                    <SettingItem
                      label="Page Range"
                      value={options.pageRange}
                    />
                  )}
                  {options.specificPages && (
                    <SettingItem
                      label="Specific Pages"
                      value={options.specificPages}
                    />
                  )}
                </div>
              </div>
              <div className="pt-6 border-t">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-gray-900">
                    Final Calculation
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {pageCount} Pages × {options.copies} Copies
                </p>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border text-center">
                  <span className="text-2xl font-black text-gray-900">
                    {pageCount * options.copies}
                  </span>
                  <span className="ml-2 text-xs font-bold text-gray-500 uppercase">
                    Total Sheets
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* ACTION FOOTER - Pinned */}
        <footer className="px-6 py-4 bg-white border-t flex items-center justify-end shrink-0">
          <Button
            variant="outline"
            className="font-bold"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for cleaner sidebar code
function SettingItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50">
      <span className="text-xs font-semibold text-gray-500">
        {label}
      </span>
      <span
        className={`text-xs font-bold ${color || "text-gray-900"} capitalize`}
      >
        {value}
      </span>
    </div>
  );
}