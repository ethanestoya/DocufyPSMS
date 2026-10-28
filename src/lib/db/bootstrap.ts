import { supabase } from '../supabaseClient';
import { DEFAULT_MATRIX, pricingStore } from '../../app/utils/pricingStore';
import { landingContentStore } from '../../app/utils/landingContentStore';
import { legalContentStore } from '../../app/utils/legalContentStore';
import type {
  PricingSettingsRow,
  MatrixCellInsert,
  StaffRecordInsert,
  JobInsert,
  InventoryItemInsert,
} from './types';
import type { Json } from '../database.types';

// Phase 0 bootstrap: guarantee the single-row settings tables and the pricing
// matrix cells exist so every later phase has a stable source of truth. This is
// BEST-EFFORT: RLS may forbid the calling role from inserting (customers), and
// the tables may already be seeded by the admin. Failed attempts degrade
// quietly — nothing here may crash the app startup.

let started = false;

export function startBootstrap(): void {
  if (started) return;
  started = true;
  void runAll().catch((err) => {
    console.warn('[bootstrap] aborted:', err);
  });
}

async function runAll(): Promise<void> {
  await ensurePricingSettings();
  await ensureMatrixCells();
  await ensurePaymentMethods();
  await ensureStaffRecords();
  await ensureJobs();
  await ensureInventory();
  await ensureShopStatus();
  await ensureLandingContent();
  await ensureLegalPolicies();
  await ensureBrandSettings();
  await ensureSalarySettings();
  await ensureStaffNested();
}

// Seed `staff_records` directory rows for the DEMO roster so attendance sync
// has an identity to attach to (the roster members have no Supabase auth
// accounts — only the real staff@test.com account does, and its staff_records
// row gets linked to the existing `profiles.id` by email). The SQL migration
// also seeds these; this is a best-effort runtime counterpart for when the
// migration hasn't been run yet. Idempotent: rows are matched by email.
const DEMO_STAFF_SEEDS: Array<{
  fullName: string;
  email: string;
  employeeCode: string;
}> = [
  { fullName: 'Heaven Rica', email: 'staff@test.com', employeeCode: 'EMP-001' },
  { fullName: 'Robert Chen', email: 'robert.chen@docufy.com', employeeCode: 'EMP-002' },
  { fullName: 'Katie Perry', email: 'katie.perry@docufy.com', employeeCode: 'EMP-003' },
  { fullName: 'Miguel Santos', email: 'miguel.santos@docufy.com', employeeCode: 'EMP-004' },
  { fullName: 'Ana Dela Cruz', email: 'ana.delacruz@docufy.com', employeeCode: 'EMP-005' },
];

async function ensureStaffRecords(): Promise<void> {
  try {
    for (const seed of DEMO_STAFF_SEEDS) {
      const email = seed.email.toLowerCase();
      const { data: existing } = await supabase
        .from('staff_records')
        .select('id, profile_id')
        .eq('email', email)
        .maybeSingle();
      if (existing) continue;

      // Link the real auth account (staff@test.com) to its profiles.id row so
      // clock-ins made while signed in as that user land on its profile_id.
      let profileId: string | null = null;
      if (email === 'staff@test.com') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (profile) profileId = profile.id;
      }

      const insert: StaffRecordInsert = {
        profile_id: profileId,
        employee_code: seed.employeeCode,
        full_name: seed.fullName,
        email,
        role: 'staff',
        status: 'Active',
        attendance_status: 'active',
        on_leave_reason: seed.email === 'staff@test.com'
          ? 'On scheduled annual leave'
          : null,
        join_date: '2026-09-01',
        skills_message: null,
        portfolio_link: null,
        permissions: ['attendance'],
        salary: 0,
      };
      const { error: insertError } = await supabase.from('staff_records').insert(insert);
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.warn('[bootstrap] staff_records seed skipped (RLS or offline):', err);
  }
}

// Seed the two demo online payment methods (GCash / Maya) when the table is
// empty, matching the old localStorage prototype defaults. Best-effort: RLS
// only lets staff/admin insert, so customers simply skip this.
async function ensurePaymentMethods(): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('payment_methods')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    if (count && count > 0) return;
    const { error: insertError } = await supabase.from('payment_methods').insert([
      {
        name: 'GCash',
        account_name: 'Docufy Printing Services',
        account_number: '0917 123 4567',
        qr_storage_path: null,
        active: true,
      },
      {
        name: 'Maya',
        account_name: 'Docufy Printing Services',
        account_number: '0918 765 4321',
        qr_storage_path: null,
        active: true,
      },
    ]);
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] payment_methods seed skipped (RLS or offline):', err);
  }
}

