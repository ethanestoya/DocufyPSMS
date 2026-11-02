import { supabase } from '../supabaseClient';
import type { Json } from '../database.types';
import type {
  BrandSettingsRow,
  LandingContentRow,
  LegalPolicyInsert,
  LegalPolicyRow,
  ShopPhotoInsert,
  ShopPhotoRow,
  ShopStatusRow,
} from './types';

// Site-content domain repo — the editable public-facing content that the
// Landing Page, auth pages, and shop-wide chrome render. Four single-row / few-row
// tables hold the authoring content (`shop_status`, `landing_content`,
// `legal_policies`, `brand_settings`) plus one item table for the admin-uploaded
// shop photos (`shop_photos`, ordered by `display_order`).
//
// RLS: every role AND anonymous visitors may READ (the public landing page, the
// login/signup screens and the shop-status banner all render before/without a
// session), while writes are staff/admin only via `public.is_staff_or_admin()`.

export type ShopStatusPatch = Partial<Omit<ShopStatusRow, 'id'>>;

// The status table holds exactly one row (id = true) — null means it hasn't
// been seeded yet (the bootstrap seed normally does).
export async function fetchShopStatus(): Promise<ShopStatusRow | null> {
  const { data, error } = await supabase
    .from('shop_status')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ShopStatusRow | null;
}

// Single-call insert-or-update of the status row (PK = id, always true).
export async function upsertShopStatus(patch: ShopStatusPatch): Promise<void> {
  const { error } = await supabase
    .from('shop_status')
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

// The landing content row (id = true) holds the whole editable landing-page
// content model as one `content` jsonb blob. Null means not yet seeded.
export async function fetchLandingContent(): Promise<LandingContentRow | null> {
  const { data, error } = await supabase
    .from('landing_content')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LandingContentRow | null;
}

export async function upsertLandingContent(
  content: Json,
  updatedBy: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from('landing_content')
    .upsert({ id: true, content, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchLegalPolicies(): Promise<LegalPolicyRow[]> {
  const { data, error } = await supabase.from('legal_policies').select('*');
  if (error) throw error;
  return (data ?? []) as LegalPolicyRow[];
}

// Insert (no id) or update (with id) one policy, mirroring `saveMatrixCell`:
// the caller passes the row id it learned from the hydrate snapshot so an admin
// edit is one targeted update; a brand-new policy type inserts. Returns the row
// id (existing or newly inserted) so the caller can adopt it for future edits.
export async function saveLegalPolicy(input: { id?: string; row: LegalPolicyInsert }): Promise<string> {
  if (input.id) {
    const { error } = await supabase.from('legal_policies').update(input.row).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from('legal_policies')
    .insert(input.row)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? '';
}

// The brand settings row (id = true) holds the custom logo's storage path.
// Null means the admin hasn't uploaded a custom logo (bundled default in use).
export async function fetchBrandSettings(): Promise<BrandSettingsRow | null> {
  const { data, error } = await supabase
    .from('brand_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as BrandSettingsRow | null;
}

export async function upsertBrandSettings(patch: Partial<Omit<BrandSettingsRow, 'id'>>): Promise<void> {
  const { error } = await supabase
    .from('brand_settings')
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchShopPhotos(): Promise<ShopPhotoRow[]> {
  const { data, error } = await supabase.from('shop_photos').select('*').order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShopPhotoRow[];
}

export async function insertShopPhoto(input: ShopPhotoInsert): Promise<string> {
  const { data, error } = await supabase
    .from('shop_photos')
    .insert(input)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? '';
}

export async function deleteShopPhoto(id: string): Promise<void> {
  const { error } = await supabase.from('shop_photos').delete().eq('id', id);
  if (error) throw error;
}
