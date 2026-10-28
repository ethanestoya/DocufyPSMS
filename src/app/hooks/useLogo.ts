import { useEffect, useState } from "react";
import { logoStore } from "../utils/logoStore";

// Returns the current system logo and keeps it in sync with the store, so an
// admin upload / reset updates every consumer instantly.
export function useLogo(): string {
  const [logo, setLogo] = useState<string>(logoStore.getLogo());

  useEffect(() => {
    const sync = () => setLogo(logoStore.getLogo());
    sync();
    return logoStore.subscribe(sync);
  }, []);

  return logo;
}
