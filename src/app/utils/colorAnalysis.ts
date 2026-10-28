// ============================================================================
// COLOR ANALYSIS — real per-file color detection for uploaded documents.
//
// Previously this was a fixed 1.5s timer that "decided" 20% of pages were
// colored; now each uploaded file is actually analyzed:
//   - PDF   → pages are RENDERED to a small canvas with pdfjs-dist and scanned
//             with the same HSL-saturation pixel test the image path uses, so
//             colored TEXT (the most common miss for operator parsers), images,
//             drawings and scans are all counted accurately. NOT an estimate.
//             If rendering fails (corrupt/unusual file) it falls back to a
//             pdf-lib *operator scan* of the content streams, marked estimated.
//   - Image (PNG/JPG/WebP/BMP/GIF) → downscale to a cap and count colored
//             pixels on a canvas (HSL saturation). This one is NOT estimated.
//   - Office documents (.docx/.pptx/.xlsx) → deterministic estimate from the
//             ZIP internals (media + EDITED color-marks, excluding theme/srcs
//             swatches that make every file look colored). estimated=true.
//
// The result feeds the per-file Color Mode >50% / =50% / B&W tiers and the
// "(estimated)" UI label when the value is a heuristic rather than a scan.
// ============================================================================

import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFObject,
  PDFPageLeaf,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Load the pdf.js worker as a Vite asset and hand its URL to pdfjs once.
if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = workerUrl;
}

export type ColorAnalysis = {
  /** Total pages in the analyzed document (for office/PDF semantics). */
  totalPages: number;
  /** 1-based page numbers whose bitmaps/paints are mostly colored. */
  colorPages: number[];
  /** 1-based page numbers that are mostly grayscale/black & white. */
  bwPages: number[];
  /** 1-based page → approximate colored percentage (0-100). */
  colorPercentages: { [page: number]: number };
  /** True when the result is an estimate, not a full pixel-level scan. */
  estimated?: boolean;
  /** Which analyzer produced the result (drives the UI label). */
  method?: "pdf" | "image" | "office";
};

export type AnalyzedDocument = {
  pageCount: number;
  analysis: ColorAnalysis;
};

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

export function isSupportedImageName(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return IMAGE_EXTS.includes(ext);
}

export function isSupportedDocument(fileName: string): boolean {
  const base = fileName.toLowerCase();
  return (
    base.endsWith(".pdf") ||
    base.endsWith(".docx") ||
    base.endsWith(".doc") ||
    base.endsWith(".pptx") ||
    base.endsWith(".ppt") ||
    base.endsWith(".xlsx") ||
    base.endsWith(".xls")
  );
}

// ---------------------------------------------------------------------------
// Doc dispatch
// ---------------------------------------------------------------------------

export async function analyzeDocument(file: File): Promise<AnalyzedDocument> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return analyzePdfDocument(file);
  if (isSupportedImageName(file.name)) {
    return {
      pageCount: 1,
      analysis: await analyzeImageColors(file),
    };
  }
  return analyzeOfficeEstimate(file);
}

// ---------------------------------------------------------------------------
// Pixel scan (shared by the image path and the rendered-PDF path)
// ---------------------------------------------------------------------------

const CAP = 256; // long-edge cap for rendered PDF pages / images
const LARGE_DOC_CAP = 192; // cheaper cap for very long documents
const SAT_THRESHOLD = 0.18;
// A page must reach this % of colored pixels to count as colored (>=); pages
// with only ~1% (a tiny logo, an underline, antialiased edges) stay B&W.
const MIN_COLOR_PCT = 1;

type PixelScan = { colored: number; total: number };

// Counts "colorful" pixels on an RGBA ImageData buffer: a pixel is colored
// when its HSL saturation exceeds the threshold. Grayscale (incl. antialiased
// text and sepia-less scans) stays under it, while genuine color reads high.
function scanPixels(data: Uint8ClampedArray | number[]): PixelScan {
  let colored = 0;
  const total = data.length >> 2;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const denom = 1 - Math.abs(2 * l - 1);
    const s = denom === 0 ? 0 : (max - min) / denom;
    if (s > SAT_THRESHOLD) colored += 1;
  }
  return { colored, total };
}

