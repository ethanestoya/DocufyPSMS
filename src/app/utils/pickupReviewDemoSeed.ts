// PREVIEW ONLY — dedicated demo customers for the Unpaid & Unclaimed Order
// penalty workflow.
//
// Keeps ONE fixed, clearly-named demo customer per review stage so the Pickup
// Monitoring and Unclaimed Orders pages can be tested end-to-end:
//
//   ORD-DEMO-0001  Maria Santos    — Pending Review (staff flagged)
//   ORD-DEMO-0002  Juan Dela Cruz  — Excuse Requested (customer replied)
//   ORD-DEMO-0003  Ana Reyes       — Confirmed Unclaimed
//   ORD-DEMO-0004  Pedro Lim       — Excused
//   ORD-DEMO-0005  Carlo Mendoza   — Confirmed (1st)  ┐ Restricted
//   ORD-DEMO-0006  Carlo Mendoza   — Confirmed (2nd)  ┘ (2nd offence, 50% deposit)
//   ORD-DEMO-0007  Liza Torres     — Good Standing (no incident)
//
// Each scenario has BOTH:
//   1. a real login-able account + order created by
//      `supabase/seed_demo_customers.sql` (same emails) so staff/admin can log in
//      and the customers see their own order history, AND
//   2. an in-memory synthetic order used as a FALLBACK when the real seeded
//      orders are not present (e.g. the SQL has not been run) so the two pickup
//      pages still demonstrate every stage with zero setup.
//
// The preview incidents (the staff/admin decisions) always live in the in-memory
// `pickupReview` store — nothing is written to Supabase and everything resets on
// reload. Incidents are attached to whatever ORDER ID resolves for each scenario:
// the customer's real order (matched by email) when it exists, otherwise the
// synthetic id. This lets the preview state follow the real seeded orders.

import type { OrderType } from "./ordersStore";
import { pickupReview, type PickupIncident } from "./pickupReview";

/** Flip to false to hide the demo customers entirely. */
export const DEMO_SEED_ENABLED = true;

const DAY = 86_400_000;

const MARIA = "maria.santos@docufy.demo";
const JUAN = "juan.delacruz@docufy.demo";
const ANA = "ana.reyes@docufy.demo";
const PEDRO = "pedro.lim@docufy.demo";
const CARLO = "carlo.mendoza@docufy.demo";
const LIZA = "liza.torres@docufy.demo";

interface DemoScenario {
  /** Stable id for wiring the incident definition to the scenario. */
  key: string;
  /** Synthetic fallback id (used only when no real order resolves). */
  orderId: string;
  displayId: string;
  customer: string;
  email: string;
  status: OrderType["status"];
  daysAgo: number;
  hour: number;
  total: number;
  /** Which of the customer's real orders (oldest first) this scenario maps to. */
  matchIndex: number;
}

const SCENARIOS: DemoScenario[] = [
  { key: "underReview", orderId: "demo-under-review", displayId: "ORD-DEMO-0001", customer: "Maria Santos", email: MARIA, status: "released", daysAgo: 2, hour: 9, total: 180, matchIndex: 0 },
  { key: "excuse", orderId: "demo-excuse", displayId: "ORD-DEMO-0002", customer: "Juan Dela Cruz", email: JUAN, status: "completed", daysAgo: 3, hour: 11, total: 240, matchIndex: 0 },
  { key: "confirmed", orderId: "demo-confirmed", displayId: "ORD-DEMO-0003", customer: "Ana Reyes", email: ANA, status: "released", daysAgo: 5, hour: 14, total: 150, matchIndex: 0 },
  { key: "excused", orderId: "demo-excused", displayId: "ORD-DEMO-0004", customer: "Pedro Lim", email: PEDRO, status: "released", daysAgo: 6, hour: 16, total: 320, matchIndex: 0 },
  { key: "restricted1", orderId: "demo-restricted-1", displayId: "ORD-DEMO-0005", customer: "Carlo Mendoza", email: CARLO, status: "released", daysAgo: 20, hour: 10, total: 200, matchIndex: 0 },
  { key: "restricted2", orderId: "demo-restricted-2", displayId: "ORD-DEMO-0006", customer: "Carlo Mendoza", email: CARLO, status: "completed", daysAgo: 12, hour: 15, total: 260, matchIndex: 1 },
  { key: "goodStanding", orderId: "demo-good-standing", displayId: "ORD-DEMO-0007", customer: "Liza Torres", email: LIZA, status: "released", daysAgo: 1, hour: 13, total: 120, matchIndex: 0 },
];

const SCENARIO_BY_KEY = new Map(SCENARIOS.map((s) => [s.key, s]));

/** Lower-cased emails of the seeded demo customers. */
export const DEMO_CUSTOMER_EMAILS: readonly string[] = SCENARIOS.map((s) =>
  s.email.toLowerCase(),
);

/** True when the signed-in email belongs to a seeded demo customer. */
export function isDemoCustomerEmail(email?: string | null): boolean {
  return !!email && DEMO_CUSTOMER_EMAILS.includes(email.toLowerCase());
}

