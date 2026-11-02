import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Check, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { PersonAvatar } from "../ui/person-avatar";
import { Spinner } from "../ui/spinner";
import { dataStore, type Order } from "../../utils/dataStore";
import { useShopClosingTime } from "../../utils/useUnclaimedOffenses";
import {
  findCustomerSummary,
  isHistoryUnavailable,
  toUnclaimedOrderLikes,
} from "../../utils/unclaimedOrders";
import { effectivePolicy } from "../../utils/unclaimedPolicy";
import { restrictionsStore } from "../../utils/restrictionsStore";
import { formatCurrency } from "../../utils/formatNumber";
import { formatPHDate } from "../../utils/pht";
import {
  fetchCustomerProfileByEmail,
  type CustomerProfileDto,
} from "../../../lib/db/customerRepo";

interface CustomerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerEmail?: string;
}

// The orders the shop already has for this address, taken straight from the
// shared mirror. Compared case-insensitively because an older order or profile
// row may not be lowercased the way auth stores new addresses.
function ordersFor(emailKey: string): Order[] {
  if (!emailKey) return [];
  return dataStore
    .getOrders()
    .filter((o) => (o.customerEmail ?? "").trim().toLowerCase() === emailKey);
}

function amountOf(order: Order): number {
  if (typeof order.manualTotal === "number") return order.manualTotal;
  if (typeof order.costBreakdown?.total === "number") return order.costBreakdown.total;
  const parsed = parseFloat(String(order.total ?? "").replace(/[₱,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function placedAt(order: Order): Date | null {
  const raw = order.createdAt ?? order.date;
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * The customer behind an order, shown over the order the operator already has
 * open. Read-only on purpose: there is no customer directory and nothing here
 * edits an account.
 *
 * The account rows live on `profiles`; the order history and the unclaimed /
 * restriction standing are derived from this shop's own orders, so they are
 * still shown when the profile itself can't be read.
 */
export function CustomerDetailsDialog({
  open,
  onOpenChange,
  customerName,
  customerEmail,
}: CustomerDetailsDialogProps) {
  const emailKey = (customerEmail ?? "").trim().toLowerCase();
  const closingTime = useShopClosingTime();
  const [profile, setProfile] = useState<CustomerProfileDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  // Restrictions and per-order decisions hydrate from the server after mount,
  // so the derived standing carries this counter: a re-render alone would keep
  // serving the memo built before the remote rows arrived.
  const [restrictionVersion, setRestrictionVersion] = useState(0);

  // Account details are fetched only while the dialog is open, so browsing the
  // order list never reads every profile.
  useEffect(() => {
    if (!open) return;
    if (!emailKey) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    fetchCustomerProfileByEmail(emailKey).then((result) => {
      if (cancelled) return;
      setProfile(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, emailKey]);

  useEffect(() => {
    const sync = () => setCustomerOrders(ordersFor(emailKey));
    sync();
    return dataStore.subscribe(sync);
  }, [emailKey]);

  // A decision made on another machine must re-render this one.
  useEffect(() => {
    return restrictionsStore.subscribe(() => setRestrictionVersion((n) => n + 1));
  }, []);

  const stats = useMemo(() => {
    const billed = customerOrders.filter((o) => o.status !== "Canceled");
    const totalSpent = billed.reduce((sum, o) => sum + amountOf(o), 0);
    const openCount = customerOrders.filter(
      (o) => o.status !== "Released" && o.status !== "Canceled",
    ).length;
    let lastAt: Date | null = null;
    for (const order of customerOrders) {
      const at = placedAt(order);
      if (at && (!lastAt || at.getTime() > lastAt.getTime())) lastAt = at;
    }
    return { count: customerOrders.length, totalSpent, openCount, lastAt };
  }, [customerOrders]);

  const standing = useMemo(() => {
    const likes = toUnclaimedOrderLikes(customerOrders);
    const summary = findCustomerSummary(likes, emailKey, closingTime);
    const restriction = restrictionsStore.getRestriction(emailKey);
    const overrides = restrictionsStore.getOverrides();
    const kept = (summary?.records ?? []).filter(
      (r) => overrides.get(r.orderId)?.decision !== "excused",
    );
    return {
      count: kept.length,
      policy: effectivePolicy(kept.length, restriction),
      restriction,
      unavailable: isHistoryUnavailable(likes),
    };
  }, [customerOrders, emailKey, closingTime, restrictionVersion]);

  const displayName = profile?.fullName || customerName || "Customer";
  const displayEmail = profile?.email ?? customerEmail ?? "";
  const restrictionActive = standing.restriction?.active === true;
  const blocked = standing.policy.cashOnPickupDisabled;
  const restrictionRemoved = Boolean(standing.restriction) && !restrictionActive;
  const standingClean =
    !standing.unavailable &&
    !blocked &&
    standing.count === 0 &&
    !restrictionActive &&
    !restrictionRemoved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] max-h-[calc(100dvh-2rem)] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl [font-family:inherit] [&_[data-slot=dialog-close]]:hidden"
        onFocusOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-row items-start justify-between gap-3 space-y-0 px-6 pt-6 pb-0 text-left">
          <div className="flex min-w-0 items-start gap-3">
            <PersonAvatar
              name={displayName}
              src={profile?.profileImageUrl}
              className="size-14 text-base"
            />
            <div className="min-w-0">
              <DialogTitle className="break-words text-[20px] font-bold leading-tight text-[#111827]">
                {displayName}
              </DialogTitle>
              <DialogDescription className="mt-1 break-words text-[14px] leading-relaxed text-[#4B5563]">
                {displayEmail || "No email on this order"}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile ? (
                  profile.suspended ? (
                    <Badge
                      variant="outline"
                      className="border-[#FECACA] bg-[#FEF2F2] text-[12px] font-semibold text-[#991B1B]"
                    >
                      Suspended
                    </Badge>
                  ) : profile.active ? (
                    <Badge
                      variant="outline"
                      className="border-[#BBF7D0] bg-[#F0FDF4] text-[12px] font-semibold text-[#166534]"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-[#E5E7EB] bg-[#F3F4F6] text-[12px] font-semibold text-[#4B5563]"
                    >
                      Inactive
                    </Badge>
                  )
                ) : (
                  !loading && (
                    <Badge
                      variant="outline"
                      className="border-[#E5E7EB] bg-[#F9FAFB] text-[12px] font-semibold text-[#4B5563]"
                    >
                      Account unavailable
                    </Badge>
                  )
                )}
                {blocked && (
                  <Badge
                    variant="outline"
                    className="border-[#FECACA] bg-[#FEF2F2] text-[12px] font-semibold text-[#991B1B]"
                  >
                    Cash on Pickup blocked
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close customer details"
            className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#D5DBE5] bg-white text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="text-[18px] leading-none">
              ×
            </span>
          </button>
        </DialogHeader>

        <div className="mt-5 h-px bg-[#E5E7EB]" />

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" label="Loading customer…" />
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="text-[13px] font-semibold text-[#111827]">
                  Contact
                </h3>
                {profile ? (
                  <dl className="mt-2.5 grid gap-x-4 gap-y-2.5 sm:grid-cols-[120px_1fr]">
                    <dt className="text-[12px] font-semibold text-[#6B7280]">
                      Email
                    </dt>
                    <dd className="break-words text-[14px] text-[#111827]">
                      {displayEmail || "—"}
                    </dd>
                    {profile.phone ? (
                      <>
                        <dt className="text-[12px] font-semibold text-[#6B7280]">
                          Phone
                        </dt>
                        <dd className="break-words text-[14px] text-[#111827]">
                          {profile.phone}
                        </dd>
                      </>
                    ) : null}
                    {profile.address ? (
                      <>
                        <dt className="text-[12px] font-semibold text-[#6B7280]">
                          Address
                        </dt>
                        <dd className="whitespace-pre-line break-words text-[14px] text-[#111827]">
                          {profile.address}
                        </dd>
                      </>
                    ) : null}
                    <dt className="text-[12px] font-semibold text-[#6B7280]">
                      Customer since
                    </dt>
                    <dd className="text-[14px] text-[#111827]">
                      {formatPHDate(profile.createdAt, "long")}
                    </dd>
                  </dl>
                ) : (
                  <div className="mt-2.5 rounded-[10px] border border-dashed border-[#D5DBE5] bg-[#F9FAFB] px-4 py-3">
                    <p className="text-[13px] font-medium text-[#4B5563]">
                      Saved profile unavailable
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6B7280]">
                      The account details for this address couldn't be read here.
                      The order history below still comes from this shop's orders.
                    </p>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-[#111827]">
                  Orders
                </h3>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                      Orders
                    </p>
                    <p className="mt-1 text-[18px] font-bold leading-tight text-[#111827]">
                      {stats.count}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">
                      {stats.openCount === 0
                        ? "Nothing open"
                        : `${stats.openCount} still open`}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                      Total spent
                    </p>
                    <p className="mt-1 break-words text-[18px] font-bold leading-tight text-[#111827]">
                      {formatCurrency(stats.totalSpent)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">
                      Canceled excluded
                    </p>
                  </div>
                  <div className="col-span-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 sm:col-span-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                      Last order
                    </p>
                    <p className="mt-1 text-[18px] font-bold leading-tight text-[#111827]">
                      {stats.lastAt ? formatPHDate(stats.lastAt, "short") : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">
                      Most recently placed
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-[#111827]">
                  Standing
                </h3>
                <div className="mt-2.5 space-y-2">
                  {standing.unavailable ? (
                    <div className="flex items-start gap-2.5 rounded-[10px] border border-[#F5CE8A] bg-[#FFF8EB] px-3.5 py-3">
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0 text-[#B45309]"
                        aria-hidden="true"
                      />
                      <p className="text-[12.5px] leading-relaxed text-[#8A5007]">
                        Pickup history couldn't be read, so the unclaimed order
                        count may be incomplete.
                      </p>
                    </div>
                  ) : standing.count > 0 ? (
                    <div className="rounded-[10px] border border-[#F5CE8A] bg-[#FFF8EB] px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-[#B45309]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#8A5007]">
                            {standing.count === 1
                              ? "1 unclaimed order on record"
                              : `${standing.count} unclaimed orders on record`}
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#8A5007]">
                            {standing.policy.summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {restrictionActive || blocked ? (
                    <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-[#B91C1C]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#991B1B]">
                            Cash on Pickup is blocked
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#7F1D1D]">
                            {standing.policy.summary}
                          </p>
                          {restrictionActive && (
                            <p className="mt-1.5 text-[12px] text-[#7F1D1D]">
                              {standing.restriction?.arrangement === "full_advance"
                                ? "Full advance payment required"
                                : "50% down payment accepted"}
                              {standing.restriction?.setByName
                                ? ` · set by ${standing.restriction.setByName}`
                                : ""}
                              {" · "}
                              {formatPHDate(
                                standing.restriction?.updatedAt,
                                "short",
                              )}
                            </p>
                          )}
                          {restrictionActive && standing.restriction?.reason && (
                            <p className="mt-1 text-[12px] italic text-[#7F1D1D]">
                              “{standing.restriction.reason}”
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {restrictionRemoved ? (
                    <div className="flex items-start gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-3">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-[#4B5563]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#111827]">
                          Restriction removed
                        </p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#4B5563]">
                          Cash on Pickup is available again
                          {standing.restriction?.removedReason
                            ? ` — ${standing.restriction.removedReason}`
                            : "."}
                          {" · "}
                          {formatPHDate(standing.restriction?.updatedAt, "short")}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {standingClean ? (
                    <div className="flex items-center gap-2.5 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3">
                      <ShieldCheck
                        className="size-4 shrink-0 text-[#166534]"
                        aria-hidden="true"
                      />
                      <p className="text-[13px] font-medium text-[#166534]">
                        No unclaimed orders or payment restrictions on record.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-[#E5E7EB] px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
