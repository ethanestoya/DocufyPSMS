// ============================================================================
// ORDER SESSION LOCKS — Supabase-backed facade
// ----------------------------------------------------------------------------
// "Who is reviewing this order right now" so two staff/admin don't approve /
// process the same order at the same time.
//
// The authoritative source of truth is the shared `order_locks` table (one row
// per order, `expires_at` = now() + 5 min), so claims/releases/expiry are
// visible to EVERY machine — not just the tabs of one browser. The localStorage
// mirror below stays as the offline / anonymous fallback (and the cross-tab
// `storage` event still keeps this browser's tabs coherent).
//
// AUTHENTICATED LOCK RULES:
//   - Only the lock holder may act on the order.
//   - A lock auto-expires after LOCK_TIMEOUT_MS so a dropped PC / crashed tab
//     doesn't trap an order forever.
//   - claimLock NEVER steals a live lock held by someone else (the server-side
//     `claim_order_lock` RPC makes that decision atomic); if our local mirror
//     and the DB fall out of sync, the DB wins on the next hydrate.
//   - releaseLock only ever frees OUR hold.
//
// API kept identical to the old localStorage module — consumers only gain the
// async `verifyLockOnServer` for the final-confirm moment.
// ============================================================================

import { authReady } from '../../lib/supabaseClient';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import {
  claimOrderLock,
  fetchOrderLocks,
  getOrderLockById,
  pruneExpiredOrderLocks,
  releaseOrderLock,
  sessionUserProfileId,
  subscribeOrderLocks,
} from '../../lib/db/orderLocksRepo';
import type { OrderLockRow } from '../../lib/db/types';

export interface OrderLock {
  orderId: string;
  heldBy: string;
  heldAt: number;
}

const STORAGE_KEY = "docufy_order_locks";
export const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (matches the DB TTL)

const empty = (): Record<string, OrderLock> => ({});

function load(): Record<string, OrderLock> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, OrderLock>;
    return empty();
  } catch {
    return empty();
  }
}

function persist(map: Record<string, OrderLock>) {
  try {
    const serialized = JSON.stringify(map);
    // Skip identical writes: a `storage` event only fires when the value really
    // changes, so this keeps the sibling tabs from bouncing empty snapshots off
    // each other now that every writer re-applies its own holds before saving.
    if (localStorage.getItem(STORAGE_KEY) === serialized) return;
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // ignore storage quota/availability errors
  }
}

// In-memory mirror of the LIVE locks. Reads here are synchronous (consumers
// call getLock/getAllLocks during render), while every mutation also fires a
// best-effort push to the DB and the DB wins on hydrate/realtime.
let mirror: Record<string, OrderLock> = load();
const subscribers = new Set<() => void>();
let hydrating = false;

// Order ids THIS tab has claimed and not released. The DB snapshot stays
// authoritative for every order it mentions, but it can lag behind our own
// optimistic claim (the `claim_order_lock` push is best-effort), and a wholesale
// replace used to erase a lock we had just taken. Only locks in this set are
// carried across such a gap — so a colleague's lock that they release is never
// resurrected by our stale mirror, while ours survives the echo.
const heldLocally = new Set<string>();

function notify() {
  subscribers.forEach((cb) => cb());
}

/**
 * The locks THIS tab holds that are still inside their TTL, read out of `prev`.
 *
 * Both places that reload the mirror wholesale have to call this: "this snapshot
 * doesn't mention the order" means "the writer hasn't caught up", NOT "nobody
 * holds it". Scoped to `heldLocally` so a colleague's claim or release still
 * applies immediately and is never undone by our own hold.
 */
function liveHeldFrom(prev: Record<string, OrderLock>): Record<string, OrderLock> {
  const kept: Record<string, OrderLock> = {};
  for (const orderId of heldLocally) {
    const lock = prev[orderId];
    if (lock && !isLockExpired(lock)) kept[orderId] = lock;
  }
  return kept;
}

function refreshFromRows(rows: OrderLockRow[]) {
  const next: Record<string, OrderLock> = {};
  for (const row of rows) {
    const heldAt = Date.parse(row.locked_at);
    if (Number.isNaN(heldAt)) continue;
    next[row.order_id] = {
      orderId: row.order_id,
      heldBy: row.locked_by_name ?? row.locked_by,
      heldAt,
    };
  }
  // Carry over locks this tab still holds that the snapshot didn't mention, so a
  // snapshot lagging behind our own optimistic claim can't wipe them.
  for (const [orderId, lock] of Object.entries(liveHeldFrom(mirror))) {
    if (!next[orderId]) next[orderId] = lock;
  }
  mirror = next;
  persist(mirror);
  notify();
}

