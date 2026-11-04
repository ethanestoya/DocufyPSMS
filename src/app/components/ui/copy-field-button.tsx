import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "./utils";

// How long the "copied" tick stays up before the control returns to the copy
// glyph. Long enough to read as confirmation while the user moves to the next
// field, short enough that a stale tick is never mistaken for saved state.
const COPIED_LINGER_MS = 5000;

interface CopyFieldButtonProps {
  value?: string | null;
  /** What the toast and screen reader call it, e.g. "customer email". */
  label: string;
  className?: string;
}

// Copy-to-clipboard control for a read-only field. Renders nothing without a
// value so a record with no address never shows a dead button, and stops the
// click from reaching a clickable table row behind it.
export function CopyFieldButton({ value, label, className }: CopyFieldButtonProps) {
  const trimmed = (value ?? "").trim();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  if (!trimmed) return null;

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(
        () => setCopied(false),
        COPIED_LINGER_MS,
      );
      toast.success(`${label.charAt(0).toUpperCase()}${label.slice(1)} copied`);
    } catch {
      toast.error(`Couldn't copy the ${label}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={copied ? `Copied ${label}` : `Copy ${label}`}
      className={cn(
        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]",
        copied && "text-green-600 hover:text-green-600",
        className,
      )}
    >
      <span className="relative block h-3.5 w-3.5" aria-hidden="true">
        <Copy
          className={cn(
            "absolute inset-0 h-3.5 w-3.5 transition-all duration-200",
            copied ? "scale-50 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <Check
          strokeWidth={2.5}
          className={cn(
            "absolute inset-0 h-3.5 w-3.5 transition-all duration-200",
            copied ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </span>
    </button>
  );
}