// Seed the two demo job board listings when the table is empty, matching the
// old localStorage defaults. Best-effort: RLS only lets staff/admin insert, so
// customers simply skip this.
const DEFAULT_JOB_SEEDS: Array<{
  title: string;
  description: string;
  type: string;
  duration: string;
  department: string;
  postedDate: string;
}> = [
  {
    title: 'Part-Time Print Shop Assistant',
    description:
      'Assist customers with print requests, handle document processing, operate printing and binding equipment, and help maintain the print shop. Ideal for students looking to gain hands-on experience in a fast-paced environment.',
    type: 'Part-Time',
    duration: '15-20 hours/week',
    department: 'General',
    postedDate: '2026-08-26',
  },
  {
    title: 'Document Encoding / Layout Assistant',
    description:
      'Handle document formatting, encoding, and layout design for customer print jobs. Requires attention to detail and basic familiarity with office/document software.',
    type: 'Part-Time',
    duration: '10-15 hours/week',
    department: 'General',
    postedDate: '2026-08-23',
  },
];

async function ensureJobs(): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    if (count && count > 0) return;
    const rows: JobInsert[] = DEFAULT_JOB_SEEDS.map((seed) => ({
      title: seed.title,
      description: seed.description,
      job_type: seed.type,
      duration: seed.duration,
      department: seed.department,
      location: null,
      salary: null,
      schedule: null,
      requirements: [],
      responsibilities: [],
      status: 'active',
      posted_date: seed.postedDate,
    }));
    const { error: insertError } = await supabase.from('jobs').insert(rows);
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] jobs seed skipped (RLS or offline):', err);
  }
}

// Seed the six demo inventory items when the table is empty, matching the old
// localStorage defaults (paper reams = 500 pcs each, add-on sell prices).
// Best-effort: RLS only lets staff/admin insert, so customers simply skip this.
const DEFAULT_INVENTORY_SEEDS: Array<{
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  price?: number;
  paperSize?: string;
  piecesPerUnit: number;
}> = [
  { name: 'Bond Paper (A4)', category: 'Paper', unit: 'ream', currentStock: 15, minimumStock: 3, paperSize: 'a4', piecesPerUnit: 500 },
  { name: 'Bond Paper (Short)', category: 'Paper', unit: 'ream', currentStock: 12, minimumStock: 3, paperSize: 'short', piecesPerUnit: 500 },
  { name: 'Bond Paper (Legal)', category: 'Paper', unit: 'ream', currentStock: 8, minimumStock: 2, paperSize: 'legal', piecesPerUnit: 500 },
  { name: 'Printer Ink (Black)', category: 'Ink', unit: 'bottle', currentStock: 5, minimumStock: 2, piecesPerUnit: 1 },
  { name: 'Ballpen (Black)', category: 'Add-ons', unit: 'piece', currentStock: 30, minimumStock: 10, price: 10, piecesPerUnit: 1 },
  { name: 'Staples', category: 'Add-ons', unit: 'box', currentStock: 15, minimumStock: 4, price: 5, piecesPerUnit: 1 },
];

async function ensureInventory(): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    if (count && count > 0) return;
    const rows: InventoryItemInsert[] = DEFAULT_INVENTORY_SEEDS.map((seed) => ({
      name: seed.name,
      category: seed.category,
      brand: '',
      unit: seed.unit,
      current_stock: seed.currentStock,
      minimum_stock: seed.minimumStock,
      price: seed.price ?? null,
      paper_size: seed.paperSize ?? null,
      pieces_per_unit: seed.piecesPerUnit,
      archived: false,
    }));
    const { error: insertError } = await supabase.from('inventory_items').insert(rows);
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] inventory seed skipped (RLS or offline):', err);
  }
}

function defaultPricingSettings(): Omit<PricingSettingsRow, 'updated_by' | 'updated_at'> {  const p = pricingStore.getPricing();
  return {
    id: true,
    bw: p.bw,
    color_low: p.colorLow,
    color_high: p.colorHigh,
    size_long_legal_folio: p.sizeLongLegalFolio,
    size_a3: p.sizeA3,
    duplex_savings: p.duplexSavings,
    down_payment_threshold: p.downPaymentThreshold,
    full_payment_threshold: p.fullPaymentThreshold,
    cash_payment_window_seconds: p.cashPickupPaymentWindowSeconds,
    online_payment_window_seconds: p.onlinePaymentVerificationWindowSeconds,
  };
}

async function ensurePricingSettings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('id')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return; // already seeded
    const { error: insertError } = await supabase.from('pricing_settings').insert(defaultPricingSettings());
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] pricing_settings seed skipped (RLS or offline):', err);
  }
}

