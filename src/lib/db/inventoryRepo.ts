import { supabase } from '../supabaseClient';
import type {
  InventoryItemDto,
  InventoryItemInsert,
  InventoryItemRow,
  InventoryMovementDto,
  InventoryMovementInsert,
  InventoryMovementRow,
} from './types';

// Inventory domain repo — CRUD against `inventory_items` + a stock-movement log
// in `inventory_movements`. RLS: every authenticated role may READ items (stock
// levels drive the customer's paper/add-on availability lists), while writes
// are staff/admin only. Customers never touch `inventory_movements` directly —
// their order-time paper deduction runs through the `deduct_paper_pieces`
// security-definer RPC (see REQUIRED SQL).

function toItemDto(row: InventoryItemRow): InventoryItemDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    unit: row.unit,
    currentStock: row.current_stock,
    minimumStock: row.minimum_stock,
    price: row.price,
    paperSize: row.paper_size,
    piecesPerUnit: row.pieces_per_unit || 1,
    archived: row.archived,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toMovementDto(row: InventoryMovementRow): InventoryMovementDto {
  return {
    id: row.id,
    itemId: row.item_id,
    movementType: row.movement_type,
    quantity: row.quantity,
    unit: row.unit,
    reason: row.reason,
    person: row.person,
    relatedOrderId: row.related_order_id,
    relatedTransactionId: row.related_transaction_id,
    createdAt: new Date(row.created_at),
  };
}

// Fetch all inventory items the calling role may read. RLS lets authenticated
// customers read every row (for availability gating), so staff/admin and
// customers get the same snapshot.
export async function fetchInventoryItems(): Promise<InventoryItemDto[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toItemDto);
}

// Fetch the stock-movement history. Staff/admin only (RLS); customers get an
// empty list, which the store treats as "no movements" rather than a failure.
export async function fetchInventoryMovements(): Promise<InventoryMovementDto[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toMovementDto);
}

export interface SaveInventoryItemInput {
  id?: string;
  name: string;
  category: string;
  brand?: string | null;
  unit?: string;
  currentStock?: number;
  minimumStock?: number;
  price?: number | null;
  paperSize?: string | null;
  piecesPerUnit?: number;
  archived?: boolean;
}

// Insert (no id) or update (with id) an inventory item. Returns the saved row
// as a DTO so the caller can adopt the server-assigned uuid id.
export async function saveInventoryItem(input: SaveInventoryItemInput): Promise<InventoryItemDto> {
  const body: InventoryItemInsert = {
    name: input.name,
    category: input.category,
    brand: input.brand ?? null,
    unit: input.unit ?? 'piece',
    current_stock: input.currentStock ?? 0,
    minimum_stock: input.minimumStock ?? 0,
    price: input.price ?? null,
    paper_size: input.paperSize ?? null,
    pieces_per_unit: input.piecesPerUnit ?? 1,
    archived: input.archived ?? false,
  };

  const query = input.id
    ? supabase.from('inventory_items').update(body).eq('id', input.id).select('*').single()
    : supabase.from('inventory_items').insert(body).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return toItemDto(data as unknown as InventoryItemRow);
}

// Permanently remove an inventory item (cascade deletes its movements).
export async function removeInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
}

// Append a stock movement row (Stock In / Stock Out / order deduction).
export async function insertInventoryMovement(input: InventoryMovementInsert): Promise<void> {
  const { error } = await supabase.from('inventory_movements').insert(input);
  if (error) throw error;
}

// Order-time paper deduction. Runs the `deduct_paper_pieces` security-definer
// RPC so BOTH the staff walk-in flow and a customer's checkout decrement real,
// cross-device stock. `deducted` is the number of pieces actually reduced.
// The function name is cast because it is not yet part of the typed RPC schema.
export async function deductPaperPiecesRpc(
  paperSize: string,
  pieces: number,
  relatedOrderId?: string | null,
  relatedTransactionId?: string | null,
): Promise<number> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: 'deduct_paper_pieces',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>)('deduct_paper_pieces', {
    p_size: paperSize,
    p_pieces: Math.max(0, Math.floor(pieces)),
    p_related_order_id: relatedOrderId ?? null,
    p_related_transaction_id: relatedTransactionId ?? null,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
