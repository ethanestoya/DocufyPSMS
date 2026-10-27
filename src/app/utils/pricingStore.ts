// Centralized printing-pricing store.
// Supabase-backed facade: the localStorage mirror below stays as the offline /
// anonymous fallback, but the DB now drives real cross-device pricing. Every
// authenticated role can READ pricing (customers price their checkout live);
// admin edits on /admin/pricing push to `pricing_settings` (the single-row
// legacy flat rates + payment windows) and `pricing_matrix_cells` (one row per
// matrix cell), and a realtime subscription propagates edits made on any
// device back to every open page. Previously these values were hardcoded in
// new-print-request, walk-in, invoice, and landing pages. Admin edits them on
// /admin/pricing; every consumer subscribes so changes propagate live.
// The localStorage mirror is persisted for offline/anon fallback.

import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import { auditLogStore } from './auditLogStore';
import {
  fetchMatrixCells,
  fetchPricingSettings,
  replaceMatrixCells,
  saveMatrixCell,
  upsertPricingSettings,
} from '../../lib/db/pricingRepo';
import type { MatrixCellInsert, MatrixCellRow, PricingSettingsRow } from '../../lib/db/types';

// ============================================================
// LEGACY FLAT MODEL (kept for backward compatibility)
// The original consumers (NewPrintRequest, WalkIn, OrderTracking,
// LandingPage, UnifiedOrders) still read these fields and
// the default document standard-paper flow. They are preserved untouched so
// nothing breaks while the new multi-dimensional pricing matrix (below) is
// being adopted by the order flows. These rows are still user-editable on the
// admin page under "Legacy Per-Page Rates".
// ============================================================

export type PricingValues = {
  bw: number; // Black & White — per page
  colorLow: number; // Colored, ≤50% of the page colored — per page
  colorHigh: number; // Colored, >50% of the page colored (or flat colored) — per page
  sizeLongLegalFolio: number; // per-page surcharge for Long / Folio / Legal
  sizeA3: number; // per-page surcharge for A3
  duplexSavings: number; // per-page savings for double-sided printing
  downPaymentThreshold: number; // order total at/above which a down payment is required
  // PLACEHOLDER — value NOT yet confirmed by the client (named both ₱100 and ₱150).
  // Order totals at/above this amount require FULL payment (no 50% option) before
  // printing, since a printed-but-unclaimed high-value order is hard to recover.
  fullPaymentThreshold: number;
  // PLACEHOLDER — PAID-PAYMENT DEADLINES NOT YET CONFIRMED BY THE CLIENT.
  // Awaiting-payment orders are auto-cancelled as expired if payment is not
  // confirmed within these windows. Cash-on-pickup orders must be paid at the
  // shop; online orders must be submitted + verified. Admin-editable under
  // "Order Rules" as a full duration (hours/minutes/seconds; 0 = no auto-expiry).
  // Deadlines are wall-clock durations (not store hours) pending client decision.
  // Stored as total seconds so the admin can pick any granularity down to seconds.
  cashPickupPaymentWindowSeconds: number; // how long a customer has to pay cash at the shop
  onlinePaymentVerificationWindowSeconds: number; // how long an online payment has to be submitted + verified
};

// Current system behavior (formerly hardcoded) is the default.
const DEFAULT_PRICING: PricingValues = {
  bw: 1,
  colorLow: 3,
  colorHigh: 5,
  sizeLongLegalFolio: 11,
  sizeA3: 1.5,
  duplexSavings: 0.5,
  downPaymentThreshold: 50,
  fullPaymentThreshold: 100, // client named both ₱100 and ₱150; using ₱100 (admin-editable)
  // Placeholder deadline windows (seconds — 48h / 24h) — pending client confirmation.
  cashPickupPaymentWindowSeconds: 48 * 3600,
  onlinePaymentVerificationWindowSeconds: 24 * 3600,
};

// ============================================================
// NEW MULTI-DIMENSIONAL PRICING MATRIX
// Docufy prices by service type, content type, color option, and paper
// size/material. These nested tables are the new source of truth. The order
// flows pick a service type + content type + color tier and material, then
// index straight into the matrix. Admin edits them on /admin/pricing.
// ============================================================

export type ColorTier = "bw" | "partial" | "full";
export type ContentType = "text" | "textWithImage" | "imageOnly";
export type PaperSizeKey = "short" | "a4" | "long";

export type ServiceType = "document" | "vellum" | "sticker" | "photo";

// Per page: [content][color][size], e.g. document.textWithImage.full.a4 = 6.
export type ContentColorSize = Record<ColorTier, Record<PaperSizeKey, number>>;
export type DocumentMatrix = Record<ContentType, ContentColorSize>;

// Image-only, per page: [color][size].
export type ColorSize = Record<ColorTier, Record<PaperSizeKey, number>>;

// A4 only, per sheet, by color tier.
export type StickerMatrix = Record<ColorTier, number>;