function defaultMatrixCells(): MatrixCellInsert[] {
  const cells: MatrixCellInsert[] = [];
  const sizes = ['short', 'a4', 'long'] as const;
  const tiers = ['bw', 'partial', 'full'] as const;
  const contents = ['text', 'textWithImage', 'imageOnly'] as const;

  for (const ct of contents) {
    for (const tier of tiers) {
      for (const size of sizes) {
        cells.push({
          service_type: 'document',
          content_type: ct,
          color_tier: tier,
          paper_size: size,
          photo_size: null,
          price: DEFAULT_MATRIX.document[ct][tier][size],
          minimum_quantity: null,
        });
      }
    }
  }

  for (const tier of tiers) {
    for (const size of sizes) {
      cells.push({
        service_type: 'vellum',
        content_type: null,
        color_tier: tier,
        paper_size: size,
        photo_size: null,
        price: DEFAULT_MATRIX.vellum[tier][size],
        minimum_quantity: null,
      });
    }
  }

  for (const tier of tiers) {
    cells.push({
      service_type: 'sticker',
      content_type: null,
      color_tier: tier,
      paper_size: null,
      photo_size: null,
      price: DEFAULT_MATRIX.sticker[tier],
      minimum_quantity: null,
    });
  }

  for (const [photoSize, cfg] of Object.entries(DEFAULT_MATRIX.photo)) {
    cells.push({
      service_type: 'photo',
      content_type: null,
      color_tier: null,
      paper_size: null,
      photo_size: photoSize,
      price: cfg.price,
      minimum_quantity: cfg.minQty,
    });
  }

  return cells;
}

async function ensureMatrixCells(): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('pricing_matrix_cells')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    if (count && count > 0) return;
    const cells = defaultMatrixCells();
    // Insert in chunks to stay well under request body limits.
    for (let i = 0; i < cells.length; i += 50) {
      const { error: insertError } = await supabase
        .from('pricing_matrix_cells')
        .insert(cells.slice(i, i + 50));
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.warn('[bootstrap] pricing matrix cells seed skipped (RLS or offline):', err);
  }
}

// Seed the single-row `shop_status` (Open) so the shop-status banner and the
// checkout locks have a server snapshot to hydrate from. Best-effort: reads
// are open to everyone but the INSERT needs staff/admin RLS, so customers skip.
async function ensureShopStatus(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('shop_status')
      .select('id')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return; // already seeded
    const { error: insertError } = await supabase
      .from('shop_status')
      .insert({ id: true, status: 'open', reason: null, eta: null });
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] shop_status seed skipped (RLS or offline):', err);
  }
}

// Seed the single-row `landing_content` (the canonical defaults) so the public
// landing page has a server snapshot to hydrate from. The `content` jsonb blob
// mirrors the store's default content model; the seed always uses the DEFAULTS
// (never the current browser mirror) so a fresh install gets the published copy.
async function ensureLandingContent(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('landing_content')
      .select('id')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return; // already seeded
    const { error: insertError } = await supabase
      .from('landing_content')
      .insert({ id: true, content: landingContentStore.getDefaults() as unknown as Json });
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] landing_content seed skipped (RLS or offline):', err);
  }
}

// Seed the Terms + Privacy policy rows so the landing footer, sign-up and
// checkout "Terms & Privacy" readers have a server snapshot to hydrate from.
// The `content` column holds the JSON string of `{ sections, lastUpdated }`.
async function ensureLegalPolicies(): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('legal_policies')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    if (count && count > 0) return;
    const defaults = legalContentStore.getDefaults();
    const encode = (sections: { title: string; body: string }[], lastUpdated: string) =>
      JSON.stringify({ sections, lastUpdated });
    const { error: insertError } = await supabase.from('legal_policies').insert([
      {
        policy_type: 'terms',
        title: defaults.termsTitle,
        content: encode(defaults.termsSections, defaults.termsLastUpdated),
        version: 'v1',
        published: true,
      },
      {
        policy_type: 'privacy',
        title: defaults.privacyTitle,
        content: encode(defaults.privacySections, defaults.privacyLastUpdated),
        version: 'v1',
        published: true,
      },
    ]);
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] legal_policies seed skipped (RLS or offline):', err);
  }
}

// Seed the single-row `brand_settings` (no custom logo → bundled default in
// use) so the logo store has a server snapshot to hydrate from.
async function ensureBrandSettings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('brand_settings')
      .select('id')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return; // already seeded
    const { error: insertError } = await supabase
      .from('brand_settings')
      .insert({ id: true, logo_storage_path: null });
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] brand_settings seed skipped (RLS or offline):', err);
  }
}

// Seed the single-row `salary_settings` (default hourly rate ₱50) so the
// salary store has a server snapshot to hydrate from.
async function ensureSalarySettings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('salary_settings')
      .select('id')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return; // already seeded
    const { error: insertError } = await supabase
      .from('salary_settings')
      .insert({ id: true, hourly_rate: 50 });
    if (insertError) throw insertError;
  } catch (err) {
    console.warn('[bootstrap] salary_settings seed skipped (RLS or offline):', err);
  }
}

