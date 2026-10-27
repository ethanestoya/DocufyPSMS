import React, { useState } from "react";
import {
  FileText,
  Download,
  FileImage,
  FileSpreadsheet,
  Presentation,
  File,
  Eye,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { formatPHDate, formatPHTime } from "../../utils/pht";
import {
  BUCKETS,
  getSignedObjectUrl,
  downloadObjectToBlob,
} from "../../../lib/db/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

interface AttachedFile {
  name: string;
  size: string;
  type: string;
  url?: string;
  storagePath?: string;
  uploadedAt?: string;
  // Optional print spec, used by the "card" appearance to state what the file
  // is actually going to be printed as ("14 pages · Short paper · 1 copy").
  // Absent on older orders — the row then falls back to the file size.
  pages?: number;
  paperSize?: string;
  copies?: number;
  colorMode?: string;
}

interface FileAttachmentsProps {
  files: AttachedFile[];
  orderId: string;
  showDownload?: boolean; // defaults to false — hides download on customer-facing views
  showView?: boolean; // show a "View" button that opens the file in a new tab (native viewer)
  // Name of the staff/admin currently holding the order's SESSION LOCK. While
  // set, View/Download are blocked so two people can't pull the same document
  // at once; clicking one explains why instead of silently doing nothing.
  // Left undefined by consumers with no session locks (customer Order Tracking).
  lockedBy?: string | null;
  // Render the actions as labelled controls ("View" pill + download icon) for
  // mobile detail sheets, instead of the default icon-only squares.
  labelledActions?: boolean;
  // "list" (default) is the compact row used by the customer order view and the
  // mobile sheets. "card" is the single-file presentation used by the staff
  // Order Details dialog: a large file tile, the name, what it prints as, and
  // two labelled actions beneath.
  appearance?: "list" | "card";
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

function getFileCategory(
  file: AttachedFile,
):
  | "pdf"
  | "image"
  | "spreadsheet"
  | "presentation"
  | "document"
  | "text"
  | "other" {
  const ext = getFileExtension(file.name);
  const type = file.type.toLowerCase();
  if (ext === "pdf" || type.includes("pdf")) return "pdf";
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
      ext,
    ) ||
    type.includes("image")
  )
    return "image";
  if (
    ["xls", "xlsx", "csv"].includes(ext) ||
    type.includes("spreadsheet") ||
    type.includes("excel")
  )
    return "spreadsheet";
  if (
    ["ppt", "pptx"].includes(ext) ||
    type.includes("presentation") ||
    type.includes("powerpoint")
  )
    return "presentation";
  if (
    ["doc", "docx"].includes(ext) ||
    type.includes("word") ||
    type.includes("document")
  )
    return "document";
  if (["txt", "md"].includes(ext) || type.includes("text"))
    return "text";
  return "other";
}

function FileIcon({
  file,
  size = "sm",
}: {
  file: AttachedFile;
  size?: "sm" | "lg";
}) {
  const cat = getFileCategory(file);
  const cls = size === "lg" ? "w-12 h-12" : "w-5 h-5";
  switch (cat) {
    case "pdf":
      return <FileText className={`${cls} text-red-500`} />;
    case "image":
      return <FileImage className={`${cls} text-blue-500`} />;
    case "spreadsheet":
      return (
        <FileSpreadsheet className={`${cls} text-blue-600`} />
      );
    case "presentation":
      return (
        <Presentation className={`${cls} text-blue-500`} />
      );
    case "document":
      return <FileText className={`${cls} text-[#1668D9]`} />;
    case "text":
      return <FileText className={`${cls} text-gray-500`} />;
    default:
      return <File className={`${cls} text-gray-500`} />;
  }
}