export type PhotoSizeKey = "2R" | "3R" | "4R" | "5R" | "6R" | "A4photo";
export type PhotoSize = { price: number; minQty: number };
export type PhotoMatrix = Record<PhotoSizeKey, PhotoSize>;

export type PricingMatrix = {
  document: DocumentMatrix;
  vellum: ColorSize; // image only
  sticker: StickerMatrix;
  photo: PhotoMatrix;
};

export const DEFAULT_MATRIX: PricingMatrix = {
  document: {
    text: {
      bw: { short: 2, a4: 2, long: 2 },
      partial: { short: 3, a4: 3, long: 3 },
      full: { short: 4, a4: 5, long: 6 },
    },
    textWithImage: {
      bw: { short: 3, a4: 3, long: 4 },
      partial: { short: 4, a4: 4, long: 5 },
      full: { short: 5, a4: 6, long: 7 },
    },
    imageOnly: {
      bw: { short: 3, a4: 3, long: 4 },
      partial: { short: 4, a4: 5, long: 6 },
      full: { short: 7, a4: 7, long: 8 },
    },
  },
  vellum: {
    bw: { short: 7, a4: 8, long: 9 },
    partial: { short: 8, a4: 9, long: 10 },
    full: { short: 12, a4: 13, long: 15 },
  },
  sticker: {
    bw: 20,
    partial: 30,
    full: 50,
  },
  photo: {
    "2R": { price: 10, minQty: 6 },
    "3R": { price: 15, minQty: 4 },
    "4R": { price: 20, minQty: 4 },
    "5R": { price: 30, minQty: 2 },
    "6R": { price: 40, minQty: 1 },
    A4photo: { price: 60, minQty: 1 },
  },
};

// Human labels used by the admin page.
export const COLOR_TIER_LABELS: Record<ColorTier, string> = {
  bw: "Black & White",
  partial: "Partially Colored",
  full: "Fully Colored",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  text: "Text Only",
  textWithImage: "Text with Image",
  imageOnly: "Image Only",
};

export const PAPER_SIZE_LABELS: Record<PaperSizeKey, string> = {
  short: "Short",
  a4: "A4",
  long: "Long",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  document: "Plain Paper Printing (Standard Paper)",
  vellum: "Vellum Paper (Image Only)",
  sticker: "Sticker Paper (A4)",
  photo: "Photo Paper Printing",
};

export const PHOTO_SIZE_LABELS: Record<PhotoSizeKey, string> = {
  "2R": "2R (Wallet Size)",
  "3R": "3R",
  "4R": "4R",
  "5R": "5R",
  "6R": "6R",
  A4photo: "A4",
};

export type PricingCategory =
  | 'Color & Black and White'
  | 'Paper Size'
  | 'Printing Options'
  | 'Order Rules';

export type PricingItemSpec = {
  id: keyof PricingValues;
  label: string;
  description: string;
  category: PricingCategory;
  prefix?: string; // display prefix, e.g. "+" or "–" (savings)
  unit: string; // display unit, e.g. "/ page" or "₱"
  editable: boolean;
};

// Metadata for the admin UI. Ordering here = ordering on the page.
export const PRICING_ITEMS: PricingItemSpec[] = [
  {
    id: 'bw',
    label: 'Black & White',
    description: 'Per-page price for black and white printing.',
    category: 'Color & Black and White',
    unit: '/ page',
    editable: true,
  },
  {
    id: 'colorLow',
    label: 'Colored (up to 50% color)',
    description: 'Per-page price when a page is at most 50% colored (color analysis).',
    category: 'Color & Black and White',
    unit: '/ page',
    editable: true,
  },
  {
    id: 'colorHigh',
    label: 'Colored (over 50% color)',
    description: 'Per-page price when a page is more than 50% colored, or when colored printing is chosen without color analysis.',
    category: 'Color & Black and White',
    unit: '/ page',
    editable: true,
  },
  {
    id: 'sizeLongLegalFolio',
    label: 'Long / Folio / Legal',
    description: 'Per-page surcharge for larger paper sizes.',
    category: 'Paper Size',
    prefix: '+',
    unit: '/ page',
    editable: true,
  },
  {
    id: 'sizeA3',
    label: 'A3',
    description: 'Per-page surcharge for A3 paper size.',
    category: 'Paper Size',
    prefix: '+',
    unit: '/ page',
    editable: true,
  },
  {
    id: 'duplexSavings',
    label: 'Double-Sided',
    description: 'Per-page savings applied when double-sided printing is selected.',
    category: 'Printing Options',
    prefix: '–',
    unit: '/ page',
    editable: true,
  },
  {
    id: 'downPaymentThreshold',
    label: 'Down Payment Threshold',
    description: 'Order totals at or above this amount require a down payment.',
    category: 'Order Rules',
    unit: '₱',
    editable: true,
  },
  {
    id: 'fullPaymentThreshold',
    label: 'Full Payment Threshold',
    description: 'Order totals at or above this amount require FULL payment upfront — the 50% down payment option is removed.',
    category: 'Order Rules',
    unit: '₱',
    editable: true,
  },
  {
    id: 'cashPickupPaymentWindowSeconds',
    label: 'Cash on Pickup Payment Window',
    description: 'Time to pay in cash at the shop before the order auto-cancels. 0 = never expires. Pending approval.',
    category: 'Order Rules',
    unit: 'duration',
    editable: true,
  },
  {
    id: 'onlinePaymentVerificationWindowSeconds',
    label: 'Online Payment Verification Window',
    description: 'Time to submit and verify an online payment before the order auto-cancels. 0 = never expires. Pending approval.',
    category: 'Order Rules',
    unit: 'duration',
    editable: true,
  },
];

