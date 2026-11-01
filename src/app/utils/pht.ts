// ── Philippines Time (PHT / Manila, UTC+8) — timezone-independent ──────────
// Docufy PSMS is a Philippine printing-shop system, so every product-facing
// date/time must read as Philippines (Manila) time even when the browser is in
// another timezone. Instead of blindly adding +8h (which breaks when the device
// is itself in a GMT+ zone), we resolve the Manila wall-clock through Intl's
// `timeZone: "Asia/Manila"` so it is correct on any device.

export const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

// ── Manila wall-clock component helpers ─────────────────────────────────────
// The single source of truth for "what time is it in Manila": Intl with an
// explicit Asia/Manila timezone. Works regardless of the device timezone.
const MANILA_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Manila",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

let manilaFormatter: Intl.DateTimeFormat | null = null;
function manilaParts(d: Date) {
  if (!manilaFormatter) manilaFormatter = new Intl.DateTimeFormat("en-US", MANILA_OPTS);
  const parts: Record<string, string> = {};
  manilaFormatter.formatToParts(d).forEach(p => {
    if (p.type !== "literal") parts[p.type] = p.value;
  });
  return parts;
}

function partsOf(d: Date): { y: number; mo: number; day: number; h: number; m: number; s: number } {
  const p = manilaParts(d);
  return {
    y: Number(p.year),
    mo: Number(p.month) - 1,
    day: Number(p.day),
    h: Number(p.hour === "24" ? "0" : p.hour),
    m: Number(p.minute),
    s: Number(p.second),
  };
}

// ── Internet-derived real "now" ─────────────────────────────────────────────
// "Now" should read the REAL Philippines time from the internet, not the
// viewer's (possibly wrong) device clock. We fetch the current UTC instant
// from a time API once, compute how far the device clock is off, and adjust all
// subsequent "now" reads by that delta.
let internetOffsetMs: number | null = null; // device-clock correction
let syncStarted = false;

const TIME_API = "https://worldtimeapi.org/api/timezone/Asia/Manila";
type Subscriber = () => void;
const syncSubscribers = new Set<Subscriber>();

function notifySyncSubscribers(): void {
  syncSubscribers.forEach(cb => cb());
}

// Fire the time-API fetch once (idempotent). Falls back to the device clock if
// the network/api is unavailable, so the app still works offline.
export function syncInternetTime(): Promise<void> {
  if (syncStarted) return Promise.resolve();
  syncStarted = true;
  return fetch(TIME_API)
    .then(r => r.json())
    .then(data => {
      const realUtcMs = new Date(data?.utc_datetime ?? data?.datetime).getTime();
      if (!Number.isNaN(realUtcMs)) {
        internetOffsetMs = realUtcMs - Date.now();
        notifySyncSubscribers();
      }
    })
    .catch(() => {
      // Network/API unavailable — keep using the device clock.
    });
}

// Subscribe to be notified once the internet time resolves so live clocks can
// re-render with the corrected "now". Returns an unsubscribe fn.
export function subscribeInternetTime(cb: Subscriber): () => void {
  syncSubscribers.add(cb);
  return () => syncSubscribers.delete(cb);
}

// Current real UTC instant in ms, corrected to the internet when available.
export const internetUtcMs = (): number => Date.now() + (internetOffsetMs ?? 0);

// ── Pin a real instant to the Manila wall-clock ─────────────────────────────
// Returns a Date whose DEVICE-LOCAL getters (getHours/getDate/toLocaleTimeString
// etc.) match the Manila wall-clock, so every downstream consumer that reads
// local components gets Manila time no matter the device timezone.
export const toPHT = (d: Date): Date => {
  // Never throw on an invalid date — a bad persisted value would otherwise crash
  // the whole page via Intl.formatToParts (RangeError: Invalid time value).
  if (!d || Number.isNaN(d.getTime())) return d;
  const p = partsOf(d);
  return new Date(p.y, p.mo, p.day, p.h, p.m, p.s);
};