function buildAnalysis(totalPages: number, perPage: number[], estimated: boolean, method: NonNullable<ColorAnalysis["method"]>): ColorAnalysis {
  const analysis: ColorAnalysis = {
    totalPages,
    colorPages: [],
    bwPages: [],
    colorPercentages: {},
    estimated,
    method,
  };
  for (let i = 1; i <= totalPages; i++) {
    const pct = perPage[i - 1] ?? 0;
    // A page needs at least MIN_COLOR_PCT percent of its pixels colored to
    // count as a color page — a stray logo, underline, or antialiased edge
    // (~1% or less) must not repaint the whole page as colored. The real
    // percentage is still preserved in colorPercentages for transparency.
    const isColored = pct >= MIN_COLOR_PCT;
    analysis.colorPercentages[i] = pct;
    if (isColored) analysis.colorPages.push(i);
    else analysis.bwPages.push(i);
  }
  return analysis;
}

// ---------------------------------------------------------------------------
// PDF — rendered pixel scan (pdf.js). Accurate, NOT an estimate.
// ---------------------------------------------------------------------------

const pdfCache = new Map<string, { pdf: import("pdfjs-dist").PDFDocumentProxy; key: string }>();

function pdfCacheKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

async function loadPdfOnce(file: File): Promise<import("pdfjs-dist").PDFDocumentProxy> {
  const key = pdfCacheKey(file);
  const cached = pdfCache.get(key);
  if (cached) return cached.pdf;
  const task = getDocument({ data: await file.arrayBuffer() });
  const pdf = await task.promise;
  pdfCache.set(key, { pdf, key });
  return pdf;
}

async function renderPageToCanvas(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  pageNumber: number,
  cap: number,
): Promise<ImageData | null> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1, cap / Math.max(1, Math.max(base.width, base.height)));
  const viewport = page.getViewport({ scale });
  const w = Math.max(1, Math.round(viewport.width));
  const h = Math.max(1, Math.round(viewport.height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const task = page.render({ canvas, canvasContext: ctx, viewport });
  await task.promise;
  try {
    return ctx.getImageData(0, 0, w, h);
  } finally {
    page.cleanup();
  }
}

export async function analyzePdfDocument(
  file: File,
): Promise<AnalyzedDocument> {
  try {
    const pdf = await loadPdfOnce(file);
    const totalPages = Math.max(1, pdf.numPages);
    const cap = totalPages > 60 ? LARGE_DOC_CAP : CAP;
    const perPage: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const imageData = await renderPageToCanvas(pdf, i, cap);
      if (!imageData) {
        perPage.push(0);
        continue;
      }
      const { colored, total } = scanPixels(imageData.data);
      perPage.push(total > 0 ? Math.round((colored / total) * 100) : 0);
    }
    pdf.cleanup();
    return { pageCount: totalPages, analysis: buildAnalysis(totalPages, perPage, false, "pdf") };
  } catch (error) {
    console.warn(
      "[color-analysis] pdf.js render failed — falling back to operator scan:",
      error,
    );
    return analyzePdfByOperators(file);
  }
}

// ---------------------------------------------------------------------------
// PDF fallback — pdf-lib content-stream operator scan (estimated).
// ---------------------------------------------------------------------------

type ColorToken =
  | { kind: "num"; value: number }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string }
  | { kind: "arrstart" }
  | { kind: "arrend" }
  | { kind: "paint"; colored: boolean };

/**
 * Pragmatic PDF content-stream tokenizer. Skips comments/strings/hex/dicts,
 * emits numbers, /names and bare operator keywords, and collapses INLINE
 * IMAGES (BI … ID … EI) into a single paint token so their binary payloads
 * can never fabricate operator keywords.
 */