type Subscriber = () => void;

const STORAGE_KEY = 'docufy_pricing_v1';
const STORAGE_VERSION = '2.0';

function convertToNumber(value: unknown): number {
  return typeof value === 'number' && isFinite(value) ? value : NaN;
}

function normalize(raw: unknown): PricingValues {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PRICING };
  const source = raw as Record<string, unknown>;
  const values: Partial<PricingValues> = {};
  (Object.keys(DEFAULT_PRICING) as Array<keyof PricingValues>).forEach((key) => {
    const n = convertToNumber(source[key]);
    values[key] = Number.isNaN(n) ? DEFAULT_PRICING[key] : n;
  });
  return values as PricingValues;
}

function mergeStorage(stored: unknown): PricingValues {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PRICING };
  const source = stored as Record<string, unknown>;
  const values: Partial<PricingValues> = {};
  (Object.keys(DEFAULT_PRICING) as Array<keyof PricingValues>).forEach((key) => {
    const n = convertToNumber(source[key]);
    values[key] = Number.isNaN(n) ? DEFAULT_PRICING[key] : n;
  });
  // Migrate the legacy hours-only deadline windows (v1 fields) into the
  // seconds-based duration fields so previously saved admin settings survive.
  const legacyCashHours = convertToNumber(source['cashPickupPaymentHours']);
  if (
    !Number.isNaN(legacyCashHours) &&
    Number.isNaN(convertToNumber(source['cashPickupPaymentWindowSeconds']))
  ) {
    values.cashPickupPaymentWindowSeconds = legacyCashHours * 3600;
  }
  const legacyOnlineHours = convertToNumber(source['onlinePaymentVerificationHours']);
  if (
    !Number.isNaN(legacyOnlineHours) &&
    Number.isNaN(convertToNumber(source['onlinePaymentVerificationWindowSeconds']))
  ) {
    values.onlinePaymentVerificationWindowSeconds = legacyOnlineHours * 3600;
  }
  return values as PricingValues;
}

const COLOR_TIERS: ColorTier[] = ['bw', 'partial', 'full'];
const PAPER_SIZES: PaperSizeKey[] = ['short', 'a4', 'long'];
const CONTENT_TYPES: ContentType[] = ['text', 'textWithImage', 'imageOnly'];
const PHOTO_SIZE_KEYS: PhotoSizeKey[] = ['2R', '3R', '4R', '5R', '6R', 'A4photo'];

function normalizeColorSize(raw: unknown, fallback: ColorSize): ColorSize {
  if (!raw || typeof raw !== 'object') {
    const out = {} as ColorSize;
    COLOR_TIERS.forEach((t) => {
      out[t] = { ...fallback[t] };
    });
    return out;
  }
  const source = raw as Record<string, unknown>;
  const out = {} as ColorSize;
  COLOR_TIERS.forEach((t) => {
    out[t] = { ...fallback[t] };
    const tier = source[t] as Record<string, unknown> | undefined;
    if (tier && typeof tier === 'object') {
      PAPER_SIZES.forEach((s) => {
        const n = convertToNumber(tier[s]);
        if (!Number.isNaN(n)) out[t][s] = n;
      });
    }
  });
  return out;
}

function normalizeMatrix(raw: unknown): PricingMatrix {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const document = {} as DocumentMatrix;
  CONTENT_TYPES.forEach((ct) => {
    document[ct] = normalizeColorSize(src.document as unknown, DEFAULT_MATRIX.document[ct]);
  });

  const vellum = normalizeColorSize(src.vellum as unknown, DEFAULT_MATRIX.vellum);

  const sticker: StickerMatrix = { ...DEFAULT_MATRIX.sticker };
  const stickerRaw = src.sticker as Record<string, unknown> | undefined;
  if (stickerRaw && typeof stickerRaw === 'object') {
    COLOR_TIERS.forEach((t) => {
      const n = convertToNumber(stickerRaw[t]);
      if (!Number.isNaN(n)) sticker[t] = n;
    });
  }

  const photo: PhotoMatrix = { ...DEFAULT_MATRIX.photo };
  const photoRaw = src.photo as Record<string, unknown> | undefined;
  if (photoRaw && typeof photoRaw === 'object') {
    PHOTO_SIZE_KEYS.forEach((k) => {
      const item = photoRaw[k] as Record<string, unknown> | undefined;
      if (item && typeof item === 'object') {
        const price = convertToNumber(item.price);
        const minQty = convertToNumber(item.minQty);
        photo[k] = {
          price: Number.isNaN(price) ? DEFAULT_MATRIX.photo[k].price : price,
          minQty: Number.isNaN(minQty) ? DEFAULT_MATRIX.photo[k].minQty : Math.max(1, minQty),
        };
      }
    });
  }

  return { document, vellum, sticker, photo };
}

