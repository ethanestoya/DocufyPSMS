import type { Database } from '../database.types';

type Tables = Database['public']['Tables'];

export type AppRole = Database['public']['Enums']['app_role'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type OrderSource = Database['public']['Enums']['order_source'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

export type OrderRow = Tables['orders']['Row'];
export type OrderInsert = Tables['orders']['Insert'];
export type OrderUpdate = Tables['orders']['Update'];

export type OrderFileRow = Tables['order_files']['Row'];
export type OrderFileInsert = Tables['order_files']['Insert'];

export type OrderAddonRow = Tables['order_addons']['Row'];
export type OrderAddonInsert = Tables['order_addons']['Insert'];

export type CostBreakdownRow = Tables['order_cost_breakdowns']['Row'];
export type CostBreakdownInsert = Tables['order_cost_breakdowns']['Insert'];

export type StatusHistoryRow = Tables['order_status_history']['Row'];
export type StatusHistoryInsert = Tables['order_status_history']['Insert'];

export type PaymentRow = Tables['payments']['Row'];
export type PaymentInsert = Tables['payments']['Insert'];
export type PaymentUpdate = Tables['payments']['Update'];

export type PaymentMethodRow = Tables['payment_methods']['Row'];
export type PaymentMethodInsert = Tables['payment_methods']['Insert'];
export type PaymentMethodUpdate = Tables['payment_methods']['Update'];

export type WalkInTransactionRow = Tables['walk_in_transactions']['Row'];
export type WalkInTransactionInsert = Tables['walk_in_transactions']['Insert'];

// `order_locks` — the cross-machine "someone is reviewing this order" session
// lock. The table's real columns are `order_id → locked_by (profiles.id FK) →
// locked_at → expires_at` (already generated in `database.types.ts`); the
// `locked_by_name` DTO field is filled by the repo's `profiles` join so the
// "X is managing" banners render a name, not a uuid.
export type OrderLockRow = Tables['order_locks']['Row'] & {
  locked_by_name?: string | null;
};

// `audit_logs` — the immutable "who changed what, when" record behind Admin →
// Audit Trail. `actor_id` is a bare uuid with no DB FK (so no joined select);
// the actor's display name/role/email are snapshotted into the jsonb
// `metadata` by the repo so the page renders without a `profiles` join.
export type AuditLogRow = Tables['audit_logs']['Row'];
export type AuditLogInsert = Tables['audit_logs']['Insert'];

export type ShopStatusRow = Tables['shop_status']['Row'];
export type ShopStatusInsert = Tables['shop_status']['Insert'];

export type LandingContentRow = Tables['landing_content']['Row'];
export type LandingContentInsert = Tables['landing_content']['Insert'];

export type BrandSettingsRow = Tables['brand_settings']['Row'];
export type BrandSettingsInsert = Tables['brand_settings']['Insert'];

export type LegalPolicyRow = Tables['legal_policies']['Row'];
export type LegalPolicyInsert = Tables['legal_policies']['Insert'];

export type ShopPhotoRow = Tables['shop_photos']['Row'];
export type ShopPhotoInsert = Tables['shop_photos']['Insert'];

export type PricingSettingsRow = Tables['pricing_settings']['Row'];
export type MatrixCellRow = Tables['pricing_matrix_cells']['Row'];
export type MatrixCellInsert = Tables['pricing_matrix_cells']['Insert'];

export type AttendanceRecordRow = Tables['attendance_records']['Row'];
export type AttendanceRecordInsert = Tables['attendance_records']['Insert'];
export type AttendanceRecordUpdate = Tables['attendance_records']['Update'];

export type AttendanceAdjustmentRow = Tables['attendance_adjustments']['Row'];
export type AttendanceAdjustmentInsert = Tables['attendance_adjustments']['Insert'];

export type StaffRecordRow = Tables['staff_records']['Row'];
export type StaffRecordInsert = Tables['staff_records']['Insert'];

export type JobStatus = Database['public']['Enums']['job_status'];
export type ApplicationStatus = Database['public']['Enums']['application_status'];

export type JobRow = Tables['jobs']['Row'];
export type JobInsert = Tables['jobs']['Insert'];
export type JobUpdate = Tables['jobs']['Update'];

export type JobApplicationRow = Tables['job_applications']['Row'];
export type JobApplicationInsert = Tables['job_applications']['Insert'];
export type JobApplicationUpdate = Tables['job_applications']['Update'];

// ── Inventory domain (supplies/consumables + stock movements) ─────────────────
// Alias the generated `database.types.ts` shapes so the repo matches the real
// columns: `inventory_items` uses `pieces_per_unit`, `inventory_movements`
// carries a `movement_type` text plus separate related-order/transaction FKs.

export type InventoryItemRow = Tables['inventory_items']['Row'];
export type InventoryItemInsert = Tables['inventory_items']['Insert'];
export type InventoryItemUpdate = Tables['inventory_items']['Update'];

export type InventoryMovementRow = Tables['inventory_movements']['Row'];
export type InventoryMovementInsert = Tables['inventory_movements']['Insert'];

export type NotificationRow = Tables['notifications']['Row'];
export type NotificationInsert = Tables['notifications']['Insert'];
export type NotificationUpdate = Tables['notifications']['Update'];

export type AnnouncementRow = Tables['announcements']['Row'];
export type AnnouncementInsert = Tables['announcements']['Insert'];

export type AnnouncementReadRow = Tables['announcement_reads']['Row'];
export type AnnouncementReadInsert = Tables['announcement_reads']['Insert'];

// ── Domain DTOs (decoupled from the row shapes so consumers never touch raw
// ── DB rows) ────────────────────────────────────────────────────────────────

export interface OrderFileDto {
  id: string;
  storagePath: string | null;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  pageCount: number | null;
  printType: string | null;
  contentType: string | null;
  paperSize: string | null;
  copies: number;
  colorMode: string | null;
  pageRange: string | null;
  specificPages: string | null;
  pagesPerSheet: string | null;
  orientation: string | null;
  twoSided: string | null;
  margins: string | null;
  scale: string | null;
  customScale: number | null;
  photoSize: string | null;
  photoQuantity: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface OrderAddonDto {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CostBreakdownDto {
  printingCost: number;
  addonsCost: number;
  total: number;
}

export interface PaymentDto {
  id: string;
  orderId: string;
  methodId: string | null;
  methodName: string;
  amount: number;
  referenceNumber: string | null;
  proofStoragePath: string | null;
  status: PaymentStatus;
  rejectionReason: string | null;
  submittedBy: string | null;
  verifiedBy: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
}

// One status transition from `order_status_history`, oldest-first. The unclaimed
// derivation reads the timeline (when an order reached `Completed` / `Released`)
// rather than the order's CURRENT status, so a later `Released` never erases the
// record that the order was once overdue.
export interface StatusHistoryDto {
  id: string;
  orderId: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus;
  reason: string | null;
  changedBy: string | null;
  createdAt: Date;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  orderSource: OrderSource;
  customerType: string | null;
  subtotal: number;
  addonsTotal: number;
  total: number;
  manualTotal: number | null;
  holdReason: string | null;
  cancellationReason: string | null;
  paymentDeadline: Date | null;
  downPaymentRequired: boolean;
  downPaymentAmount: number | null;
  downPaymentVerified: boolean;
  fullPaymentRequired: boolean;
  fullPaymentAmount: number | null;
  fullPaymentVerified: boolean;
  paymentAmountPaid: number;
  expectedPaperUsage: { size: string; sheets: number }[] | null;
  paperDeductedOnCreate: boolean;
  paperConfirmed: boolean;
  errorUsage: { noErrors: boolean; reason?: string; wastedSheets: number } | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  statusUpdatedAt: Date;
  files: OrderFileDto[];
  addons: OrderAddonDto[];
  costBreakdown: CostBreakdownDto | null;
  payments: PaymentDto[];
  // Status timeline, oldest-first. Empty when the order has no history rows OR
  // when the caller's permissions block the read (see statusHistoryUnavailable).
  statusHistory: StatusHistoryDto[];
  // True when the `order_status_history` read itself failed for this fetch — the
  // UI shows an "unclaimed-order information unavailable" notice instead of
  // silently treating the empty timeline as "no offenses".
  statusHistoryUnavailable?: boolean;
}

// Display ID helper: the DB sequence lives in `order_number` (identity), and
// the human-facing ID is derived on read: ORD-0001 … ORD-9999…
export function formatOrderNumber(orderNumber: number): string {
  return `ORD-${String(orderNumber).padStart(4, '0')}`;
}

// ── Walk-in domain (companion transaction log linked to an orders row) ───────

// Human-facing walk-in transaction number: WK-0001 … (the DB serves the raw
// identity `transaction_number`; this derives the display form).
export function formatWalkInNumber(transactionNumber: number): string {
  return `WK-${String(transactionNumber).padStart(4, '0')}`;
}

// A walk-in transaction log entry. `transactionNumber` is the server-assigned
// identity; `orderId` links back to the placed `orders` row so the queue/print
// pipeline and the transaction log stay consistent.
export interface WalkInTransactionDto {
  id: string;
  transactionNumber: number;
  orderId: string | null;
  customerName: string | null;
  customerType: string;
  total: number;
  paymentMethod: string;
  createdBy: string | null;
  createdAt: Date;
}

// ── Attendance domain (staff clock-in / out, adjustments) ────────────────────

// Absence / leave status applied to a single attendance day.
export type AbsenceStatus = 'on-leave' | 'absent';

// A clock-in/out paired session (the day's primary, or one extra session).
export interface AttendanceSessionDto {
  timeIn?: Date;
  timeOut?: Date;
}

// Decoupled attendance record: dates are already parsed into Dates, identity is
// carried as profile_id (real Supabase staff account) and/or staff_id
// (a staff_records directory row — used for demo staff with no auth account).
export interface AttendanceRecordDto {
  id: string;
  profileId: string | null;
  staffId: string | null;
  date: string; // YYYY-MM-DD (PHT day)
  timeIn: Date | null;
  timeOut: Date | null;
  exceeded: boolean;
  extraSessions: AttendanceSessionDto[];
  absenceStatus: AbsenceStatus | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Resolved person info (joined from profiles / staff_records) so the app can
  // rebuild its email-keyed records. Null when the row references no known id.
  email: string | null;
  name: string | null;
  role: 'admin' | 'staff' | null;
}

// A logged admin/db-level adjustment to an attendance record (audit trail).
export interface AttendanceAdjustmentDto {
  id: string;
  attendanceId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  adjustedBy: string | null;
  createdAt: Date;
}

// ── Jobs domain (job board listings + applications) ──────────────────────────

export interface JobDto {
  id: string;
  title: string;
  description: string;
  type: string;
  duration: string | null;
  department: string | null;
  location: string | null;
  salary: string | null;
  schedule: string | null;
  requirements: string[];
  responsibilities: string[];
  status: JobStatus;
  postedDate: string;
  // Relative "posted X ago" label derived from postedDate at read time.
  posted: string;
  createdAt: Date;
  updatedAt: Date;
}

export type JobStatusDto = JobStatus;

export interface JobApplicationDto {
  id: string;
  jobId: string;
  jobTitle: string | null;
  applicantProfileId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  contact: string;
  address: string | null;
  position: string;
  skills: string | null;
  coverLetter: string | null;
  portfolioUrl: string | null;
  portfolioStoragePath: string | null;
  portfolioFileName: string | null;
  portfolioFileType: string | null;
  status: ApplicationStatus;
  interviewDate: string | null;
  interviewTime: string | null;
  interviewLocation: string | null;
  rejectionReason: string | null;
  appliedAt: string;
  updatedAt: string;
}

// ── Inventory DTOs (decoupled from row shapes) ────────────────────────────────

export interface InventoryItemDto {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  price: number | null;
  paperSize: string | null;
  piecesPerUnit: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryMovementDto {
  id: string;
  itemId: string;
  movementType: string;
  quantity: number;
  unit: string;
  reason: string | null;
  person: string | null;
  relatedOrderId: string | null;
  relatedTransactionId: string | null;
  createdAt: Date;
}

// ── Notifications domain (per-recipient notifications + announcements) ────────
// The generated schema has no person-aware concept of "unread": notifications
// use `read_at` (null = unread) and announcements use the `announcement_reads`
// join table. These DTOs mirror the localStorage store shapes plus the server
// `dbId` so the facade can reconcile realtime echoes.

export type NotificationKind = 'order' | 'payment' | 'status_update' | 'inventory';
export type NotificationPriority = 'important' | 'emergency';
export type NotificationRecipientRole = 'customer' | 'staff' | 'admin' | 'staff_admin' | 'all';

export interface NotificationDto {
  id: string;                       // server uuid = stable identity across devices
  dbId: string;                     // same uuid (kept explicit for reconciliation)
  type: NotificationKind;
  priority: NotificationPriority | null;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;                    // derived from read_at != null
  clickable: boolean;
  relatedOrderId: string | null;
  relatedRoute: string | null;
  recipientRole: NotificationRecipientRole;
  recipientEmail: string | null;    // only known for locally-created rows
}

export type AnnouncementType = 'announcement' | 'pricing' | 'maintenance' | 'reminder' | 'promo';
export type AnnouncementPriority = 'regular' | 'important' | 'emergency';
export type AnnouncementRecipientRole = 'customer' | 'all';

export interface AnnouncementDto {
  id: string;
  dbId: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  title: string;
  message: string;
  recipientRole: AnnouncementRecipientRole;
  sentBy: string;                   // sender email
  sentAt: string;                   // ISO timestamp
  readBy: string[];                 // reader emails resolvable from the read join
}

// ── Staff domain (roster + nested demo data + salary tracking) ───────────────
// `staff_records` is the source roster (shared with the attendance batch). The
// nested tables are hydrate-only demo data displayed on the Staff page/profile;
// `salary_settings` mirrors the store's hourly rate, and `salary_releases` is
// the real cross-device history behind the salary-store `releases` list.

export type StaffPerformanceNoteRow = Tables['staff_performance_notes']['Row'];
export type StaffPerformanceNoteInsert = Tables['staff_performance_notes']['Insert'];

export type StaffAllowanceRow = Tables['staff_allowances']['Row'];
export type StaffAllowanceInsert = Tables['staff_allowances']['Insert'];

export type StaffTaskRow = Tables['staff_tasks']['Row'];
export type StaffTaskInsert = Tables['staff_tasks']['Insert'];

export type SalarySettingsRow = Tables['salary_settings']['Row'];
export type SalarySettingsInsert = Tables['salary_settings']['Insert'];

export type SalaryReleaseRow = Tables['salary_releases']['Row'];
export type SalaryReleaseInsert = Tables['salary_releases']['Insert'];

// A rendered roster DTO: the store staff-facing fields PLUS the server identity
// (`recordId`) so nested demo rows (notes/allowances/tasks) re-attach to the
// right staff member after hydration.
export interface StaffRecordDto {
  recordId: string;                 // staff_records.id (server identity)
  id: string;                       // EMP-xxxx employee code (display key)
  name: string;
  email: string;
  phone: string;
  role: string;                     // 'Staff' | 'Admin' display role
  status: string;                   // 'Active' | 'Inactive'
  attendanceStatus: string;         // 'active' | 'on-leave'
  onLeaveReason: string;
  joinDate: string;
  skillsMessage: string;
  portfolioLink: string;
  performanceNotes: { date: string; note: string; rating: number }[];
  salary: number;
  allowances: { type: string; amount: number }[];
  paymentHistory: { date: string; amount: number; type: string }[];
  permissions: string[];
  tasks: { id: string; title: string; status: string; priority: string; dueDate: string }[];
}

// A rendered salary-release history row: the store record shape PLUS the
// resolved names/emails (the DB rows only carry ids, so the repo joins back
// `staff_records.email`/`full_name` and `profiles.full_name` for releasedBy).
export interface SalaryReleaseDto {
  id: string;
  staffEmail: string;
  staffName: string;
  periodStart: string;              // YYYY-MM-DD
  periodEnd: string;                // YYYY-MM-DD
  totalHours: number;
  hourlyRate: number;
  releasedAmount: number;
  releasedAt: string;               // ISO instant
  releasedByName: string;           // resolver name (falls back to id)
}