function tokenizeContent(text: string): ColorToken[] {
  const tokens: ColorToken[] = [];
  const len = text.length;
  let i = 0;
  const isDelim = (c: string) => "()<>[]{}/%".includes(c);

  while (i < len) {
    const c = text[i];
    if (c === "%") {
      while (i < len && text[i] !== "\n" && text[i] !== "\r") i += 1;
      continue;
    }
    if (c === "(") {
      i += 1;
      while (i < len) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === ")") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === "<") {
      i += 1;
      while (i < len && text[i] !== ">") i += 1;
      i += 1;
      continue;
    }
    if (c === "/") {
      i += 1;
      let j = i;
      while (j < len && !/\s/.test(text[j]) && !isDelim(text[j])) j += 1;
      tokens.push({ kind: "name", value: text.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "[") {
      tokens.push({ kind: "arrstart" });
      i += 1;
      continue;
    }
    if (c === "]") {
      tokens.push({ kind: "arrend" });
      i += 1;
      continue;
    }
    if (isDelim(c) || /\s/.test(c)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < len && !/\s/.test(text[j]) && !isDelim(text[j]) && text[j] !== "[") j += 1;
    const word = text.slice(i, j);

    if (word === "BI") {
      // Inline image. Extract its dict (BI … ID), classify its color space,
      // then skip the raw binary payload through EI so it can't pollute the
      // token stream. Also guard against the last-"-EI"-wins 8-byte-per-line
      // convention by bounding the guess to the remaining text.
      const dictStart = j;
      const idPos = text.indexOf("ID", dictStart);
      if (idPos !== -1) {
        const dictText = text.slice(dictStart, idPos);
        const csMatch =
          /\/ColorSpace\s+(\/?[A-Za-z]+|\/Indexed|\[)/.exec(dictText) ||
          /(?:^|[^\w])CS\s+(\/?[A-Za-z]+)/.exec(dictText);
        const csName = csMatch?.[1];
        const colored = !!(
          csName &&
          csName !== "/DeviceGray" &&
          csName !== "/CalGray" &&
          csName !== "DeviceGray" &&
          csName !== "CalGray" &&
          csName !== "ImageMask" &&
          csName !== "["
        );
        tokens.push({ kind: "paint", colored });
        // Skip through EI (word-boundary; binary data above 0x7f can't match).
        let ei = text.indexOf("EI", idPos + 2);
        while (ei !== -1) {
          const before = text[ei - 1] ?? "";
          const after = text[ei + 2] ?? "";
          if (/\s/.test(before) && (/\s/.test(after) || after === "")) break;
          ei = text.indexOf("EI", ei + 2);
        }
        i = ei !== -1 ? ei + 2 : len;
        continue;
      }
    }

    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      tokens.push({ kind: "num", value: parseFloat(word) });
    } else if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(word) && word.length <= 11) {
      tokens.push({ kind: "op", value: word });
    }
    i = j;
  }
  return tokens;
}

type CountResult = { paints: number; colored: number };

function isColor(comps: number[] | null): boolean {
  if (!comps || comps.length === 0) return false;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of comps) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min > 0.05;
}

/** A colorspace is color-capable when it is not a pure gray/black pattern. */
function isColorColorspace(cs: PDFObject | undefined): boolean {
  if (!cs) return false;
  if (cs instanceof PDFName) {
    const n = cs.asString();
    if (n === "DeviceGray" || n === "CalGray" || n === "Pattern") return false;
    return true;
  }
  if (cs instanceof PDFArray) {
    const base = cs.get(0);
    if (base instanceof PDFName) {
      const n = base.asString();
      if (n === "ICCBased") return true;
      if (n === "Indexed" || n === "IndexedCIELab") return isColorColorspace(cs.get(1));
      return isColorColorspace(base);
    }
    return false;
  }
  if (cs instanceof PDFStream) return true; // bare ICC profile stream
  return false;
}

function streamText(stream: PDFStream | undefined): string {
  if (!stream) return "";
  try {
    const decoded = decodePDFRawStream(
      stream as unknown as PDFRawStream,
    ).decode();
    return new TextDecoder("latin1").decode(decoded);
  } catch {
    return "";
  }
}

/** Trailing numeric operands only (skip stray names, e.g. a scn pattern name). */
function popOperands(stack: (number | string)[], n: number): number[] {
  const out: number[] = [];
  for (let k = stack.length - 1; k >= 0 && out.length < n; k--) {
    const v = stack[k];
    if (typeof v === "number") {
      out.unshift(v);
      stack.splice(k, 1);
    }
  }
  return out;
}

