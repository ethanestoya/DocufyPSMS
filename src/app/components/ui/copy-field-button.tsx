import { Copy } from "lucide-react";
import { toast } from "sonner";

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
  if (!trimmed) return null;

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(trimmed);
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
      title={`Copy ${label}`}
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] ${className ?? ""}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