// ── matrix-cell row helpers (DB ↔ store) ────────────────────────────────────
// A cell's natural key is its service/content/color/paper/photo path — the
// same identity the bootstrap seed and the admin page use.

function matrixRowKey(row: MatrixCellRow): string {
  return cellKey(row.service_type, row.content_type, row.color_tier, row.paper_size, row.photo_size);
}

function cellKey(
  service: string,
  contentType: string | null,
  colorTier: string | null,
  paperSize: string | null,
  photoSize: string | null,
): string {
  return [service, contentType ?? '', colorTier ?? '', paperSize ?? '', photoSize ?? ''].join(':');
}

// Apply one DB cell row onto a matrix, guarding shapes so a partially-seeded or
// hand-edited table overlays cleanly (only valid cells win; invalid ones keep
// the current/default value).
function applyMatrixRow(matrix: PricingMatrix, row: MatrixCellRow): void {
  if (
    row.service_type === 'document' &&
    row.content_type &&
    row.color_tier &&
    row.paper_size
  ) {
    const ct = row.content_type as ContentType;
    const tier = row.color_tier as ColorTier;
    const size = row.paper_size as PaperSizeKey;
    const price = convertToNumber(row.price);
    if (matrix.document[ct]?.[tier]?.[size] && !Number.isNaN(price)) {
      matrix.document[ct][tier][size] = price;
    }
    return;
  }

  if (
    row.service_type === 'vellum' &&
    !row.content_type &&
    row.color_tier &&
    row.paper_size
  ) {
    const tier = row.color_tier as ColorTier;
    const size = row.paper_size as PaperSizeKey;
    const price = convertToNumber(row.price);
    if (matrix.vellum[tier]?.[size] && !Number.isNaN(price)) {
      matrix.vellum[tier][size] = price;
    }
    return;
  }

  if (
    row.service_type === 'sticker' &&
    !row.content_type &&
    row.color_tier &&
    !row.paper_size &&
    !row.photo_size
  ) {
    const tier = row.color_tier as ColorTier;
    const price = convertToNumber(row.price);
    if (tier in matrix.sticker && !Number.isNaN(price)) {
      matrix.sticker[tier] = price;
    }
    return;
  }

  if (row.service_type === 'photo' && row.photo_size) {
    const size = row.photo_size as PhotoSizeKey;
    const current = matrix.photo[size];
    if (!current) return;
    const price = convertToNumber(row.price);
    const minQty = convertToNumber(row.minimum_quantity);
    matrix.photo[size] = {
      price: !Number.isNaN(price) ? price : current.price,
      minQty: !Number.isNaN(minQty) ? Math.max(1, minQty) : current.minQty,
    };
  }
}

class PricingStore {
  private pricing: PricingValues = { ...DEFAULT_PRICING };
  private matrix: PricingMatrix = normalizeMatrix(undefined);
  private subscribers: Set<Subscriber> = new Set();
  private initialized = false;
  // Row-id map keyed by the matrix cell's natural key (service/content/color/
  // paper/photo path) so a cell edit can target the existing DB row by id.
  private remoteCellIds: Map<string, string> = new Map();
  private hydrating = false;

