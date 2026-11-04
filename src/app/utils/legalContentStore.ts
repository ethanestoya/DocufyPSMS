// Centralized Terms & Conditions / Privacy Policy content store.
// The admin edits these from Management -> Terms & Privacy, and every place
// that shows the policies (landing footer, sign up, checkout) reads from here.
//
// Supabase-backed facade: the localStorage mirror stays as the offline /
// anonymous fallback, but the DB `legal_policies` rows (one per policy type)
// now drive real cross-device edits — an admin saving on any device updates
// every page that renders the policies via realtime. Reads are open to
// everyone (the public landing + auth screens render these anonymously);
// writes are staff/admin only.

import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady, supabase } from '../../lib/supabaseClient';
import { fetchLegalPolicies, saveLegalPolicy } from '../../lib/db/siteContentRepo';
import type { LegalPolicyInsert, LegalPolicyRow } from '../../lib/db/types';
import { auditLogStore } from './auditLogStore';
import { cloneJson } from './cloneJson';

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalContent {
  termsTitle: string;
  termsLastUpdated: string;
  termsSections: LegalSection[];
  privacyTitle: string;
  privacyLastUpdated: string;
  privacySections: LegalSection[];
}

const STORAGE_KEY = "docufy_legal_content_v1";

type PolicyType = 'terms' | 'privacy';

// Sections are numbered automatically by their position (1, 2, 3…), so the
// stored title never needs a "N. " prefix typed into it. If a value sneaks a
// leading number in (legacy data, manual edit), strip it so it does not
// double up with the auto number when rendered.
export function stripSectionNumber(title: string): string {
  return title.replace(/^\s*\d+\s*[.)-]?\s+/, "").trim();
}

function sanitizeSections(
  sections: { title: string; body: string }[],
): LegalSection[] {
  return sections.map((s) => ({ ...s, title: stripSectionNumber(s.title) }));
}

