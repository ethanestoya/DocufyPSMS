// "Customer Restrictions" — Admin/Staff detail page listing every customer
// whose derived unclaimed-order count has restricted their payment options.
// Reached only from the Unclaimed Orders hub card (never from the sidebar).
//
// Restrictions are derived automatically from each customer's unclaimed-order
// count and cannot be overridden here. Display-only — nothing is enforced.

import React, { useMemo, useState } from "react";
import { Search, Eye, ShieldAlert, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { formatPHDate } from "../../utils/pht";
import { useUnclaimedAdminData } from "../../utils/useUnclaimedOffenses";
import type { CustomerUnclaimedSummary } from "../../utils/unclaimedOrders";

interface UnclaimedRestrictionsProps {
  menuItems: Array<{ label: string; path: string; icon: React.ReactNode }>;
  userRole: "admin" | "staff";
}

function policyBadgeClasses(level: number): string {
  if (level >= 3) return "bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40";
  if (level === 2) return "bg-[#FFF5D6] text-[#92400E] border-[#F59E0B]/40";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function UnclaimedRestrictions({
  menuItems,
  userRole,
}: UnclaimedRestrictionsProps) {
  const navigate = useNavigate();
  const hydrating = useHydrating();
  const { restrictedSummaries, ordersById } = useUnclaimedAdminData();

  const base =
    userRole === "admin" ? "/admin/orders/unclaimed" : "/staff/queue/unclaimed";

  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerUnclaimedSummary | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restrictedSummaries;
    return restrictedSummaries.filter((s) =>
      `${s.name} ${s.email} ${s.customerKey}`.toLowerCase().includes(q),
    );
  }, [restrictedSummaries, search]);

  return (
    <Layout
      menuItems={menuItems}
      title="Customer Restrictions"
      showBackButton
      backButtonPath={base}
    >
      <StaffTimeInGate>
        <div className="flex flex-col space-y-5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(base)}
            className="w-fit bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Unclaimed Orders
          </Button>
          <p className="max-w-2xl text-sm text-slate-500">
            A restriction applies automatically from a customer&apos;s second
            unclaimed order. Restrictions are derived from each customer&apos;s
            unclaimed-order count and cannot be overridden here.
          </p>

          <Card className="p-4 border border-slate-100 shadow-sm shrink-0">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Search
            </Label>
            <div className="group relative mt-1.5 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
              <Input
                aria-label="Search restricted customers"
                placeholder="Search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-[#10316B]">
              Customer Restrictions
            </h2>
            <Card className="overflow-hidden">
              {hydrating && <TableSkeleton columns={4} rows={6} />}
              {!hydrating && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                    <tr>
                      {[
                        "Customer",
                        "Unclaimed Orders",
                        "Restriction",
                        "What's Required",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-14">
                          <div className="flex flex-col items-center text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1668D9] ring-1 ring-[#1668D9]/15">
                              <ShieldAlert className="h-6 w-6" />
                            </span>
                            <p className="mt-3 text-sm font-semibold text-gray-800">
                              No restricted customers
                            </p>
                            <p className="mt-1 max-w-md text-xs text-gray-500">
                              A restriction applies automatically from a
                              customer&apos;s second unclaimed order.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((summary) => (
                        <tr
                          key={summary.customerKey}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedCustomer(summary)}
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {summary.name || summary.customerKey}
                            </div>
                            <div className="text-xs text-gray-500">
                              {summary.email || summary.customerKey}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40"
                            >
                              {summary.count} unclaimed
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${policyBadgeClasses(
                                summary.policy.level,
                              )}`}
                            >
                              {summary.policy.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 max-w-[22rem]">
                            <span className="text-sm text-gray-600">
                              {summary.policy.summary}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(summary);
                              }}
                              className="h-8 bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </Card>
          </div>

          <p className="text-xs text-gray-500">
            Restrictions are derived automatically from each customer&apos;s
            unclaimed-order count and cannot be overridden here.
          </p>
        </div>
      </StaffTimeInGate>

      {/* Customer restriction details */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null);
        }}
      >
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto p-[26px]">
          {selectedCustomer && (
            <>
              <DialogHeader className="border-b border-gray-100 pb-4">
                <DialogTitle className="text-[22px] font-bold text-[#10316B]">
                  {selectedCustomer.name || selectedCustomer.customerKey}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-gray-500">
                  {selectedCustomer.email || selectedCustomer.customerKey}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs font-semibold bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40"
                >
                  {selectedCustomer.count} unclaimed
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${policyBadgeClasses(
                    selectedCustomer.policy.level,
                  )}`}
                >
                  {selectedCustomer.policy.label}
                </Badge>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {selectedCustomer.policy.summary}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unclaimed Orders ({selectedCustomer.records.length})
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Order ID", "Ready", "Missed Deadline", "Collected"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {selectedCustomer.records
                        .slice()
                        .sort(
                          (a, b) =>
                            b.deadlineAt.getTime() - a.deadlineAt.getTime(),
                        )
                        .map((record) => (
                          <tr
                            key={record.orderId}
                            className="border-t border-slate-100"
                          >
                            <td className="px-3 py-2 font-mono text-xs text-gray-700">
                              {ordersById.get(record.orderId)?.displayId ??
                                record.orderId}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {formatPHDate(record.readyAt)}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-red-700">
                              {formatPHDate(record.deadlineAt)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {record.releasedAt
                                ? formatPHDate(record.releasedAt)
                                : "Not collected"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
