import React, { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  Edit2,
  Tag,
  FileText,
  Printer,
  Camera,
  StickyNote,
  Layers,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  pricingStore,
  formatPrice,
  COLOR_TIER_LABELS,
  CONTENT_TYPE_LABELS,
  PAPER_SIZE_LABELS,
  SERVICE_TYPE_LABELS,
  PHOTO_SIZE_LABELS,
  type ColorTier,
  type ContentType,
  type PaperSizeKey,
  type PricingMatrix,
  type PricingValues,
  type PricingItemSpec,
  type PricingCategory,
  type PhotoSizeKey,
  type ServiceType,
} from "../../utils/pricingStore";
import { PRICING_ITEMS } from "../../utils/pricingStore";
import { formatDuration } from "../../utils/pricingStore";

const menuItems = adminMenuItems;

const COLOR_TIERS: ColorTier[] = ["bw", "partial", "full"];
const PAPER_SIZES: PaperSizeKey[] = ["short", "a4", "long"];
const CONTENT_TYPES: ContentType[] = ["text", "textWithImage", "imageOnly"];
const PHOTO_SIZES: PhotoSizeKey[] = ["2R", "3R", "4R", "5R", "6R", "A4photo"];

const SERVICE_ICON: Record<ServiceType, React.ReactNode> = {
  document: <Layers className="w-4 h-4 text-[#2F6FD6]" />,
  vellum: <FileText className="w-4 h-4 text-[#2F6FD6]" />,
  sticker: <StickyNote className="w-4 h-4 text-[#2F6FD6]" />,
  photo: <Camera className="w-4 h-4 text-[#2F6FD6]" />,
};

// Short labels for the service tabs so all four fit on one row with even
// spacing (full descriptions are shown in each section's content header).
const SERVICE_TAB_LABELS: Record<ServiceType, string> = {
  document: "Plain Paper",
  vellum: "Vellum",
  sticker: "Sticker",
  photo: "Photo Paper",
};

const CATEGORY_ICON: Record<PricingCategory, React.ReactNode> = {
  "Color & Black and White": <Tag className="w-4 h-4 text-[#2F6FD6]" />,
  "Paper Size": <FileText className="w-4 h-4 text-[#2F6FD6]" />,
  "Printing Options": <Printer className="w-4 h-4 text-[#2F6FD6]" />,
  "Order Rules": <Camera className="w-4 h-4 text-[#2F6FD6]" />,
};

const CATEGORY_ORDER: PricingCategory[] = [
  "Color & Black and White",
  "Paper Size",
  "Printing Options",
  "Order Rules",
];

// The two order-rule deadline windows are edited as a full duration
// (hours/minutes/seconds) instead of a single number input.
const DURATION_WINDOW_IDS: Array<keyof PricingValues> = [
  "cashPickupPaymentWindowSeconds",
  "onlinePaymentVerificationWindowSeconds",
];

type DurationUnit = "hours" | "minutes" | "seconds";
const DURATION_UNIT_MULTIPLIER: Record<DurationUnit, number> = {
  hours: 3600,
  minutes: 60,
  seconds: 1,
};
const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
};

// A single editable cell described by its location in the matrix.
type EditTarget =
  | { kind: "document"; content: ContentType; tier: ColorTier; size: PaperSizeKey }
  | { kind: "vellum"; tier: ColorTier; size: PaperSizeKey }
  | { kind: "sticker"; tier: ColorTier }
  | { kind: "photo"; size: PhotoSizeKey; field: "price" | "minQty" };

function EditTargetLabel(target: EditTarget): string {
  switch (target.kind) {
    case "document":
      return `${SERVICE_TYPE_LABELS.document} · ${CONTENT_TYPE_LABELS[target.content]} · ${COLOR_TIER_LABELS[target.tier]} · ${PAPER_SIZE_LABELS[target.size]}`;
    case "vellum":
      return `${SERVICE_TYPE_LABELS.vellum} · ${COLOR_TIER_LABELS[target.tier]} · ${PAPER_SIZE_LABELS[target.size]}`;
    case "sticker":
      return `${SERVICE_TYPE_LABELS.sticker} · ${COLOR_TIER_LABELS[target.tier]}`;
    case "photo":
      return `${SERVICE_TYPE_LABELS.photo} · ${PHOTO_SIZE_LABELS[target.size]} · ${target.field === "price" ? "Price" : "Minimum Order"}`;
  }
}

