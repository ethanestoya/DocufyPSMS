// Centralized inventory store for supply/consumable tracking.
// Supabase-backed facade: the localStorage mirror below stays as the offline /
// anonymous fallback, but the DB now drives real cross-device stock. Every
// authenticated role can READ items (stock levels gate the customer's paper /
// add-on lists); writes are staff/admin only; a customer's order-time paper
// deduction runs through the `deduct_paper_pieces` security-definer RPC so it
// reaches the backend from any device the order was placed on.

import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { auditLogStore, type AuditChange } from './auditLogStore';
import { authReady } from '../../lib/supabaseClient';
import {
  deductPaperPiecesRpc,
  fetchInventoryItems,
  fetchInventoryMovements,
  insertInventoryMovement,
  removeInventoryItem,
  saveInventoryItem,
} from '../../lib/db/inventoryRepo';
import type {
  InventoryItemDto,
  InventoryMovementDto,
} from '../../lib/db/types';

export type InventoryStatus = 'out' | 'low' | 'ok';

export type InventoryItem = {
  id: string;
  name: string;
  category: string; // e.g. Paper, Ink, Add-ons, Vellum, Sticker, Photo paper
  brand?: string;
  unit: string; // ream, piece, box, bottle, etc.
  currentStock: number;
  minimumStock: number;
  price?: number; // sell price per unit (used for order add-ons)
  paperSize?: string; // size code for Paper items: 'a4' | 'short' | 'legal' | ...
  pcsPerUnit?: number; // pieces per unit (paper ream = 500); defaults to 1
  archived?: boolean;
  lastUpdated?: string;
};

export type PaperSizeOption = {
  id: string;
  name: string;
  displayName: string;
  inStock: boolean;
};

export type AddonOption = {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  unit: string;
  category: string;
  description: string;
};

export type StockMovementType = 'in' | 'out';

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  quantity: number;
  unit: string;
  reason?: string;
  person?: string;
  related?: string; // e.g. order/transaction reference
  createdAt: string; // ISO timestamp
};

type Subscriber = () => void;

const LOCAL_KEY = 'inventoryStore';
const LOCAL_MOVES = 'inventoryMovements';
const LOCAL_VERSION = 'inventoryStoreVersion';
// Keep the v3.0 mirror version (NOT bumped) so any existing local edits by the
// user survive until the DB hydrate replaces them with the server snapshot.
const INVENTORY_VERSION = '3.0';

// DB DTO → store shape, applying the legacy client-side migrations (the merged
// "School supplies" category and the paper ream pcsPerUnit default).
function fromItemDto(dto: InventoryItemDto): InventoryItem {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category === 'School supplies' ? 'Add-ons' : dto.category,
    brand: dto.brand ?? undefined,
    unit: dto.unit,
    currentStock: dto.currentStock,
    minimumStock: dto.minimumStock,
    price: dto.price ?? undefined,
    paperSize: dto.paperSize ?? undefined,
    pcsPerUnit: dto.piecesPerUnit || 1,
    archived: dto.archived,
    lastUpdated: todayKey(),
  };
}