  constructor() {
    this.load();

    // Cross-tab live sync: an admin editing pricing in another tab writes the
    // mirror; the `storage` event reloads it here so every open page updates.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY && e.key !== `${STORAGE_KEY}_version`) return;
      this.reloadFromLocalStorage();
    });

    // Backend sync: realtime fires when ANY device edits pricing (admin table
    // edits, reset, another browser), so the DB snapshot replaces the mirror.
    subscribeTableChanges('pricing_settings', () => {
      void this.hydrate();
    });
    subscribeTableChanges('pricing_matrix_cells', () => {
      void this.hydrate();
    });

    void this.hydrate();
  }

  private load(): void {
    if (this.initialized) return;
    try {
      const storedVersion = localStorage.getItem(`${STORAGE_KEY}_version`);
      const stored = localStorage.getItem(STORAGE_KEY);
      let parsed: Record<string, unknown> = {};
      if (stored) {
        try {
          parsed = JSON.parse(stored);
        } catch {
          parsed = {};
        }
      }
      if (!stored || storedVersion !== STORAGE_VERSION) {
        this.pricing = { ...DEFAULT_PRICING };
        this.matrix = normalizeMatrix(undefined);
        localStorage.setItem(`${STORAGE_KEY}_version`, STORAGE_VERSION);
        this.save();
      } else {
        this.pricing = mergeStorage(parsed);
        this.matrix = normalizeMatrix(parsed.matrix);
      }
    } catch (error) {
      console.error('Failed to load pricing:', error);
      this.pricing = { ...DEFAULT_PRICING };
      this.matrix = normalizeMatrix(undefined);
    }
    this.initialized = true;
  }

  // Re-read the pricing mirror unconditionally (ignores the `initialized`
  // guard) and notify. Used by the cross-tab `storage` listener so an edit
  // made in another tab replaces the in-memory snapshot and every subscriber
  // re-renders.
  private reloadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.pricing = mergeStorage(parsed);
        this.matrix = normalizeMatrix((parsed as Record<string, unknown>).matrix);
      }
      this.notify();
    } catch (error) {
      console.error('Failed to reload pricing from localStorage:', error);
    }
  }

  // Pull the latest snapshot from Supabase. The DB wins whenever it returns
  // rows (per-field / per-cell, so a partially-seeded table still overlays
  // what exists onto the mirror); when the tables are empty/unreachable (anon
  // visitor, offline) the local mirror is kept. Concurrent calls dedupe.
  private async hydrate(): Promise<void> {
    if (this.hydrating) return;
    this.hydrating = true;
    await authReady;
    try {
      await this.hydrateSettings();
      await this.hydrateMatrix();
    } catch (err) {
      console.warn('[pricing] hydration kept local data:', err);
    } finally {
      this.hydrating = false;
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles: a fresh
  // incognito boot ran with the anonymous token, so the DB rows appear the
  // moment the user logs in without needing a page reload).
  async refreshFromBackend(): Promise<void> {
    await this.hydrate();
  }

  private async hydrateSettings(): Promise<void> {
    try {
      const row = await fetchPricingSettings();
      if (!row) return; // not seeded yet — keep the local mirror
      const next: PricingValues = { ...this.pricing };
      const pairs: Array<[keyof PricingValues, unknown]> = [
        ['bw', row.bw],
        ['colorLow', row.color_low],
        ['colorHigh', row.color_high],
        ['sizeLongLegalFolio', row.size_long_legal_folio],
        ['sizeA3', row.size_a3],
        ['duplexSavings', row.duplex_savings],
        ['downPaymentThreshold', row.down_payment_threshold],
        ['fullPaymentThreshold', row.full_payment_threshold],
        ['cashPickupPaymentWindowSeconds', row.cash_payment_window_seconds],
        ['onlinePaymentVerificationWindowSeconds', row.online_payment_window_seconds],
      ];
      let changed = false;
      for (const [key, value] of pairs) {
        const n = convertToNumber(value);
        if (!Number.isNaN(n) && n !== next[key]) {
          next[key] = n;
          changed = true;
        }
      }
      if (changed) {
        this.pricing = next;
        this.save();
        this.notify();
      }
    } catch {
      // Mirrors the fail-open pattern of the other facades; the outer hydrate
      // logs a single warn.
    }
  }

  private async hydrateMatrix(): Promise<void> {
    try {
      const rows = await fetchMatrixCells();
      if (rows.length === 0) return; // not seeded yet — keep the local mirror
      const next = normalizeMatrix(this.matrix);
      const ids: Map<string, string> = new Map();
      for (const row of rows) {
        ids.set(matrixRowKey(row), row.id);
        applyMatrixRow(next, row);
      }
      this.matrix = next;
      this.remoteCellIds = ids;
      this.save();
      this.notify();
    } catch {
      // outer hydrate logs a single warn
    }
  }

  // Build the full settings row (camelCase store → snake_case DB columns)
  // from the current pricing snapshot for a best-effort remote sync.
  private settingsPatch(): Omit<PricingSettingsRow, 'id' | 'updated_at'> {
    const p = this.pricing;
    return {
      bw: p.bw,
      color_low: p.colorLow,
      color_high: p.colorHigh,
      size_long_legal_folio: p.sizeLongLegalFolio,
      size_a3: p.sizeA3,
      duplex_savings: p.duplexSavings,
      down_payment_threshold: p.downPaymentThreshold,
      full_payment_threshold: p.fullPaymentThreshold,
      cash_payment_window_seconds: p.cashPickupPaymentWindowSeconds,
      online_payment_window_seconds: p.onlinePaymentVerificationWindowSeconds,
      updated_by: null,
    };
  }

  // Best-effort push of the whole settings row. RLS-denied writes (e.g. a
  // customer being prevented from editing pricing) degrade quietly; every
  // other failure is surfaced so a silently-unreflected admin edit is never
  // mistaken for a successful sync.
  private async syncSettings(): Promise<void> {
    try {
      await upsertPricingSettings(this.settingsPatch());
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('pricing.update', err);
      else console.warn('[pricing] settings not synced (RLS):', err);
    }
  }

  // Best-effort DB write of a single matrix cell (admin cell edit). The row id
  // is looked up from the hydrate snapshot so an existing cell is updated in
  // place; an unknown cell (server row the store hasn't seen yet) inserts.
  private async syncCell(service: ServiceType, path: string[], value: number): Promise<void> {
    const cell = this.cellInsertFor(service, path, value);
    if (!cell) return;
    try {
      await saveMatrixCell({ id: this.lookupCellId(cell), cell });
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('pricing.update', err);
      else console.warn('[pricing] matrix cell not synced (RLS):', err);
    }
  }

  private cellInsertFor(service: ServiceType, path: string[], value: number): MatrixCellInsert | null {
    if (service === 'document') {
      if (path.length !== 3) return null;
      const [content, tier, size] = path as [ContentType, ColorTier, PaperSizeKey];
      if (!this.matrix.document[content]?.[tier]?.[size]) return null;
      return {
        service_type: 'document',
        content_type: content,
        color_tier: tier,
        paper_size: size,
        photo_size: null,
        price: value,
        minimum_quantity: null,
      };
    }
    if (service === 'vellum') {
      if (path.length !== 2) return null;
      const [tier, size] = path as [ColorTier, PaperSizeKey];
      if (!this.matrix.vellum[tier]?.[size]) return null;
      return {
        service_type: 'vellum',
        content_type: null,
        color_tier: tier,
        paper_size: size,
        photo_size: null,
        price: value,
        minimum_quantity: null,
      };
    }
    if (service === 'sticker') {
      if (path.length !== 1) return null;
      const [tier] = path as [ColorTier];
      if (!(tier in this.matrix.sticker)) return null;
      return {
        service_type: 'sticker',
        content_type: null,
        color_tier: tier,
        paper_size: null,
        photo_size: null,
        price: value,
        minimum_quantity: null,
      };
    }
    if (service === 'photo') {
      if (path.length !== 2) return null;
      const [size, field] = path as [PhotoSizeKey, 'price' | 'minQty'];
      const current = this.matrix.photo[size];
      if (!current) return null;
      return {
        service_type: 'photo',
        content_type: null,
        color_tier: null,
        paper_size: null,
        photo_size: size,
        price: field === 'price' ? value : current.price,
        minimum_quantity: field === 'minQty' ? value : current.minQty,
      };
    }
    return null;
  }

  private lookupCellId(cell: MatrixCellInsert): string | undefined {
    if (!cell.service_type) return undefined;
    return this.remoteCellIds.get(
      cellKey(cell.service_type, cell.content_type ?? null, cell.color_tier ?? null, cell.paper_size ?? null, cell.photo_size ?? null),
    );
  }

  // Rebuild the full matrix as DB insert rows (used for setMatrix / reset).
  private allCellInserts(): MatrixCellInsert[] {
    const cells: MatrixCellInsert[] = [];
    for (const ct of CONTENT_TYPES) {
      for (const tier of COLOR_TIERS) {
        for (const size of PAPER_SIZES) {
          cells.push({
            service_type: 'document',
            content_type: ct,
            color_tier: tier,
            paper_size: size,
            photo_size: null,
            price: this.matrix.document[ct][tier][size],
            minimum_quantity: null,
          });
        }
      }
    }
    for (const tier of COLOR_TIERS) {
      for (const size of PAPER_SIZES) {
        cells.push({
          service_type: 'vellum',
          content_type: null,
          color_tier: tier,
          paper_size: size,
          photo_size: null,
          price: this.matrix.vellum[tier][size],
          minimum_quantity: null,
        });
      }
    }
    for (const tier of COLOR_TIERS) {
      cells.push({
        service_type: 'sticker',
        content_type: null,
        color_tier: tier,
        paper_size: null,
        photo_size: null,
        price: this.matrix.sticker[tier],
        minimum_quantity: null,
      });
    }
    for (const size of PHOTO_SIZE_KEYS) {
      cells.push({
        service_type: 'photo',
        content_type: null,
        color_tier: null,
        paper_size: null,
        photo_size: size,
        price: this.matrix.photo[size].price,
        minimum_quantity: this.matrix.photo[size].minQty,
      });
    }
    return cells;
  }

  // Best-effort full replacement of the cell table (setMatrix / reset).
  private async replaceRemote(): Promise<void> {
    try {
      await replaceMatrixCells(this.allCellInserts());
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('pricing.update', err);
      else console.warn('[pricing] matrix not replaced (RLS):', err);
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...this.pricing,
          matrix: this.matrix,
        }),
      );
    } catch (error) {
      console.error('Failed to save pricing:', error);
    }
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }

  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  getPricing(): PricingValues {
    this.load();
    return { ...this.pricing };
  }

  // Admin editing: a single value at a time (from the pricing page dialog).
  updatePricing(key: keyof PricingValues, value: number): boolean {
    if (!(key in DEFAULT_PRICING) || !Number.isFinite(value) || value < 0) {
      return false;
    }
    const previous = this.pricing[key];
    this.pricing = { ...this.pricing, [key]: value };
    this.save();
    this.notify();
    void this.syncSettings();
    auditLogStore.record({
      module: 'Pricing',
      action: 'Updated',
      reference: `Pricing — ${pricingFieldLabel(key)}`,
      entityType: 'Pricing',
      entityId: key,
      title: 'Pricing Setting Updated',
      description: `Changed the pricing setting "${pricingFieldLabel(key)}" from ${previous} to ${value}.`,
      changes: [{ field: pricingFieldLabel(key), previous: String(previous), next: String(value) }],
    });
    return true;
  }

  // Get a deep copy of the full pricing matrix.
  getMatrix(): PricingMatrix {
    this.load();
    return JSON.parse(JSON.stringify(this.matrix)) as PricingMatrix;
  }

  // Admin editing of the matrix. The path selects the exact cell:
  //   document:  [content, tier, size]
  //   vellum:    [tier, size]
  //   sticker:   [tier]
  //   photo:     [size, 'price' | 'minQty']
  updateMatrixCell(
    service: ServiceType,
    path: string[],
    value: number,
  ): boolean {
    if (!Number.isFinite(value) || value < 0) return false;
    const m = JSON.parse(JSON.stringify(this.matrix)) as PricingMatrix;
    let previous = -1;
    let cellLabel = '';

    try {
      if (service === 'document') {
        if (path.length !== 3) return false;
        const [content, tier, size] = path as [ContentType, ColorTier, PaperSizeKey];
        if (!m.document[content]?.[tier]?.[size]) return false;
        previous = m.document[content][tier][size];
        m.document[content][tier][size] = value;
        cellLabel = `${CONTENT_TYPE_LABELS[content]} · ${COLOR_TIER_LABELS[tier]} · ${PAPER_SIZE_LABELS[size]}`;
      } else if (service === 'vellum') {
        if (path.length !== 2) return false;
        const [tier, size] = path as [ColorTier, PaperSizeKey];
        if (!m.vellum[tier]?.[size]) return false;
        previous = m.vellum[tier][size];
        m.vellum[tier][size] = value;
        cellLabel = `Vellum · ${COLOR_TIER_LABELS[tier]} · ${PAPER_SIZE_LABELS[size]}`;
      } else if (service === 'sticker') {
        if (path.length !== 1) return false;
        const [tier] = path as [ColorTier];
        if (!(tier in m.sticker)) return false;
        previous = m.sticker[tier];
        m.sticker[tier] = value;
        cellLabel = `Sticker · ${COLOR_TIER_LABELS[tier]}`;
      } else if (service === 'photo') {
        if (path.length !== 2) return false;
        const [size, field] = path as [PhotoSizeKey, 'price' | 'minQty'];
        if (!m.photo[size]) return false;
        previous = field === 'price' ? m.photo[size].price : m.photo[size].minQty;
        if (field === 'price') m.photo[size].price = value;
        else m.photo[size].minQty = Math.max(1, Math.floor(value));
        cellLabel = `Photo · ${PHOTO_SIZE_LABELS[size]} · ${field === 'price' ? 'Price' : 'Minimum Order'}`;
      }
    } catch {
      return false;
    }

    this.matrix = m;
    this.save();
    this.notify();
    void this.syncCell(service, path, value);
    auditLogStore.record({
      module: 'Pricing',
      action: 'Updated',
      reference: `Pricing matrix — ${cellLabel}`,
      entityType: 'Pricing',
      entityId: `${service}:${path.join('/')}`,
      title: 'Matrix Price Updated',
      description: `Changed the price for ${cellLabel} from ${previous} to ${value}.`,
      changes: [{ field: cellLabel, previous: String(previous), next: String(value) }],
    });
    return true;
  }

  // Matrix editing by service type with the full table replaced.
  setMatrix(matrix: PricingMatrix): void {
    this.matrix = normalizeMatrix(matrix);
    this.save();
    this.notify();
    void this.replaceRemote();
    auditLogStore.record({
      module: 'Pricing',
      action: 'Updated',
      reference: 'Pricing matrix',
      entityType: 'Pricing',
      entityId: 'matrix',
      title: 'Pricing Matrix Replaced',
      description: 'The full pricing matrix was rebuilt with a new set of values.',
    });
  }

  // Reset all values (legacy + matrix) back to the system defaults.
  resetPricing(): void {
    this.pricing = { ...DEFAULT_PRICING };
    this.matrix = normalizeMatrix(undefined);
    this.save();
    this.notify();
    void this.syncSettings();
    void this.replaceRemote();
    auditLogStore.record({
      module: 'Pricing',
      action: 'Updated',
      reference: 'Pricing settings',
      entityType: 'Pricing',
      entityId: 'pricing',
      title: 'Pricing Reset to Defaults',
      description: 'All pricing values and the pricing matrix were reset to the system defaults.',
      changes: [{ field: 'Pricing', previous: 'Custom values', next: 'System defaults' }],
    });
  }
}