function submitted(daysAgo: number, hour: number): Date {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function syntheticOrder(s: DemoScenario): OrderType {
  const when = submitted(s.daysAgo, s.hour);
  return {
    id: s.orderId,
    displayId: s.displayId,
    customer: s.customer,
    customerEmail: s.email,
    pages: 6,
    type: "B&W",
    notes: "Demo order — preview workflow data (not a real order).",
    status: s.status,
    time: when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    paperSize: "A4",
    copies: 1,
    submittedAt: when,
    orderSource: "online",
    paymentVerified: true,
    costBreakdown: { printingCost: s.total, addonsCost: 0, total: s.total },
    isDemo: true,
  };
}

/** Synthetic fallback orders (one per scenario), exported for reference. */
export const DEMO_ORDERS: OrderType[] = SCENARIOS.map(syntheticOrder);

const SYNTHETIC_BY_KEY = new Map(SCENARIOS.map((s) => [s.key, syntheticOrder(s)]));

/** The customer's real orders, oldest first (matched by email). */
function realOrdersFor(orders: OrderType[], email: string): OrderType[] {
  const target = email.toLowerCase();
  return orders
    .filter((o) => (o.customerEmail ?? "").toLowerCase() === target)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}

/** The order id a scenario should attach to: real order if resolved, else synthetic. */
function targetOrderId(s: DemoScenario, orders: OrderType[]): string {
  return realOrdersFor(orders, s.email)[s.matchIndex]?.id ?? s.orderId;
}

/**
 * Prepend the synthetic demo orders to a live order list (pickup pages only).
 * A synthetic order is injected ONLY when the customer has no real order for
 * that scenario, so the seeded DB orders never appear twice.
 */
export function withDemoOrders(orders: OrderType[]): OrderType[] {
  if (!DEMO_SEED_ENABLED) return orders;
  const missing = SCENARIOS.filter(
    (s) => realOrdersFor(orders, s.email).length <= s.matchIndex,
  )
    .map((s) => SYNTHETIC_BY_KEY.get(s.key))
    .filter((o): o is OrderType => !!o);
  return [...missing, ...orders];
}

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString();
}

const INCIDENT_DEFS: { key: string; incident: Partial<Omit<PickupIncident, "orderId">> }[] = [
  {
    key: "underReview",
    incident: {
      customerKey: MARIA,
      status: "pending_review",
      flaggedForReview: true,
      flaggedBy: "Staff — Heaven Rica",
      staffNote: "Looks unclaimed — please confirm before releasing.",
    },
  },
  {
    key: "excuse",
    incident: {
      customerKey: JUAN,
      status: "pending_review",
      customerExplanation:
        "I was out of town on a family emergency and could not collect the order on time.",
      staffNote: "Customer submitted a reason — routed to Admin.",
    },
  },
  {
    key: "confirmed",
    incident: {
      customerKey: ANA,
      status: "confirmed_unclaimed",
      reviewedBy: "Admin — Docufy",
      reviewedAt: daysAgoIso(4),
      reason: "Order not collected within the pickup window.",
    },
  },
  {
    key: "excused",
    incident: {
      customerKey: PEDRO,
      status: "excused",
      reviewedBy: "Admin — Docufy",
      reviewedAt: daysAgoIso(2),
      reason: "Customer provided a valid reason; incident excused.",
    },
  },
  {
    key: "restricted1",
    incident: {
      customerKey: CARLO,
      status: "confirmed_unclaimed",
      reviewedBy: "Admin — Docufy",
      reviewedAt: daysAgoIso(18),
      reason: "Order not collected within the pickup window — first confirmed incident.",
      staffNote: "Customer did not respond to the pickup reminder.",
    },
  },
  {
    key: "restricted2",
    incident: {
      customerKey: CARLO,
      status: "confirmed_unclaimed",
      reviewedBy: "Admin — Docufy",
      reviewedAt: daysAgoIso(9),
      reason: "Second confirmed unclaimed order for this customer.",
    },
  },
  // ORD-DEMO-0007 (Liza Torres) has no incident — Good Standing.
];

/**
 * Attach the preview incidents to each scenario's resolved order id. Idempotent
 * and non-destructive: an incident is only written when the resolved order does
 * not already carry one, so it never clobbers a decision a tester made in the
 * current session — and it re-resolves as the real seeded orders load, so the
 * preview state follows the DB orders once they appear.
 */
export function seedDemoIncidentsOnce(orders: OrderType[] = []): void {
  if (!DEMO_SEED_ENABLED) return;

  for (const def of INCIDENT_DEFS) {
    const scenario = SCENARIO_BY_KEY.get(def.key);
    if (!scenario) continue;
    const orderId = targetOrderId(scenario, orders);
    if (!pickupReview.getIncident(orderId)) {
      pickupReview.setIncident(orderId, def.incident);
    }
  }

  // Restricted (2nd offence) — one active 50% deposit arrangement for Carlo.
  if (!pickupReview.getRestriction(CARLO).active) {
    pickupReview.setRestriction(CARLO, {
      arrangement: "deposit_50",
      active: true,
      reason: "Second confirmed unclaimed order — 50% deposit required on future orders.",
      updatedBy: "Admin — Docufy",
    });
  }
}
