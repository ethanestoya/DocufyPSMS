// Centralized landing-page content store.
// All editable text on the landing page is read from / written to this store
// (backed by localStorage "landing_content"). The LandingPage and the admin
// LandingPageEditor both import from here so they stay in sync.
//
// Supabase-backed facade: the localStorage mirror stays as the offline /
// anonymous fallback, but the DB's single `landing_content` row (the whole
// content model as one `content` jsonb blob) now drives real cross-device
// edits — an admin saving on any device updates the public page everywhere via
// realtime. Reads are open to everyone (the public landing renders
// anonymously); writes are staff/admin only.

import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady, supabase } from '../../lib/supabaseClient';
import { fetchLandingContent, upsertLandingContent } from '../../lib/db/siteContentRepo';
import type { Json } from '../../lib/database.types';
import { auditLogStore } from './auditLogStore';

export interface ServiceCardContent {
  title: string;
  description: string;
  details: Array<{ label: string; value: string }>;
  badge?: string;
}

export interface LandingPageContent {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  feature1: string;
  feature1Sub: string;
  feature2: string;
  feature2Sub: string;
  feature3: string;
  feature3Sub: string;
  shopHours: Array<{ label: string; hours: string }>;
  hoursNote: string;
  // Structured pickup-deadline source for the unclaimed-order system: the shop's
  // closing time as 24h "HH:mm". EMPTY by default (unconfigured) — when empty no
  // pickup deadline can be computed, so no unclaimed offense is derived and the
  // admin UI shows a "configure shop hours" warning. The free-text `shopHours`
  // rows stay display-only.
  shopClosingTime: string;
  locationLines: string[];
  mapEmbedUrl: string;
  contactEmail: string;
  facebookPage: string;
  facebookPageUrl: string;
  facebookMessenger: string;
  facebookMessengerUrl: string;
  aboutTitle: string;
  aboutSubtitle: string;
  aboutBody: string;
  serviceCards: ServiceCardContent[];
  authBackgroundUrl: string;
}

const STORAGE_KEY = "landing_content";

export const DEFAULT_MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3931.8605234742895!2d118.7358141!3d9.777867299999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33b5632f84660cb3%3A0x6c411581676a62cf!2sDocufy%20Printing%20Services!5e0!3m2!1sen!2sph!4v1788133073002!5m2!1sen!2sph";

const defaults: LandingPageContent = {
  heroTitle: "Print, Track #b, Succeed",
  heroSubtitle: "Your Printing Companion",
  heroDescription:
    "Upload, print, and track your documents with ease. Professional printing services designed for students and faculty.",
  feature1: "Upload documents",
  feature1Sub: "instantly",
  feature2: "Real-time",
  feature2Sub: "order tracking",
  feature3: "Secure payment",
  feature3Sub: "verification.",
  shopHours: [
    { label: "Monday - Friday", hours: "9:00 AM - 5:00 PM" },
    { label: "Saturday - Sunday", hours: "Closed" },
  ],
  hoursNote: "No noon break",
  shopClosingTime: "",
  locationLines: [
    "Palawan State University - Main Campus",
    "Room 4, TBI Building",
    "Puerto Princesa City, 5300 Palawan",
  ],
  mapEmbedUrl: DEFAULT_MAP_EMBED,
  contactEmail: "printwithdocufy@gmail.com",
  facebookPage: "Docufy",
  facebookPageUrl: "https://www.facebook.com/Docufy",
  facebookMessenger: "Docufy Printing",
  facebookMessengerUrl: "https://m.me/DocufyPrinting",
  aboutTitle: "About Docufy PSMS",
  aboutSubtitle: "Your printing companion",
  aboutBody:
    "Docufy is an online printing management system designed to make document printing and tracking easier for students, faculty, and staff. With our user-friendly platform, you can upload documents, place print orders, track your requests in real-time, and manage everything from a single dashboard. We're committed to providing fast, reliable, and affordable printing services to the academic community.",
  serviceCards: [
    {
      title: "Black & White Printing",
      description: "Standard plain-paper printing for everyday text documents.",
      details: [
        { label: "Paper sizes", value: "Short \u00b7 A4 \u00b7 Long" },
        { label: "Content", value: "Text \u00b7 Text + Image \u00b7 Image" },
      ],
    },
    {
      title: "Color Printing",
      description: "Full-color plain-paper printing for documents and presentations.",
      details: [
        { label: "Paper sizes", value: "Short \u00b7 A4 \u00b7 Long" },
        { label: "Color modes", value: "Partial \u00b7 Full" },
      ],
      badge: "POPULAR",
    },
    {
      title: "Photo, Vellum & Sticker",
      description: "Photo prints, vellum paper, and A4 sticker sheets.",
      details: [
        { label: "Photo sizes", value: "2R \u00b7 3R \u00b7 4R \u00b7 5R \u00b7 6R \u00b7 A4" },
        { label: "Materials", value: "Vellum \u00b7 Sticker (A4)" },
      ],
    },
  ],
  authBackgroundUrl: "",
};

