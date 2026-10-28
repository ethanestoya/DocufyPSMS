import { useEffect, useState } from "react";

import { useHydrating } from "../../utils/useHydrating";

/**
 * Thin indeterminate bar pinned to the very top of the app while the backend
 * stores hydrate.
 *
 * Deliberately NON-blocking: the page stays scrollable and clickable while this
 * shows, because the local mirror is already rendered and usable. It just stops
 * the silent wait from looking like missing data.
 */
export function TopProgressBar() {
  const hydrating = useHydrating();
  const [visible, setVisible] = useState(false);

  // Keep the bar on screen long enough to read. Instant loads would otherwise
  // flash it for one frame, which reads as a glitch rather than as progress.
  useEffect(() => {
    if (hydrating) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), 450);
    return () => window.clearTimeout(timer);
  }, [hydrating]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading data from the server"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-[#2F6FD6]/15"
    >
      <div className="h-full w-1/3 animate-[hydrating-sweep_1.1s_ease-in-out_infinite] bg-[#2F6FD6]" />
    </div>
  );
}