function analyzeContentUnit(
  text: string,
  resources: PDFDict | undefined,
  depth: number,
): CountResult {
  const tokens = tokenizeContent(text);
  const stack: (number | string)[] = [];
  let paints = 0;
  let colored = 0;
  let fill: number[] | null = null;
  let stroke: number[] | null = null;

  const xobjectDict = (): PDFDict | undefined => {
    if (!resources) return undefined;
    const xo = resources.lookup(PDFName.of("XObject"));
    return xo instanceof PDFDict ? xo : undefined;
  };

  const recordPaint = (using: number[] | null) => {
    paints += 1;
    if (isColor(using)) colored += 1;
  };

  for (const t of tokens) {
    if (t.kind === "num" || t.kind === "name") {
      stack.push(t.value);
      continue;
    }
    if (t.kind === "arrstart") {
      // New operand array — prior operands belong to the current operator.
      if (stack.length > 0 && stack[stack.length - 1] !== "__arr__") {
        stack.push("__arr__");
      }
      continue;
    }
    if (t.kind === "arrend") {
      // Drop any numbers pushed inside the array (TJ offsets etc.).
      while (stack.length > 0 && stack[stack.length - 1] !== "__arr__") stack.pop();
      if (stack[stack.length - 1] === "__arr__") stack.pop();
      continue;
    }
    if (t.kind === "paint") {
      paints += 1;
      if (t.colored) colored += 1;
      continue;
    }
    const op = t.value;
    let handled = true;
    switch (op) {
      case "rg":
      case "RG": {
        const c = popOperands(stack, 3);
        if (op === "rg") fill = c;
        else stroke = c;
        break;
      }
      case "k":
      case "K": {
        const c = popOperands(stack, 4);
        if (op === "k") fill = c;
        else stroke = c;
        break;
      }
      case "g":
      case "G": {
        const c = popOperands(stack, 1);
        if (op === "g") fill = c;
        else stroke = c;
        break;
      }
      case "sc":
      case "SC":
      case "scn":
      case "SCN": {
        const c = popOperands(stack, 4);
        if (op === "sc" || op === "scn") fill = c;
        else stroke = c;
        break;
      }
      case "f":
      case "F":
      case "b":
      case "B": {
        recordPaint(fill);
        break;
      }
      case "S":
      case "s": {
        recordPaint(stroke);
        break;
      }
      case "Tj":
      case "'":
      case "\"":
      case "TJ": {
        // Text is painted with the current NON-stroking color.
        recordPaint(fill);
        break;
      }
      case "sh": {
        paints += 1;
        colored += 1; // shading patterns are effectively color paints
        break;
      }
      case "Do": {
        if (stack.length > 0) {
          const name = stack.pop();
          if (typeof name === "string" && depth < 4) {
            const xo = xobjectDict();
            const obj = xo?.lookup(PDFName.of(name));
            if (obj instanceof PDFStream) {
              const sub = obj.dict.lookup(PDFName.of("Subtype"));
              const subName = sub instanceof PDFName ? sub.asString() : "";
              if (subName === "Image") {
                paints += 1;
                const cs = obj.dict.lookup(PDFName.of("ColorSpace"));
                if (isColorColorspace(cs)) colored += 1;
              } else if (subName === "Form") {
                const res = analyzeFormStream(obj, depth + 1);
                paints += res.paints;
                colored += res.colored;
              }
            }
          }
        }
        break;
      }
      default:
        handled = false;
        break;
    }
    if (!handled) {
      // Any other operator consumes *all* pending operands — drop them so a
      // later color operator can never mis-read e.g. Td/Tm numbers as RGB.
      stack.length = 0;
    }
  }
  return { paints, colored };
}

function analyzeFormStream(
  stream: PDFStream,
  depth: number,
): CountResult {
  const ownResources = stream.dict.lookup(PDFName.of("Resources"));
  const resources = ownResources instanceof PDFDict ? ownResources : undefined;
  return analyzeContentUnit(streamText(stream), resources, depth);
}

