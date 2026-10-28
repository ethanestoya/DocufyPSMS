// Centralized brand-logo store.
// The logo shown across the whole system (sidebar, headers, landing page,
// auth screens) is read from / written to this store (backed by localStorage
// "docufy_logo_v1"). The upload is an optional data URL override; when none is
// set, the bundled default Docufy logo is used. Reset simply clears the
// override, so the default is always available again.
//
// Supabase-backed facade: the localStorage override stays as the offline /
// anonymous fallback, but the DB's single `brand_settings` row (the custom
// logo's storage path in the `brand-assets` bucket) now drives the real
// cross-device logo — an admin upload on any device shows up everywhere via
// realtime. Reads are open to everyone (the public landing + auth screens
// render it anonymously); writes are staff/admin only.

import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import { fetchBrandSettings, upsertBrandSettings } from '../../lib/db/siteContentRepo';
import { auditLogStore } from './auditLogStore';
import {
  BUCKETS,
  getStoragePublicUrl,
  removeObjectsIfPresent,
  uploadDataUrlAndGetPath,
} from '../../lib/db/storage';
import defaultLogo from "../../assets/32cd46dac3d06839e0db69b6c6ad22c9a8ac17a6.png";

const STORAGE_KEY = "docufy_logo_v1";

const LOGO_FOLDER = 'brand';

type Listener = () => void;
const listeners = new Set<Listener>();
let hydrating = false;
// The DB-sourced custom logo (public URL + storage path). When set it wins over
// any local override; reset clears both.
let remoteLogoUrl: string | null = null;
let remoteLogoPath: string | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

function read(): string {
  if (remoteLogoUrl) return remoteLogoUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // fall through
  }
  return defaultLogo;
}

// Pull the latest snapshot from Supabase. The branded path (when set) wins
// over the mirror; an empty/unreachable backend keeps the local override.
async function hydrate(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  await authReady;
  try {
    const row = await fetchBrandSettings();
    if (row && row.logo_storage_path) {
      remoteLogoUrl = getStoragePublicUrl(BUCKETS.brandAssets, row.logo_storage_path);
      remoteLogoPath = row.logo_storage_path;
    } else {
      remoteLogoUrl = null;
      remoteLogoPath = null;
    }
    notify();
  } catch (err) {
    console.warn('[logo] hydration kept local data:', err);
  } finally {
    hydrating = false;
  }
}

// Best-effort push: upload the data URL to `brand-assets`, then write the
// storage path into the settings row. RLS-denied writes degrade quietly;
// every other failure is surfaced so a silently-unreflected upload is never
// mistaken for a successful sync.
async function pushLogo(dataUrl: string): Promise<void> {
  try {
    const path = await uploadDataUrlAndGetPath(BUCKETS.brandAssets, LOGO_FOLDER, dataUrl, 'logo.png');
    await upsertBrandSettings({ logo_storage_path: path });
    remoteLogoUrl = getStoragePublicUrl(BUCKETS.brandAssets, path);
    remoteLogoPath = path;
  } catch (err) {
    if (!isRlsDenied(err)) showDbError('logo.update', err);
    else console.warn('[logo] not synced (RLS):', err);
  }
}

// Best-effort push: clear the settings row + remove the stored object.
async function clearRemoteLogo(): Promise<void> {
  const toRemove = remoteLogoPath;
  remoteLogoUrl = null;
  remoteLogoPath = null;
  try {
    await upsertBrandSettings({ logo_storage_path: null });
  } catch (err) {
    if (!isRlsDenied(err)) showDbError('logo.update', err);
    else console.warn('[logo] not synced (RLS):', err);
  }
  void removeObjectsIfPresent(BUCKETS.brandAssets, [toRemove]);
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  // Cross-tab sync via storage event
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

// Backend realtime: an admin uploading/resetting the logo from any device
// refreshes every page that renders it.
subscribeTableChanges('brand_settings', () => {
  void hydrate();
});

void hydrate();

export const logoStore = {
  getLogo: read,
  hasCustomLogo: () => {
    if (remoteLogoUrl) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  },
  setLogo: (dataUrl: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, dataUrl);
    } catch {
      // Quota exceeded etc. — keep default
    }
    auditLogStore.record({
      module: "Shop Content",
      action: "Updated",
      reference: "Brand Logo",
      entityType: "Brand Logo",
      title: "Brand Logo Changed",
      description: "Uploaded a new custom brand logo.",
    });
    notify();
    void pushLogo(dataUrl);
  },
  resetLogo: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    auditLogStore.record({
      module: "Shop Content",
      action: "Updated",
      reference: "Brand Logo",
      entityType: "Brand Logo",
      title: "Brand Logo Reset",
      description: "Removed the custom brand logo and restored the default.",
    });
    notify();
    void clearRemoteLogo();
  },
  refreshFromBackend: () => hydrate(),
  subscribe,
};