// Human-readable label for a legacy/key per-page or order-rule pricing field,
// used by the audit log narrative.
function pricingFieldLabel(key: keyof PricingValues): string {
  switch (key) {
    case 'bw': return 'B&W price per page';
    case 'colorLow': return 'Partially colored price per page';
    case 'colorHigh': return 'Fully colored price per page';
    case 'sizeLongLegalFolio': return 'Long/Legal/Folio per-page surcharge';
    case 'sizeA3': return 'A3 per-page surcharge';
    case 'duplexSavings': return 'Double-sided savings per page';
    case 'downPaymentThreshold': return 'Down payment threshold (₱)';
    case 'fullPaymentThreshold': return 'Full payment threshold (₱)';
    case 'cashPickupPaymentWindowSeconds': return 'Cash on Pickup payment window (s)';
    case 'onlinePaymentVerificationWindowSeconds': return 'Online payment verification window (s)';
    default: return String(key);
  }
}

// Matrix price lookup helpers used by the order flows.

// Map a gallery of raw color-mode values onto the matrix color tier.
export function resolveColorTier(colorMode: 'bw' | 'colored', colorPct?: number): ColorTier {
  if (colorMode === 'bw') return 'bw';
  const pct = typeof colorPct === 'number' ? colorPct : 100;
  return pct > 50 ? 'full' : 'partial';
}