// Body text uses a small plain-text format:
//   * paragraphs separated by a blank line
//   * a line starting with "- " becomes a bullet list item
// This is what the admin editor presents and what the readers render.
const defaults: LegalContent = {
  termsTitle: "Terms and Conditions",
  termsLastUpdated: "April 27, 2026",
  termsSections: [
    {
      title: "DOCUFY ONLINE PRINTING",
      body: "Terms & Conditions",
    },
    {
      title: "1. ORDER SUBMISSION & CONFIRMATION",
      body: "Once an order is submitted through the Docufy Online Ordering System, the customer is responsible for ensuring that all uploaded files, printing specifications, quantities, paper types, sizes, and other order details are correct.\nAn order may be reviewed by Docufy before production. Order status may change to Awaiting Payment, In Queue, Printing, Completed, Released, or Canceled depending on the current processing stage.",
    },
    {
      title: "2. ORDER CANCELLATION",
      body: "Orders may only be cancelled before Docufy has started processing the order.\nOnce an order has been marked as In Queue or Printing, cancellation is no longer allowed because materials, printing time, and resources may have already been allocated to the order.\nOrders that are already printed cannot be cancelled, refunded, or returned due to a change of mind or failure to review the submitted details before ordering.",
    },
    {
      title: "3. CUSTOMER RESPONSIBILITY FOR FILES",
      body: "Customers are responsible for reviewing their files and order details before submitting an order.\nDocufy is not responsible for errors contained in customer-submitted files, including but not limited to:\n- Incorrect content or spelling\n- Wrong file or page\n- Incorrect page size or orientation\n- Missing pages\n- Incorrect quantity\n- Low-resolution or poor-quality files\n- Formatting or layout issues contained in the submitted file\nIf the customer submits an incorrect file and printing has already started, the order may still be charged accordingly.",
    },
    {
      title: "4. PAYMENT TERMS",
      body: "For orders P50.00 and below, Cash on Pickup may be available and the order is queued automatically.\nFor orders from P50.00 to P99.00, a down payment (50% of the total) or full payment may be required before the order is processed.\nFor orders P100.00 and above, full payment is required before the order is processed.\nOrders requiring a down payment or full payment will not be processed until the required payment has been confirmed by Docufy.\nThe remaining balance (if any) must be settled upon pickup unless otherwise agreed with Docufy.",
    },
    {
      title: "5. UNPAID OR UNCLAIMED ORDERS",
      body: "Once an order has been printed, the customer is responsible for claiming and paying for the order within the applicable pickup period communicated by Docufy.\nIf a customer fails to claim an order without a valid reason, the order will be considered an Unclaimed Order.\nBecause printed materials are prepared specifically for the customer and may not be resold, Docufy reserves the right to impose the following consequences:\n- First unclaimed order: A warning may be recorded on the customer's account.\n- Second unclaimed order: Cash on Pickup may be temporarily disabled, and the customer may be required to pay a 50% deposit or full payment in advance for future orders.\n- Repeated or intentional unclaimed orders: Docufy may require full payment before processing future orders and may temporarily suspend the customer's online ordering privileges.\nAny outstanding balance from an unclaimed printed order remains payable by the customer.",
    },
    {
      title: "6. DOWN PAYMENTS",
      body: "Down payments are considered a commitment to the order.\nIf a customer cancels an order after production has started, or fails to claim an order after it has been printed, the down payment may be applied toward the costs already incurred for the order and may not be refundable.\nIf the amount of the down payment does not cover the applicable costs of an abandoned order, the customer may still be required to settle the remaining balance.",
    },
    {
      title: "7. PICKUP",
      body: "Customers are responsible for claiming their completed orders within the pickup period communicated by Docufy.\nCustomers may be asked to provide their order number, name, or other account information when claiming an order.",
    },
    {
      title: "8. REPRINTS & PRINTING ISSUES",
      body: "If an error is caused by Docufy's printing process, the customer may report the issue to Docufy for assessment and possible reprinting.\nHowever, reprinting is not automatically provided for errors originating from the customer's submitted file or incorrect order specifications.\nAny concerns regarding an order should be reported as soon as possible after pickup.",
    },
    {
      title: "9. ORDER STATUS & PROCESSING TIME",
      body: "Order processing times may vary depending on order volume, file complexity, materials, equipment availability, and other operational circumstances.\nAn order being marked as Awaiting Payment does not necessarily mean that printing has already started.\nCustomers should wait for the order to be marked Ready for Pickup (Completed/Released) before proceeding to claim their order.",
    },
    {
      title: "10. RIGHT TO REFUSE OR HOLD AN ORDER",
      body: "Docufy reserves the right to hold, reject, or request clarification for orders that contain incomplete information, corrupted files, unclear instructions, inappropriate content, or other issues that may prevent proper processing.\nDocufy may also require additional verification for orders that appear suspicious, duplicated, fraudulent, or abusive.",
    },
    {
      title: "11. CUSTOMER ACCOUNT & MISUSE",
      body: "Customers are expected to provide accurate information when creating and using a Docufy account.\nCreating multiple accounts, placing fake orders, repeatedly submitting orders with no intention of claiming them, or otherwise abusing the online ordering system may result in the restriction or suspension of the customer's account and/or Cash on Pickup privileges.",
    },
    {
      title: "12. AGREEMENT",
      body: "By checking the box below and placing an order, you acknowledge that:\n- You have reviewed your files and order details before submission.\n- You understand that orders cannot be cancelled once processing or printing has started.\n- You agree to claim and pay for your order.\n- You understand the consequences of unclaimed or unpaid orders.\n- You agree to the payment and account policies stated above.\n\nI have read, understood, and agreed to Docufy's Terms & Conditions.\n\nCash on Pickup orders are considered confirmed orders. Please only select this option if you are sure you can claim your order. Unclaimed or unpaid orders may result in restrictions on your Cash on Pickup privileges and may require advance payment for future orders.",
    },
  ],
  privacyTitle: "Privacy Policy",
  privacyLastUpdated: "November 5, 2026",
  privacySections: [
    {
      title: "About This Policy",
      body: "Docufy Printing Shop (“Docufy”, “we”, “us”, or “our”) operates at Room 4, Technology Business Incubator (TBI) Building, Palawan State University (Palawan SU) – Main Campus, San Miguel, Puerto Princesa City, Palawan 5300.\n\nThis Privacy Policy explains how we collect, use, store, share, and protect your personal information when you access or use the Docufy Printing Shop Management System (Docufy PSMS) web application. By creating an account, uploading files, or placing an order through Docufy PSMS, you agree to the collection and use of information in accordance with this Privacy Policy and Republic Act No. 10173, otherwise known as the Philippine Data Privacy Act of 2012 (DPA).\n\nEffective date: November 5, 2026.",
    },
    {
      title: "Information We Collect",
      body: "We collect only the information necessary to process printing requests, verify financial transactions, monitor queue operations, manage student job applications, and improve our services.\n\nAccount and identity data:\n\n- Full name\n- Institutional email address (e.g. name@psu.palawan.edu.ph)\n- Contact number\n- Account password, stored only as a secure cryptographic hash — never in plain text\n- Optional profile photo\n- Account type or role (Customer/Student/Faculty, Staff, or Administrator)\n\nOrder and document data:\n\n- Files submitted for processing (PDF, Word, Excel, and image formats)\n- File metadata such as page counts, color breakdown, and document dimensions\n- Print specifications such as paper size, orientation, print mode, copies, and add-ons\n\nPayment verification data:\n\n- E-wallet payment proof screenshots for the payment channels enabled by the shop (for example GCash or Maya)\n- Payment reference numbers, the payment channel used, and down payment or balance records\n\nRecruitment and job board data (student applicants):\n\n- Application details such as name, contact information, skills, and resume or portfolio (provided as a link or an uploaded file)\n- Interview schedule and application status\n\nSystem and technical data:\n\n- Order status changes and their timestamps\n- Staff activity records such as time-in/time-out and payment verification actions\n- Audit logs of administrative actions, kept for operational accountability\n- Authentication session data and local preferences stored in your browser",
    },
    {
      title: "How We Use Your Information",
      body: "We use the collected personal data strictly for operational, administrative, and academic-service purposes:\n\n- Order processing and fulfillment: analyze uploaded files, compute automated price estimates, place orders in the digital queue, and produce physical copies\n- Payment validation and accounting: verify payment receipts, manage down payments, track daily shop sales, and prevent financial fraud\n- Queue notification and pickup: update order statuses in real time (Awaiting Payment, In Queue, Printing, Completed, Released, Canceled) and notify you when an order is ready for pickup\n- Account and policy enforcement: monitor pickup compliance, enforce the rules on unclaimed orders, and record account warnings or restrictions\n- Student labor management: process job applications submitted by Palawan SU students for part-time positions within Docufy\n- Analytics and shop auditing: aggregate de-identified sales performance, paper usage, and service trends for internal management reporting",
    },
    {
      title: "Legal Basis for Processing",
      body: "Under Sections 12 and 13 of the Philippine Data Privacy Act of 2012, we process your personal information based on:\n\n- Contractual necessity: processing is required to fulfill the printing services or job application requests you initiate\n- Consent: you give explicit consent when you register an account and check the agreement prompt before checkout\n- Legitimate business interest: maintaining financial integrity, shop security, inventory tracking, and preventing uncollected order losses",
    },
    {
      title: "Document Handling and Retention",
      body: "Uploaded files and payment receipt images are stored in restricted cloud storage buckets protected by Row-Level Security (RLS) policies, and are accessed only by authorized staff and administrators.\n\nImmediate cleanup of finished orders: when an order is marked Released or Canceled, it is queued for retention cleanup. A background worker runs every minute and permanently deletes that order's uploaded documents, payment proof images, dependent records, and the order record itself from our servers. No fixed waiting period applies once an order reaches Released or Canceled.\n\nAudit and accounting retention: a de-identified transaction snapshot (amounts, payment channel, and dates — without the print file contents) is retained for administrative auditing and financial reporting.\n\nOrders that are still active keep their files until they reach Released or Canceled.",
    },
    {
      title: "Data Sharing and Third-Party Infrastructure",
      body: "Docufy does not sell, rent, trade, or lease your personal information or uploaded documents to any third-party commercial entities. Your data is accessed only by authorized Docufy staff and system administrators, or processed through the following infrastructure:\n\n- Supabase (backend infrastructure): database storage, authentication, and file storage buckets under strict access controls\n- Vercel (frontend hosting): hosts the web application over HTTPS connections\n- Legal obligations: we may disclose the minimum required information if mandated by Philippine law, lawful government orders, or university regulations, or to protect safety",
    },
    {
      title: "Data Security Measures",
      body: "We implement organizational, physical, and technical measures to protect your personal data against unauthorized access, theft, alteration, or disclosure:\n\n- Cryptographic hashing: passwords are never stored in plain text and are handled by our authentication provider as secure one-way hashes\n- Transport encryption: data transmitted between your device and Docufy PSMS is encrypted using HTTPS/TLS\n- Access control: Role-Based Access Control (RBAC) and database Row-Level Security (RLS) keep customer documents, financial records, and administrative analytics separate by role\n- Personnel confidentiality: printing shop personnel are bound to confidentiality and trained in the ethical handling of student documents and intellectual property",
    },
    {
      title: "Your Data Privacy Rights",
      body: "Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the following rights:\n\n- Right to be informed: know how your personal data is collected, processed, and stored\n- Right to access: request access to the personal data we hold about your account, and view your order history through your Customer Dashboard\n- Right to rectification: edit or update inaccurate personal details through your profile settings\n- Right to erasure or blocking: request deletion or suspension of your account and associated records, subject to settled financial balances and mandatory audit retention\n- Right to data portability: request copies of your transaction summary or order history logs\n- Right to file a complaint: lodge a complaint with the National Privacy Commission (NPC) of the Philippines if your data privacy rights have been violated",
    },
    {
      title: "Cookies and Local Storage",
      body: "Docufy PSMS does not use advertising cookies or third-party tracking cookies. It uses only essential browser storage: a preference cookie that remembers whether the sidebar is collapsed or expanded, and local storage for your authentication session, saved checkout drafts, and display preferences. Clearing your browser's site data signs you out and removes these local copies.",
    },
    {
      title: "Changes to This Privacy Policy",
      body: "We may update this Privacy Policy from time to time to reflect system updates, regulatory changes, or operational improvements. Any changes are posted within Docufy PSMS and the last-updated date at the top of this policy is revised accordingly.",
    },
    {
      title: "Contact Us",
      body: "If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your personal data, please contact us:\n\nDocufy Printing Shop\nRoom 4, Technology Business Incubator (TBI) Building\nPalawan State University – Main Campus\nSan Miguel, Puerto Princesa City, Palawan 5300\nEmail: printwithdocufy@gmail.com",
    },
  ],
};

