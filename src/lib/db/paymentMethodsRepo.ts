import { supabase } from '../supabaseClient';
import { removeObjectsIfPresent, uploadDataUrlAndGetPath, BUCKETS, resolveStorageUrl } from './storage';
import type { PaymentMethodRow } from './types';

export interface PaymentMethodDto {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string;
  qrStoragePath: string | null;
  qrUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(row: PaymentMethodRow): PaymentMethodDto {
  return {
    id: row.id,
    name: row.name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    qrStoragePath: row.qr_storage_path,
    qrUrl: resolveStorageUrl(BUCKETS.brandAssets, row.qr_storage_path),
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// As many payment methods as the caller may see (RLS: customers only get the
// active ones, staff/admin see everything). Ordered active-first, then name.
export async function fetchPaymentMethods(): Promise<PaymentMethodDto[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('active', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toDto);
}

export interface SavePaymentMethodInput {
  id?: string;
  name: string;
  accountName: string;
  accountNumber: string;
  qrStoragePath: string | null;
  active: boolean;
}

export async function savePaymentMethod(input: SavePaymentMethodInput): Promise<string> {
  const { data, error } = await supabase
    .from('payment_methods')
    .upsert({
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      account_name: input.accountName,
      account_number: input.accountNumber,
      qr_storage_path: input.qrStoragePath,
      active: input.active,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function setPaymentMethodActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('payment_methods').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deletePaymentMethod(id: string, qrStoragePath?: string | null): Promise<void> {
  const { error } = await supabase.from('payment_methods').delete().eq('id', id);
  if (error) throw error;
  if (qrStoragePath) {
    await removeObjectsIfPresent(BUCKETS.brandAssets, [qrStoragePath]);
  }
}

// Upload a QR code image (data URL) into the public brand-assets bucket under
// `qrs/`. Returns the storage path.
export async function uploadQrCode(dataUrl: string): Promise<string> {
  return uploadDataUrlAndGetPath(BUCKETS.brandAssets, 'qrs', dataUrl, 'qr.png');
}
