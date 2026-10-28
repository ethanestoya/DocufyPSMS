import { useEffect, useState } from "react";

import { isHydrating, subscribeHydration } from "./storeSync";

/**
 * `true` while the Supabase-backed stores are re-reading from the backend.
 *
 * Used for non-blocking "we're still loading" affordances — the thin top
 * progress bar and table skeletons — so a slow connection reads as "working"
 * rather than "empty".
 */
export function useHydrating(): boolean {
  const [hydrating, setHydrating] = useState(isHydrating);

  useEffect(() => subscribeHydration(() => setHydrating(isHydrating())), []);

  return hydrating;
}