function defaultClone(): LegalContent {
  return {
    ...cloneJson(defaults),
    termsSections: sanitizeSections(cloneJson(defaults.termsSections)),
    privacySections: sanitizeSections(cloneJson(defaults.privacySections)),
  } as LegalContent;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: LegalContent | null = null;
let hydrating = false;
// Row ids learned at hydrate so an admin edit targets the existing DB row.
const remotePolicyIds: Partial<Record<PolicyType, string>> = {};

function notify() {
  listeners.forEach((fn) => fn());
}

function read(): LegalContent {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LegalContent>;
      cached = mergeInto(defaultClone(), parsed);
      return cached;
    }
  } catch {
    // fall through
  }
  return defaultClone();
}

// Spread a partial onto the defaults, guarding the sections arrays so a
// missing/empty side falls back to the defaults.
function mergeInto(base: LegalContent, part: Partial<LegalContent>): LegalContent {
  return {
    ...base,
    ...part,
    termsSections:
      Array.isArray(part.termsSections) && part.termsSections.length > 0
        ? sanitizeSections(part.termsSections)
        : base.termsSections,
    privacySections:
      Array.isArray(part.privacySections) && part.privacySections.length > 0
        ? sanitizeSections(part.privacySections)
        : base.privacySections,
  } as LegalContent;
}

