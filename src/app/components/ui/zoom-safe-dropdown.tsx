import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Plain anchored dropdown.
 *
 * The trigger is wrapped in a `relative` container and the list renders as an
 * `absolute` child underneath it, so it stays aligned to the trigger at any
 * browser zoom without any portal or viewport measurement.
 *
 * Pass `applied` when the selected value is narrowing a list (i.e. it is not the
 * control's default) — the trigger then takes the pale-blue "applied" surface, so
 * a filtered list is visible without opening anything.
 */
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
}: {
  value?: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode; disabled?: boolean }[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  applied?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const marked = open || applied;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:border-[#E4E7EC] disabled:bg-[#F8FAFC] disabled:text-[#9AA4B2] ${
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
          <ul className="p-1 max-h-60 overflow-auto">
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  disabled={o.disabled}
                  className={`flex w-full items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm ${o.disabled ? "cursor-not-allowed text-[#B4BCC8] hover:bg-transparent" : "hover:bg-[#F2F7FF]"}${o.value === value ? " bg-[#F2F7FF] font-semibold text-[#2F6FD6]" : " text-gray-700"}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {o.icon && <span className="shrink-0">{o.icon}</span>}
                    {o.label}
                  </span>
                  {o.value === value && <Check className="h-4 w-4 shrink-0 text-[#2F6FD6]" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Action dropdown — no controlled value, fires onSelect only.
 * Useful for "pick to insert" actions (e.g. note templates).
 */
export function ZoomSafeActionDropdown({
  onSelect,
  options,
  placeholder = "Select",
  icon,
  className = "",
  triggerClassName = "",
  disabled = false,
}: {
  onSelect: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:border-[#E4E7EC] disabled:bg-[#F8FAFC] disabled:text-[#9AA4B2] ${
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
          <ul className="p-1 max-h-60 overflow-auto">
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(o.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-[#F2F7FF]"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
