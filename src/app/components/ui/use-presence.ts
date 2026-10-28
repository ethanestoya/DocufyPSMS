import { useEffect, useRef, useState } from "react";

/**
 * Keeps an element mounted for `duration` ms after `open` flips to false so a
 * CSS exit animation (animate-out) can play before the element unmounts.
 * Returns null when hidden, otherwise { isClosing }.
 */
export function usePresence(open: boolean, duration = 200) {
  const [visible, setVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsClosing(false);
      setVisible(true);
    } else {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setIsClosing(true);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        setIsClosing(false);
      }, duration);
    }

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [open, duration]);

  return visible ? { isClosing } : null;
}
