import { useEffect, type RefObject } from "react";

/**
 * Closes a menu when a press lands outside it.
 *
 * Deliberately NOT a `fixed inset-0` click-catcher: on desktop the whole app
 * scrolls inside Layout's `<main>`, so an overlay laid over the page swallows
 * every wheel and touch gesture (nothing under it can scroll) and the screen
 * reads as frozen until the menu closes.
 *
 * Presses inside a portaled popover are ignored — the shared date-range calendar
 * renders into `<body>`, so a day cell is outside the wrapper yet must not close
 * the menu that hosts it.
 */
export function useClickOutsideClose<T extends HTMLElement>(
  ref: RefObject<T | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as HTMLElement | null;
      if (!node || ref.current?.contains(node)) return;
      if (node.closest('[data-slot="popover-content"]')) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close, ref]);
}
