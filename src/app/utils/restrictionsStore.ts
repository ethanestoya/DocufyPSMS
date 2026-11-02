// Unclaimed-order restriction STORE.
//
// Holds the two admin-controlled pieces of the unclaimed-order policy in
// Supabase (`unclaimed_offense_overrides` + `customer_restrictions`) with a
// localStorage mirror as the offline/anonymous fallback. The BASE detection of
// an unclaimed order stays derived from real order + status-history data — this
// store never decides whether an order WAS unclaimed; it only remembers the
// human decisions layered on top:
//
//   • per-offense: "confirmed" (counts) or "excused" (does not count)
//   • per-customer: is Cash on Pickup blocked, under which arrangement, and
//     who applied/removed it
//
// Auto-application: when a customer's effective (non-excused) count first
// reaches the threshold, `ensureRestrictionFor` creates the active restriction
// row with the default arrangement for that tier. Once a row exists it is
// never re-created — an admin who removed it (forgiveness) stays removed until
// they re-apply, so the system never fights the person operating it.
import { toast } from 'sonner';
import {
  fetchOverrides,
  fetchRestrictions,
  saveOverride,
  saveRestriction,
  subscribeOverrides,
  subscribeRestrictions,
  type CustomerRestriction,
  type OffenseDecision,
  type OffenseOverride,
  type PaymentArrangement,
} from '../../lib/db/restrictionsRepo';
import { isRlsDenied, showDbError } from '../../lib/db/errors';

const OVERRIDE_KEY = 'docufy_unclaimed_overrides_v1';
const RESTRICTION_KEY = 'docufy_customer_restrictions_v1';

const SYSTEM_ACTOR = 'System';

function loadMap<T>(key: string): Map<string, T> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as [string, T][]) : [];
    return new Map(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Map();
  }
}

function saveMap<T>(key: string, map: Map<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(map.entries())));
  } catch {
    // Quota / private mode — the in-memory copy still drives this session.
  }
}

class RestrictionsStore {
  private overrides = new Map<string, OffenseOverride>();
  private restrictions = new Map<string, CustomerRestriction>();
  private listeners = new Set<() => void>();
  private hydrated = false;

  constructor() {
    this.overrides = loadMap<OffenseOverride>(OVERRIDE_KEY);
    this.restrictions = loadMap<CustomerRestriction>(RESTRICTION_KEY);
  }

  // ── reads ────────────────────────────────────────────────────────────────
  getOverride(orderId: string): OffenseOverride | undefined {
    return this.overrides.get(orderId);
  }

  getOverrides(): Map<string, OffenseOverride> {
    return new Map(this.overrides);
  }

  getRestriction(customerKey: string | null | undefined): CustomerRestriction | null {
    const key = (customerKey ?? '').trim().toLowerCase();
    if (!key) return null;
    return this.restrictions.get(key) ?? null;
  }

