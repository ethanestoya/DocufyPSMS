// Supabase-backed online payment-method store facade.
// Sync read API (served from an in-memory cache) + async writes to the DB +
// realtime refresh, so every existing consumer (admin management page,
// customer checkout/payment pages, staff verification) keeps working while the
// source of truth moves to the `payment_methods` table. Admin manages the list
// (name, account holder, account number, QR image); customers only ever see the
// ACTIVE methods (enforced by RLS and filtered locally).
import {
  fetchPaymentMethods,
  savePaymentMethod,
  setPaymentMethodActive,
  deletePaymentMethod as dbDeletePaymentMethod,
  uploadQrCode,
  type PaymentMethodDto,
} from '../../lib/db/paymentMethodsRepo';
import { subscribeTableChanges } from '../../lib/db/hooks';
import { authReady } from '../../lib/supabaseClient';
import { auditLogStore, type AuditChange } from './auditLogStore';

export type PaymentMethodType = {
  id: string;
  name: string; // display name, e.g. "GCash", "Maya"
  accountName: string; // account / account-holder name
  accountNumber: string; // account or payment number
  qrCode?: string; // display URL (public storage URL, or a placeholder data URL)
  qrStoragePath?: string | null; // real uploaded QR path (null = placeholder)
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Subscriber = () => void;

// Deterministic pseudo-QR placeholder SVG (differs per label) so every
// online method still has something scannable-looking to display/download
// before an admin uploads a real QR image.
function makePlaceholderQR(label: string): string {
  const cells: boolean[] = [];
  let seed = label.length * 73 + 11;
  for (let i = 0; i < 64; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.48);
  }
  const rects = cells
    .map((c, i) =>
      c
        ? `<rect width="10" height="10" x="${16 + (i % 8) * 21}" y="${16 + Math.floor(i / 8) * 21}"/>`
        : ''
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="white"/><g fill="black">${rects}<rect x="176" y="16" width="12" height="12" fill="black"/><rect x="16" y="168" width="12" height="12" fill="black"/></g><text x="100" y="194" font-family="sans-serif" font-size="9" fill="#888" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function dtoToType(dto: PaymentMethodDto): PaymentMethodType {
  return {
    id: dto.id,
    name: dto.name,
    accountName: dto.accountName,
    accountNumber: dto.accountNumber,
    qrCode: dto.qrUrl ?? makePlaceholderQR(dto.name),
    qrStoragePath: dto.qrStoragePath,
    active: dto.active,
    createdAt: dto.createdAt.toISOString(),
    updatedAt: dto.updatedAt.toISOString(),
  };
}

class PaymentMethodsStore {
  private methods: PaymentMethodType[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private hydrating: Promise<void> | null = null;

  constructor() {
    void this.hydrate();
    // Live refresh when any client (admin on another device/tab) changes a row.
    subscribeTableChanges('payment_methods', () => {
      void this.hydrate();
    });
  }

  // Reload the cache from the DB. Concurrent calls share one in-flight request.
  private hydrate(): Promise<void> {
    if (this.hydrating) return this.hydrating;
    this.hydrating = (async () => {
      await authReady;
      try {
        const dtos = await fetchPaymentMethods();
        this.methods = dtos.map(dtoToType);
        this.notify();
      } catch (err) {
        console.warn('[paymentMethodsStore] hydrate failed:', err);
      } finally {
        this.hydrating = null;
      }
    })();
    return this.hydrating;
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }

  // Public force-refetch entry (used by storeSync when auth settles).
  refresh(): Promise<void> {
    return this.hydrate();
  }

  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  getAllPaymentMethods(): PaymentMethodType[] {
    return [...this.methods];
  }

  // Only methods customers can currently use
  getPaymentMethods(): PaymentMethodType[] {
    return this.getAllPaymentMethods().filter((m) => m.active);
  }

  findById(id: string): PaymentMethodType | undefined {
    return this.methods.find((m) => m.id === id);
  }

  findByName(name: string): PaymentMethodType | undefined {
    const normalized = (name || '').toLowerCase();
    return this.methods.find((m) => m.name.toLowerCase() === normalized);
  }

  nameExists(name: string, excludeId?: string): boolean {
    const normalized = (name || '').trim().toLowerCase();
    return this.methods.some(
      (m) => m.id !== excludeId && m.name.toLowerCase() === normalized,
    );
  }

  async addPaymentMethod(data: {
    name: string;
    accountName: string;
    accountNumber: string;
    qrCode?: string;
  }): Promise<PaymentMethodType> {
    const qrStoragePath = data.qrCode ? await uploadQrCode(data.qrCode) : null;
    const id = await savePaymentMethod({
      name: data.name.trim(),
      accountName: data.accountName.trim(),
      accountNumber: data.accountNumber.trim(),
      qrStoragePath,
      active: true,
    });
    auditLogStore.record({
      module: 'Payment Methods',
      action: 'Created',
      reference: data.name.trim(),
      entityType: 'Payment Method',
      entityId: id,
      title: 'Payment Method Added',
      description: `Added the payment method "${data.name.trim()}" (${data.accountName.trim()}${data.accountNumber.trim() ? ` / ${data.accountNumber.trim()}` : ''}).`,
    });
    await this.hydrate();
    return this.findById(id) ?? {
      id,
      name: data.name.trim(),
      accountName: data.accountName.trim(),
      accountNumber: data.accountNumber.trim(),
      qrCode: qrStoragePath ? undefined : makePlaceholderQR(data.name.trim()),
      qrStoragePath,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updatePaymentMethod(
    id: string,
    updates: Partial<
      Pick<PaymentMethodType, 'name' | 'accountName' | 'accountNumber' | 'qrCode' | 'active'>
    >,
  ): Promise<boolean> {
    const current = this.findById(id);
    if (!current) return false;

    // A brand-new upload arrives as a data URL that differs from what's already
    // displayed; anything else (an unchanged URL, or the generated placeholder)
    // keeps the existing stored QR.
    let qrStoragePath = current.qrStoragePath ?? null;
    if (
      updates.qrCode &&
      updates.qrCode.startsWith('data:') &&
      updates.qrCode !== current.qrCode
    ) {
      qrStoragePath = await uploadQrCode(updates.qrCode);
    }

    await savePaymentMethod({
      id,
      name: updates.name ?? current.name,
      accountName: updates.accountName ?? current.accountName,
      accountNumber: updates.accountNumber ?? current.accountNumber,
      qrStoragePath,
      active: updates.active ?? current.active,
    });
    if (updates.active !== undefined && updates.active !== current.active) {
      auditLogStore.record({
        module: 'Payment Methods',
        action: 'Updated',
        reference: current.name,
        entityType: 'Payment Method',
        entityId: id,
        title: updates.active ? 'Payment Method Activated' : 'Payment Method Deactivated',
        description: `${updates.active ? 'Activated' : 'Deactivated'} the payment method "${current.name}".`,
        changes: [{ field: 'Active', previous: current.active ? 'Yes' : 'No', next: updates.active ? 'Yes' : 'No' }],
      });
    } else {
      const changes: AuditChange[] = [];
      if (updates.name !== undefined && updates.name !== current.name) {
        changes.push({ field: 'Name', previous: current.name, next: updates.name });
      }
      if (updates.accountName !== undefined && updates.accountName !== current.accountName) {
        changes.push({ field: 'Account Name', previous: current.accountName, next: updates.accountName });
      }
      if (updates.accountNumber !== undefined && updates.accountNumber !== current.accountNumber) {
        changes.push({ field: 'Account Number', previous: current.accountNumber, next: updates.accountNumber });
      }
      if (updates.qrCode !== undefined && updates.qrCode.startsWith('data:')) {
        changes.push({ field: 'QR Code', previous: 'Previous image', next: 'New image' });
      }
      if (changes.length > 0) {
        auditLogStore.record({
          module: 'Payment Methods',
          action: 'Updated',
          reference: updates.name ?? current.name,
          entityType: 'Payment Method',
          entityId: id,
          title: 'Payment Method Updated',
          description: `Updated the payment method "${updates.name ?? current.name}".`,
          changes,
        });
      }
    }
    await this.hydrate();
    return true;
  }

  async setActive(id: string, active: boolean): Promise<boolean> {
    const current = this.findById(id);
    await setPaymentMethodActive(id, active);
    auditLogStore.record({
      module: 'Payment Methods',
      action: 'Updated',
      reference: current?.name ?? id,
      entityType: 'Payment Method',
      entityId: id,
      title: active ? 'Payment Method Activated' : 'Payment Method Deactivated',
      description: `${active ? 'Activated' : 'Deactivated'} the payment method "${current?.name ?? id}".`,
      changes: [{ field: 'Active', previous: active ? 'No' : 'Yes', next: active ? 'Yes' : 'No' }],
    });
    await this.hydrate();
    return true;
  }

  async deletePaymentMethod(id: string): Promise<boolean> {
    const current = this.findById(id);
    await dbDeletePaymentMethod(id, current?.qrStoragePath ?? null);
    auditLogStore.record({
      module: 'Payment Methods',
      action: 'Deleted',
      reference: current?.name ?? id,
      entityType: 'Payment Method',
      entityId: id,
      title: 'Payment Method Deleted',
      description: `Deleted the payment method "${current?.name ?? id}".`,
    });
    await this.hydrate();
    return true;
  }
}

export const paymentMethodsStore = new PaymentMethodsStore();

// Trigger a client-side download of the method's QR image. Data URLs download
// directly; remote (Supabase Storage) URLs are fetched into a blob first so the
// `download` attribute actually applies (it's ignored cross-origin).
export function downloadQRCode(
  qrCode: string | undefined,
  filename: string,
): boolean {
  if (!qrCode) return false;
  const link = document.createElement('a');
  link.download = filename;

  if (qrCode.startsWith('data:')) {
    link.href = qrCode;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  fetch(qrCode)
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    })
    .catch(() => {
      window.open(qrCode, '_blank', 'noopener,noreferrer');
    });
  return true;
}

export function methodQRFilename(method: PaymentMethodType): string {
  return `${method.name.toLowerCase().replace(/\s+/g, '-')}-qr-code`;
}
