import { useEffect, useState } from "react";
import { landingContentStore } from "../utils/landingContentStore";

// Returns the custom photo background for the Log in / Create account pages
// (empty string = use the built-in photo) and keeps it live with the store, so
// an admin upload / reset from the Landing editor updates the pages instantly.
export function useAuthBackgroundUrl(): string {
  const [url, setUrl] = useState<string>(
    landingContentStore.getContent().authBackgroundUrl,
  );

  useEffect(() => {
    const sync = () =>
      setUrl(landingContentStore.getContent().authBackgroundUrl);
    sync();
    return landingContentStore.subscribe(sync);
  }, []);

  return url;
}