export function getPriceFromMatrix(
  matrix: PricingMatrix,
  service: ServiceType,
  input: {
    contentType?: ContentType; // used by document
    colorTier: ColorTier;
    sizeKey?: PaperSizeKey; // unused for sticker
    photoSize?: PhotoSizeKey; // photo only
    field?: 'price' | 'minQty'; // photo only
  },
): number {
  if (service === 'document') {
    const ct = input.contentType || 'text';
    const size = input.sizeKey || 'a4';
    return matrix.document[ct]?.[input.colorTier]?.[size] ?? 0;
  }
  if (service === 'vellum') {
    const size = input.sizeKey || 'a4';
    return matrix.vellum[input.colorTier]?.[size] ?? 0;
  }
  if (service === 'sticker') {
    return matrix.sticker[input.colorTier] ?? 0;
  }
  if (service === 'photo') {
    const size = input.photoSize || 'A4photo';
    const item = matrix.photo[size];
    if (!item) return 0;
    return input.field === 'minQty' ? item.minQty : item.price;
  }
  return 0;
}

// Map a raw paper-size string (as stored on a file) onto a matrix paper-size key.
// Fallback: sizes without a dedicated column (letter/legal/folio/a3) map to the
// nearest standard column.
export function mapPaperSizeKey(paperSize?: string): PaperSizeKey {
  const size = (paperSize || 'a4').toLowerCase();
  if (size === 'short') return 'short';
  if (size === 'long' || size === 'legal' || size === 'folio') return 'long';
  return 'a4'; // a4, letter, a3 and unknown sizes default to the a4 column
}