// Pull the authoritative lock snapshot from Supabase. The DB replaces the
// mirror for every order it mentions (so a live lock claimed on ANOTHER machine
// shows up here), while locks this tab holds but the snapshot hasn't caught up
// with are carried over (see refreshFromRows); an empty/unreachable backend
// keeps the local mirror as the offline fallback.
async function hydrate(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  await authReady;
  try {
    const rows = await fetchOrderLocks();
    refreshFromRows(rows);
    // Expired rows are invisible to every reader already; prune them so the
    // table doesn't grow forever. Best-effort — never blocks hydration.
    void pruneExpiredOrderLocks().catch(() => {});
  } catch (err) {
    console.warn('[order-locks] hydration kept local data:', err);
  } finally {
    hydrating = false;
  }
}

// Re-verify OUR hold against the server right before a final confirm. This is
// the authoritative check (a second machine may have claimed the order after
// we opened our dialog). When the DB is unreachable it falls back to the local
// mirror so the offline flow keeps working.
export async function verifyLockOnServer(orderId: string, heldBy?: string): Promise<boolean> {
  try {
    const profileId = await sessionUserProfileId();
    if (profileId) {
      const row = await getOrderLockById(orderId);
      // getOrderLockById already excludes expired rows — an expired/missing
      // lock therefore means we can NOT act, regardless of our local mirror.
      return !!row && row.locked_by === profileId;
    }
  } catch {
    // fall through to the local mirror
  }
  return heldBy ? stillHoldsLock(orderId, heldBy) : false;
}

// Live sync: realtime on `order_locks` re-hydrates from ANY device, and the
// `storage` event keeps this browser's other tabs coherent.
subscribeOrderLocks(() => {
  void hydrate();
});
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  // Another tab of THIS browser just wrote the shared lock key, so reload it —
  // but re-apply the locks we hold first. A sibling tab has no business clearing
  // them: any tab can wipe the key, because Supabase RLS returns ZERO ROWS WITH
  // NO ERROR to a context that can't see `order_locks` (a customer tab, or a tab
  // that hydrated before its session attached), and that tab's `persist({})`
  // fires this event here. Taking `load()` at face value used to drop the lock on
  // an order we had open, seconds after claiming it.
  const previous = mirror;
  mirror = load();
  for (const [orderId, lock] of Object.entries(liveHeldFrom(previous))) {
    if (!mirror[orderId]) mirror[orderId] = lock;
  }
  persist(mirror);
  notify();
});
void hydrate();

export function isLockExpired(lock: OrderLock): boolean {
  return Date.now() - lock.heldAt > LOCK_TIMEOUT_MS;
}

/** Read the current (non-expired) lock for an order, if any. */
export function getLock(orderId: string): OrderLock | null {
  const lock = mirror[orderId];
  if (!lock) return null;
  if (isLockExpired(lock)) {
    heldLocally.delete(orderId);
    delete mirror[orderId];
    persist(mirror);
    return null;
  }
  return lock;
}

/** All non-expired locks (right now), for list-row indicators. */
export function getAllLocks(): OrderLock[] {
  const now = Date.now();
  let changed = false;
  const result: OrderLock[] = [];
  Object.values(mirror).forEach((lock) => {
    if (now - lock.heldAt > LOCK_TIMEOUT_MS) {
      delete mirror[lock.orderId];
      changed = true;
    } else {
      result.push(lock);
    }
  });
  if (changed) persist(mirror);
  return result;
}

/**
 * Claim (or renew) a lock for an order held by `heldBy`.
 *
 * Mirrors the old safe-by-design behavior: it will NOT steal an active lock
 * held by someone else — if another user holds a live lock it returns that
 * lock without touching it. If the lock is expired (dropped PC) OR held by us,
 * it (re)claims it, which doubles as the "heartbeat" that keeps our lock alive
 * while our window stays open. Local-first (instant UI), then the async
 * `claim_order_lock` RPC makes the server-side claim atomically; if the RPC
 * reports that someone else took it in between, the DB snapshot re-hydrates.
 * Returns the resulting lock.
 */
