// Re-hydrates every Supabase-backed store after auth settles.
//
// Why: each store runs its first DB fetch in its own module-constructor, which
// races the Supabase session restore on first load. In a fresh/incognito browser
// context (empty localStorage) that first fetch goes out anonymous, RLS returns
// nothing, and the store caches the empty snapshot — so a user logging in
// afterwards sees no data until a manual reload (and reloads flip between
// working/empty depending on who wins the timing race).
//
// AuthContext calls refreshAllStores() on session restore / login / signup so
// every store re-reads with the authenticated token immediately.
import { dataStore } from './dataStore';
import { inventoryStore } from './inventoryStore';
import { paymentMethodsStore } from './paymentMethodsStore';
import { attendanceStore } from './attendanceStore';
import { jobsStore } from './jobsStore';
import { applicationsStore } from './applicationsStore';
import { notificationStore } from './notificationStore';
import { announcementsStore } from './announcementsStore';
import { pricingStore } from './pricingStore';
import { shopStatusStore } from './shopStatusStore';
import { landingContentStore } from './landingContentStore';
import { legalContentStore } from './legalContentStore';
import { logoStore } from './logoStore';
import { shopPhotosStore } from './shopPhotosStore';
import { staffStore } from './staffStore';
import { salaryStore } from './salaryStore';
import { auditLogStore } from './auditLogStore';
import { refreshInventoryAlertsFromBackend } from './inventoryAlerts';
import { restrictionsStore } from './restrictionsStore';

// ---------------------------------------------------------------------------
// Hydration tracking.
//
// Every store below reads from Supabase, so `refreshAllStores()` is a real
// network wait (16 parallel round-trips). Until now that wait was completely
// invisible: pages painted their localStorage/seed mirror, then silently
// swapped, and a slow connection just looked like "the data isn't there yet".
//
// This module is the single chokepoint all of those calls already pass through,
// so tracking the pending count here exposes app-wide hydration state WITHOUT
// touching any of the 16 stores. Consumers use `useHydrating()`.
// ---------------------------------------------------------------------------

type Subscriber = () => void;

let pendingHydrations = 0;
const subscribers = new Set<Subscriber>();

function notify(): void {
  subscribers.forEach((listener) => listener());
}

/** True while at least one `refreshAllStores()` batch is still in flight. */
export const isHydrating = (): boolean => pendingHydrations > 0;

export function subscribeHydration(listener: Subscriber): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export async function refreshAllStores(): Promise<void> {
  pendingHydrations += 1;
  if (pendingHydrations === 1) notify();

  try {
    await Promise.allSettled([
      dataStore.refreshFromBackend(),
      inventoryStore.refresh(),
      paymentMethodsStore.refresh(),
      attendanceStore.refresh(),
      jobsStore.refreshFromBackend(),
      applicationsStore.refreshFromBackend(),
      notificationStore.refreshFromBackend(),
      announcementsStore.refreshFromBackend(),
      pricingStore.refreshFromBackend(),
      shopStatusStore.refreshFromBackend(),
      landingContentStore.refreshFromBackend(),
      legalContentStore.refreshFromBackend(),
      logoStore.refreshFromBackend(),
      shopPhotosStore.refreshFromBackend(),
      staffStore.refreshFromBackend(),
      salaryStore.refreshFromBackend(),
      auditLogStore.refreshFromBackend(),
      refreshInventoryAlertsFromBackend(),
      restrictionsStore.refreshFromBackend(),
    ]);
  } finally {
    pendingHydrations -= 1;
    if (pendingHydrations === 0) notify();
  }
}