function analyzePageContent(node: PDFPageLeaf): CountResult {
  try {
    const resources = node.Resources() ?? undefined;
    const contents = node.Contents();
    const streams: PDFStream[] = [];
    if (contents instanceof PDFArray) {
      for (const c of contents.asArray()) {
        if (c instanceof PDFStream) streams.push(c);
      }
    } else if (contents instanceof PDFStream) {
      streams.push(contents);
    }
    let paints = 0;
    let colored = 0;
    for (const s of streams) {
      const res = analyzeFormStream(s, 0);
      paints += res.paints;
      colored += res.colored;
    }
    return { paints, colored };
  } catch {
    return { paints: 0, colored: 0 };
  }
}

export async function analyzePdfByOperators(
  file: File,
): Promise<AnalyzedDocument> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
  });
  const pages = pdf.getPages();
  const totalPages = Math.max(1, pages.length);
  const perPage: number[] = [];
  for (const page of pages) {
    const res = analyzePageContent(page.node);
    perPage.push(
      res.paints > 0 ? Math.round((res.colored / res.paints) * 100) : 0,
    );
  }
  return { pageCount: totalPages, analysis: buildAnalysis(totalPages, perPage, true, "pdf") };
}

// ---------------------------------------------------------------------------
// Image — canvas pixel scan (NOT an estimate)
// ---------------------------------------------------------------------------

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-decode-failed"));
    img.src = url;
  });
}

export async function analyzeImageColors(
  file: File,
): Promise<ColorAnalysis> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = Math.min(1, CAP / Math.max(1, maxDim));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    const { colored, total } = scanPixels(ctx.getImageData(0, 0, w, h).data);
    const pct = total > 0 ? Math.round((colored / total) * 100) : 0;
    return buildAnalysis(1, [pct], false, "image");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Office — deterministic ZIP-internal estimate (.docx/.pptx/.xlsx)
// ---------------------------------------------------------------------------

const LOCAL_HEADER = "PK\u0003\u0004";

// Reads 16-bit little-endian at `pos`.
function u16(text: string, pos: number): number {
  return text.charCodeAt(pos) | (text.charCodeAt(pos + 1) << 8);
}

// Reads 32-bit little-endian at `pos`.
function u32(text: string, pos: number): number {
  return (
    text.charCodeAt(pos) |
    (text.charCodeAt(pos + 1) << 8) |
    (text.charCodeAt(pos + 2) << 16) |
    (text.charCodeAt(pos + 3) << 24)
  );
}

/**
 * Walks the ZIP local-file headers and returns, for every readable XML entry
 * under word/ppt/xl: its name, and its raw compressed bytes' range in the
 * file. Works for STORED (method 0) and DEFLATED (method 8) content.
 */
function zipXmlEntries(text: string): {
  name: string;
  start: number;
  size: number;
  method: number;
}[] {
  const out: { name: string; start: number; size: number; method: number }[] = [];
  let idx = text.indexOf(LOCAL_HEADER, 0);
  while (idx !== -1) {
    if (idx + 30 <= text.length) {
      const method = u16(text, idx + 8);
      const nameLen = u16(text, idx + 26);
      const extraLen = u16(text, idx + 28);
      const compSize = u32(text, idx + 18);
      const name = text.slice(idx + 30, idx + 30 + nameLen);
      const isXml =
        name.endsWith(".xml") &&
        (name.startsWith("word/") || name.startsWith("ppt/") || name.startsWith("xl/"));
      if (isXml && (method === 0 || method === 8)) {
        const start = idx + 30 + nameLen + extraLen;
        out.push({ name, start, size: compSize, method });
      }
    }
    idx = text.indexOf(LOCAL_HEADER, idx + 1);
  }
  return out;
}

/** Inflates a DEFLATED zip entry (or passes STORED bytes through). */
async function inflateEntry(
  bytes: Uint8Array<ArrayBuffer>,
  method: number,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    if (method === 0) return bytes;
    const ds = new DecompressionStream("deflate-raw");
    const out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  } catch {
    return new Uint8Array(0);
  }
}

function countOccurrences(text: string, needle: string): number[] {
  const positions: number[] = [];
  let idx = text.indexOf(needle);
  while (idx !== -1) {
    positions.push(idx);
    idx = text.indexOf(needle, idx + needle.length);
  }
  return positions;
}

