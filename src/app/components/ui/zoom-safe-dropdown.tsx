import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Plain anchored dropdown.
 *
 * The trigger is wrapped in a `relative` container and the list renders as an
 * `absolute` child underneath it, so it stays aligned to the trigger at any
 * browser zoom without any portal or viewport measurement.
 *
 * Accessibility contract (this is a listbox popup, not a menu):
 * - the trigger is a button with `aria-haspopup="listbox"`, `aria-expanded` and
 *   `aria-controls`; give it a `label` so a screen reader hears what the control
 *   selects ("Paper size"), not just the current value ("A4");
 * - opening moves focus into the listbox, Arrow/Home/End move between options,
 *   Enter/Space select, Escape closes and returns focus to the trigger, Tab
 *   closes and lets focus continue;
 * - the trigger keeps a visible focus ring (`focus-visible`), never a bare
 *   `outline-none`.
 *
 * Pass `applied` when the selected value is narrowing a list (i.e. it is not the
 * control's default) — the trigger then takes the pale-blue "applied" surface, so
 * a filtered list is visible without opening anything.
 */
type DropdownOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

function enabledIndexesOf(options: DropdownOption[]): number[] {
  return options.reduce<number[]>((acc, option, index) => {
    if (!option.disabled) acc.push(index);
    return acc;
  }, []);
}

export function ZoomSafeDropdown({
  value,
  onChange,
  options,
  placeholder = "Select",
  icon: Icon,
  className = "",
  triggerClassName = "",
  disabled = false,
  applied = false,
  label,
}: {
  value?: string;
  onChange?: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  applied?: boolean;
  /** Accessible name for the control, e.g. "Paper size". */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openList = (direction: 1 | -1 = 1) => {
    if (disabled) return;
    const enabled = enabledIndexesOf(options);
    if (enabled.length === 0) return;
    const selected = options.findIndex((o) => o.value === value && !o.disabled);
    const nextIndex =
      selected >= 0
        ? selected
        : direction === 1
          ? enabled[0]
          : enabled[enabled.length - 1];
    setActiveIndex(nextIndex);
    setOpen(true);
  };

  // Roving focus: the option that is "active" owns the real DOM focus, so a
  // screen reader announces it and the browser can scroll it into view.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const marked = open || applied;

  const move = (direction: 1 | -1) => {
    const enabled = enabledIndexesOf(options);
    if (enabled.length === 0) return;
    const current = enabled.indexOf(activeIndex);
    const next =
      current === -1
        ? direction === 1
          ? enabled[0]
          : enabled[enabled.length - 1]
        : enabled[(current + direction + enabled.length) % enabled.length];
    setActiveIndex(next);
  };

  const selectActive = () => {
    const option = options[activeIndex];
    if (!option || option.disabled) return;
    onChange?.(option.value);
    closeAndFocusTrigger();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) setOpen(false);
      else openList(1);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const enabled = enabledIndexesOf(options);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        if (enabled.length) setActiveIndex(enabled[0]);
        break;
      case "End":
        e.preventDefault();
        if (enabled.length) setActiveIndex(enabled[enabled.length - 1]);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectActive();
        break;
      case "Escape":
        e.preventDefault();
        closeAndFocusTrigger();
        break;
      case "Tab":
        // Let focus continue to the next control, but close the popup first.
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openList(1);
        }}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label || placeholder}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm transition-colors outline-none focus-visible:border-[#2F6FD6] focus-visible:ring-[3px] focus-visible:ring-[#2F6FD6]/20 disabled:cursor-not-allowed disabled:border-[#E4E7EC] disabled:bg-[#F8FAFC] disabled:text-[#9AA4B2] ${
          open
            ? "border-[#2F6FD6] ring-[3px] ring-[#2F6FD6]/20"
            : applied
              ? "border-[#9CBBEC] bg-[#F4F8FE]"
              : "border-[#D5DCE6] bg-white hover:border-[#B7C3D4]"
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <span className="shrink-0">{Icon}</span>}
          <span
            className={`truncate ${applied ? "font-semibold text-[#1F4E9C]" : "text-[#1E293B]"}`}
          >
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform${open ? " rotate-180" : ""} ${
            marked ? "text-[#1F4E9C]" : "text-[#98A2B3]"
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[10rem] overflow-hidden rounded-[10px] border border-[#E4EBF5] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.13)]">
          <ul
            id={listId}
            role="listbox"
            aria-label={label || placeholder}
            className="p-1 max-h-60 overflow-auto"
            onKeyDown={onListKeyDown}
          >
            {options.map((o, index) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  tabIndex={-1}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange?.(o.value);
                    closeAndFocusTrigger();
                  }}
                  className={`flex select-none items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm outline-none ${
                    o.disabled
                      ? "cursor-not-allowed text-[#B4BCC8]"
                      : "cursor-pointer hover:bg-[#F2F7FF] focus-visible:bg-[#F2F7FF] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9CBBEC]"
                  }${isSelected ? " bg-[#F2F7FF] font-semibold text-[#2F6FD6]" : " text-gray-700"}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {o.icon && <span className="shrink-0">{o.icon}</span>}
                    {o.label}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[#2F6FD6]" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Action dropdown — no controlled value, fires onSelect only.
 * Useful for "pick to insert" actions (e.g. note templates).
 *
 * Same listbox/keyboard/focus contract as `ZoomSafeDropdown`.
 */
export function ZoomSafeActionDropdown({
  onSelect,
  options,
  placeholder = "Select",
  icon,
  className = "",
  triggerClassName = "",
  disabled = false,
  label,
}: {
  onSelect: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Accessible name for the control, e.g. "Note template". */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openList = () => {
    if (disabled || options.length === 0) return;
    setActiveIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) setOpen(false);
      else openList();
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const option = options[activeIndex];
        if (!option) break;
        onSelect(option.value);
        closeAndFocusTrigger();
        break;
      }
      case "Escape":
        e.preventDefault();
        closeAndFocusTrigger();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label || placeholder}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm transition-colors outline-none focus-visible:border-[#2F6FD6] focus-visible:ring-[3px] focus-visible:ring-[#2F6FD6]/20 disabled:cursor-not-allowed disabled:border-[#E4E7EC] disabled:bg-[#F8FAFC] disabled:text-[#9AA4B2] ${
          open
            ? "border-[#2F6FD6] ring-[3px] ring-[#2F6FD6]/20"
            : "border-[#D5DCE6] bg-white hover:border-[#B7C3D4]"
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate text-[#1E293B]">{placeholder}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform${open ? " rotate-180 text-[#1F4E9C]" : " text-[#98A2B3]"}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[10rem] overflow-hidden rounded-[10px] border border-[#E4EBF5] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.13)]">
          <ul
            id={listId}
            role="listbox"
            aria-label={label || placeholder}
            className="p-1 max-h-60 overflow-auto"
            onKeyDown={onListKeyDown}
          >
            {options.map((o, index) => (
              <li
                key={o.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                role="option"
                aria-selected={false}
                tabIndex={-1}
                onClick={() => {
                  onSelect(o.value);
                  closeAndFocusTrigger();
                }}
                className="flex cursor-pointer select-none items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm text-gray-700 outline-none hover:bg-[#F2F7FF] focus-visible:bg-[#F2F7FF] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9CBBEC]"
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