// The nested demo data shown on the Staff page (performance notes, allowances,
// tasks) is hydrate-only — the app never edits it, so these seed it once so the
// roster displays the same populated profile the localStorage mock showed.
// Matched to the roster rows by email; each table is seeded only when empty.
const NESTED_DEMO_SEEDS: Array<{
  email: string;
  notes: { date: string; note: string; rating: number }[];
  allowances: { type: string; amount: number }[];
  tasks: { title: string; status: string; priority: string; dueDate: string }[];
}> = [
  {
    email: 'staff@test.com',
    notes: [
      { date: '2026-04-01', note: 'Excellent performance, handled rush orders efficiently', rating: 5 },
      { date: '2026-03-01', note: 'Successfully trained 2 new staffs', rating: 5 },
      { date: '2026-02-01', note: 'Improved print quality standards', rating: 4 },
    ],
    allowances: [
      { type: 'Transportation', amount: 2000 },
      { type: 'Meal', amount: 1500 },
    ],
    tasks: [
      { title: 'Quality check for color prints', status: 'Completed', priority: 'High', dueDate: '2026-04-20' },
      { title: 'Train new staff on binding', status: 'In Progress', priority: 'Medium', dueDate: '2026-04-25' },
      { title: 'Printer toner check', status: 'Pending', priority: 'Low', dueDate: '2026-04-30' },
    ],
  },
  {
    email: 'robert.chen@docufy.com',
    notes: [
      { date: '2026-04-01', note: 'Good attendance and punctuality', rating: 4 },
      { date: '2026-03-01', note: 'Needs improvement in color matching', rating: 3 },
    ],
    allowances: [{ type: 'Transportation', amount: 1500 }],
    tasks: [
      { title: 'Process customer orders', status: 'Completed', priority: 'High', dueDate: '2026-04-21' },
      { title: 'Clean and maintain printers', status: 'Completed', priority: 'Medium', dueDate: '2026-04-22' },
    ],
  },
  {
    email: 'katie.perry@docufy.com',
    notes: [
      { date: '2026-04-01', note: 'Excellent customer service skills', rating: 5 },
      { date: '2026-03-01', note: 'Quick learner, adapting well to role', rating: 4 },
    ],
    allowances: [{ type: 'Meal', amount: 1000 }],
    tasks: [
      { title: 'Verify payment receipts', status: 'In Progress', priority: 'High', dueDate: '2026-04-22' },
      { title: 'Update customer database', status: 'Pending', priority: 'Low', dueDate: '2026-04-28' },
    ],
  },
];

async function ensureStaffNested(): Promise<void> {
  try {
    const rows = await Promise.all([
      supabase.from('staff_performance_notes').select('*', { count: 'exact', head: true }),
      supabase.from('staff_allowances').select('*', { count: 'exact', head: true }),
      supabase.from('staff_tasks').select('*', { count: 'exact', head: true }),
    ]);
    const counts = rows.map((r) => r.count ?? 0);
    if (counts.some((c) => c > 0)) return; // already seeded somewhere — skip all

    const { data: roster } = await supabase
      .from('staff_records')
      .select('id, email');
    if (!roster) return;
    const idByEmail = new Map((roster as { id: string; email: string | null }[])
      .filter((r) => r.email)
      .map((r) => [r.email!.toLowerCase(), r.id]));
    if (idByEmail.size === 0) return;

    const noteInserts: any[] = [];
    const allowanceInserts: any[] = [];
    const taskInserts: any[] = [];
    for (const seed of NESTED_DEMO_SEEDS) {
      const staffId = idByEmail.get(seed.email.toLowerCase());
      if (!staffId) continue;
      for (const n of seed.notes) noteInserts.push({ staff_id: staffId, note_date: n.date, note: n.note, rating: n.rating });
      for (const a of seed.allowances) allowanceInserts.push({ staff_id: staffId, allowance_type: a.type, amount: a.amount });
      for (const t of seed.tasks) taskInserts.push({ staff_id: staffId, title: t.title, status: t.status, priority: t.priority, due_date: t.dueDate });
    }

    if (noteInserts.length) {
      const { error: e } = await supabase.from('staff_performance_notes').insert(noteInserts);
      if (e) throw e;
    }
    if (allowanceInserts.length) {
      const { error: e } = await supabase.from('staff_allowances').insert(allowanceInserts);
      if (e) throw e;
    }
    if (taskInserts.length) {
      const { error: e } = await supabase.from('staff_tasks').insert(taskInserts);
      if (e) throw e;
    }
  } catch (err) {
    console.warn('[bootstrap] staff nested demo seed skipped (RLS or offline):', err);
  }
}

startBootstrap();