// ── legal_policies row ↔ store mapping ───────────────────────────────────────
// The `content` column holds a JSON string of `{ sections, lastUpdated }`
// (kept as a string per the schema). Legacy plain-text content (older seed,
// hand-edited) falls back to a single section with the policy title.

function encodePolicyContent(sections: LegalSection[], lastUpdated: string): string {
  return JSON.stringify({ sections, lastUpdated });
}

function decodePolicyContent(json: string | null, fallbackTitle: string): {
  sections: LegalSection[];
  lastUpdated: string;
} {
  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        sections?: { title: string; body: string }[];
        lastUpdated?: string;
      } | null;
      if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return {
          sections: sanitizeSections(parsed.sections),
          lastUpdated: typeof parsed.lastUpdated === 'string' ? parsed.lastUpdated : '',
        };
      }
    } catch {
      // not JSON — legacy plain text below
    }
  }
  return {
    sections: [{ title: fallbackTitle, body: json ?? '' }],
    lastUpdated: '',
  };
}

function applyPolicyRow(base: LegalContent, row: LegalPolicyRow): LegalContent {
  const type = row.policy_type as PolicyType;
  if (type !== 'terms' && type !== 'privacy') return base;
  const { sections, lastUpdated } = decodePolicyContent(row.content, row.title);
  const next: LegalContent = { ...base };
  if (type === 'terms') {
    next.termsTitle = row.title;
    next.termsLastUpdated = lastUpdated || row.updated_at;
    next.termsSections = sections;
  } else {
    next.privacyTitle = row.title;
    next.privacyLastUpdated = lastUpdated || row.updated_at;
    next.privacySections = sections;
  }
  return next;
}

