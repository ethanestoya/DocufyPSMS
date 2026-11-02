// Centralized shop-location photo store.
// Admin uploads up to MAX_PHOTOS (3) photos of the shop's physical location;
// customers see them on the Shop Location dialog (landing page + dashboard).
// Persisted to localStorage as data URLs (mirrors paymentMethodsStore pattern).
//
// Supabase-backed facade: the localStorage mirror stays as the offline /
// anonymous fallback, but the DB `shop_photos` rows (storage path + display
// order in the public `shop-photos` bucket) now drive the real cross-device
// gallery — a photo added on any device shows up everywhere via realtime.
// Reads are open to everyone (the public landing renders the gallery
// anonymously); writes are staff/admin only.

import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady, supabase } from '../../lib/supabaseClient';
import {
  deleteShopPhoto,
  fetchShopPhotos,
  insertShopPhoto,
} from '../../lib/db/siteContentRepo';
import { BUCKETS, removeObjectsIfPresent, uploadDataUrlAndGetPath } from '../../lib/db/storage';
import { auditLogStore } from './auditLogStore';

export const MAX_PHOTOS = 3;

export type ShopPhoto = {
  id: string;
  dataUrl: string; // uploaded image data URL (or its public URL when DB-backed)
  createdBy: string; // name of the admin who uploaded it
  createdAt: string;
};

type Subscriber = () => void;

const STORAGE_KEY = 'docufy_shop_photos_v1';
const STORAGE_VERSION = '1.0';

const PHOTOS_FOLDER = 'shop';

class ShopPhotosStore {
  private photos: ShopPhoto[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private initialized = false;
  private hydrating = false;
  // storage path per current photo id (local-minted ids swap to DB ids once
  // adopted) so removePhoto can also delete the object from the bucket.
  private paths: Map<string, string> = new Map();

  constructor() {
    this.load();

    // Cross-tab live sync: any local edit writes the mirror; the `storage`
    // event reloads it here so every open tab of this browser updates.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      this.reloadFromLocalStorage();
    });

    // Backend sync: realtime fires when ANY device adds/removes a photo, so
    // the DB snapshot replaces the mirror everywhere.
    subscribeTableChanges('shop_photos', () => {
      void this.hydrate();
    });

    void this.hydrate();
  }

  private load(): void {
    if (this.initialized) return;
    try {
      const storedVersion = localStorage.getItem(`${STORAGE_KEY}_version`);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored || storedVersion !== STORAGE_VERSION) {
        this.photos = [];
        localStorage.setItem(`${STORAGE_KEY}_version`, STORAGE_VERSION);
        this.save();
      } else {
        const parsed = JSON.parse(stored);
        this.photos = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error('Failed to load shop photos:', error);
      this.photos = [];
    }
    this.initialized = true;
  }

  private reloadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      this.photos = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
      this.notify();
    } catch (error) {
      console.error('Failed to reload shop photos from localStorage:', error);
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.photos));
    } catch (error) {
      console.error('Failed to save shop photos:', error);
    }
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }

  // Pull the latest snapshot from Supabase. The DB wins whenever it returns
  // rows; an empty/unreachable backend keeps the local mirror. Concurrent
  // calls dedupe.
  private async hydrate(): Promise<void> {
    if (this.hydrating) return;
    this.hydrating = true;
    await authReady;
    try {
      const rows = await fetchShopPhotos();
      if (rows.length === 0) return; // not seeded — keep the local mirror
      const paths: Map<string, string> = new Map();
      const photos: ShopPhoto[] = rows.map((row) => {
        if (row.storage_path) paths.set(row.id, row.storage_path);
        return {
          id: row.id,
          dataUrl: row.storage_path
            ? publicUrl(row.storage_path)
            : '',
          createdBy: row.uploaded_by ?? '',
          createdAt: row.created_at,
        };
      });
      this.photos = photos;
      this.paths = paths;
      this.save();
      this.notify();
    } catch (err) {
      console.warn('[shop-photos] hydration kept local data:', err);
    } finally {
      this.hydrating = false;
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles).
  async refreshFromBackend(): Promise<void> {
    await this.hydrate();
  }

  // Best-effort push of a newly added photo: upload the bytes, insert the row,
  // then swap the local-minted id for the adopted DB id so removals target the
  // real row. RLS-denied writes degrade quietly; every other failure toasts.
  private async pushAdd(photo: ShopPhoto): Promise<void> {
    try {
      const path = await uploadDataUrlAndGetPath(BUCKETS.shopPhotos, PHOTOS_FOLDER, photo.dataUrl, 'photo.png');
      const uid = await currentUserId();
      const id = await insertShopPhoto({
        storage_path: path,
        caption: null,
        display_order: this.photos.length,
        uploaded_by: uid,
      });
      this.paths.set(id, path);
      this.photos = this.photos.map((p) => (p.id === photo.id ? { ...p, id } : p));
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('shop-photos.update', err);
      else console.warn('[shop-photos] not synced (RLS):', err);
    }
  }

  // Best-effort push of a removal: delete the row, then the stored object.
  private async pushRemove(id: string): Promise<void> {
    const toRemove = this.paths.get(id);
    this.paths.delete(id);
    try {
      await deleteShopPhoto(id);
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('shop-photos.remove', err);
      else console.warn('[shop-photos] not synced (RLS):', err);
    }
    void removeObjectsIfPresent(BUCKETS.shopPhotos, [toRemove]);
  }

  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  getPhotos(): ShopPhoto[] {
    this.load();
    return this.photos.map((p) => ({ ...p }));
  }

  get remainingSlots(): number {
    return Math.max(0, MAX_PHOTOS - this.photos.length);
  }

  addPhoto(dataUrl: string, createdBy: string): boolean {
    if (this.photos.length >= MAX_PHOTOS) return false;
    const photo: ShopPhoto = {
      id: `shop-photo-${Date.now().toString(36)}`,
      dataUrl,
      createdBy,
      createdAt: new Date().toISOString(),
    };
    this.photos = [...this.photos, photo];
    this.save();
    auditLogStore.record({
      module: "Shop Content",
      action: "Created",
      reference: "Shop Photo",
      entityType: "Shop Photo",
      entityId: photo.id,
      title: "Shop Photo Added",
      description: `Added a shop photo${this.photos.length > 1 ? ` (${this.photos.length} of ${MAX_PHOTOS} shown)` : ""}.`,
    });
    this.notify();
    void this.pushAdd(photo);
    return true;
  }

  removePhoto(id: string): boolean {
    const removed = this.photos.find((p) => p.id === id);
    const next = this.photos.filter((p) => p.id !== id);
    if (next.length === this.photos.length) return false;
    this.photos = next;
    this.save();
    if (removed) {
      auditLogStore.record({
        module: "Shop Content",
        action: "Deleted",
        reference: "Shop Photo",
        entityType: "Shop Photo",
        entityId: id,
        title: "Shop Photo Removed",
        description: "Removed a shop photo from the location gallery.",
      });
    }
    this.notify();
    void this.pushRemove(id);
    return true;
  }
}

function publicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKETS.shopPhotos).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export const shopPhotosStore = new ShopPhotosStore();
