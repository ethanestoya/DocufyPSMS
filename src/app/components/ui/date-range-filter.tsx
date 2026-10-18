import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";

import { Calendar } from "./calendar";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";
import { cn } from "./utils";

export interface DateRangeValue {
  from: string;
  to: string;
}

// `YYYY-MM-DD` is the canonical STORED format — it sorts correctly as a plain
// string, so every filter comparison stays a cheap `<`/`>` on strings. The parts
// may be one or two digits so "2026-1-5" still resolves when ISO is pasted in.
const ISO_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
// The user-facing entry/display format is strictly MM/DD/YYYY — month first,
// never ambiguous, and it matches the masked input the user actually types into.
const SHORT_RE = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject rolled-over dates (e.g. Feb 31) by round-tripping through Date.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Parse what the user typed into a `YYYY-MM-DD` string, or null when it isn't a
 * complete valid date yet. Typed entry is month-first (`10/05/2026`, `10/5/26`,
 * and the `MM/DD/YYYY` the mask builds for you); a pasted ISO date is accepted
 * too, since people copy dates out of spreadsheets and other tools.
 */
export function parseDateInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = ISO_RE.exec(value);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const short = SHORT_RE.exec(value);
  if (short) {
    let year = Number(short[3]);
    if (short[3].length === 2) year += year < 70 ? 2000 : 1900;
    return isoFromParts(year, Number(short[1]), Number(short[2]));
  }

  return null;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const match = ISO_RE.exec(iso.trim());
  if (!match) return undefined;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Canonical `YYYY-MM-DD` → the `MM/DD/YYYY` the user reads and types. */
function isoToDisplay(iso: string): string {
  const date = isoToDate(iso);
  if (!date) return "";
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

/**
 * Insert the `/` separators as the user types, so nobody has to type them:
 * `1`,`0`,`0` → `10/0`, then `5` → `10/05`, then the year → `10/05/2026`.
 *
 * A group is only closed once a digit actually FOLLOWS it, so the slash appears
 * at exactly the keystroke that needs it. Rebuilding the mask from the raw value
 * on every change is what makes backspace behave — deleting back through a
 * separator leaves the digits intact (`10/05/2026` → `10/05/202` → `10/05/2` →
 * `10/05` → `10/0` → `1`), instead of parking a trailing slash that swallows
 * keypresses. A separator the user typed themselves is normalized to `/`, and a
 * pasted ISO date is converted rather than read as month `2026`.
 */
export function formatTypedDate(raw: string): string {
  const trimmed = raw.trim();
  if (ISO_RE.test(trimmed)) return isoToDisplay(trimmed);

  const chars = raw.split("");
  let out = "";
  let digits = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (char >= "0" && char <= "9") {
      if (digits === 8) break;
      out += char;
      digits += 1;
      if (digits === 2 || digits === 4) {
        const moreDigitsFollow = chars
          .slice(index + 1)
          .some((next) => next >= "0" && next <= "9");
        if (moreDigitsFollow) out += "/";
      }
    } else if (digits > 0 && !out.endsWith("/")) {
      out += "/";
    }
  }
  return out;
}