/** "#3C78D8" → true when r ≈ g ≈ b (i.e. it isn't really color). */
function isGrayHex(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return Math.abs(r - g) < 8 && Math.abs(g - b) < 8;
}

// Color marks searched inside one entry's decoded XML. Only ATTRIBUTE hex
// values (or named highlights) that are genuinely non-gray count — theme,
// auto, and "default black" values do not.
function countColorMarksInText(xml: string): number {
  let marks = 0;
  const hexRe =
    /(?:<a:srgbClr\b[^>]*\bval|<w:color\b[^>]*\bw:val|<w:shd\b[^>]*\bw:fill)="?([0-9A-Fa-f]{6})/gi;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(xml)) !== null) {
    const hex = m[1];
    if (hex && hex.length === 6 && !isGrayHex(hex)) marks += 1;
  }
  const hlRe = /<w:highlight\b[^>]*\bw:val="([0-9A-Za-z]+)"/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hlRe.exec(xml)) !== null) {
    const val = hm[1].toLowerCase();
    if (val && val !== "none") marks += 1;
  }
  return marks;
}

export async function countPagesInFile(file: File): Promise<number> {
  const name = file.name.toLowerCase();
  try {
    const buf = new Uint8Array(await file.slice(0, 12 * 1024 * 1024).arrayBuffer());
    const text = new TextDecoder("latin1").decode(buf);
    let count = 1;
    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      count = Math.max(1, countOccurrences(text, "\\sect").length + 1);
    } else if (name.endsWith(".pptx") || name.endsWith(".ppt")) {
      const slideNames = zipXmlEntries(text)
        .map((e) => e.name)
        .filter((n) => n.startsWith("ppt/slides/slide") && n.endsWith(".xml"));
      if (slideNames.length > 0) count = slideNames.length;
    }
    return Math.max(1, count);
  } catch {
    return 1;
  }
}

/**
 * Office estimate. Reads the ZIP structure correctly: media files are counted
 * from their ENTRY NAMES (always readable), and color marks are counted only
 * inside DECODED document/slide/sheet XML entries, with the theme/style-source
 * parts (which ship ~12 colored swatches in EVERY Office file and used to make
 * every document read as "colored") excluded by name. Deflated content is
 * inflated with the built-in DecompressionStream.
 */
async function analyzeOfficeEstimate(file: File): Promise<AnalyzedDocument> {
  const pageCount = await countPagesInFile(file);
  const raw = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("latin1").decode(raw);

  const entries = zipXmlEntries(text);

  // Distinct media files present (entry names are readable even when deflated).
  const mediaFiles = new Set(
    entries
      .filter(
        (e) =>
          e.name.startsWith("word/media/") ||
          e.name.startsWith("ppt/media/") ||
          e.name.startsWith("xl/media/"),
      )
      .map((e) => e.name),
  );
  const mediaCount = mediaFiles.size;

  // Color marks from decoded non-theme content entries.
  let colorMarks = 0;
  for (const entry of entries) {
    const base = entry.name.split("/").pop() ?? "";
    const isThemePart =
      entry.name.includes("/theme/") ||
      base === "styles.xml" ||
      base === "theme1.xml" ||
      base === "colors.xml" ||
      base === "viewProps.xml" ||
      base === "fontTable.xml";
    if (isThemePart) continue;
    if (!entry.name.endsWith(".xml")) continue;
    const slice = raw.slice(entry.start, entry.start + Math.min(entry.size, 50 * 1024 * 1024));
    const decoded = await inflateEntry(slice, entry.method);
    if (decoded.length > 0) {
      colorMarks += countColorMarksInText(new TextDecoder("utf-8").decode(decoded));
    }
  }

  const coloredShare = Math.min(
    1,
    (mediaCount * 0.7 + Math.min(colorMarks, pageCount * 2)) / Math.max(1, pageCount),
  );
  const coloredCount = Math.min(pageCount, Math.max(0, Math.round(pageCount * coloredShare)));
  const perPage: number[] = [];
  for (let i = 1; i <= pageCount; i++) {
    perPage.push(i <= coloredCount ? 50 : 0);
  }
  return { pageCount, analysis: buildAnalysis(pageCount, perPage, true, "office") };
}
