// Single source of truth for the Supabase environment variables this app needs.
//
// Kept in its own tiny module (deliberately NOT in `supabaseClient.ts`) so the
// boot screen can report what is missing WITHOUT importing the client — and
// therefore without constructing it.
export const SUPABASE_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

export type SupabaseEnvKey = (typeof SUPABASE_ENV_KEYS)[number];

/**
 * Keys that are absent, undefined, or an empty/whitespace-only string.
 *
 * Each value is read through a *static* member access on purpose: Vite only
 * rewrites `import.meta.env.VITE_X` when it appears literally in source, so a
 * computed `import.meta.env[key]` can survive into the bundle unhandled and
 * blow up at module-eval time — exactly the failure mode this file exists to
 * prevent.
 */
export function missingSupabaseEnvKeys(): SupabaseEnvKey[] {
  const values: Record<SupabaseEnvKey, unknown> = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  return SUPABASE_ENV_KEYS.filter((key) => {
    const value = values[key];
    return typeof value !== "string" || value.trim() === "";
  });
}

/** Ready-to-paste `.env.local` contents, used by the setup screen. */
export const SUPABASE_ENV_TEMPLATE = [
  "# Copy this file to .env.local in the project root, then fill in your",
  "# project's values (Supabase Dashboard -> Project Settings -> API).",
  "VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co",
  "VITE_SUPABASE_ANON_KEY=your-anon-public-key",
].join("\n");