export default function PricingManagement() {
  const hydrating = useHydrating();
  const [pricing, setPricing] = useState<PricingValues>(pricingStore.getPricing());
  const [matrix, setMatrix] = useState<PricingMatrix>(pricingStore.getMatrix());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState("");

  const [legacyEditing, setLegacyEditing] = useState<PricingItemSpec | null>(null);
  const [legacyEditValue, setLegacyEditValue] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showLegacySaveConfirm, setShowLegacySaveConfirm] = useState(false);

  useEffect(() => {
    const load = () => {
      setPricing(pricingStore.getPricing());
      setMatrix(pricingStore.getMatrix());
    };
    load();
    const unsubscribe = pricingStore.subscribe(load);
    return unsubscribe;
  }, []);

  const currentValue = (target: EditTarget): number => {
    switch (target.kind) {
      case "document":
        return matrix.document[target.content][target.tier][target.size];
      case "vellum":
        return matrix.vellum[target.tier][target.size];
      case "sticker":
        return matrix.sticker[target.tier];
      case "photo":
        return matrix.photo[target.size][target.field];
    }
  };

  const openEdit = (target: EditTarget) => {
    setEditing(target);
    setEditValue(String(currentValue(target)));
    setShowResetConfirm(false);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const handleSave = () => {
    if (!editing) return;
    const parsed = Number(editValue);
    if (editValue.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      toast.error("Please enter a valid number (0 or greater).");
      return;
    }
    const path: string[] =
      editing.kind === "document"
        ? [editing.content, editing.tier, editing.size]
        : editing.kind === "vellum"
          ? [editing.tier, editing.size]
          : editing.kind === "sticker"
            ? [editing.tier]
            : [editing.size, editing.field];
    const ok = pricingStore.updateMatrixCell(editing.kind, path, parsed);
    if (!ok) {
      toast.error("Could not update that price. Please try again.");
      return;
    }
    toast.success("Pricing updated successfully.");
    closeEdit();
  };

  const openLegacyEdit = (item: PricingItemSpec) => {
    setLegacyEditing(item);
    setLegacyEditValue(String(pricing[item.id]));
    setShowResetConfirm(false);
  };

  const closeLegacyEdit = () => {
    setLegacyEditing(null);
    setLegacyEditValue("");
  };

  const [durationTarget, setDurationTarget] = useState<PricingItemSpec | null>(null);
  const [durUnit, setDurUnit] = useState<DurationUnit>("hours");
  const [durValue, setDurValue] = useState("0");
  const [showDurationSaveConfirm, setShowDurationSaveConfirm] = useState(false);

  const openDurationEdit = (item: PricingItemSpec) => {
    const seconds = Number.isFinite(pricing[item.id])
      ? Math.floor(pricing[item.id])
      : 0;
    let unit: DurationUnit = "seconds";
    let value = seconds;
    if (seconds > 0 && seconds % 3600 === 0) {
      unit = "hours";
      value = seconds / 3600;
    } else if (seconds > 0 && seconds % 60 === 0) {
      unit = "minutes";
      value = seconds / 60;
    }
    setDurUnit(unit);
    setDurValue(String(value));
    setDurationTarget(item);
    setShowResetConfirm(false);
  };

  const closeDurationEdit = () => {
    setDurationTarget(null);
    setShowDurationSaveConfirm(false);
  };

  const durationTotalSeconds = () => {
    const n = Number(durValue);
    const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    return v * DURATION_UNIT_MULTIPLIER[durUnit];
  };

  const handleDurationSave = () => {
    if (!durationTarget) return;
    const total = durationTotalSeconds();
    const ok = pricingStore.updatePricing(durationTarget.id, total);
    if (!ok) {
      toast.error(`Could not update ${durationTarget.label}. Please try again.`);
      return;
    }
    toast.success("Pricing updated successfully.");
    closeDurationEdit();
  };

  const DurationRow = ({ item }: { item: PricingItemSpec }) => (
    <div className="py-3.5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{item.label}</p>
        <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-[#10316B] whitespace-nowrap">
          {formatDuration(pricing[item.id])}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="bg-white text-[#2F6FD6] border-2 border-[#2F6FD6]/40 hover:bg-[#2F6FD6] hover:text-white h-9 transition-all"
          onClick={() => openDurationEdit(item)}
        >
          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      </div>
    </div>
  );

  const handleLegacySave = () => {
    if (!legacyEditing) return;
    const parsed = Number(legacyEditValue);
    if (legacyEditValue.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      toast.error("Please enter a valid number (0 or greater).");
      return;
    }
    const ok = pricingStore.updatePricing(legacyEditing.id, parsed);
    if (!ok) {
      toast.error(`Could not update ${legacyEditing.label}. Please try again.`);
      return;
    }
    toast.success("Pricing updated successfully.");
    closeLegacyEdit();
  };

  const legacyDisplayValue = (item: PricingItemSpec) => {
    const price = `${item.prefix || ""}${formatPrice(pricing[item.id])}`;
    if (item.unit === "₱") return price;
    return `${price} ${item.unit}`;
  };

  const confirmReset = () => {
    pricingStore.resetPricing();
    toast.success("Pricing reset to the default values.");
    setShowResetConfirm(false);
  };

  const EditableRow = ({
    label,
    sublabel,
    target,
  }: {
    label: string;
    sublabel?: string;
    target: EditTarget;
  }) => (
    <div className="py-3.5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        {sublabel && (
          <p className="text-sm text-gray-500 mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-[#10316B] whitespace-nowrap">
          {formatPrice(currentValue(target))}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="bg-white text-[#2F6FD6] border-2 border-[#2F6FD6]/40 hover:bg-[#2F6FD6] hover:text-white h-9 transition-all"
          onClick={() => openEdit(target)}
        >
          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      </div>
    </div>
  );

  const ColorSizeTable = ({
    rows,
    makeTarget,
  }: {
    rows: { key: ColorTier; label: string }[];
    makeTarget: (tier: ColorTier, size: PaperSizeKey) => EditTarget;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-600 border-b border-gray-300 bg-gray-50">
            <th className="py-2.5 pl-4 pr-6 font-semibold uppercase tracking-wider min-w-[10rem]">
              Color Option
            </th>
            {PAPER_SIZES.map((s) => (
              <th key={s} className="py-2.5 px-4 font-semibold text-right">
                {PAPER_SIZE_LABELS[s]}
              </th>
            ))}
            <th className="py-2.5 pl-4 w-24" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-gray-200 last:border-0">
              <td className="py-3 pl-4 pr-6 font-medium text-gray-900 whitespace-nowrap">
                {row.label}
              </td>
              {PAPER_SIZES.map((size) => {
                const target = makeTarget(row.key, size);
                return (
                  <td key={size} className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-[#10316B]">
                        {formatPrice(currentValue(target))}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white transition-all"
                        title="Edit"
                        onClick={() => openEdit(target)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                );
              })}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Layout menuItems={menuItems} title="Pricing Management" showBackButton>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F2F7FF] text-[#1668D9] flex items-center justify-center shrink-0">
              <BadgeDollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#10316B]">
                Printing Prices
              </h2>
              <p className="text-gray-600 mt-1">
                Manage the prices customers see and pay. Changes apply everywhere immediately.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11 sm:h-10 w-full sm:w-auto border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
            onClick={() => setShowResetConfirm(true)}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>

        {hydrating && <TableSkeleton columns={4} rows={6} />}
        <div className={hydrating ? "hidden" : undefined}>
        <Tabs defaultValue="document">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
            {(["document", "vellum", "sticker", "photo"] as ServiceType[]).map(
              (service) => (
                <TabsTrigger key={service} value={service} className="gap-2">
                  {SERVICE_ICON[service]}
                  <span>{SERVICE_TAB_LABELS[service]}</span>
                </TabsTrigger>
              ),
            )}
          </TabsList>

          {/* Document */}
          <TabsContent value="document" className="mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-lg bg-[#F2F7FF] flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-[#2F6FD6]" />
                </span>
                <h3 className="font-bold text-gray-900">
                  Plain Paper Printing (Standard Paper)
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4 ml-10">
                Per-page price by content type, color and paper size.
              </p>
              {CONTENT_TYPES.map((ct) => (
                <div key={ct} className="mb-5 last:mb-0">
                  <h4 className="text-sm font-semibold text-[#2F6FD6] mb-2">
                    {CONTENT_TYPE_LABELS[ct]}
                  </h4>
                  <div className="rounded-xl border border-gray-300 shadow-sm overflow-hidden">
                    <ColorSizeTable
                      rows={COLOR_TIERS.map((tier) => ({
                        key: tier,
                        label: COLOR_TIER_LABELS[tier],
                      }))}
                      makeTarget={(tier, size) => ({ kind: "document", content: ct, tier, size })}
                    />
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          {/* Vellum */}
          <TabsContent value="vellum" className="mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-lg bg-[#F2F7FF] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#2F6FD6]" />
                </span>
                <h3 className="font-bold text-gray-900">
                  Vellum Paper (Image Only)
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4 ml-10">
                Per-page price by color option and paper size. Vellum is always
                image-only printing.
              </p>
              <div className="rounded-xl border border-gray-300 shadow-sm overflow-hidden">
                <ColorSizeTable
                  rows={COLOR_TIERS.map((tier) => ({
                    key: tier,
                    label: COLOR_TIER_LABELS[tier],
                  }))}
                  makeTarget={(tier, size) => ({ kind: "vellum", tier, size })}
                />
              </div>
            </Card>
          </TabsContent>

          {/* Sticker */}
          <TabsContent value="sticker" className="mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-lg bg-[#F2F7FF] flex items-center justify-center shrink-0">
                  <StickyNote className="w-4 h-4 text-[#2F6FD6]" />
                </span>
                <h3 className="font-bold text-gray-900">Sticker Paper (A4)</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4 ml-10">
                Price per sheet, by color option. Sticker printing is A4 only.
              </p>
              <div className="divide-y divide-gray-100">
                {COLOR_TIERS.map((tier) => (
                  <EditableRow
                    key={tier}
                    label={COLOR_TIER_LABELS[tier]}
                    sublabel="Per sheet"
                    target={{ kind: "sticker", tier }}
                  />
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Photo */}
          <TabsContent value="photo" className="mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-lg bg-[#F2F7FF] flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-[#2F6FD6]" />
                </span>
                <h3 className="font-bold text-gray-900">
                  Photo Paper Printing (Matte or Glossy)
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4 ml-10">
                Per-piece price and minimum order quantity for each photo size.
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-300 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-600 border-b border-gray-300 bg-gray-50">
                      <th className="py-2.5 pl-4 pr-6 font-semibold uppercase tracking-wider min-w-[10rem]">
                        Photo Size
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-right">Price / each</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Minimum Order</th>
                      <th className="py-2.5 pl-4 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {PHOTO_SIZES.map((size) => (
                      <tr key={size} className="border-b border-gray-200 last:border-0">
                        <td className="py-3 pl-4 pr-6 font-medium text-gray-900">
                          {PHOTO_SIZE_LABELS[size]}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-[#10316B]">
                              {formatPrice(matrix.photo[size].price)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white transition-all"
                              title="Edit price"
                              onClick={() =>
                                openEdit({ kind: "photo", size, field: "price" })
                              }
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-[#10316B]">
                              {matrix.photo[size].minQty > 0
                                ? `${matrix.photo[size].minQty} pcs`
                                : "—"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white transition-all"
                              title="Edit minimum order"
                              onClick={() =>
                                openEdit({ kind: "photo", size, field: "minQty" })
                              }
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
        </div>

        {/* Legacy per-page rates */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-[#F2F7FF] flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-gray-500" />
            </span>
            <h3 className="font-bold text-gray-900">Legacy Per-Page Rates</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4 ml-10">
            Fallback rates for the older document flow.
          </p>
          {CATEGORY_ORDER.map((category) => {
            const items = PRICING_ITEMS.filter((item) => item.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category} className="mb-5 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 rounded-lg bg-[#F2F7FF] flex items-center justify-center shrink-0">
                    {CATEGORY_ICON[category]}
                  </span>
                  <h4 className="font-semibold text-gray-700">{category}</h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((item) =>
                    DURATION_WINDOW_IDS.includes(item.id) ? (
                      <DurationRow key={item.id} item={item} />
                    ) : (
                      <div
                        key={item.id}
                        className="py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-[#10316B] whitespace-nowrap">
                            {legacyDisplayValue(item)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white text-[#2F6FD6] border-2 border-[#2F6FD6]/40 hover:bg-[#2F6FD6] hover:text-white h-9 transition-all"
                            onClick={() => openLegacyEdit(item)}
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Edit Matrix Cell Dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              {editing ? EditTargetLabel(editing) : "Edit Price"}
            </DialogTitle>
            <DialogDescription>
              {editing?.kind === "photo" && editing.field === "minQty"
                ? "0 means no minimum."
                : "Set the price in Philippine pesos (₱)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pricing-value">
                {editing?.kind === "photo" && editing.field === "minQty"
                  ? "Minimum Order (pcs)"
                  : "Price (₱)"}
              </Label>
              <Input
                id="pricing-value"
                type="number"
                min="0"
                step="0.5"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="0"
                className="h-11 bg-white text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={closeEdit}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowSaveConfirm(true)}
            >
              <Edit2 className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Matrix Price Confirmation */}
      {showSaveConfirm && editing && (
        <ConfirmationDialog
          open
          onOpenChange={setShowSaveConfirm}
          onConfirm={handleSave}
          title="Update Price?"
          description={`Set ${EditTargetLabel(editing)} to ₱${editValue}? This applies everywhere immediately.`}
          confirmLabel="Save Changes"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Edit Legacy Dialog */}
      <Dialog
        open={!!legacyEditing}
        onOpenChange={(open) => {
          if (!open) closeLegacyEdit();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              Edit {legacyEditing?.label}
            </DialogTitle>
            <DialogDescription>{legacyEditing?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="legacy-pricing-value">Price</Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-500">₱</span>
                <Input
                  id="legacy-pricing-value"
                  type="number"
                  min="0"
                  step="0.5"
                  value={legacyEditValue}
                  onChange={(e) => setLegacyEditValue(e.target.value)}
                  placeholder="0"
                  className="h-11 bg-white text-sm"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {legacyEditing?.unit === "₱" ? "" : legacyEditing?.unit}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={closeLegacyEdit}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowLegacySaveConfirm(true)}
            >
              <Edit2 className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Legacy Rate Confirmation */}
      {showLegacySaveConfirm && legacyEditing && (
        <ConfirmationDialog
          open
          onOpenChange={setShowLegacySaveConfirm}
          onConfirm={handleLegacySave}
          title="Update Legacy Rate?"
          description={`Set "${legacyEditing.label}" to ₱${legacyEditValue}? The standard document flow uses this rate.`}
          confirmLabel="Save Changes"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Edit Payment Window Duration Dialog */}
      <Dialog
        open={!!durationTarget}
        onOpenChange={(open) => {
          if (!open) closeDurationEdit();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              Edit {durationTarget?.label}
            </DialogTitle>
            <DialogDescription>{durationTarget?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Set the payment window by</Label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100">
                {(Object.keys(DURATION_UNIT_MULTIPLIER) as DurationUnit[]).map(
                  (unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setDurUnit(unit)}
                      className={`h-9 rounded-lg text-sm font-semibold transition-all ${
                        durUnit === unit
                          ? "bg-white text-[#2F6FD6] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {DURATION_UNIT_LABELS[unit]}
                    </button>
                  )
                )}
              </div>
              <Label htmlFor="duration-window-value">
                {DURATION_UNIT_LABELS[durUnit]}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="duration-window-value"
                  type="number"
                  min="0"
                  step="1"
                  value={durValue}
                  onChange={(e) => setDurValue(e.target.value)}
                  placeholder="0"
                  className="h-11 bg-white text-sm"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {DURATION_UNIT_LABELS[durUnit].toLowerCase()}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Total window:{" "}
                <span className="font-semibold text-[#10316B]">
                  {formatDuration(durationTotalSeconds())}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Set 0 so orders never auto-expire while awaiting payment.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={closeDurationEdit}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowDurationSaveConfirm(true)}
            >
              <Edit2 className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Payment Window Confirmation */}
      {showDurationSaveConfirm && durationTarget && (
        <ConfirmationDialog
          open
          onOpenChange={setShowDurationSaveConfirm}
          onConfirm={handleDurationSave}
          title="Update Payment Window?"
          description={`Set "${durationTarget.label}" to ${formatDuration(durationTotalSeconds())}? Awaiting-payment orders will be auto-cancelled once this window passes.`}
          confirmLabel="Save Changes"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Reset Confirm */}
      {showResetConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={() => {
            if (!editing && !legacyEditing) setShowResetConfirm(false);
          }}
          onConfirm={confirmReset}
          title="Reset Pricing to Defaults?"
          description="Every service price and legacy rate returns to its default. This cannot be undone."
          confirmLabel="Reset Pricing"
          cancelLabel="Cancel"
          destructive
          requirePhrase
        />
      )}
    </Layout>
  );
}
