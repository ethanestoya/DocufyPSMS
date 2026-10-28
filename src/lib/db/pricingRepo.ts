import { supabase } from '../supabaseClient';
import type {
  MatrixCellInsert,
  MatrixCellRow,
  PricingSettingsRow,
} from './types';

// Pricing domain repo — CRUD against the single-row `pricing_settings` blob
// (the legacy flat per-page rates + payment/full-payment thresholds + the
// payment-deadline windows, keyed `id = true`) and the `pricing_matrix_cells`
// cell table (one row per matrix cell, keyed by its service/content/color/
// paper/photo path). RLS: every authenticated role may READ — customers need
// the live rates/thresholds to price their checkout — while writes are
// staff/admin only.

export type PricingSettingsPatch = Partial<Omit<PricingSettingsRow, 'id'>>;

// The settings table holds exactly one row (id = true); null means the admin
// hasn't seeded it yet (the bootstrap seed normally does).
export async function fetchPricingSettings(): Promise<PricingSettingsRow | null> {
  const { data, error } = await supabase
    .from('pricing_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PricingSettingsRow | null;
}

// Single-call insert-or-update of the settings row (PK = id, always true).
export async function upsertPricingSettings(patch: PricingSettingsPatch): Promise<void> {
  const { error } = await supabase
    .from('pricing_settings')
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchMatrixCells(): Promise<MatrixCellRow[]> {
  const { data, error } = await supabase.from('pricing_matrix_cells').select('*');
  if (error) throw error;
  return (data ?? []) as MatrixCellRow[];
}

// Insert (no id) or update (with id) one matrix cell, mirroring
// `saveInventoryItem`: the caller passes the row id it learned from the hydrate
// snapshot so a single-cell admin edit is one targeted update; a brand-new cell
// inserts without needing to know a server id.
export async function saveMatrixCell(input: { id?: string; cell: MatrixCellInsert }): Promise<void> {
  const query = input.id
    ? supabase.from('pricing_matrix_cells').update(input.cell).eq('id', input.id)
    : supabase.from('pricing_matrix_cells').insert(input.cell);
  const { error } = await query;
  if (error) throw error;
}

// Replace the whole cell table (full-matrix save / reset). Deletes every row,
// then inserts in chunks to stay well under request body limits.
export async function replaceMatrixCells(cells: MatrixCellInsert[]): Promise<void> {
  const { error: del } = await supabase
    .from('pricing_matrix_cells')
    .delete()
    .neq('id', '');
  if (del) throw del;
  for (let i = 0; i < cells.length; i += 50) {
    const { error: ins } = await supabase
      .from('pricing_matrix_cells')
      .insert(cells.slice(i, i + 50));
    if (ins) throw ins;
  }
}
