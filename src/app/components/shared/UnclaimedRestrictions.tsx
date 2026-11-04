// "Customer Restrictions" — Admin/Staff detail page listing every customer
// whose derived unclaimed-order count has restricted their payment options.
// Reached only from the Unclaimed Orders hub card (never from the sidebar).
//
// Restrictions are derived automatically from each customer's unclaimed-order
// count and cannot be overridden here. Display-only — nothing is enforced.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Eye,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Users,
  ClipboardList,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import Layout from "../Layout";
import StaffTimeInGate from "./StaffTimeInGate";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SummaryCard } from "../ui/summary-card";
import { TableSkeleton } from "../ui/table-skeleton";
import { CopyFieldButton } from "../ui/copy-field-button";
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

const PAGE_SIZE = 10;

export default function UnclaimedRestrictions({
  menuItems,
  userRole,
}: UnclaimedRestrictionsProps) {
  const hydrating = useHydrating();
  const navigate = useNavigate();
  const { restrictedSummaries, ordersById } = useUnclaimedAdminData();

  const base =
    userRole === "admin" ? "/admin/orders/unclaimed" : "/staff/queue/unclaimed";

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerUnclaimedSummary | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restrictedSummaries;
    return restrictedSummaries.filter((s) =>
      `${s.name} ${s.email} ${s.customerKey}`.toLowerCase().includes(q),
    );
  }, [restrictedSummaries, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / PAGE_SIZE),
  );
  const pageRows = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const unclaimedOnRecord = restrictedSummaries.reduce(
    (sum, s) => sum + s.count,
    0,
  );
  const fullAdvanceCount = restrictedSummaries.filter(
    (s) => s.policy.level >= 3,
  ).length;

  return (
    <Layout
      menuItems={menuItems}
      title="Customer Restrictions"
      showBackButton
      backButtonPath={base}
    >
      <StaffTimeInGate>
        <div className="flex flex-col space-y-6">
          {/* Desktop has no header back arrow, so the way out of this detail
              page is stated here in the same outline button the other
              drill-down pages (Job Board, Staff) use; below md the header
              arrow already returns to Unclaimed Orders. */}
          <div className="hidden md:block">
            <Button
              variant="outline"
              onClick={() => navigate(base)}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Unclaimed Orders
            </Button>
          </div>

          {/* Same summary row the All Orders workspace opens with. */}
          <div className="grid grid-cols-1 @min-[560px]:grid-cols-3 gap-2 sm:gap-3 mb-4 shrink-0">
            <SummaryCard
              label="Restricted customers"
              value={restrictedSummaries.length}
              icon={Users}
              iconColor="text-[#2F6FD6]"
              labelColor="text-[#1668D9]"
            />
            <SummaryCard
              label="Unclaimed orders on record"
              value={unclaimedOnRecord}
              icon={ClipboardList}
              iconColor="text-[#B91C1C]"
              labelColor="text-[#B91C1C]"
            />
            <SummaryCard
              label="Full advance required"
              value={fullAdvanceCount}
              icon={CreditCard}
              iconColor="text-[#B91C1C]"
              labelColor="text-[#B91C1C]"
            />
          </div>

          <Card className="p-4 border border-slate-100 shadow-sm mb-6 shrink-0">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Search
            </Label>
            <div className="group relative mt-1.5 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] transition-colors group-focus-within:text-[#2F6FD6]" />
              <Input
                aria-label="Search restricted customers"
                placeholder="Search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Restrictions apply automatically from a customer&apos;s second
              unclaimed order.
            </p>
          </Card>

          <Card className="overflow-hidden">
            {hydrating && <TableSkeleton columns={6} rows={6} />}
            {!hydrating && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-[#F2F7FF] border-b border-[#1668D9]/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider w-14 whitespace-nowrap">
                        #
                      </th>
                      {[
                        "Customer",
                        "Unclaimed Orders",
                        "Restriction",
                        "What's Required",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-[#10316B] uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-14">
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
                      pageRows.map((summary, index) => {
                        const listPosition =
                          (currentPage - 1) * PAGE_SIZE + index + 1;
                        return (
                          <tr
                            key={summary.customerKey}
                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedCustomer(summary)}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-[#10316B]">
                              {listPosition}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">
                                {summary.name || summary.customerKey}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="min-w-0">
                                  {summary.email || summary.customerKey}
                                </span>
                                <CopyFieldButton
                                  value={summary.email}
                                  label="customer email"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold bg-[#FDE8E8] text-[#B91C1C] border-[#DC2626]/40"
                              >
                                {summary.count} unclaimed
                              </Badge>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
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
                                className="h-8"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-white">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {totalPages === 1
                    ? filteredCustomers.length
                    : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                        currentPage * PAGE_SIZE,
                        filteredCustomers.length,
                      )}`}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {filteredCustomers.length}
                </span>{" "}
                customer{filteredCustomers.length === 1 ? "" : "s"}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pg) => (
                      <Button
                        key={pg}
                        type="button"
                        variant={pg === currentPage ? "primary" : "outline"}
                        size="icon"
                        onClick={() => setCurrentPage(pg)}
                      >
                        {pg}
                      </Button>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="h-9 px-3"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
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
                <div className="mt-1 flex items-center gap-1.5">
                  <DialogDescription className="min-w-0 text-sm text-gray-500">
                    {selectedCustomer.email || selectedCustomer.customerKey}
                  </DialogDescription>
                  <CopyFieldButton
                    value={selectedCustomer.email}
                    label="customer email"
                  />
                </div>
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
                                record.displayId ??
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