export const pricingStore = new PricingStore();

/**
 * Compute the per-page price for a sheet based on the shared pricing model.
 * Replicates the former hardcoded formula used by both new-print-request and
 * walk-in flows so they stay in lockstep.
 */
export function calcPagePrice(
  pricing: PricingValues,
  input: {
    colorMode: 'bw' | 'colored';
    colorPct?: number; // per-page color percentage; >50 → colorHigh, 1..50 → colorLow, 0/undefined+BW → bw
    paperSize?: string;
    twoSided?: string;
  },
): number {
  let price: number;
  if (input.colorMode === 'colored') {
    const pct = typeof input.colorPct === 'number' ? input.colorPct : 100;
    price = pct > 50 ? pricing.colorHigh : pct > 0 ? pricing.colorLow : pricing.bw;
  } else {
    price = pricing.bw;
  }

  const size = (input.paperSize || 'a4').toLowerCase();
  if (size === 'long' || size === 'folio' || size === 'legal') {
    price += pricing.sizeLongLegalFolio;
  } else if (size === 'a3') {
    price += pricing.sizeA3;
  }

  if (input.twoSided === 'yes') {
    price -= pricing.duplexSavings;
  }

  return Math.max(price, 0);
}

// Shared formatting helper so every consumer labels prices identically.
export function formatPrice(value: number): string {
  return `₱${value.toFixed(2)}`;
}

// Compact human label for a duration stored as total seconds
// (0 = no expiry). e.g. 172800 → "2 days", 5400 → "1 hr 30 min", 45 → "45 sec".
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Never";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h > 0) parts.push(`${h} hr`);
  if (m > 0) parts.push(`${m} min`);
  if (sec > 0) parts.push(`${sec} sec`);
  return parts.length > 0 ? parts.join(" ") : "0 sec";
}