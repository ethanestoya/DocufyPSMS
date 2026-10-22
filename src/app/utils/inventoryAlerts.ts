// Automatic inventory alerts for the Notifications system.
// Monitors the inventory store and emits a notification when an item
// transitions into a Low Stock or Out of Stock condition.
//
// The inventory store remains the single source of truth for stock levels.
// This module subscribes to it and re-evaluates every inventory change (Stock
// In / Stock Out / order deductions / item edits), so alerts stay in sync
// without any separate or hardcoded stock calculations.
//
// Deduplication: each item only re-fires an alert when it FIRST enters a
// low/out condition. While it stays low/out no new alert is created. Once it
// is restocked past the threshold (healthy) and later drops low/out again, a
// fresh alert is created. The dedup state lives in Supabase
// (`inventory_alert_state`, one row per item) so a NEW browser/device doesn't
// re-fire alerts that were already sent; localStorage is kept as the offline
// fallback.
//
// Recipients: staff and admin only (customers never see these).
import { inventoryStore, type InventoryItem, type InventoryStatus } from './inventoryStore';
import { notificationStore } from './notificationStore';
import {
  fetchInventoryAlertState,
  upsertInventoryAlertState,
  subscribeInventoryAlertState,
} from '../../lib/db/inventoryAlertsRepo';

const STATE_KEY = 'docufy_inventory_alert_state_v1';

// itemId -> the last status (out/low/ok) an alert was emitted for.
type AlertState = Record<string, InventoryStatus>;

function loadLocalState(): AlertState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as AlertState) : {};
  } catch {
    return {};
  }
}

function saveLocalState(state: AlertState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures — alerts will just re-fire next evaluation.
  }
}

// In-memory working state, seeded from the offline mirror.
let state: AlertState = loadLocalState();

// Best-effort push of one item's state to Supabase. RLS-denied is silent
// (a customer context never alerts anyway); other failures are logged so a
// failed sync is never invisible.
function pushRemote(itemId: string, status: InventoryStatus): void {
  void upsertInventoryAlertState(itemId, status).catch((err) => {
    const msg = String((err as { message?: string })?.message ?? err);
    if (/row-level security|permission denied|JWT|not authenticated/i.test(msg)) return;
    console.warn('[inventoryAlerts] alert state not synced to server', itemId, err);
  });
}

// Piece count display used in the message, matching the Inventory module's
// emphasis on pieces (a paper ream = 500 pcs; other items = 1 pc per unit).
function piecesLabel(item: InventoryItem): string {
  const pcs = Math.round(item.currentStock * (item.pcsPerUnit || 1));
  const unit = item.pcsPerUnit && item.pcsPerUnit > 1 ? ` (${item.currentStock} ${item.unit}(s))` : '';
  return `${pcs.toLocaleString()} pcs${unit}`;
}

function minPiecesLabel(item: InventoryItem): string {
  const pcs = Math.round(item.minimumStock * (item.pcsPerUnit || 1));
  const unit = item.pcsPerUnit && item.pcsPerUnit > 1 ? ` (${item.minimumStock} ${item.unit}(s))` : '';
  return `${pcs.toLocaleString()} pcs${unit}`;
}

function emitAlert(item: InventoryItem, status: 'low' | 'out'): void {
  const isOut = status === 'out';
  const title = isOut ? 'Out of Stock' : 'Low Stock';
  const message = isOut
    ? `${item.name} is out of stock. The item currently has ${piecesLabel(item)} remaining and may no longer be available for transactions.`
    : `${item.name} is running low. Current stock: ${piecesLabel(item)}; minimum stock: ${minPiecesLabel(item)}. Please consider restocking this item.`;

  notificationStore.addNotification('inventory', title, message, {
    priority: isOut ? 'emergency' : 'important',
    clickable: true,
    recipientRole: 'staff_admin',
  });
}

// Re-evaluate the current inventory and emit alerts for items that have just
// entered a low/out condition (avoids duplicate alerts while they remain so).
export function evaluateInventoryAlerts(): void {
  let changed = false;
  const pushed: AlertState = {};

  for (const item of inventoryStore.getActiveItems()) {
    const status = inventoryStore.getInventoryStatus(item);
    const prev = state[item.id];

    // Emit only when an item FIRST enters low/out (not when it stays there).
    if (prev !== status && (status === 'low' || status === 'out')) {
      emitAlert(item, status);
      changed = true;
    }

    if (prev !== status) {
      state[item.id] = status;
      pushed[item.id] = status;
      changed = true;
    }
  }

  if (changed) {
    saveLocalState(state);
    for (const [id, s] of Object.entries(pushed)) pushRemote(id, s);
  }
}

let hydrating = false;

// Force a re-read of the shared dedup state (used at startup and by storeSync
// when auth settles). DB wins per item where a row exists; local entries not
// present in the DB are kept so an offline device doesn't re-fire. Failures
// keep the local mirror.
export async function refreshInventoryAlertsFromBackend(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  try {
    const remote = await fetchInventoryAlertState();
    state = { ...state, ...remote };
    saveLocalState(state);
    evaluateInventoryAlerts();
  } catch (err) {
    console.warn('[inventoryAlerts] hydrate failed — keeping local state', err);
  } finally {
    hydrating = false;
  }
}

// Subscribe to inventory changes so Stock In/Out (and order deductions / item
// edits, which all route through the same store) automatically re-evaluate.
inventoryStore.subscribe(evaluateInventoryAlerts);

// Subscribe to the shared dedup state so a change on another device re-hydrates
// (prevents two open staff machines double-alerting).
subscribeInventoryAlertState(() => {
  void refreshInventoryAlertsFromBackend();
});

// Evaluate once on load so the current stored stock is reflected on startup,
// then hydrate the shared state from the backend.
evaluateInventoryAlerts();
void refreshInventoryAlertsFromBackend();
