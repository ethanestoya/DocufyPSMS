// Inventory alert dedup state repository.
//
// One row per inventory item recording the last status an alert was emitted
// for ('low' | 'out' | 'ok'). This used to live only in the browser
// (localStorage `docufy_inventory_alert_state_v1`), which meant every NEW
// browser/device re-fired Low/Out alerts for items that had already been
// alerted. Backing it with a shared table makes the dedup authoritative across
// devices (a new browser reads the existing state and stays quiet).
//
// RLS: staff/admin only via `public.is_staff_or_admin()` — customers never read
// or write alert state.
import { supabase as typedSupabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryStatus } from '../../app/utils/inventoryStore';

// The table is not in the generated schema yet, so route through an untyped
// client view (same pattern the RPC casts use).
const supabase = typedSupabase as unknown as SupabaseClient;

export type InventoryAlertState = Record<string, InventoryStatus>;

interface AlertStateRow {
  item_id: string;
  status: string;
}

export async function fetchInventoryAlertState(): Promise<InventoryAlertState> {
  const { data, error } = await supabase
    .from('inventory_alert_state')
    .select('item_id, status');
  if (error) throw error;
  const map: InventoryAlertState = {};
  for (const row of (data ?? []) as AlertStateRow[]) {
    if (row.item_id) map[row.item_id] = row.status as InventoryStatus;
  }
  return map;
}

export async function upsertInventoryAlertState(
  itemId: string,
  status: InventoryStatus,
): Promise<void> {
  const { error } = await supabase.from('inventory_alert_state').upsert(
    {
      item_id: itemId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'item_id' },
  );
  if (error) throw error;
}

export async function deleteInventoryAlertState(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_alert_state')
    .delete()
    .eq('item_id', itemId);
  if (error) throw error;
}

// Realtime: any change (this device or another) triggers a re-hydrate so two
// open staff machines never double-alert.
export function subscribeInventoryAlertState(cb: () => void): () => void {
  return subscribeTableChanges('inventory_alert_state', () => cb());
}