function FileBadgeColor(file: AttachedFile): string {
  switch (getFileCategory(file)) {
    case "pdf":
      return "bg-red-50 text-red-700 border-red-200";
    case "image":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "spreadsheet":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "presentation":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "document":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

function formatUploadDate(iso?: string): string {
  if (!iso) return "Unknown";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${formatPHDate(date, "short")} ${formatPHTime(date, { hour12: true })}`;
  } catch {
    return iso;
  }
}

// ─── Main FileAttachments Component ────────────────────────────────────────
export function FileAttachments({
  files,
  orderId,
  showDownload = false,
  showView = false,
  lockedBy = null,
  labelledActions = false,
  appearance = "list",
}: FileAttachmentsProps) {
  // A live lock held by someone else blocks the file actions.
  const actionsLocked = !!lockedBy;
  const [lockNoticeOpen, setLockNoticeOpen] = useState(false);
  if (!files || files.length === 0) return null;

  // Resolve the read URL for a file: prefers an authenticated signed URL (the
  // order-files bucket is private), falling back to the stored public URL.
  const resolveFileUrl = async (file: AttachedFile): Promise<string | null> => {
    if (file.storagePath) {
      const signed = await getSignedObjectUrl(BUCKETS.orderFiles, file.storagePath);
      if (signed) return signed;
      toast.error("Couldn't load this file from the server. Please try again.");
      return null;
    }
    return file.url || null;
  };

  const handleDownload = async (file: AttachedFile) => {
    if (file.storagePath) {
      const result = await downloadObjectToBlob(BUCKETS.orderFiles, file.storagePath);
      if (result) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name || result.name;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Downloading ${file.name}…`);
        return;
      }
      toast.error("Couldn't download this file. Please try again.");
      return;
    }
    if (!file.url) {
      toast.info("No document available to download in this session.");
      return;
    }
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.target = "_blank";
    a.rel = "noopener,noreferrer";
    a.click();
    toast.success(`Downloading ${file.name}…`);
  };

  // Open the document in a new tab using the browser's native PDF viewer (no download).
  const handleView = async (file: AttachedFile) => {
    const url = await resolveFileUrl(file);
    if (!url) return;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener,noreferrer";
      a.click();
    }
  };

  // When another staff/admin holds the order's session lock, the file actions
  // explain the block instead of opening the document. This is deliberately NOT
  // a real `disabled` attribute — a disabled button swallows the click, so the
  // person would get no feedback at all and assume the button is broken.
  const guardLockedAction = () => setLockNoticeOpen(true);

  // Literal class strings (not interpolated) so Tailwind's scanner keeps them.
  const actionBtnBase =
    "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all";
  const actionBtnCls = actionsLocked
    ? `${actionBtnBase} border-gray-200 bg-gray-50 text-gray-300`
    : `${actionBtnBase} border-gray-300 text-gray-600 hover:text-[#1668D9] hover:border-[#1668D9] hover:bg-[#F2F7FF]`;
  // Labelled variant (mobile sheets): a "View" pill next to the icon buttons.
  const viewLabelCls = actionsLocked
    ? "inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-300"
    : "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CDE0FA] bg-[#F4F8FF] px-2.5 text-[11px] font-semibold text-[#1668D9] transition-colors hover:bg-[#1668D9] hover:text-white hover:border-[#1668D9]";
  const lockTitle = `${lockedBy} is viewing this order`;

  // "card" appearance (staff Order Details). Complete literals so Tailwind's
  // scanner keeps them.
  const cardActionCls = actionsLocked
    ? "inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-[13px] font-semibold text-[#9CA3AF]"
    : "inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#D5DBE5] bg-white px-4 text-[13px] font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2";

  return (
    <div className={appearance === "card" ? "space-y-4" : "space-y-2"}>
      {files.map((file, index) => {
        const badgeCls = FileBadgeColor(file);
        const ext = getFileExtension(file.name).toUpperCase();

        if (appearance === "card") {
          // What this file prints as, e.g. "14 pages · Short paper · 1 copy".
          const spec = [
            file.pages
              ? `${file.pages} ${file.pages === 1 ? "page" : "pages"}`
              : null,
            file.paperSize
              ? `${file.paperSize.charAt(0).toUpperCase()}${file.paperSize.slice(1)} paper`
              : null,
            file.copies
              ? `${file.copies} ${file.copies === 1 ? "copy" : "copies"}`
              : null,
            file.colorMode
              ? file.colorMode === "bw"
                ? "Black & white"
                : "Color"
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={index}
              className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
              >
                <span
                  className={`text-[13px] font-bold tracking-tight ${
                    getFileCategory(file) === "pdf"
                      ? "text-[#DC2626]"
                      : "text-[#1D4ED8]"
                  }`}
                >
                  {ext || file.type}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="break-words text-[15px] font-semibold leading-snug text-[#111827]">
                  {file.name}
                </p>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  {spec || file.size}
                </p>

                <div className="mt-3 flex flex-wrap gap-2.5">
                  {showView && (
                    <button
                      type="button"
                      onClick={
                        actionsLocked ? guardLockedAction : () => handleView(file)
                      }
                      aria-disabled={actionsLocked || undefined}
                      title={actionsLocked ? lockTitle : `Preview ${file.name}`}
                      className={cardActionCls}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      Preview
                    </button>
                  )}
                  {showDownload && (
                    <button
                      type="button"
                      onClick={
                        actionsLocked
                          ? guardLockedAction
                          : () => handleDownload(file)
                      }
                      aria-disabled={actionsLocked || undefined}
                      title={
                        actionsLocked ? lockTitle : `Download ${file.name}`
                      }
                      className={cardActionCls}
                    >
                      <Download className="size-4" aria-hidden="true" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={index}
            className="group flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-[#1668D9] hover:shadow-sm transition-all"
          >
            {/* File icon */}
            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
              <FileIcon file={file} size="sm" />
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeCls}`}
                >
                  {ext || file.type}
                </span>
                <span className="text-xs text-gray-500">
                  {file.size}
                </span>
                {file.uploadedAt && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {formatUploadDate(file.uploadedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* View — opens the document in a new tab (labelled in sheets) */}
              {showView && (
                <button
                  onClick={actionsLocked ? guardLockedAction : () => handleView(file)}
                  aria-disabled={actionsLocked || undefined}
                  title={actionsLocked ? lockTitle : `View ${file.name}`}
                  className={labelledActions ? viewLabelCls : actionBtnCls}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {labelledActions && <span>View</span>}
                </button>
              )}
              {/* Download icon button — only shown when showDownload is true */}
              {showDownload && (
                <button
                  onClick={actionsLocked ? guardLockedAction : () => handleDownload(file)}
                  aria-disabled={actionsLocked || undefined}
                  title={actionsLocked ? lockTitle : `Download ${file.name}`}
                  className={actionBtnCls}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Shown when View/Download is clicked while another staff/admin holds
          this order's session lock. */}
      <Dialog open={lockNoticeOpen} onOpenChange={setLockNoticeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 ring-2 ring-amber-200">
              <Lock className="h-5 w-5 text-amber-700" />
            </div>
            <DialogTitle className="text-center text-lg font-semibold text-[#1c1f26]">
              Order is being viewed
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed">
              <span className="font-semibold text-gray-900">{lockedBy}</span> is
              currently viewing this order, so its files can&apos;t be opened or
              downloaded. They become available again once they finish with it or
              their session lock expires.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setLockNoticeOpen(false)}
              className="w-full"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