function fromMovementDto(dto: InventoryMovementDto): StockMovement {
  return {
    id: dto.id,
    itemId: dto.itemId,
    itemName: '',
    type: dto.movementType === 'in' ? 'in' : 'out',
    quantity: dto.quantity,
    unit: dto.unit,
    reason: dto.reason ?? undefined,
    person: dto.person ?? undefined,
    related: dto.relatedOrderId ?? dto.relatedTransactionId ?? undefined,
    createdAt: dto.createdAt.toISOString(),
  };
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function mintId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

class InventoryStore {
  private items: InventoryItem[] = [];
  private movements: StockMovement[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private initialized: boolean = false;
  private hydrating: boolean = false;

  constructor() {
    this.loadFromLocalStorage();

    // Cross-tab live sync: when ANOTHER tab writes inventory (e.g. the customer
    // tab placing an order deducts paper pieces), the `storage` event fires
    // HERE. Reload from localStorage and re-render every subscriber live — the
    // staff/admin Inventory page, paper size options, and low/out-of-stock
    // alerts all update without a page refresh.
    window.addEventListener('storage', (e) => {
      if (e.key !== LOCAL_KEY && e.key !== LOCAL_MOVES && e.key !== LOCAL_VERSION) return;
      this.reloadFromLocalStorage();
    });

    // Real-time backend sync (replaces the per-browser mirror whenever the DB
    // has rows — e.g. a staff restock on another device).
    subscribeTableChanges('inventory_items', () => {
      void this.hydrate();
    });

    void this.hydrate();
  }

  private loadFromLocalStorage(): void {
    if (this.initialized) return;

    try {
      const storedVersion = localStorage.getItem(LOCAL_VERSION);
      const stored = localStorage.getItem(LOCAL_KEY);
      const storedMoves = localStorage.getItem(LOCAL_MOVES);

      if (!stored || storedVersion !== INVENTORY_VERSION) {
        this.items = this.getDefaultItems();
        this.movements = [];
        localStorage.setItem(LOCAL_VERSION, INVENTORY_VERSION);
        this.saveToLocalStorage();
      } else {
        const parsed = JSON.parse(stored);
        this.items = Array.isArray(parsed)
          ? parsed.map(item => this.normalizeItem(item))
          : [];
        try {
          const movesParsed = storedMoves ? JSON.parse(storedMoves) : [];
          this.movements = Array.isArray(movesParsed) ? movesParsed : [];
        } catch {
          this.movements = [];
        }
      }
    } catch (error) {
      console.error('Failed to load inventory from localStorage:', error);
      this.items = this.getDefaultItems();
      this.movements = [];
    }

    this.initialized = true;
  }

  // Re-read inventory + movements unconditionally (ignores the `initialized`
  // guard) and notify. Used by the cross-tab `storage` listener so a fresh
  // snapshot from another tab replaces the in-memory state and every
  // subscriber re-renders.
  private reloadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.items = Array.isArray(parsed)
          ? parsed.map(item => this.normalizeItem(item))
          : [];
      }
      const storedMoves = localStorage.getItem(LOCAL_MOVES);
      try {
        const movesParsed = storedMoves ? JSON.parse(storedMoves) : [];
        this.movements = Array.isArray(movesParsed) ? movesParsed : [];
      } catch {
        this.movements = [];
      }
      this.notify();
    } catch (error) {
      console.error('Failed to reload inventory from localStorage:', error);
    }
  }

  // Pull the latest snapshot from Supabase. The DB wins whenever it returns
  // rows; when the tables are empty/unreachable (anon visitor, offline) the
  // local mirror is kept so the pages never appear blank. Concurrent calls
  // dedupe.
  private async hydrate(): Promise<void> {
    if (this.hydrating) return;
    this.hydrating = true;
    await authReady;
    try {
      const items = await fetchInventoryItems();
      if (items.length > 0) {
        this.items = items.map(fromItemDto);
        this.saveToLocalStorage();
        this.notify();
      }
    } catch (err) {
      console.warn('[inventory] hydration kept local data:', err);
    }
    try {
      const movements = await fetchInventoryMovements();
      if (movements.length > 0) {
        this.movements = movements.map(fromMovementDto);
        this.saveToLocalStorage();
        this.notify();
      }
    } catch {
      // Movement history is staff/admin-only; a customer's empty/denied read
      // simply keeps the local list. Silent.
    } finally {
      this.hydrating = false;
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles). The DB
  // wins only when it returns rows; a denied/empty read keeps the mirror.
  refresh(): Promise<void> {
    return this.hydrate();
  }

  // Backfill pcsPerUnit for existing Paper items that were saved before it
  // existed: a Paper ream is 500 pieces, other paper units default to 1.
  // Also migrates the merged category: "School supplies" is now "Add-ons" so
  // school-supply items appear alongside add-ons at the customer's checkout.
  private normalizeItem(item: InventoryItem): InventoryItem {
    const normalized = {
      ...item,
      category: item.category === 'School supplies' ? 'Add-ons' : item.category,
    };
    if (normalized.category === 'Paper' && normalized.pcsPerUnit == null) {
      return { ...normalized, pcsPerUnit: normalized.unit === 'ream' ? 500 : 1 };
    }
    return normalized;
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this.items));
      localStorage.setItem(LOCAL_MOVES, JSON.stringify(this.movements));
    } catch (error) {
      console.error('Failed to save inventory to localStorage:', error);
    }
  }

  private recordInventoryUpdate(prev: InventoryItem, next: InventoryItem): void {
    const labels: Record<keyof Pick<InventoryItem, 'name' | 'category' | 'brand' | 'unit' | 'currentStock' | 'minimumStock' | 'price' | 'paperSize' | 'archived'>, string> = {
      name: 'Name',
      category: 'Category',
      brand: 'Brand',
      unit: 'Unit',
      currentStock: 'Current Stock',
      minimumStock: 'Minimum Stock',
      price: 'Price',
      paperSize: 'Paper Size',
      archived: 'Archived',
    };
    const changes: AuditChange[] = (Object.keys(labels) as (keyof typeof labels)[]).flatMap((key) => {
      const oldValue = prev[key];
      const newValue = next[key];
      if (oldValue === newValue) return [];
      return [{
        field: labels[key],
        previous: oldValue == null ? '—' : String(oldValue),
        next: newValue == null ? '—' : String(newValue),
      }];
    });
    auditLogStore.record({
      module: 'Inventory',
      action: 'Updated',
      reference: prev.name || prev.id,
      entityType: 'Inventory',
      entityId: prev.id,
      title: 'Inventory Item Updated',
      description: `Updated the inventory item "${prev.name || prev.id}".`,
      changes,
    });
  }

  private recordMovement(
    item: InventoryItem,
    type: StockMovementType,
    quantity: number,
    opts?: { reason?: string; person?: string; related?: string; push?: boolean }
  ): void {
    const movement: StockMovement = {
      id: `mv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      itemId: item.id,
      itemName: item.name,
      type,
      quantity,
      unit: item.unit,
      reason: opts?.reason,
      person: opts?.person,
      related: opts?.related,
      createdAt: new Date().toISOString(),
    };
    this.movements = [movement, ...this.movements];
    this.saveToLocalStorage();
    // Paper deductions are written server-side ONCE by the deduct_paper_pieces
    // RPC (its own security-definer movement insert). Suppress the direct push
    // there so staff restock()/stockOut() are the only direct movement writers
    // and a walk-in deduction never logs twice.
    if (opts?.push !== false) void this.pushMovement(movement);
  }

  // Best-effort DB append of a movement row. RLS-denied writes (a customer
  // being prevented from logging a movement directly, e.g. a deduction that
  // the RPC handles server-side) degrade silently.
  private async pushMovement(movement: StockMovement): Promise<void> {
    try {
      await insertInventoryMovement({
        item_id: movement.itemId,
        movement_type: movement.type,
        quantity: movement.quantity,
        unit: movement.unit,
        reason: movement.reason ?? null,
        person: movement.person ?? null,
        related_order_id: movement.related ?? null,
        related_transaction_id: null,
      });
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('inventory.movement', err);
    }
  }

  // DB upsert of the full item snapshot. On success the server's row is
  // adopted (id + defaults) so the store matches realtime. RLS-denied writes
  // keep the local state silently; other failures toast (keep-local).
  private async syncItem(item: InventoryItem): Promise<void> {
    try {
      const saved = await saveInventoryItem({
        id: item.id,
        name: item.name,
        category: item.category,
        brand: item.brand ?? null,
        unit: item.unit,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        price: item.price ?? null,
        paperSize: item.paperSize ?? null,
        piecesPerUnit: item.pcsPerUnit ?? 1,
        archived: item.archived ?? false,
      });
      const mapped = fromItemDto(saved);
      this.items = this.items.map(i => (i.id === item.id ? mapped : i));
      this.saveToLocalStorage();
      this.notify();
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('inventory.update', err);
    }
  }

  // Best-effort DB delete. RLS-denied/not-found deletions degrade silently.
  private async removeRemote(id: string): Promise<void> {
    try {
      await removeInventoryItem(id);
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('inventory.delete', err);
    }
  }

  private getDefaultItems(): InventoryItem[] {
    return [
      { id: 'inv-paper-a4', name: 'Bond Paper (A4)', category: 'Paper', brand: '', unit: 'ream', currentStock: 15, minimumStock: 3, paperSize: 'a4', pcsPerUnit: 500 },
      { id: 'inv-paper-short', name: 'Bond Paper (Short)', category: 'Paper', brand: '', unit: 'ream', currentStock: 12, minimumStock: 3, paperSize: 'short', pcsPerUnit: 500 },
      { id: 'inv-paper-legal', name: 'Bond Paper (Legal)', category: 'Paper', brand: '', unit: 'ream', currentStock: 8, minimumStock: 2, paperSize: 'legal', pcsPerUnit: 500 },
      { id: 'inv-ink-black', name: 'Printer Ink (Black)', category: 'Ink', brand: 'Epson', unit: 'bottle', currentStock: 5, minimumStock: 2, pcsPerUnit: 1 },
      { id: 'inv-ballpen', name: 'Ballpen (Black)', category: 'Add-ons', brand: '', unit: 'piece', currentStock: 30, minimumStock: 10, price: 10, pcsPerUnit: 1 },
      { id: 'inv-staples', name: 'Staples', category: 'Add-ons', brand: '', unit: 'box', currentStock: 15, minimumStock: 4, price: 5, pcsPerUnit: 1 },
    ];
  }

  getItems(): InventoryItem[] {
    this.loadFromLocalStorage();
    return [...this.items];
  }

  getActiveItems(): InventoryItem[] {
    this.loadFromLocalStorage();
    return this.items.filter(item => !item.archived);
  }

  getArchivedItems(): InventoryItem[] {
    this.loadFromLocalStorage();
    return this.items.filter(item => item.archived);
  }

  getItemById(id: string): InventoryItem | undefined {
    this.loadFromLocalStorage();
    return this.items.find(item => item.id === id);
  }

  // Create an inventory item. Applies locally immediately, then inserts to the
  // DB and adopts the server-assigned uuid id. On failure the item stays local
  // (silently when RLS-denied, with a toast otherwise). The id is optional —
  // the store mints one — so callers never have to invent ids.
  async addItem(item: Omit<InventoryItem, 'id'> & { id?: string }): Promise<InventoryItem> {
    this.loadFromLocalStorage();
    const stamped: InventoryItem = {
      ...item,
      id: item.id || mintId(),
      lastUpdated: todayKey(),
    };
    this.items = [stamped, ...this.items];
    this.saveToLocalStorage();
    this.notify();

    auditLogStore.record({
      module: 'Inventory',
      action: 'Created',
      reference: stamped.name || stamped.id,
      entityType: 'Inventory',
      entityId: stamped.id,
      title: 'Inventory Item Added',
      description: `Added the inventory item "${stamped.name || stamped.id}" (${stamped.category}) with an initial stock of ${stamped.currentStock} ${stamped.unit}(s).`,
      changes: [{ field: 'Current Stock', previous: '—', next: String(stamped.currentStock) }],
    });

    try {
      const saved = await saveInventoryItem({
        name: stamped.name,
        category: stamped.category,
        brand: stamped.brand ?? null,
        unit: stamped.unit,
        currentStock: stamped.currentStock,
        minimumStock: stamped.minimumStock,
        price: stamped.price ?? null,
        paperSize: stamped.paperSize ?? null,
        piecesPerUnit: stamped.pcsPerUnit ?? 1,
        archived: stamped.archived ?? false,
      });
      const mapped = fromItemDto(saved);
      this.items = this.items.map(i => (i.id === stamped.id ? mapped : i));
      this.saveToLocalStorage();
      this.notify();
      return mapped;
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('inventory.add', err);
      return stamped;
    }
  }

  updateItem(id: string, updates: Partial<InventoryItem>, opts?: { audit?: boolean }): void {
    this.loadFromLocalStorage();
    const prev = this.items.find(item => item.id === id);
    const merged: InventoryItem = {
      ...(prev ?? ({} as InventoryItem)),
      ...updates,
      id,
      lastUpdated: todayKey(),
    };
    this.items = this.items.map(item =>
      item.id === id ? { ...item, ...updates, lastUpdated: todayKey() } : item
    );
    this.saveToLocalStorage();
    this.notify();
    if (prev) {
      void this.syncItem(merged);
      if (opts?.audit !== false) this.recordInventoryUpdate(prev, merged);
    }
  }

  archiveItem(id: string): void {
    this.updateItem(id, { archived: true });
  }

  unarchiveItem(id: string): void {
    this.updateItem(id, { archived: false });
  }

  deleteItem(id: string): void {
    this.loadFromLocalStorage();
    const doomed = this.items.find(item => item.id === id);
    this.items = this.items.filter(item => item.id !== id);
    this.saveToLocalStorage();
    this.notify();
    if (doomed) {
      auditLogStore.record({
        module: 'Inventory',
        action: 'Deleted',
        reference: doomed.name || doomed.id,
        entityType: 'Inventory',
        entityId: doomed.id,
        title: 'Inventory Item Deleted',
        description: `Deleted the inventory item "${doomed.name || doomed.id}" (${doomed.category}).`,
      });
      void this.removeRemote(id);
    }
  }

  // Stock In (restocking): add quantity
  stockIn(id: string, quantity: number, opts?: { reason?: string; person?: string }): InventoryItem | undefined {
    if (quantity <= 0) return undefined;
    const item = this.getItemById(id);
    if (!item) return undefined;
    const prevStock = item.currentStock;
    const updated = { ...item, currentStock: item.currentStock + quantity };
    this.updateItem(id, { currentStock: updated.currentStock }, { audit: false });
    this.recordMovement(item, 'in', quantity, opts);
    auditLogStore.record({
      module: 'Inventory',
      action: 'Updated',
      reference: item.name || item.id,
      entityType: 'Inventory',
      entityId: item.id,
      title: 'Stock In',
      description: `Restocked "${item.name || item.id}" with ${quantity} ${item.unit}(s).${opts?.reason ? ` Reason: ${opts.reason}.` : ''}`,
      changes: [{ field: 'Current Stock', previous: String(prevStock), next: String(updated.currentStock) }],
    });
    return updated;
  }

  // Stock Out (usage/sale): deduct quantity, never below zero
  stockOut(id: string, quantity: number, opts?: { reason?: string; person?: string; related?: string }): { success: boolean; message: string; item?: InventoryItem } {
    if (quantity <= 0) return { success: false, message: 'Quantity must be greater than zero.' };
    const item = this.getItemById(id);
    if (!item) return { success: false, message: 'Item not found.' };
    if (item.currentStock < quantity) {
      return { success: false, message: `Not enough stock. Only ${item.currentStock} ${item.unit}(s) available.` };
    }
    const prevStock = item.currentStock;
    const updated = { ...item, currentStock: item.currentStock - quantity };
    this.updateItem(id, { currentStock: updated.currentStock }, { audit: false });
    this.recordMovement(item, 'out', quantity, opts);
    auditLogStore.record({
      module: 'Inventory',
      action: 'Updated',
      reference: item.name || item.id,
      entityType: 'Inventory',
      entityId: item.id,
      title: 'Stock Out',
      description: `Removed ${quantity} ${item.unit}(s) from "${item.name || item.id}" stock.${opts?.reason ? ` Reason: ${opts.reason}.` : ''}`,
      changes: [{ field: 'Current Stock', previous: String(prevStock), next: String(updated.currentStock) }],
    });
    return { success: true, message: 'Stock deducted.', item: updated };
  }

  // Shared inventory health status. Out-of-stock is checked first (0 stock),
  // then low-stock (at or below the minimum), otherwise healthy.
  getInventoryStatus(item: InventoryItem): 'out' | 'low' | 'ok' {
    if (item.currentStock === 0) return 'out';
    if (item.currentStock <= item.minimumStock) return 'low';
    return 'ok';
  }

  isLowStock(item: InventoryItem): boolean {
    return this.getInventoryStatus(item) === 'low';
  }

  isOutOfStock(item: InventoryItem): boolean {
    return this.getInventoryStatus(item) === 'out';
  }

  getLowStockItems(): InventoryItem[] {
    this.loadFromLocalStorage();
    return this.items.filter(item => !item.archived && this.getInventoryStatus(item) === 'low');
  }

  getOutOfStockItems(): InventoryItem[] {
    this.loadFromLocalStorage();
    return this.items.filter(item => !item.archived && this.getInventoryStatus(item) === 'out');
  }

  // Piece count for an item: currentStock (units) x pieces-per-unit (paper ream = 500)
  getItemPieces(item: InventoryItem): number {
    return Math.round(item.currentStock * (item.pcsPerUnit || 1));
  }

  getPaperItems(): InventoryItem[] {
    this.loadFromLocalStorage();
    return this.items.filter(item => !item.archived && item.category === 'Paper');
  }

  getPaperItemBySize(paperSize: string): InventoryItem | undefined {
    this.loadFromLocalStorage();
    return this.items.find(
      item => !item.archived && item.category === 'Paper' && item.paperSize === paperSize
    );
  }

  // Total paper pieces remaining across all paper items (for the inventory card)
  getPapersLeftPieces(): number {
    return this.getPaperItems().reduce(
      (sum, item) => sum + this.getItemPieces(item),
      0
    );
  }

  // Deduct paper pieces for an order, matched by paper size. Applies locally
  // for instant UI feedback, then runs the `deduct_paper_pieces` RPC so the
  // REAL, cross-device stock is decremented too (the RPC is the authoritative
  // writer — no separate item upsert here to avoid clobbering server stock).
  // Returns how many pieces were actually deducted for that size.
  deductPaperPieces(paperSize: string, pieces: number, opts?: { reason?: string; person?: string; related?: string }): number {
    if (pieces <= 0) return 0;
    const item = this.getPaperItemBySize(paperSize);
    if (!item) return 0;

    const pcsPerUnit = item.pcsPerUnit || 1;
    const unitsToDeduct = pieces / pcsPerUnit;
    const newStock = Math.max(0, item.currentStock - unitsToDeduct);
    const deductedUnits = item.currentStock - newStock;
    const deductedPieces = Math.round(deductedUnits * pcsPerUnit);

    this.items = this.items.map(i =>
      i.id === item.id ? { ...i, currentStock: newStock, lastUpdated: todayKey() } : i
    );

    if (deductedUnits > 0) {
      this.recordMovement(item, 'out', deductedUnits, {
        reason: opts?.reason ?? 'Order printing',
        person: opts?.person,
        related: opts?.related,
        push: false, // the RPC writes the server movement row itself
      });
    } else {
      this.saveToLocalStorage();
      this.notify();
    }

    if (deductedPieces > 0) {
      void this.deductRemote(paperSize, deductedPieces, opts?.related);
    }
    return deductedPieces;
  }

  private async deductRemote(paperSize: string, pieces: number, related?: string): Promise<void> {
    try {
      // The related reference is order-ish (order id) — route it to the
      // related_order_id column; the transaction-side FK stays null here.
      await deductPaperPiecesRpc(paperSize, pieces, related, null);
    } catch (err) {
      // RLS-denied failures degrade quietly (the local deduction already applied
      // and there's nothing the caller can do about permissions); every other
      // server failure is surfaced so a silently-unreflected deduction is never
      // mistaken for a successful sync.
      if (!isRlsDenied(err)) {
        showDbError('paper deduction', err);
      } else {
        console.warn('[inventory] paper deduction not synced to server:', err);
      }
    }
  }

  // Stock movement history, optionally filtered by type
  getMovements(type?: StockMovementType): StockMovement[] {
    this.loadFromLocalStorage();
    if (!type) return [...this.movements];
    return this.movements.filter(m => m.type === type);
  }

  // Paper size / material options for the customer order form (from Paper,
  // Vellum, Sticker, and Photo paper stock items that carry a size).
  getPaperSizeOptions(): PaperSizeOption[] {
    this.loadFromLocalStorage();
    return this.items
      .filter(item => !item.archived && item.paperSize)
      .map(item => ({
        id: item.id,
        name: item.paperSize as string,
        // Non-paper materials (Vellum/Sticker/Photo) are labeled with their
        // item name so customers can tell stock items apart at a glance.
        displayName:
          item.category === 'Paper'
            ? this.paperDisplayName(item.paperSize as string)
            : `${item.name} (${this.paperDisplayName(item.paperSize as string)})`,
        inStock: item.currentStock > 0,
      }));
  }

  // Add-on options for the customer order form (from Add-ons category items)
  getAddons(): AddonOption[] {
    this.loadFromLocalStorage();
    return this.items
      .filter(item => !item.archived && item.category === 'Add-ons')
      .map(item => ({
        id: item.id,
        name: item.name,
        price: item.price || 0,
        inStock: item.currentStock > 0,
        unit: item.unit || 'piece',
        category: 'supplies',
        description: `${item.name} for printing needs`,
      }));
  }

  private paperDisplayName(code: string): string {
    switch (code) {
      case 'a4': return 'A4';
      case 'short': return 'Short (8.5 x 11 in)';
      case 'legal': return 'Legal (8.5 x 14 in)';
      case 'long': return 'Long (8.5 x 13 in)';
      case 'folio': return 'Folio (8.5 x 13 in)';
      case 'a3': return 'A3';
      case '2R': return '2R';
      case '3R': return '3R';
      case '4R': return '4R';
      case '5R': return '5R';
      case '6R': return '6R';
      case 'A4photo': return 'A4';
      default: return code;
    }
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback());
  }
}

export const inventoryStore = new InventoryStore();
