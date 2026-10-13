import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  History,
  Bell,
  CreditCard,
  Wallet,
  Eye,
  RotateCcw,
} from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import PaymentRestrictionNotice from "./PaymentRestrictionNotice";
import {
  pickupReview,
  PAYMENT_ARRANGEMENT_LABELS,
} from "../../utils/pickupReview";

// PREVIEW ONLY — "Order Violations & Restrictions".
//
// Shown on the customer account (profile) screen as a design preview. It has
// two clearly-separated modes:
//
//   1. LIVE PREVIEW — reflects the sample incident/restriction decisions made
//      on this order in THIS session (in-memory only, via utils/pickupReview).
//      It never reads or writes real penalty data.
//   2. SAMPLE PREVIEW — if there is no session preview state, the customer sees
//      the honest EMPTY state; an Admin can toggle sample data on for design
//      review. Sample records are never merged with real orders or persisted.
//
// Every policy value that depends on client approval is shown as
// "pending policy approval" rather than guessed.

interface SampleIncident {
  date: string;
  orderId: string;
  decision: "Confirmed Unclaimed" | "Excused";
  reason: string;
}

interface OrderViolationsSectionProps {
  /** Per-customer key (email preferred) used to read session preview state. */
  customerKey?: string;
  /** Viewing role — controls the sample/preview admin controls. */
  role?: "customer" | "staff" | "admin";
}

const SAMPLE_CONFIRMED_COUNT = 2;
const SAMPLE_OUTSTANDING_BALANCE = 180;
const SAMPLE_WARNINGS = [
  { date: "Sep 28, 2026", note: "Pickup reminder sent for order ORD-2026-0042" },
  { date: "Oct 03, 2026", note: "Final reminder sent for order ORD-2026-0042" },
];
const SAMPLE_INCIDENTS: SampleIncident[] = [
  {
    date: "Oct 05, 2026",
    orderId: "ORD-2026-0042",
    decision: "Confirmed Unclaimed",
    reason: "No pickup after the reminder window",
  },
  {
    date: "Oct 06, 2026",
    orderId: "ORD-2026-0038",
    decision: "Confirmed Unclaimed",
    reason: "Customer did not respond to reminders",
  },
  {
    date: "Oct 07, 2026",
    orderId: "ORD-2026-0031",
    decision: "Excused",
    reason: "Customer informed the shop and rescheduled",
  },
];

