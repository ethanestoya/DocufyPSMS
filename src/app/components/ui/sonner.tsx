"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

// Docufy is a light-only app (there is no ThemeProvider and no dark palette in
// use), so the toaster is pinned to light instead of reading `next-themes`'
// "system" default — which used to render dark toasts on a dark-mode OS inside
// an otherwise white interface (F30).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
