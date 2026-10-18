import React from "react";
import type { LucideIcon } from "lucide-react";

export interface SummaryCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  labelColor?: string;
  valueColor?: string;
  subtitle?: React.ReactNode;
  active?: boolean;
  activeBorder?: string;
  activeBg?: string;
  highlight?: boolean;
  onClick?: () => void;
  className?: string;
  chipClassName?: string;
  /** Optional trailing node (e.g. a chevron hinting the card leads somewhere). */
  trailing?: React.ReactNode;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  iconBg = "bg-blue-50",
  iconColor = "text-[#2F6FD6]",
  labelColor = "text-slate-600",
  valueColor = "text-slate-900",
  subtitle,
  active = false,
  activeBorder = "border-[#2F6FD6]",
  activeBg = "bg-[#F2F7FF]",
  highlight = false,
  onClick,
  className = "",
  chipClassName = "",
  trailing,
}: SummaryCardProps) {
  const clickable = typeof onClick === "function";
  const isActive = active && !highlight;

  const shell = [
    "p-4 rounded-xl border flex items-center gap-4 flex-row transition-all",
    highlight
      ? "border-[#1D73EC] bg-[#1D73EC] shadow-none"
      : isActive
        ? `${activeBorder} ${activeBg} shadow-[0_1px_2px_rgba(15,23,42,0.04)]`
        : "border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    clickable && !highlight ? "cursor-pointer hover:border-[#2F6FD6]/40" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const chip = highlight ? "bg-white/20" : iconBg;
  const iconCls = highlight ? "text-white" : iconColor;
  const labelCls = highlight ? "text-white/90" : labelColor;
  const valueCls = highlight ? "text-white" : valueColor;

  return (
    <div
      className={shell}
      role={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
    >
      {Icon && (
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${chip} ${chipClassName}`}
        >
          <Icon className={`w-5 h-5 ${iconCls}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${labelCls}`}>{label}</p>
        <p className={`text-xl sm:text-2xl font-semibold leading-tight mt-1 ${valueCls}`}>
          {value}
        </p>
        {subtitle !== undefined && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
            {subtitle}
          </div>
        )}
      </div>
      {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}