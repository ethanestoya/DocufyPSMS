
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { syncInternetTime } from "./app/utils/pht.ts";
  import { supabaseEnvError } from "./lib/supabaseClient.ts";
  import SupabaseSetupNotice from "./app/components/SupabaseSetupNotice.tsx";
  import { purgeLocalAvatarKeys } from "./app/utils/supabaseAvatar";

  // Avatars are Supabase-only (see supabaseAvatar.ts); clear any leftover
  // localStorage avatar keys older builds wrote so no stale picture shows.
  purgeLocalAvatarKeys();

  // Start syncing the app clock to real internet GMT+8 as early as possible.
  syncInternetTime();

  const root = createRoot(document.getElementById("root")!);

  // Unconfigured/invalid Supabase credentials used to throw during module
  // evaluation, killing this entry point before React mounted — the user saw a
  // blank white screen with no explanation. Render a setup screen instead.
  if (supabaseEnvError) {
    root.render(
      <SupabaseSetupNotice
        missing={supabaseEnvError.missing}
        reason={supabaseEnvError.reason}
      />,
    );
  } else {
    root.render(<App />);
  }
  
