import { supabase } from '../supabaseClient';
import { dataUrlToBlob } from '../../app/utils/supabaseAvatar';

// Storage buckets used across the backend integration. Public buckets serve
// anonymous reads; private buckets require an authenticated token (or a signed
// URL) to read.
export const BUCKETS = {
  orderFiles: 'order-files',
  paymentProofs: 'payment-proofs',
  brandAssets: 'brand-assets',
  shopPhotos: 'shop-photos',
  jobApplications: 'job-applications',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export function getStoragePublicUrl(bucket: BucketName, path: string): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export interface UploadInput {
  bucket: BucketName;
  // Folder within the bucket, e.g. `orders/<uuid>` or `${userId}/…`. The RLS
  // storage policies for the private buckets expect the FIRST folder segment
  // to be the owner's user id (foldername(name)[1] = auth.uid()).
  folder: string;
  file: Blob;
  fileName?: string;
  contentType?: string;
  // Emits real byte progress while the upload is in flight. Only wired when
  // provided — the supabase-js client (which uses fetch under the hood) exposes
  // no upload progress events, so a progressive callback switches to a matching
  // XHR request against the same Storage REST endpoint (see below).
  onProgress?: (loaded: number, total: number) => void;
}

// Upload a Blob to the bucket, returning the storage path (not the URL).
export async function uploadObjectAndGetPath(input: UploadInput): Promise<string> {
  const ext = (input.fileName?.split('.').pop() || '').toLowerCase();
  const safeExt = /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
  const path = `${input.folder.replace(/^\/+|\/+$/g, '')}/${Date.now()}.${safeExt}`;

  if (input.onProgress) {
    return uploadObjectWithProgress(input, path);
  }

  const { error } = await supabase.storage
    .from(input.bucket)
    .upload(path, input.file, {
      contentType: input.contentType || input.file.type || 'application/octet-stream',
      upsert: true,
    });
  if (error) throw error;
  return path;
}

// Progressive upload via XMLHttpRequest — mirrors the exact request the
// supabase-js SDK sends (same endpoint, headers, and FormData shape) but fires
// `xhr.upload.onprogress`, which fetch does not expose. Falls back to the SDK
// call when no session token is available.
async function uploadObjectWithProgress(input: UploadInput, path: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? null;
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

  if (!token || !supabaseUrl) {
    const { error } = await supabase.storage
      .from(input.bucket)
      .upload(path, input.file, {
        contentType: input.contentType || input.file.type || 'application/octet-stream',
        upsert: true,
      });
    if (error) throw error;
    return path;
  }

  const encodedBucket = encodeURIComponent(input.bucket);
  const encodedPath = path.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  const url = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${encodedBucket}/${encodedPath}`;

  // The SDK's Blob path sends the file inside FormData under an empty key, with
  // cacheControl as a sibling field; Content-Type is left to the browser so the
  // multipart boundary is generated. Replicating it keeps the server parse the
  // same way.
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', input.file);

  const result: { Id?: string; Key?: string; statusCode?: string; message?: string; error?: string } =
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY as string);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && input.onProgress) {
          input.onProgress(e.loaded, e.total);
        }
      };
      xhr.onload = () => {
        let parsed: { Id?: string; Key?: string; statusCode?: string; message?: string; error?: string } | null = null;
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          parsed = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed ?? {});
        } else {
          const message = parsed?.message || parsed?.error || `Upload failed (HTTP ${xhr.status})`;
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'));
      xhr.onabort = () => reject(new Error('Upload was aborted'));
      xhr.send(body);
    });

  if (input.onProgress && input.file.size > 0) {
    input.onProgress(input.file.size, input.file.size);
  }

  return path;
}

// Convenience: a data URL → storage path in one call (reuses the avatar
// converter). `fileName` drives the extension.
export async function uploadDataUrlAndGetPath(
  bucket: BucketName,
  folder: string,
  dataUrl: string,
  fileName = 'image.png',
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  return uploadObjectAndGetPath({ bucket, folder, file: blob, fileName, contentType: blob.type });
}

// Create a short-lived signed URL for an object in a bucket. Private buckets
// can't be read through the public endpoint, so signed URLs (or the download
// helper below) are the way to fetch their contents while keeping them private.
export async function getSignedObjectUrl(
  bucket: BucketName,
  path: string | null | undefined,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.warn(`[storage] failed to create signed URL for ${bucket}/${path}:`, error);
    return null;
  }
  return data?.signedUrl ?? null;
}

// Download the object's raw bytes (authenticated). Used to fetch the real file
// content for private-bucket downloads.
export async function downloadObjectToBlob(
  bucket: BucketName,
  path: string | null | undefined,
): Promise<{ blob: Blob; name: string } | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    console.warn(`[storage] failed to download ${bucket}/${path}:`, error);
    return null;
  }
  const name = path.split('/').pop() || path;
  return { blob: data, name };
}

// Remove one or more objects by storage path. Failures are logged, not thrown
// (best-effort cleanup).
export async function removeObjectsIfPresent(bucket: BucketName, paths: Array<string | null | undefined>): Promise<void> {
  const present = paths.filter((p): p is string => Boolean(p));
  if (present.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(present);
  if (error) {
    console.warn(`[storage] failed to remove ${present.length} object(s) from ${bucket}:`, error);
  }
}

// Resolve a stored storage path to its public URL (private buckets: only works
// while a session is authenticated — prototype-acceptable for staff/admin).
export function resolveStorageUrl(bucket: BucketName, storagePath: string | null | undefined): string | null {
  return storagePath ? getStoragePublicUrl(bucket, storagePath) : null;
}