  /** Every restriction row (active and removed) for the admin table. */
  getAllRestrictions(): CustomerRestriction[] {
    return Array.from(this.restrictions.values()).sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  /** True when an ACTIVE restriction currently blocks Cash on Pickup. */
  isCashOnPickupBlocked(customerKey: string | null | undefined): boolean {
    return this.getRestriction(customerKey)?.active === true;
  }

  // ── writes ───────────────────────────────────────────────────────────────
  setOverride(input: {
    orderId: string;
    customerKey: string;
    decision: OffenseDecision;
    reason: string | null;
    decidedBy: string | null;
    decidedByName: string | null;
  }): void {
    const row: OffenseOverride = {
      orderId: input.orderId,
      customerKey: input.customerKey.toLowerCase(),
      decision: input.decision,
      reason: input.reason,
      decidedBy: input.decidedBy,
      decidedByName: input.decidedByName,
      decidedAt: new Date().toISOString(),
    };
    this.overrides.set(input.orderId, row);
    this.persist(OVERRIDE_KEY, this.overrides);
    this.notify();
    void this.pushOverride(row);
  }

  clearOverride(orderId: string): void {
    if (!this.overrides.delete(orderId)) return;
    this.persist(OVERRIDE_KEY, this.overrides);
    this.notify();
    void supabaseDeleteOverride(orderId);
  }

  setRestriction(input: {
    customerKey: string;
    customerName: string | null;
    customerEmail: string | null;
    active: boolean;
    arrangement: PaymentArrangement;
    reason: string | null;
    removedReason: string | null;
    setBy: string | null;
    setByName: string | null;
  }): void {
    const now = new Date().toISOString();
    const key = input.customerKey.toLowerCase();
    const existing = this.restrictions.get(key);
    const row: CustomerRestriction = {
      customerKey: key,
      customerName: input.customerName ?? existing?.customerName ?? null,
      customerEmail: input.customerEmail ?? existing?.customerEmail ?? null,
      active: input.active,
      arrangement: input.arrangement,
      reason: input.reason,
      removedReason: input.removedReason,
      setBy: input.setBy,
      setByName: input.setByName,
      setAt: existing?.setAt ?? now,
      updatedAt: now,
    };
    this.restrictions.set(key, row);
    this.persist(RESTRICTION_KEY, this.restrictions);
    this.notify();
    void this.pushRestriction(row);
  }

  /**
   * Auto-apply a restriction the first time a customer's effective count
   * reaches the threshold. Never overwrites an existing row — a restriction an
   * admin removed stays removed until they re-apply it.
   */
  ensureRestrictionFor(input: {
    customerKey: string;
    customerName: string | null;
    customerEmail: string | null;
    count: number;
  }): void {
    const key = (input.customerKey ?? '').trim().toLowerCase();
    if (!key) return;
    if (input.count < 2) return;
    if (this.restrictions.has(key)) return;
    this.setRestriction({
      customerKey: key,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      active: true,
      arrangement: input.count >= 3 ? 'full_advance' : 'deposit_50',
      reason: `Applied automatically — ${input.count} unclaimed orders on record.`,
      removedReason: null,
      setBy: null,
      setByName: SYSTEM_ACTOR,
    });
  }

  // ── sync ─────────────────────────────────────────────────────────────────
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  private persist<T>(key: string, map: Map<string, T>): void {
    saveMap(key, map);
  }

  /** Pull both tables. DB wins per row; the local mirror fills any gap. */
  async refreshFromBackend(): Promise<void> {
    try {
      const [overrides, restrictions] = await Promise.all([
        fetchOverrides(),
        fetchRestrictions(),
      ]);
      if (overrides.size > 0) {
        for (const [id, row] of overrides) this.overrides.set(id, row);
      }
      if (restrictions.size > 0) {
        for (const [key, row] of restrictions) this.restrictions.set(key, row);
      }
      this.hydrated = true;
      this.persist(OVERRIDE_KEY, this.overrides);
      this.persist(RESTRICTION_KEY, this.restrictions);
      this.notify();
    } catch (err) {
      if (isRlsDenied(err)) return; // anonymous / customer context — keep mirror
      console.warn('[restrictions] hydrate failed — keeping local state', err);
    }
  }

  private async pushOverride(row: OffenseOverride): Promise<void> {
    try {
      await saveOverride({
        orderId: row.orderId,
        customerKey: row.customerKey,
        decision: row.decision,
        reason: row.reason,
        decidedBy: row.decidedBy,
        decidedByName: row.decidedByName,
      });
    } catch (err) {
      if (isRlsDenied(err)) return;
      showDbError('unclaimed.override', err);
      toast.error("This decision was kept locally but couldn't sync to the server.");
    }
  }

  private async pushRestriction(row: CustomerRestriction): Promise<void> {
    try {
      await saveRestriction({
        customerKey: row.customerKey,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        active: row.active,
        arrangement: row.arrangement,
        reason: row.reason,
        removedReason: row.removedReason,
        setBy: row.setBy,
        setByName: row.setByName,
      });
    } catch (err) {
      if (isRlsDenied(err)) return;
      showDbError('unclaimed.restriction', err);
      toast.error("This restriction was kept locally but couldn't sync to the server.");
    }
  }

  /** True once the backend has answered at least once this session. */
  get isHydrated(): boolean {
    return this.hydrated;
  }
}

async function supabaseDeleteOverride(orderId: string): Promise<void> {
  const { deleteOverride } = await import('../../lib/db/restrictionsRepo');
  try {
    await deleteOverride(orderId);
  } catch (err) {
    if (isRlsDenied(err)) return;
    console.warn('[restrictions] override not removed on server', orderId, err);
  }
}

export const restrictionsStore = new RestrictionsStore();

// Realtime: an admin's decision on one machine updates every other open one.
subscribeOverrides(() => {
  void restrictionsStore.refreshFromBackend();
});
subscribeRestrictions(() => {
  void restrictionsStore.refreshFromBackend();
});

void restrictionsStore.refreshFromBackend();

export type { CustomerRestriction, OffenseOverride, OffenseDecision, PaymentArrangement };
