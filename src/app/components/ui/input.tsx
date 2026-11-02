import * as React from "react";

import { cn } from "./utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          // Resting state is a neutral field, never a highlighted one: one hairline,
          // a white fill and a muted placeholder. Blue is reserved for focus (and,
          // per-control, for a filter that is actually narrowing a list).
          "file:text-foreground placeholder:text-[#5C6B7F] selection:bg-primary selection:text-primary-foreground border-[#D5DCE6] flex h-9 w-full min-w-0 rounded-[10px] border bg-white px-3 py-1 text-base transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#E4E7EC] disabled:bg-[#F8FAFC] disabled:text-[#9AA4B2] md:text-sm",
          "hover:border-[#B7C3D4] focus-visible:border-[#2F6FD6] focus-visible:ring-[3px] focus-visible:ring-[#2F6FD6]/20",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
