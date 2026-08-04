import React, { useState } from "react";
import {
  FileText,
  Download,
  Eye,
  X,
  FileImage,
  FileSpreadsheet,
  Presentation,
  File,
  Calendar,
  HardDrive,
  Tag,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "./button";
import { toast } from "sonner";

interface AttachedFile {
  name: string;
  size: string;
  type: string;
  url?: string;
  uploadedAt?: string;
}

interface FileAttachmentsProps {
  files: AttachedFile[];
  orderId: string;
  showDownload?: boolean; // defaults to false — hides download on customer-facing views
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
      return <FileImage className={`${cls} text-purple-500`} />;
    case "spreadsheet":
      return (
        <FileSpreadsheet className={`${cls} text-green-600`} />
      );
    case "presentation":
      return (
        <Presentation className={`${cls} text-orange-500`} />
      );
    case "document":
      return <FileText className={`${cls} text-[#1D73EC]`} />;
    case "text":
      return <FileText className={`${cls} text-gray-500`} />;
    default:
      return <File className={`${cls} text-gray-400`} />;
  }
}

function FileBadgeColor(file: AttachedFile): string {
  switch (getFileCategory(file)) {
    case "pdf":
      return "bg-red-50 text-red-700 border-red-200";
    case "image":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "spreadsheet":
      return "bg-green-50 text-green-700 border-green-200";
    case "presentation":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "document":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

function formatUploadDate(iso?: string): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Simulated document preview content ────────────────────────────────────
function DocumentPreview({ file }: { file: AttachedFile }) {
  const [zoom, setZoom] = useState(100);
  const cat = getFileCategory(file);

  if (cat === "image" && file.url) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-12 text-center">
            {zoom}%
          </span>
          <button
            onClick={() =>
              setZoom((z) => Math.min(200, z + 25))
            }
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto max-h-[400px] w-full flex justify-center bg-gray-100 rounded-xl p-4">
          <img
            src={file.url}
            alt={file.name}
            style={{ width: `${zoom}%`, maxWidth: "100%" }}
            className="rounded shadow"
          />
        </div>
      </div>
    );
  }

  // Simulated document page for all non-image file types
  const lines =
    cat === "pdf" ? 22 : cat === "spreadsheet" ? 0 : 18;
  const hasTable = cat === "spreadsheet";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setZoom((z) => Math.max(60, z - 20))}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-gray-500 w-12 text-center">
          {zoom}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(150, z + 20))}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-full overflow-auto rounded-xl"
        style={{ maxHeight: "600px" }}
      >
        {/* Simulated A4 page */}
        <div
          className="mx-auto bg-white shadow-lg rounded border border-gray-200 transition-all"
          style={{
            width: `${zoom}%`,
            minWidth: "400px",
            padding: "48px 56px",
          }}
        >
          {/* Document header */}
          <div className="mb-6 pb-4 border-b-2 border-[#1D73EC]">
            <div className="flex items-center gap-3 mb-3">
              <FileIcon file={file} size="lg" />
              <div>
                <p className="font-bold text-[#10316B] text-base leading-tight">
                  {file.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  DocuFy PSMS — Palawan State University
                </p>
              </div>
            </div>
          </div>

          {hasTable ? (
            /* Spreadsheet-style preview */
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F2F7FF]">
                    {["A", "B", "C", "D", "E"].map((col) => (
                      <th
                        key={col}
                        className="border border-gray-300 px-3 py-1.5 text-center font-bold text-[#10316B]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, r) => (
                    <tr
                      key={r}
                      className={
                        r % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }
                    >
                      <td className="border border-gray-200 px-2 py-1 text-center text-gray-400 font-mono">
                        {r + 1}
                      </td>
                      {[1, 2, 3, 4].map((c) => (
                        <td
                          key={c}
                          className="border border-gray-200 px-3 py-1"
                        >
                          <div
                            className="h-2.5 rounded bg-gray-200"
                            style={{
                              width: `${40 + ((r * c * 7) % 50)}%`,
                              opacity:
                                0.5 + ((r + c) % 4) * 0.1,
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Text/document-style preview */
            <div className="space-y-2">
              {/* Title placeholder */}
              <div
                className="h-5 bg-gray-300 rounded mb-4"
                style={{ width: "55%" }}
              />
              {/* Subtitle */}
              <div
                className="h-3 bg-gray-200 rounded mb-5"
                style={{ width: "38%" }}
              />

              {Array.from({ length: lines }, (_, i) => {
                const w = [
                  95, 92, 87, 70, 96, 88, 75, 93, 80, 91, 65,
                  97, 84, 90, 78, 94, 72, 89, 85, 77, 98, 83,
                ][i % 22];
                const isGap = i > 0 && i % 6 === 0;
                return (
                  <React.Fragment key={i}>
                    {isGap && <div className="h-3" />}
                    <div
                      className="h-2.5 rounded"
                      style={{
                        width: `${w}%`,
                        backgroundColor:
                          i % 7 === 0 ? "#CBD5E1" : "#E2E8F0",
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Watermark */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
            
            <p className="text-[9px] text-gray-300 font-mono">
              {file.size}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ─────────────────────────────────────────────────────────
function FilePreviewModal({
  file,
  orderId,
  onClose,
  showDownload = false,
}: {
  file: AttachedFile;
  orderId: string;
  onClose: () => void;
  showDownload?: boolean;
}) {
  const cat = getFileCategory(file);
  const badgeCls = FileBadgeColor(file);

  const handleDownload = () => {
    const content = `[DocuFy PSMS — Palawan State University]\nFile: ${file.name}\nOrder ID: ${orderId}\nSize: ${file.size}\nType: ${file.type}\nUploaded: ${formatUploadDate(file.uploadedAt)}\n\nThis is a placeholder download for the submitted document.\nActual file content would be served from the server.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Downloading ${file.name}…`);
  };

  // Close on backdrop click
  const handleBackdropClick = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col my-8"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-[#F2F7FF] flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0">
            <FileIcon file={file} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#10316B] text-sm leading-tight truncate">
              {file.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeCls}`}
              >
                {getFileExtension(file.name).toUpperCase() ||
                  file.type}
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {file.size}
              </span>
              {file.uploadedAt && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatUploadDate(file.uploadedAt)}
                </span>
              )}
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Order {orderId}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showDownload && (
              <Button
                onClick={handleDownload}
                size="sm"
                className="h-8 px-3 bg-[#1D73EC] hover:bg-[#1560c8] text-white text-xs font-semibold gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File info ribbon */}
        

        {/* Preview content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          <DocumentPreview file={file} />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white flex-shrink-0">
          
          <div className="flex items-center gap-2">
            {showDownload && (
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-[#1D73EC] text-[#1D73EC] hover:bg-[#F2F7FF] gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            )}
            <Button
              onClick={onClose}
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs text-gray-600 hover:bg-gray-50"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main FileAttachments Component ────────────────────────────────────────
export function FileAttachments({
  files,
  orderId,
  showDownload = false,
}: FileAttachmentsProps) {
  const [previewFile, setPreviewFile] =
    useState<AttachedFile | null>(null);

  if (!files || files.length === 0) return null;

  const handleDownload = (file: AttachedFile) => {
    const content = `[DocuFy PSMS — Palawan State University]\nFile: ${file.name}\nOrder ID: ${orderId}\nSize: ${file.size}\nType: ${file.type}\nUploaded: ${formatUploadDate(file.uploadedAt)}\n\nThis is a placeholder download for the submitted document.\nActual file content would be served from the server.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Downloading ${file.name}…`);
  };

  return (
    <>
      <div className="space-y-2">
        {files.map((file, index) => {
          const badgeCls = FileBadgeColor(file);
          const ext = getFileExtension(file.name).toUpperCase();

          return (
            <div
              key={index}
              className="group flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-[#1D73EC] hover:shadow-sm transition-all"
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
                  <span className="text-xs text-gray-400">
                    {file.size}
                  </span>
                  {file.uploadedAt && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {formatUploadDate(file.uploadedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* View button — opens modal */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewFile(file)}
                  className="h-8 px-3 text-xs font-semibold border-[#1D73EC] text-[#1D73EC] hover:bg-[#F2F7FF] gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </Button>

                {/* Download icon button — only shown when showDownload is true */}
                {showDownload && (
                  <button
                    onClick={() => handleDownload(file)}
                    title={`Download ${file.name}`}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1D73EC] hover:border-[#1D73EC] hover:bg-[#F2F7FF] transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal — rendered as portal-like overlay */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          orderId={orderId}
          onClose={() => setPreviewFile(null)}
          showDownload={showDownload}
        />
      )}
    </>
  );
}