function clamp(value: string, bound: string | undefined, direction: "min" | "max"): string {
  if (!value || !bound) return value;
  if (direction === "max" && value > bound) return bound;
  if (direction === "min" && value < bound) return bound;
  return value;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** Omit to render no labels at all (the caller's own heading is enough). */
  fromLabel?: React.ReactNode;
  toLabel?: React.ReactNode;
  separator?: React.ReactNode;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  fromAriaLabel?: string;
  toAriaLabel?: string;
  /** Hard bounds enforced on both the calendar and typed input. */
  min?: string;
  max?: string;
  /** Render each label inline before its box instead of stacked above. */
  labelsInline?: boolean;
  compact?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Date-range filter used by every list toolbar in the app. Replaces the native
 * `type="date"` pair: clicking either box opens a real month calendar (works on
 * mobile too), while both boxes stay typeable for a keyboard user.
 *
 * Entry and display are `MM/DD/YYYY` — the mask inserts the `/` separators while
 * you type, so the box fills itself (`10052026` reads as `10/05/2026`) — and the
 * two boxes share ONE calendar, so picking a start then an end is the same gesture
 * as the native picker. Values stay `YYYY-MM-DD` strings on the way in and out, so
 * filters can't drift across timezones and callers keep plain string comparisons.
 */
export function DateRangeFilter({
  value,
  onChange,
  fromLabel,
  toLabel,
  separator = "to",
  fromPlaceholder = "MM/DD/YYYY",
  toPlaceholder = "MM/DD/YYYY",
  fromAriaLabel = "From date",
  toAriaLabel = "To date",
  min,
  max,
  labelsInline = false,
  compact = false,
  className,
  inputClassName,
}: DateRangeFilterProps) {
  const [open, setOpen] = React.useState(false);
  // The box shows MM/DD/YYYY while the filter still speaks YYYY-MM-DD, so the
  // display text is derived state and never the source of truth.
  const [fromText, setFromText] = React.useState(() => isoToDisplay(value.from));
  const [toText, setToText] = React.useState(() => isoToDisplay(value.to));
  // While a box has focus its text is the user's, not the filter's — otherwise
  // a calendar pick would overwrite what they're still typing.
  const editing = React.useRef<"from" | "to" | null>(null);

  React.useEffect(() => {
    if (editing.current !== "from") setFromText(isoToDisplay(value.from));
  }, [value.from]);

  React.useEffect(() => {
    if (editing.current !== "to") setToText(isoToDisplay(value.to));
  }, [value.to]);

  const commit = React.useCallback(
    (patch: Partial<DateRangeValue>) => {
      let from = patch.from !== undefined ? patch.from : value.from;
      let to = patch.to !== undefined ? patch.to : value.to;
      from = clamp(from, min, "min");
      from = clamp(from, max, "max");
      to = clamp(to, min, "min");
      to = clamp(to, max, "max");
      // Keep From <= To even when typed, not just when picked from the calendar.
      if (from && to && from > to) {
        if (patch.from !== undefined) to = from;
        else from = to;
      }
      onChange({ from, to });
    },
    [max, min, onChange, value.from, value.to],
  );

  const handleType = React.useCallback(
    (side: "from" | "to", raw: string) => {
      // Run the keystroke through the mask first, so the box shows the `/` even
      // though the browser hands us the pre-format value.
      const text = formatTypedDate(raw);
      if (side === "from") setFromText(text);
      else setToText(text);
      if (text.trim() === "") {
        commit({ [side]: "" } as Partial<DateRangeValue>);
        return;
      }
      const parsed = parseDateInput(text);
      if (parsed) commit({ [side]: parsed } as Partial<DateRangeValue>);
    },
    [commit],
  );

  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      const next: DateRangeValue = {
        from: range?.from ? dateToIso(range.from) : "",
        to: range?.to ? dateToIso(range.to) : "",
      };
      setFromText(isoToDisplay(next.from));
      setToText(isoToDisplay(next.to));
      commit(next);
    },
    [commit],
  );

  const selected = React.useMemo<DateRange>(
    () => ({ from: isoToDate(value.from), to: isoToDate(value.to) }),
    [value.from, value.to],
  );

  // DayPicker's Matcher is a union of CONCRETE shapes ({before} / {after} /
// both), never one object with optional keys — so pick the shape explicitly.
const disabled = React.useMemo<Matcher | undefined>(() => {
    const after = max ? isoToDate(max) : undefined;
    const before = min ? isoToDate(min) : undefined;
    if (after && before) return { after, before };
    if (after) return { after };
    if (before) return { before };
    return undefined;
  }, [max, min]);

  // The calendar jumps to whatever month the typed value lives in.
  const defaultMonth = isoToDate(value.from) ?? isoToDate(value.to);

  // A date range that is set is a filter that is narrowing the list, so the two
  // boxes take the "applied" treatment (pale blue fill, blue hairline, bolder
  // value) and their labels go blue with a dot — legible without opening the
  // calendar.
  const applied = Boolean(value.from || value.to);

  const boxClass = cn(
    "h-9 rounded-[10px] bg-white pr-10 text-sm",
    compact && "text-xs",
    applied && "border-[#9CBBEC] bg-[#F4F8FE] font-semibold text-[#1F4E9C]",
    inputClassName,
  );

  const renderBox = (side: "from" | "to") => {
    const input = (
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={side === "from" ? fromAriaLabel : toAriaLabel}
        placeholder={side === "from" ? fromPlaceholder : toPlaceholder}
        value={side === "from" ? fromText : toText}
        onChange={(event) => handleType(side, event.target.value)}
        onFocus={() => {
          editing.current = side;
          setOpen(true);
        }}
        onBlur={() => {
          if (editing.current === side) editing.current = null;
        }}
        className={boxClass}
      />
    );

    const icon = (
      <button
        type="button"
        // Keep focus in the input so the popover doesn't close the instant the
        // calendar is clicked.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close calendar" : "Open calendar"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-slate-400 transition-colors hover:text-[#2F6FD6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6FD6]/40"
      >
        <CalendarIcon className={cn("h-4 w-4", compact && "h-3.5 w-3.5")} />
      </button>
    );

    const label =
      side === "from" ? fromLabel : toLabel ? toLabel : undefined;

    return (
      <React.Fragment key={side}>
        {label ? (
          labelsInline ? (
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                  applied ? "text-[#2F6FD6]" : "text-[#54606E]",
                  compact && "text-[11px]",
                )}
              >
                {applied ? (
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F6FD6]" />
                ) : null}
                {label}
              </span>
              <span className="relative flex-1">
                {input}
                {icon}
              </span>
            </span>
          ) : (
            <div className="min-w-0">
              <Label
                className={cn(
                  "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
                  applied ? "text-[#2F6FD6]" : "text-gray-500",
                  compact && "text-[10px]",
                )}
              >
                {applied ? (
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F6FD6]" />
                ) : null}
                {label}
              </Label>
              <div className="relative">{input}{icon}</div>
            </div>
          )
        ) : (
          <div className="relative min-w-0 flex-1">
            {input}
            {icon}
          </div>
        )}
      </React.Fragment>
    );
  };

  const hasRange = Boolean(value.from || value.to);
  // Only label-our-own boxes need the literal "to" between them — when each box
  // already carries a From/To label it would be redundant noise.
  const showSeparator = !labelsInline && fromLabel === undefined && separator !== null;

  return (
    <div className={cn("min-w-0", className)}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        // Opening on focus means moving focus into the calendar would otherwise
        // immediately dismiss it.
        modal={false}
      >
        <PopoverAnchor asChild>
          <div className={cn("flex items-center gap-2", labelsInline && "flex-wrap")}>
            {renderBox("from")}
            {showSeparator ? (
              <span aria-hidden="true" className="shrink-0 text-sm text-slate-400">
                {separator}
              </span>
            ) : null}
            {renderBox("to")}
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-auto p-0"
          onFocusOutside={(event) => event.preventDefault()}
        >
          <Calendar
            mode="range"
            defaultMonth={defaultMonth}
            selected={selected}
            onSelect={handleSelect}
            disabled={disabled}
            // Daylight between the two endpoints of a multi-day range reads as
            // "between these days" without needing a separate legend.
            className="p-3"
          />
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <span className="text-[11px] text-slate-500">
              {value.from && value.to
                ? `${isoToDisplay(value.from)} → ${isoToDisplay(value.to)}`
                : value.from
                  ? `${isoToDisplay(value.from)} → pick an end date`
                  : value.to
                    ? `pick a start date → ${isoToDisplay(value.to)}`
                    : "Pick a start and end date"}
            </span>
            {hasRange ? (
              <button
                type="button"
                onClick={() => {
                  setFromText("");
                  setToText("");
                  onChange({ from: "", to: "" });
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}