// ─── Migration helpers ────────────────────────────────────────────────────────
// Migrate legacy flat hours / location fields that older saved blobs carry.

const LEGACY_HOURS_MIGRATION: Record<string, [string, string]> = {
  hoursMonFri: ["8:00 AM - 6:00 PM", "9:00 AM - 5:00 PM"],
  hoursMonFri6: ["9:00 AM - 6:00 PM", "9:00 AM - 5:00 PM"],
  hoursSat: ["9:00 AM - 4:00 PM", "Closed"],
  hoursSat6: ["9:00 AM - 6:00 PM", "Closed"],
};

function migrateLegacy(parsed: Record<string, any>): Partial<LandingPageContent> {
  const result: Record<string, any> = { ...parsed };

  // Legacy feature title migration (full phrase → title + subtitle split)
  if (typeof result.feature1Sub !== "string") {
    for (const n of [1, 2, 3] as const) {
      const sub = defaults[`feature${n}Sub` as keyof LandingPageContent] as string;
      const match = sub.replace(/\.$/, "");
      const title = String(result[`feature${n}`] || "");
      result[`feature${n}`] = title.includes(match)
        ? title.replace(match, "").trim()
        : title;
      result[`feature${n}Sub`] = sub;
    }
  }

  // Legacy hours values → current schedule
  for (const [key, [oldVal, newVal]] of Object.entries(LEGACY_HOURS_MIGRATION)) {
    const realKey = key.replace(/6$/, "");
    if (String(result[realKey]) === oldVal) result[realKey] = newVal;
  }

  // Legacy flat hours → structured shopHours
  if (!Array.isArray(result.shopHours)) {
    const satSun =
      String(result.hoursSat).toLowerCase() === String(result.hoursSun || "").toLowerCase()
        ? [{ label: "Saturday - Sunday", hours: String(result.hoursSat || "Closed") }]
        : [
            { label: "Saturday", hours: String(result.hoursSat || "Closed") },
            { label: "Sunday", hours: String(result.hoursSun || "Closed") },
          ];
    result.shopHours = [
      { label: "Monday - Friday", hours: String(result.hoursMonFri || "") },
      ...satSun,
    ].filter((row: any) => row.hours !== "");
    result.hoursNote = "No noon break";
  }

  // Legacy flat location → structured locationLines
  if (!Array.isArray(result.locationLines)) {
    result.locationLines = [
      result.locationCampus,
      result.locationRoom,
      result.locationBuilding,
    ].filter(Boolean);
  }

  // Legacy About blurb said "modern printing management system" — the brand is
  // an ONLINE service, so rewrite any stored copy that still uses the old wording.
  if (typeof result.aboutBody === "string" && result.aboutBody.includes("modern")) {
    result.aboutBody = result.aboutBody
      .replace(
        "a modern printing management system",
        "an online printing management system",
      )
      .replace("modern printing", "online printing");
  }

  return result;
}

// ─── Store ────────────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
let cached: LandingPageContent | null = null;
let hydrating = false;

function notify() {
  listeners.forEach((fn) => fn());
}

