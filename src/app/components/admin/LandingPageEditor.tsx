import React, { useRef, useState } from "react";
import {
  MonitorPlay,
  Save,
  RotateCcw,
  ExternalLink,
  X,
  Plus,
  Trash2,
  Eye,
  Upload,
  MapPin,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import LandingPage from "../LandingPage";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  landingContentStore,
  DEFAULT_MAP_EMBED,
  type LandingPageContent,
  type ServiceCardContent,
} from "../../utils/landingContentStore";
import { useLogo } from "../../hooks/useLogo";
import { logoStore } from "../../utils/logoStore";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { DetailSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";

const sectionCards = [
  { id: "logo", label: "Logo", icon: <Eye className="w-4 h-4" /> },
  { id: "auth", label: "Login & Registration", icon: <LogIn className="w-4 h-4" /> },
  { id: "hero", label: "Top Section", icon: <Eye className="w-4 h-4" /> },
  { id: "features", label: "Features", icon: <Eye className="w-4 h-4" /> },
  { id: "services", label: "Services & Prices", icon: <Eye className="w-4 h-4" /> },
  { id: "shop-info", label: "Shop Information", icon: <Eye className="w-4 h-4" /> },
  { id: "about", label: "About Docufy PSMS", icon: <Eye className="w-4 h-4" /> },
];

function EditorCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle && (
        <p className="mt-0.5 text-sm text-slate-500 mb-3">{subtitle}</p>
      )}
      <div className="mt-1 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="mt-1.5"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5"
        />
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function LandingPageEditor() {
  const hydrating = useHydrating();
  const [content, setContent] = useState<LandingPageContent>(() =>
    landingContentStore.getContent(),
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [showAuthBgPreview, setShowAuthBgPreview] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const logo = useLogo();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const authBgInputRef = useRef<HTMLInputElement>(null);
  const [showLogoResetConfirm, setShowLogoResetConfirm] = useState(false);
  const [showAuthBgResetConfirm, setShowAuthBgResetConfirm] = useState(false);

  const handleLogoUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP, SVG, or GIF).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Logo image is too large. Please use an image under 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logoStore.setLogo(reader.result as string);
      toast.success("Logo updated. It now appears across the whole system.");
    };
    reader.onerror = () => toast.error("Could not read the logo file.");
    reader.readAsDataURL(file);
  };

  const handleLogoReset = () => {
    logoStore.resetLogo();
    setShowLogoResetConfirm(false);
    toast.success("Logo reset to the default Docufy logo.");
  };

  const handleAuthBgUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image is too large. Please use an image under 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({ authBackgroundUrl: reader.result as string });
      toast.success("Background photo set. Click Save Changes to apply it.");
    };
    reader.onerror = () => toast.error("Could not read the image file.");
    reader.readAsDataURL(file);
  };

  const handleAuthBgReset = () => {
    patch({ authBackgroundUrl: "" });
    setShowAuthBgResetConfirm(false);
    toast.success("Background reset to default. Save Changes to apply it.");
  };

  const patch = (partial: Partial<LandingPageContent>) => {
    setContent((prev) => ({ ...prev, ...partial }));
  };

  const patchServiceCard = (index: number, partial: Partial<ServiceCardContent>) => {
    setContent((prev) => {
      const serviceCards = prev.serviceCards.map((card, i) =>
        i === index ? { ...card, ...partial } : card,
      );
      return { ...prev, serviceCards };
    });
  };

  const patchServiceDetail = (
    index: number,
    detailIndex: number,
    field: "label" | "value",
    value: string,
  ) => {
    setContent((prev) => {
      const serviceCards = prev.serviceCards.map((card, i) => {
        if (i !== index) return card;
        const details = card.details.map((d, j) =>
          j === detailIndex ? { ...d, [field]: value } : d,
        );
        return { ...card, details };
      });
      return { ...prev, serviceCards };
    });
  };

  const patchShopHours = (index: number, field: "label" | "hours", value: string) => {
    setContent((prev) => {
      const shopHours = prev.shopHours.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      );
      return { ...prev, shopHours };
    });
  };

  const addShopHour = () => {
    setContent((prev) => ({
      ...prev,
      shopHours: [...prev.shopHours, { label: "", hours: "" }],
    }));
  };

  const removeShopHour = (index: number) => {
    setContent((prev) => ({
      ...prev,
      shopHours: prev.shopHours.filter((_, i) => i !== index),
    }));
  };

  const patchLocationLine = (index: number, value: string) => {
    setContent((prev) => ({
      ...prev,
      locationLines: prev.locationLines.map((line, i) => (i === index ? value : line)),
    }));
  };

  const addLocationLine = () => {
    setContent((prev) => ({
      ...prev,
      locationLines: [...prev.locationLines, ""],
    }));
  };

  const removeLocationLine = (index: number) => {
    setContent((prev) => ({
      ...prev,
      locationLines: prev.locationLines.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    setShowSaveConfirm(false);
    try {
      landingContentStore.saveContent(content);
      toast.success("Changes saved successfully. The landing page is now updated.");
    } catch {
      toast.error("Could not save your changes to browser storage. Please try again.");
    }
  };

  const handleReset = () => {
    try {
      landingContentStore.resetContent();
      setContent(landingContentStore.getContent());
      setShowResetConfirm(false);
      toast.success("Landing page content reset to defaults.");
    } catch {
      setShowResetConfirm(false);
      toast.error("Could not reset landing page content. Please try again.");
    }
  };

  return (
    <Layout menuItems={adminMenuItems} title="Landing Page" showBackButton>
      <div className="space-y-5">
        {/* Actions header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-2 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F2F7FF] text-[#1668D9] flex items-center justify-center shrink-0">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#10316B]">Landing Page</h2>
              <p className="text-gray-600 mt-1">
                Edit the text visitors see on the public landing page. Changes
                apply as soon as you save.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 sm:h-10 w-full sm:w-auto border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-10 w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowResetConfirm(true)}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button
              onClick={() => setShowSaveConfirm(true)}
              className="h-11 sm:h-10 w-full sm:w-auto bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </div>

        {hydrating && <DetailSkeleton blocks={3} label="Loading landing page content" />}
        <div className={hydrating ? "hidden" : "grid grid-cols-1 lg:grid-cols-4 gap-5"}>
          {/* Section nav (desktop) */}
          <Card className="hidden lg:flex flex-col gap-1 p-3 bg-white self-start sticky top-6">
            <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              On this page
            </p>
            {sectionCards.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#F2F7FF] hover:text-[#2F6FD6] transition-colors"
              >
                <span className="text-[#2F6FD6]/70">{sec.icon}</span>
                {sec.label}
              </a>
            ))}
          </Card>

          {/* Editor body */}
          <div className="lg:col-span-3 space-y-5">
            {/* Logo */}
            <div id="logo" className="scroll-mt-28">
              <EditorCard
                title="Logo"
                subtitle="Shown in the sidebar, header, landing page and login."
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-slate-100 p-4">
                  <div className="w-16 h-16 shrink-0 rounded-full border border-slate-200 bg-white p-1 shadow-sm flex items-center justify-center">
                    <img
                      src={logo}
                      alt="Docufy Logo"
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {logoStore.hasCustomLogo() ? "Custom logo in use" : "Default logo in use"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Upload a new logo to apply it everywhere instantly. The default logo is always kept and can be restored anytime.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:h-10 w-full sm:w-auto border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Upload Logo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:h-10 w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setShowLogoResetConfirm(true)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset Logo
                  </Button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      handleLogoUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </EditorCard>
            </div>

            {/* Login & Registration */}
            <div id="auth" className="scroll-mt-28">
              <EditorCard
                title="Login & Registration"
                subtitle="Photo behind the sign-in form."
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-slate-100 p-4">
                  <div className="w-28 h-16 shrink-0 rounded-lg border border-slate-200 bg-[#1c1f26] overflow-hidden flex items-center justify-center">
                    {content.authBackgroundUrl ? (
                      <img
                        src={content.authBackgroundUrl}
                        alt="Login background"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[11px] font-medium text-white/70">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {content.authBackgroundUrl
                        ? "Custom photo in use"
                        : "Default photo in use"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Shown on the Log in and Create account pages. A dark shade
                      is added over custom photos so the text stays readable.
                      Changes apply once you click Save Changes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:h-10 w-full sm:w-auto border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
                    onClick={() => authBgInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Upload Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:h-10 w-full sm:w-auto border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
                    onClick={() => setShowAuthBgPreview(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" /> Preview
                  </Button>
                  {content.authBackgroundUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 sm:h-10 w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setShowAuthBgResetConfirm(true)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" /> Reset to Default
                    </Button>
                  )}
                  <input
                    ref={authBgInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleAuthBgUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </EditorCard>
            </div>

            {/* Top Section */}
            <div id="hero" className="scroll-mt-28">
              <EditorCard
                title="Top Section"
              >
                <Field
                  label="Main Title"
                  value={content.heroTitle}
                  onChange={(v) => patch({ heroTitle: v })}
                  hint='Each comma starts a new line. Append "#b" to the line you want highlighted blue — e.g. "Print, Track #b, Succeed".'
                />
                <Field
                  label="Subtitle"
                  value={content.heroSubtitle}
                  onChange={(v) => patch({ heroSubtitle: v })}
                />
                <Field
                  label="Description"
                  value={content.heroDescription}
                  onChange={(v) => patch({ heroDescription: v })}
                  multiline
                />
              </EditorCard>
            </div>

            {/* Features */}
            <div id="features" className="scroll-mt-28">
              <EditorCard
                title="Features"
                subtitle="Highlights under Get Started."
              >
                {(
                  [
                    [1, "feature1", "feature1Sub"],
                    [2, "feature2", "feature2Sub"],
                    [3, "feature3", "feature3Sub"],
                  ] as Array<[number, "feature1" | "feature2" | "feature3", "feature1Sub" | "feature2Sub" | "feature3Sub"]>
                ).map(([num, titleKey, subKey]) => (
                  <div
                    key={num}
                    className="rounded-lg border border-slate-100 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F2F7FF] text-xs font-semibold text-[#2F6FD6]">
                        {num}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">Feature {num}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Feature Name"
                        value={content[titleKey]}
                        onChange={(v) => patch({ [titleKey]: v } as Partial<LandingPageContent>)}
                        hint="Short heading for this feature."
                      />
                      <Field
                        label="Feature Description"
                        value={content[subKey]}
                        onChange={(v) => patch({ [subKey]: v } as Partial<LandingPageContent>)}
                        hint="One short line that explains the feature."
                      />
                    </div>
                  </div>
                ))}
              </EditorCard>
            </div>

            {/* Services & Prices */}
            <div id="services" className="scroll-mt-28">
              <EditorCard
                title="Services & Prices"
                subtitle="Prices are set in Pricing Management."
              >
                {content.serviceCards.map((card, index) => (
                  <div key={index} className="rounded-lg border border-slate-100 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F2F7FF] text-xs font-semibold text-[#2F6FD6]">
                        {index + 1}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-800">
                        {card.title || `Service ${index + 1}`}
                      </h4>
                      {card.badge && (
                        <span className="rounded-full bg-[#F2F7FF] px-2 py-0.5 text-[11px] font-semibold text-[#2F6FD6]">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Service Name"
                        value={card.title}
                        onChange={(v) => patchServiceCard(index, { title: v })}
                        hint='e.g. "Black &amp; White Printing"'
                      />
                      <Field
                        label="Tag (optional)"
                        value={card.badge ?? ""}
                        onChange={(v) => patchServiceCard(index, { badge: v })}
                        hint='e.g. "POPULAR"'
                      />
                    </div>
                    <Field
                      label="Description"
                      value={card.description}
                      onChange={(v) => patchServiceCard(index, { description: v })}
                      hint="A short sentence explaining this service."
                    />
                    {card.details.map((detail, di) => (
                      <div key={di} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field
                          label="Option Name"
                          value={detail.label}
                          onChange={(v) => patchServiceDetail(index, di, "label", v)}
                          hint='e.g. "Paper sizes"'
                        />
                        <Field
                          label="Option Details"
                          value={detail.value}
                          onChange={(v) => patchServiceDetail(index, di, "value", v)}
                          hint='e.g. "Short · A4 · Long"'
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </EditorCard>
            </div>

            {/* Shop Information */}
            <div id="shop-info" className="scroll-mt-28">
              <EditorCard
                title="Shop Information"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium text-slate-700">Shop Hours</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF]"
                      onClick={addShopHour}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Hours
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {content.shopHours.map((row, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          value={row.label}
                          onChange={(e) => patchShopHours(i, "label", e.target.value)}
                          placeholder="Days (e.g. Monday - Friday)"
                          className="flex-1 h-9"
                        />
                        <Input
                          value={row.hours}
                          onChange={(e) => patchShopHours(i, "hours", e.target.value)}
                          placeholder="Hours (e.g. 9:00 AM - 5:00 PM)"
                          className="flex-1 h-9"
                        />
                        <button
                          type="button"
                          onClick={() => removeShopHour(i)}
                          className="shrink-0 p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove hours"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <Field
                  label="Hours note (shown below the schedule)"
                  value={content.hoursNote}
                  onChange={(v) => patch({ hoursNote: v })}
                />
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Pickup deadline — shop closing time
                  </Label>
                  <Input
                    type="time"
                    value={content.shopClosingTime}
                    onChange={(e) => patch({ shopClosingTime: e.target.value })}
                    className="mt-1.5 h-9 w-full sm:w-48"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Cash-on-Pickup orders not collected by this time on the day they
                    become ready count as unclaimed. Leave blank to disable unclaimed
                    tracking — no pickup deadline can be computed without it.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium text-slate-700">Location</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF]"
                      onClick={addLocationLine}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {content.locationLines.map((line, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          value={line}
                          onChange={(e) => patchLocationLine(i, e.target.value)}
                          placeholder='e.g. "Room 4, TBI Building"'
                          className="flex-1 h-9"
                        />
                        <button
                          type="button"
                          onClick={() => removeLocationLine(i)}
                          className="shrink-0 p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-slate-700">
                      Google Maps embed link
                    </Label>
                    <Input
                      value={content.mapEmbedUrl}
                      onChange={(e) => patch({ mapEmbedUrl: e.target.value })}
                      placeholder="Paste the Google Maps 'Embed a map' link here…"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="sm:mt-[26px] shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 sm:h-10 w-full sm:w-auto border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
                      onClick={() => setShowMapPreview(true)}
                    >
                      <MapPin className="w-4 h-4 mr-2" /> Preview Map
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Shown on the landing page and the customer's Shop Location window.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Contact Email"
                    value={content.contactEmail}
                    onChange={(v) => patch({ contactEmail: v })}
                    hint='e.g. "printwithdocufy@gmail.com" — shown in the landing page footer.'
                  />
                  <Field
                    label="Facebook Page Name"
                    value={content.facebookPage}
                    onChange={(v) => patch({ facebookPage: v })}
                    hint='e.g. "Docufy" — shown in the landing page footer.'
                  />
                </div>
                <Field
                  label="Facebook Page Link"
                  value={content.facebookPageUrl}
                  onChange={(v) => patch({ facebookPageUrl: v })}
                  hint='e.g. "https://www.facebook.com/Docufy" — where the page name links to.'
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Facebook Account / Messenger Name"
                    value={content.facebookMessenger}
                    onChange={(v) => patch({ facebookMessenger: v })}
                    hint='e.g. "Docufy Printing" — shown in the landing page footer.'
                  />
                  <Field
                    label="Messenger Link"
                    value={content.facebookMessengerUrl}
                    onChange={(v) => patch({ facebookMessengerUrl: v })}
                    hint='e.g. "https://m.me/DocufyPrinting" — where the account links to.'
                  />
                </div>

                <div className="rounded-lg border border-blue-100 bg-[#F2F7FF] p-3 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-[#1668D9]">
                    How to change the map location:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Open{" "}
                      <a
                        href="https://www.google.com/maps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#1668D9] underline decoration-[#1668D9]/30 hover:text-[#10316B]"
                      >
                        Google Maps
                      </a>{" "}
                      and search for your shop's location (or drop a pin on the map).
                    </li>
                    <li>Click <span className="font-medium">Share</span> in the location panel (or right-click the map and choose &quot;Share&quot;).</li>
                    <li>Switch to the <span className="font-medium">Embed a map</span> tab and click the copy icon to copy the &quot;Embed a map&quot; link.</li>
                    <li>Paste that link into the field above, then click <span className="font-medium">Save Changes</span>.</li>
                  </ol>
                  <p className="pt-1 text-slate-500">
                    The map preview only shows on the live page and the customer
                    dashboard — clicking Save applies it everywhere at once.
                  </p>
                </div>
              </EditorCard>
            </div>

            {/* About Docufy PSMS */}
            <div id="about" className="scroll-mt-28">
              <EditorCard
                title="About Docufy PSMS"
              >
                <Field
                  label="Title"
                  value={content.aboutTitle}
                  onChange={(v) => patch({ aboutTitle: v })}
                />
                <Field
                  label="Subtitle"
                  value={content.aboutSubtitle}
                  onChange={(v) => patch({ aboutSubtitle: v })}
                />
                <Field
                  label="Description"
                  value={content.aboutBody}
                  onChange={(v) => patch({ aboutBody: v })}
                  multiline
                />
              </EditorCard>
            </div>

            {/* Footer save */}
            <div className="flex justify-end rounded-lg border border-slate-100 bg-white p-3 mt-6 mb-2">
              <Button
                onClick={() => setShowSaveConfirm(true)}
                className="h-10 bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
              >
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset landing page content?"
        description="Default text returns to the public landing page. This cannot be undone."
        confirmLabel="Reset Content"
        onConfirm={handleReset}
        requirePhrase
        destructive
      />

      <ConfirmationDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        title="Save changes?"
        description="Publish these edits to the public landing page."
        confirmLabel="Save Changes"
        onConfirm={handleSave}
      />

      <ConfirmationDialog
        open={showLogoResetConfirm}
        onOpenChange={setShowLogoResetConfirm}
        title="Reset logo?"
        description="The default Docufy logo returns everywhere. This cannot be undone."
        confirmLabel="Reset Logo"
        onConfirm={handleLogoReset}
        destructive
      />

      <ConfirmationDialog
        open={showAuthBgResetConfirm}
        onOpenChange={setShowAuthBgResetConfirm}
        title="Reset the login background photo?"
        description="The default photo returns to the Log in and Create account pages. Save Changes still applies it."
        confirmLabel="Reset Photo"
        onConfirm={handleAuthBgReset}
        destructive
      />

      <Dialog open={showAuthBgPreview} onOpenChange={setShowAuthBgPreview}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-[#2F6FD6]" /> Login &amp; Registration Preview
            </DialogTitle>
            <DialogDescription>
              The photo below appears on the darker side of the Log in and
              Create account pages. Save Changes to apply it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 overflow-hidden grid grid-cols-1 sm:grid-cols-2 min-h-[280px]">
              <div className="relative bg-[#1c1f26] flex items-center justify-center p-6 min-h-[200px]">
                {content.authBackgroundUrl ? (
                  <>
                    <img
                      src={content.authBackgroundUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/45" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1c1f26] to-[#2F3B4F] opacity-90" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-white p-1 mx-auto mb-3 flex items-center justify-center">
                    <img
                      src={logo}
                      alt="Docufy Logo"
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                  <p className="text-white font-bold text-lg">Log in</p>
                  <p className="text-white/70 text-xs">Docufy PSMS</p>
                </div>
              </div>
              <div className="bg-white flex items-center justify-center p-6">
                <p className="text-xs text-slate-400 text-center">
                  This side shows the Log in form and its fields.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden grid grid-cols-1 sm:grid-cols-2 min-h-[280px]">
              <div className="relative bg-[#10316B] flex items-center justify-center p-6 min-h-[200px]">
                {content.authBackgroundUrl ? (
                  <>
                    <img
                      src={content.authBackgroundUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/45" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#10316B] to-[#2F6FD6] opacity-90" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-white p-1 mx-auto mb-3 flex items-center justify-center">
                    <img
                      src={logo}
                      alt="Docufy Logo"
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                  <p className="text-white font-bold text-lg">Create account</p>
                  <p className="text-white/70 text-xs">Docufy PSMS</p>
                </div>
              </div>
              <div className="bg-white flex items-center justify-center p-6">
                <p className="text-xs text-slate-400 text-center">
                  This side shows the registration form and its fields.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMapPreview} onOpenChange={setShowMapPreview}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#2F6FD6]" /> Map Preview
            </DialogTitle>
            <DialogDescription>
              This is how the embed link above appears to visitors. Save
              Changes to apply it to the landing page and customer Shop Location window.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <iframe
              src={content.mapEmbedUrl || DEFAULT_MAP_EMBED}
              title="Google Maps preview"
              className="w-full h-[380px] sm:h-[480px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>

      {showPreview && (
        <div className="fixed inset-0 z-[100] bg-[#F2F7FF]">
          <div className="h-full overflow-y-auto overscroll-contain">
            <LandingPage contentOverride={content} />
          </div>
          <div className="fixed top-4 left-1/2 z-[60] -translate-x-1/2 flex gap-2">
            <Button
              variant="outline"
              className="h-11 border-[#2F6FD6]/40 bg-white text-[#2F6FD6] shadow-md hover:bg-[#F2F7FF] hover:text-[#2F6FD6]"
              onClick={() => setShowPreview(false)}
            >
              <X className="w-4 h-4 mr-2" /> Close Preview
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}