// Best-effort mirror write that never throws (used by hydration); the public
// `save` below keeps its throw-on-failure contract for the editor.
function writeMirror(content: LegalContent): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  } catch {
    return false;
  }
  cached = content;
  return true;
}

function save(content: LegalContent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  } catch {
    throw new Error("Could not persist legal content to browser storage.");
  }
  cached = content;
  notify();
}

// Pull the latest snapshot from Supabase. Each policy type wins when its row
// exists (a partially-seeded table overlays only what exists); an
// empty/unreachable backend keeps the local mirror.
async function hydrate(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  await authReady;
  try {
    const rows = await fetchLegalPolicies();
    if (rows.length === 0) return; // not seeded yet — keep the local mirror
    let next = defaultClone();
    const ids: Partial<Record<PolicyType, string>> = {};
    let changed = false;
    for (const row of rows) {
      const type = row.policy_type as PolicyType;
      if (type !== 'terms' && type !== 'privacy') continue;
      ids[type] = row.id;
      next = applyPolicyRow(next, row);
      changed = true;
    }
    if (!changed) return;
    Object.assign(remotePolicyIds, ids);
    writeMirror(next);
    notify();
  } catch (err) {
    console.warn('[legal-content] hydration kept local data:', err);
  } finally {
    hydrating = false;
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Best-effort push of both policy rows. RLS-denied writes degrade quietly;
// every other failure is surfaced. Row ids learned at hydrate (or adopted from
// a fresh insert) let each subsequent save update in place.
async function syncRemote(content: LegalContent): Promise<void> {
  const userId = await currentUserId();
  const pushes: Array<{ type: PolicyType; id?: string; row: LegalPolicyInsert }> = [
    {
      type: 'terms',
      id: remotePolicyIds.terms,
      row: {
        policy_type: 'terms',
        title: content.termsTitle,
        content: encodePolicyContent(content.termsSections, content.termsLastUpdated),
        version: 'v1',
        published: true,
        updated_by: userId,
      },
    },
    {
      type: 'privacy',
      id: remotePolicyIds.privacy,
      row: {
        policy_type: 'privacy',
        title: content.privacyTitle,
        content: encodePolicyContent(content.privacySections, content.privacyLastUpdated),
        version: 'v1',
        published: true,
        updated_by: userId,
      },
    },
  ];
  for (const push of pushes) {
    try {
      if (!push.id) {
        const newId = await saveLegalPolicy({ row: push.row });
        if (newId) remotePolicyIds[push.type] = newId;
      } else {
        await saveLegalPolicy({ id: push.id, row: push.row });
      }
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('legal-content.update', err);
      else console.warn('[legal-content] not synced (RLS):', err);
    }
  }
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = null;
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

// Backend realtime: an admin editing the policies from any device refreshes
// every page that renders them.
subscribeTableChanges('legal_policies', () => {
  void hydrate();
});

void hydrate();

export const legalContentStore = {
  getDefaults: defaultClone,
  getContent: read,
  saveContent: (content: LegalContent) => {
    save(content);
    auditLogStore.record({
      module: "Shop Content",
      action: "Updated",
      reference: "Terms & Privacy",
      entityType: "Legal Policies",
      title: "Terms & Privacy Updated",
      description: "Edited the Terms & Conditions and Privacy Policy content.",
    });
    void syncRemote(content);
  },
  resetContent: () => {
    const reset = defaultClone();
    save(reset);
    auditLogStore.record({
      module: "Shop Content",
      action: "Updated",
      reference: "Terms & Privacy",
      entityType: "Legal Policies",
      title: "Terms & Privacy Reset",
      description: "Reset the Terms & Conditions and Privacy Policy to the defaults.",
    });
    void syncRemote(reset);
  },
  refreshFromBackend: () => hydrate(),
  subscribe,
};