// A Date carrying the current Manila wall-clock (use .getHours()/.getDay()/
// .getDate()/.toLocaleTimeString() on it to get PHT). Internet-corrected.
export const nowPHT = (): Date => toPHT(new Date(internetUtcMs()));

// Philippines date key (YYYY-MM-DD) for the current moment.
export const todayPHTKey = (): string => {
  const p = nowPHT();
  return `${p.getFullYear()}-${pad(p.getMonth() + 1)}-${pad(p.getDate())}`;
};

// Philippines date key (YYYY-MM-DD) for any UTC instant.
export const toPHTKey = (d: Date | string | number): string => {
  const date = toDate(d);
  if (!date) return "";
  const p = toPHT(date);
  return `${p.getFullYear()}-${pad(p.getMonth() + 1)}-${pad(p.getDate())}`;
};

const pad = (n: number): string => String(n).padStart(2, "0");

const toDate = (d: Date | string | number | null | undefined): Date | null => {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

export interface PHTimeOptions {
  hour12?: boolean;
  includeSeconds?: boolean;
}

// Format a real instant as Philippines time, e.g. "9:42 AM" / "09:42 AM".
export const formatPHTime = (
  d: Date | string | number | null | undefined,
  opts: PHTimeOptions = {},
): string => {
  const date = toDate(d);
  if (!date) return "—";
  const h12 = opts.hour12 !== false;
  const p = partsOf(date);
  const hour24 = p.h % 24;
  const h = h12 ? hour24 % 12 || 12 : hour24;
  const sec = opts.includeSeconds ? `:${pad(p.s)}` : "";
  const ampm = h12 ? (hour24 < 12 ? " AM" : " PM") : "";
  return `${pad(h)}:${pad(p.m)}${sec}${ampm}`;
};

// A stored wall-clock time ("10:00" or "10:00:00" from an <input type="time">)
// is not an instant, so it must not go through timezone conversion. This only
// rewrites it into the 12-hour form the rest of the app reads in.
export const formatClockTime = (value: string | null | undefined): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec((value ?? "").trim());
  if (!m) return value ?? "";
  const hour24 = Number(m[1]) % 24;
  const h = hour24 % 12 || 12;
  return `${h}:${m[2]}${hour24 < 12 ? " AM" : " PM"}`;
};

export type PHRange =
  | { year: "numeric"; month: "long"; day: "numeric" }
  | { weekday: "long"; year: "numeric"; month: "long"; day: "numeric" }
  | { month: "long"; day: "numeric"; year: "numeric" }
  | Intl.DateTimeFormatOptions;

// Format a real instant as a Philippines date.
export const formatPHDate = (
  d: Date | string | number | null | undefined,
  style: "short" | "long" | "full" = "long",
): string => {
  const date = toDate(d);
  if (!date) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Manila",
    ...(style === "full"
      ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
      : style === "short"
        ? { month: "short", day: "numeric", year: "numeric" }
        : { year: "numeric", month: "long", day: "numeric" }),
  };
  return new Intl.DateTimeFormat("en-PH", opts).format(date);
};

// Full PH date + time in one string.
export const formatPHDateTime = (
  d: Date | string | number | null | undefined,
): string => {
  const date = toDate(d);
  if (!date) return "—";
  return `${formatPHDate(date, "short")} · ${formatPHTime(date, { includeSeconds: false })}`;
};

// Value for an <input type="datetime-local"> expressed in the Manila wall-clock,
// so the box always shows what the system reports in regardless of device TZ.
export const toPHTInputValue = (d: Date | string | number | null | undefined): string => {
  const date = toDate(d);
  if (!date) return "";
  const p = partsOf(date);
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.day)}T${pad(p.h)}:${pad(p.m)}`;
};

// Reverse of toPHTInputValue — treat the picked "YYYY-MM-DDTHH:MM" string as a
// Manila wall-clock time and return the real UTC instant (device-independent).
export const fromPHTInputValue = (iso: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 8, mi, 0));
};
