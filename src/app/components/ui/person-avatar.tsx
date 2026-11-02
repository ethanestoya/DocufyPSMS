import * as React from "react";

import { cn } from "./utils";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Round person avatar: the uploaded picture when there is one, initials when
 * there isn't (or when the URL is broken). Size and text scale come from
 * `className` so the same component works at 40px in a list and 56px in a
 * detail header.
 */
export function PersonAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    setBroken(false);
  }, [src]);

  const showImage = Boolean(src) && !broken;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-[#F2F7FF] text-xs text-[#1668D9]",
        className,
      )}
    >
      {showImage ? (
        <img
          src={src as string}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-semibold tracking-wide" aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}