// Normalize a raw blob (localStorage mirror or a DB row's `content` jsonb) into
// a full content snapshot: migrate legacy fields and re-ensure the 3 service
// cards exist.
function normalizeContent(raw: unknown): LandingPageContent {
  const source = confirmServiceCards(migrateLegacyToContent(raw));
  const merged = { ...defaults, ...source };
  // Only a valid 24h "HH:mm" is accepted; anything else (legacy/garbage) is
  // treated as unconfigured so no deadline is invented from bad data.
  merged.shopClosingTime = normalizeClosingTime(merged.shopClosingTime);
  return merged;
}

// Coerce a stored closing time to a valid 24h "HH:mm", or "" when unconfigured.
function normalizeClosingTime(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function migrateLegacyToContent(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  return migrateLegacy(raw as Record<string, any>);
}

function confirmServiceCards(source: Record<string, any>): Record<string, any> {
  const out = { ...source };
  if (!Array.isArray(out.serviceCards)) {
    out.serviceCards = structuredClone(defaults.serviceCards);
    return out;
  }
  const cards = [...out.serviceCards];
  while (cards.length < defaults.serviceCards.length) {
    cards.push(structuredClone(defaults.serviceCards[cards.length]));
  }
  out.serviceCards = cards;
  return out;
}

// Best-effort mirror write that never throws (used by hydration); the public
// `save` below keeps its throw-on-failure contract so the editor can surface
// a real error instead of silently losing an edit.
function writeMirror(content: LandingPageContent): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  } catch {
    return false;
  }
  cached = content;
  return true;
}

function read(): LandingPageContent {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cached = normalizeContent(JSON.parse(raw));
      return cached;
    }
  } catch {
    // fall through
  }
  return { ...defaults };
}

function save(content: LandingPageContent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  } catch {
    // Persisting to localStorage can fail (quota exceeded, private mode,
    // storage disabled). On failure the in-memory cache is intentionally left
    // untouched so every reader stays consistent with what is actually stored,
    // and the error is re-thrown so the caller can surface a real message
    // instead of the change silently appearing to not apply.
    throw new Error("Could not persist landing page content to browser storage.");
  }
  cached = content;
  notify();
}

// Pull the latest snapshot from Supabase. The DB row (when present) wins over
// the mirror; an empty/unreachable backend keeps the local content.
async function hydrate(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  await authReady;
  try {
    const row = await fetchLandingContent();
    if (!row) return; // not seeded yet — keep the local mirror
    writeMirror(normalizeContent(row.content));
    notify();
  } catch (err) {
    console.warn('[landing-content] hydration kept local data:', err);
  } finally {
    hydrating = false;
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Best-effort push of the whole content row. RLS-denied writes degrade quietly;
// every other failure is surfaced so a silently-unreflected admin edit is never
// mistaken for a successful sync.
async function syncRemote(content: LandingPageContent): Promise<void> {
  try {
    await upsertLandingContent(content as unknown as Json, await currentUserId());
  } catch (err) {
    if (!isRlsDenied(err)) showDbError('landing-content.update', err);
    else console.warn('[landing-content] not synced (RLS):', err);
  }
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  // Cross-tab sync via storage event
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = null; // invalidate so read() re-parses
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

// Backend realtime: an admin editing the landing content from any device
// refreshes every open page.
subscribeTableChanges('landing_content', () => {
  void hydrate();
});

void hydrate();

export const landingContentStore = {
  getDefaults: () => structuredClone(defaults),
  getContent: read,
  saveContent: (content: LandingPageContent) => {
    save(content);
    auditLogStore.record({
      module: "Shop Content",
      action: "Updated",
      reference: "Landing Page",
      entityType: "Landing Page Content",
      title: "Landing Page Content Updated",
      description: "Edited the public landing page content.",
    });
    void syncRemote(content);
  },
  resetContent: () => {
    const reset = { ...defaults };
    save(reset);
    auditLogStore.record({
      module: "Shop Content",
      action: "Updated",
      reference: "Landing Page",
      entityType: "Landing Page Content",
      title: "Landing Page Content Reset",
      description: "Reset the public landing page content to the defaults.",
    });
    void syncRemote(reset);
  },
  refreshFromBackend: () => hydrate(),
  subscribe,
};
