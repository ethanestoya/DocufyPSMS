import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

export interface SummaryCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  /**
   * @deprecated The icon is drawn as a plain glyph now, not inside a filled
   * chip, so a chip background has no visual effect. Kept so existing call
   * sites still compile.
   */
  iconBg?: string;
  iconColor?: string;
  labelColor?: string;
  valueColor?: string;
  /** Replaces the value typography — for cards whose value is text, not a number. */
  valueClassName?: string;
  subtitle?: React.ReactNode;
  active?: boolean;
  activeBorder?: string;
  activeBg?: string;
  highlight?: boolean;
  onClick?: () => void;
  className?: string;
  /** Extra classes on the icon glyph itself (e.g. `animate-pulse`). */
  chipClassName?: string;
  /** Optional node in the top-right corner (e.g. a chevron hinting a destination). */
  trailing?: React.ReactNode;
}

/**
 * The system-wide summary card: a white card with the icon on top, the label
 * beneath it and the figure pinned to the bottom, so a row of cards always
 * lines its numbers up even when one label wraps to two lines. Sizing is
 * deliberately tight — a card that only carries a count must not push the
 * table below it off the first screen.
 */
export function SummaryCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-[#2F6FD6]",
  labelColor = "text-slate-500",
  valueColor = "text-slate-900",
  valueClassName,
  subtitle,
  active = false,
  activeBorder = "border-[#2F6FD6]",
  activeBg = "bg-[#F2F7FF]",
  highlight = false,
  onClick,
  className,
  chipClassName = "",
  trailing,
}: SummaryCardProps) {
  const clickable = typeof onClick === "function";
  const isActive = active && !highlight;

  const shell = cn(
    "flex h-full flex-col rounded-[20px] border p-4 transition-all",
    highlight
      ? "border-[#1668D9] bg-[#1668D9] shadow-[0_16px_32px_-22px_rgba(22,104,217,0.85)]"
      : isActive
        ? cn(
            activeBg,
            activeBorder,
            "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
          )
        : "border-slate-200/60 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]",
    clickable &&
      !highlight &&
      "cursor-pointer hover:-translate-y-0.5 hover:border-[#2F6FD6]/40 hover:shadow-[0_16px_34px_-18px_rgba(15,23,42,0.4)]",
    className,
  );

  const iconCls = highlight ? "text-white" : iconColor;
  const labelCls = highlight ? "text-white/85" : labelColor;
  const valueCls = highlight ? "text-white" : valueColor;

  return (
    <div
      className={shell}
      role={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
    >
      {(Icon || trailing !== undefined) && (
        <div className="flex items-start justify-between gap-3">
          {Icon ? (
            <Icon
              className={cn("h-5 w-5 shrink-0", iconCls, chipClassName)}
              strokeWidth={1.75}
            />
          ) : (
            <span />
          )}
          {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
        </div>
      )}

      <p className={cn("mt-3 text-[12.5px] font-medium leading-[1.4]", labelCls)}>
        {label}
      </p>

      <p
        className={cn(
          "mt-auto pt-1.5 text-[22px] font-bold leading-none tracking-tight",
          valueCls,
          valueClassName,
        )}
      >
        {value}
      </p>

      {subtitle !== undefined && (
        <div
          className={cn(
            "mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium",
            highlight ? "text-white/80" : "text-slate-500",
          )}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