export function claimLock(orderId: string, heldBy: string): OrderLock {
  const existing = mirror[orderId];
  if (existing && !isLockExpired(existing) && existing.heldBy !== heldBy) {
    return existing; // someone else holds a live lock — don't steal it
  }
  const lock: OrderLock = { orderId, heldBy, heldAt: Date.now() };
  heldLocally.add(orderId);
  mirror[orderId] = lock;
  persist(mirror);
  notify();
  void pushClaim(orderId);
  return lock;
}

async function pushClaim(orderId: string): Promise<void> {
  try {
    const profileId = await sessionUserProfileId();
    if (!profileId) {
      console.warn('[order-locks] no session — keeping local-only lock');
      return;
    }
    const row = await claimOrderLock(orderId, profileId);
    if (row === null) {
      // A live lock held by someone else won the race — adopt the real DB
      // state (never keep a locally-optimistic lock the server didn't grant).
      void hydrate();
    }
  } catch (err) {
    if (!isRlsDenied(err)) showDbError('order-locks.claim', err);
    else console.warn('[order-locks] not synced (RLS) — keeping local lock:', err);
  }
}

/**
 * Keep OUR hold on one order alive for as long as a reviewer keeps it open.
 *
 * A plain `setInterval` heartbeat is not enough: a backgrounded tab has its
 * timers throttled, and Chrome can freeze an occluded tab outright, so the
 * 5-minute TTL can lapse while the dialog is STILL open. The reviewer comes
 * back, `getLock` reports the hold gone, and their own window turns read-only
 * until they close and reopen it.
 *
 * So this re-asserts the hold on every "the page is being looked at again"
 * signal (tab shown again, window focused, page restored from the back/forward
 * cache), on top of the 30s renewal. `claimLock` never steals a live lock held
 * by somebody else, so re-asserting is always safe: it renews ours, or returns
 * theirs and lets the UI show who holds it now.
 *
 * Returns a stop function; call it when the dialog closes or the order changes.
 */
export function holdLockWhileOpen(orderId: string, heldBy: string): () => void {
  const beat = () => {
    if (orderId) claimLock(orderId, heldBy);
  };

  beat();
  const iv = window.setInterval(beat, 30000);

  const onResume = () => {
    if (document.visibilityState === "visible") beat();
  };
  // Waking from sleep can resume the page without a focus/visibility event, so
  // the first interaction after that also repairs the hold. Guarded so a normal
  // click never costs a claim round-trip: when the hold is healthy this is a
  // pure in-memory check.
  const onInteract = () => {
    if (!stillHoldsLock(orderId, heldBy)) beat();
  };
  document.addEventListener("visibilitychange", onResume);
  window.addEventListener("focus", onResume);
  window.addEventListener("pageshow", onResume);
  window.addEventListener("pointerdown", onInteract, { passive: true });
  window.addEventListener("keydown", onInteract);

  return () => {
    window.clearInterval(iv);
    document.removeEventListener("visibilitychange", onResume);
    window.removeEventListener("focus", onResume);
    window.removeEventListener("pageshow", onResume);
    window.removeEventListener("pointerdown", onInteract);
    window.removeEventListener("keydown", onInteract);
  };
}

/**
 * Release a held lock. NEVER releases a lock held by someone else —
 * passing `heldBy` (the current user's name) makes this safe across machines:
 * closing our window only ever frees OUR lock, never another reviewer's.
 */
export function releaseLock(orderId: string, heldBy?: string) {
  const lock = mirror[orderId];
  if (!lock) return;
  if (heldBy && lock.heldBy !== heldBy) return; // not ours — leave it alone
  heldLocally.delete(orderId);
  delete mirror[orderId];
  persist(mirror);
  notify();
  void pushRelease(orderId);
}

async function pushRelease(orderId: string): Promise<void> {
  try {
    const profileId = await sessionUserProfileId();
    if (!profileId) return; // mirror-only (offline / anonymous)
    await releaseOrderLock(orderId, profileId);
  } catch (err) {
    if (!isRlsDenied(err)) showDbError('order-locks.release', err);
    else console.warn('[order-locks] release not synced (RLS):', err);
  }
}

/**
 * Quick mirror check that this tab still holds the lock for an order. For the
 * FINAL confirm moment use `verifyLockOnServer` — this is only a hint.
 */
export function stillHoldsLock(orderId: string, heldBy: string): boolean {
  const lock = getLock(orderId);
  return !!lock && lock.heldBy === heldBy;
}

/** Subscribe to lock changes from ANY tab or device (realtime + storage). */
export function subscribeToLocks(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}