function StatTile({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "blue" | "amber" | "gray";
}) {
  const toneCls =
    tone === "amber"
      ? "bg-[#FFF5D6] text-[#B45309]"
      : tone === "gray"
        ? "bg-slate-100 text-slate-600"
        : "bg-[#F2F7FF] text-[#1D73EC]";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneCls}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function OrderViolationsSection({
  customerKey,
  role = "customer",
}: OrderViolationsSectionProps) {
  const [showSample, setShowSample] = useState(false);
  const [, setTick] = useState(0);
  const isAdmin = role === "admin";

  useEffect(() => {
    return pickupReview.subscribe(() => setTick((t) => t + 1));
  }, []);

  const liveConfirmed = customerKey
    ? pickupReview.getConfirmedIncidents(customerKey)
    : [];
  const liveRestriction = customerKey
    ? pickupReview.getRestriction(customerKey)
    : { arrangement: null, active: false };
  const hasLive = liveConfirmed.length > 0 || liveRestriction.active;

  const handleClearPreview = () => {
    liveConfirmed.forEach((inc) => pickupReview.resetIncident(inc.orderId));
    if (customerKey) pickupReview.clearRestriction(customerKey);
  };

  return (
    <Card className="bg-white shadow-sm">
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#1D73EC]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Order Violations &amp; Restrictions
          </h2>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1D73EC] ring-1 ring-[#1D73EC]/20">
            <Eye className="h-3 w-3" />
            Preview
          </span>
          {hasLive ? (
            isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearPreview}
                className="ml-auto h-8 bg-white text-red-600 border-2 border-red-200 hover:bg-red-600 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Clear Preview State
              </Button>
            ) : null
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSample((s) => !s)}
              className="ml-auto h-8 bg-white text-[#1D73EC] border-2 border-blue-200 hover:bg-[#1D73EC] hover:text-white"
            >
              {showSample ? "Show empty state" : "Show sample data"}
            </Button>
          )}
        </div>

        <p className="mt-1.5 text-xs text-gray-500">
          The unclaimed-order penalty policy is still awaiting client approval,
          so nothing here is active. This preview shows how the section will
          look once the rules are finalized.
        </p>

        {hasLive ? (
          /* ── Live session preview state ──────────────────────── */
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-[#F2F7FF] border border-[#1D73EC]/20 px-3 py-2 text-xs text-[#10316B]">
              <strong>Session preview state.</strong> These records reflect
              sample review actions taken on orders in this session — no real
              penalty, restriction, or notification has been applied.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Confirmed unclaimed orders"
                value={liveConfirmed.length}
                tone="amber"
              />
              <StatTile
                icon={<Bell className="h-4 w-4" />}
                label="Warnings issued"
                value={0}
              />
              <StatTile
                icon={<CreditCard className="h-4 w-4" />}
                label="Payment restrictions"
                value={liveRestriction.active ? "1 active" : "None"}
                tone={liveRestriction.active ? "amber" : "gray"}
              />
            </div>

            {liveRestriction.active && liveRestriction.arrangement && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Current payment restriction
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40"
                  >
                    {PAYMENT_ARRANGEMENT_LABELS[liveRestriction.arrangement]}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Cash on Pickup disabled after a second confirmed offense
                  </span>
                </div>
                <PaymentRestrictionNotice
                  preview
                  reason={liveRestriction.reason}
                  duration={undefined}
                />
              </div>
            )}

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <History className="h-3.5 w-3.5" />
                Incident history
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-[#F2F7FF] border-b border-[#1D73EC]/10">
                    <tr>
                      {["Date", "Order ID", "Decision", "Reason"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#10316B]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveConfirmed.map((inc) => (
                      <tr
                        key={inc.orderId}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {inc.reviewedAt
                            ? new Date(inc.reviewedAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                          {inc.orderId}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className="text-[11px] font-semibold bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40"
                          >
                            Confirmed Unclaimed
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {inc.reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Restriction status and duration will be shown here once the policy
              — including who may remove a restriction — is approved.
            </p>
          </div>
        ) : !showSample ? (
          /* ── Empty state ─────────────────────────────────────── */
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1D73EC] ring-1 ring-[#1D73EC]/15">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-gray-800">
              No confirmed incidents
            </p>
            <p className="mt-1 max-w-sm text-xs text-gray-500">
              Your account is in good standing. Confirmed unclaimed orders and
              any resulting payment restrictions will appear here.
            </p>
          </div>
        ) : (
          /* ── Sample preview state ────────────────────────────── */
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-[#F2F7FF] border border-[#1D73EC]/20 px-3 py-2 text-xs text-[#10316B]">
              <strong>Sample preview data.</strong> Not a real account — these
              records are for design review only.
            </div>

            {/* Compact stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Confirmed unclaimed orders"
                value={SAMPLE_CONFIRMED_COUNT}
                tone="amber"
              />
              <StatTile
                icon={<Bell className="h-4 w-4" />}
                label="Warnings issued"
                value={SAMPLE_WARNINGS.length}
              />
              <StatTile
                icon={<CreditCard className="h-4 w-4" />}
                label="Payment restrictions"
                value="1 active"
                tone="amber"
              />
            </div>

            {/* Current payment restriction + notice preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Current payment restriction
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs font-semibold bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40"
                >
                  Advance payment required
                </Badge>
                <span className="text-xs text-gray-500">
                  Cash on Pickup disabled after a second confirmed offense
                </span>
              </div>
              <PaymentRestrictionNotice
                preview
                reason="Repeated unclaimed orders"
                duration={undefined}
              />
            </div>

            {/* Outstanding balance — tracked separately */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F7FF] text-[#1D73EC]">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">
                  Outstanding balance
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  ₱{SAMPLE_OUTSTANDING_BALANCE.toFixed(2)}
                </p>
              </div>
              <p className="text-[11px] text-gray-400">
                Tracked separately from penalties. Whether an outstanding
                balance blocks new orders is still pending client approval.
              </p>
            </div>

            {/* Warning history */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Warning history
              </p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-slate-200/70 bg-white">
                {SAMPLE_WARNINGS.map((w) => (
                  <li
                    key={w.date}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-700">{w.note}</span>
                    <span className="shrink-0 text-xs text-gray-400">{w.date}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Incident history */}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <History className="h-3.5 w-3.5" />
                Incident history
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-[#F2F7FF] border-b border-[#1D73EC]/10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#10316B]">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#10316B]">
                        Order ID
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#10316B]">
                        Decision
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#10316B]">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_INCIDENTS.map((inc) => (
                      <tr
                        key={`${inc.orderId}-${inc.date}`}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-3 py-2 text-sm text-gray-600">{inc.date}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                          {inc.orderId}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-semibold ${
                              inc.decision === "Confirmed Unclaimed"
                                ? "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40"
                                : "bg-[#E0F7F5] text-[#0F766E] border-[#159A9C]/40"
                            }`}
                          >
                            {inc.decision}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">{inc.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Restriction status and duration will be shown here once the policy
              — including who may remove a restriction — is approved.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
