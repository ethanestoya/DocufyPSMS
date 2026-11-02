import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { missingSupabaseEnvKeys } from './supabaseEnv';

// NEVER let bad or missing credentials take down the module graph. `createClient`
// throws on a missing URL, and because this module is evaluated while the app's
// imports are still resolving, that throw happened BEFORE React could mount — the
// entry point died and the browser showed a blank white screen with no clue why.
// So: construct defensively, fall back to a clearly-labelled placeholder client
// (every call just fails at the network layer), and publish `supabaseEnvError`
// for `main.tsx` to render as a setup screen instead.
const PLACEHOLDER_URL = 'https://supabase-not-configured.invalid';
const PLACEHOLDER_KEY = 'supabase-anon-key-not-configured';

const missingEnv = missingSupabaseEnvKeys();
let constructionError: string | null = null;

function buildClient() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (url && key) {
    try {
      return createClient<Database>(url, key);
    } catch (err) {
      constructionError = err instanceof Error ? err.message : String(err);
      console.error('[supabase] Failed to initialise client:', err);
    }
  }
  return createClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
}

/**
 * Null when Supabase is correctly configured. Otherwise `main.tsx` renders the
 * setup screen instead of mounting the app, which is what replaces the old
 * blank white page.
 */
export const supabaseEnvError: { missing: string[]; reason?: string } | null =
  missingEnv.length > 0
    ? { missing: missingEnv }
    : constructionError
      ? { missing: [], reason: constructionError }
      : null;

if (supabaseEnvError) {
  console.error(
    `[supabase] Backend not configured: ${
      missingEnv.length > 0 ? missingEnv.join(', ') : constructionError
    }. Create .env.local in the project root and restart the dev server — a setup screen is being shown.`,
  );
}

export const supabase = buildClient();

// Resolves once the auth client has finished restoring any persisted session
// (or confirmed there is none). Data stores `await` this before their first DB
// fetch so that fetch never races the session restore and goes out anonymous —
// the root cause of Supabase data intermittently appearing/disappearing on
// reload (notably in fresh/incognito browser contexts with empty storage).
export const authReady: Promise<void> = (async () => {
  try {
    await supabase.auth.getSession();
  } catch (err) {
    console.warn('[authReady] session restore failed — proceeding anonymous:', err);
  }
})();
