// Admin Terms & Conditions / Privacy Policy editor.
// Management -> Terms & Privacy (/admin/legal). Edits the shared legal content
// shown on the landing footer, sign up, and checkout.

import React, { useState } from "react";
import {
  ScrollText,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  legalContentStore,
  stripSectionNumber,
  type LegalContent,
  type LegalSection,
} from "../../utils/legalContentStore";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { DetailSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import LegalPolicyDialog from "../shared/LegalPolicyDialog";

type SectionField = "termsSections" | "privacySections";

function PolicyCard({
  heading,
  hint,
  title,
  lastUpdated,
  sections,
  field,
  onTitleChange,
  onLastUpdatedChange,
  onSectionChange,
  onAdd,
  onRemove,
  onMove,
}: {
  heading: string;
  hint: string;
  field: SectionField;
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  onTitleChange: (v: string) => void;
  onLastUpdatedChange: (v: string) => void;
  onSectionChange: (index: number, partial: Partial<LegalSection>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{heading}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
        </div>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium text-slate-700">Heading</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">
              Last updated
            </Label>
            <Input
              value={lastUpdated}
              onChange={(e) => onLastUpdatedChange(e.target.value)}
              placeholder='e.g. "April 27, 2026"'
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-700">Sections</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-[#2F6FD6]/40 text-[#2F6FD6]"
            onClick={onAdd}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
          </Button>
        </div>

        <div className="space-y-3">
          {sections.map((section, i) => (
            <div
              key={i}
              id={`legal-section-${field}-${i}`}
              className="rounded-lg border border-slate-100 p-3 space-y-3 scroll-mt-28"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F2F7FF] text-xs font-semibold text-[#2F6FD6]">
                  {i + 1}
                </span>
                <Input
                  value={section.title}
                  onChange={(e) =>
                    onSectionChange(i, {
                      title: stripSectionNumber(e.target.value),
                    })
                  }
                  placeholder='e.g. "Acceptance of Terms"'
                  className="h-9 flex-1"
                />
                <button
                  type="button"
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-[#2F6FD6] hover:bg-[#F2F7FF] rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  title="Move section up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, 1)}
                  disabled={i === sections.length - 1}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-[#2F6FD6] hover:bg-[#F2F7FF] rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  title="Move section down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="shrink-0 p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Textarea
                value={section.body}
                onChange={(e) => onSectionChange(i, { body: e.target.value })}
                rows={5}
                placeholder="Write the section content here…"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LegalManagement() {
  const hydrating = useHydrating();
  const [content, setContent] = useState<LegalContent>(() =>
    legalContentStore.getContent(),
  );
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const patch = (partial: Partial<LegalContent>) =>
    setContent((prev) => ({ ...prev, ...partial }));

  const patchSection = (
    field: SectionField,
    index: number,
    partial: Partial<LegalSection>,
  ) => {
    setContent((prev) => ({
      ...prev,
      [field]: prev[field].map((s, i) => (i === index ? { ...s, ...partial } : s)),
    }));
  };

  const addSection = (field: SectionField) => {
    setContent((prev) => {
      const next = [...prev[field], { title: "", body: "" }];
      const newIndex = next.length - 1;
      window.setTimeout(() => {
        document
          .getElementById(`legal-section-${field}-${newIndex}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return { ...prev, [field]: next };
    });
  };

  const moveSection = (field: SectionField, index: number, direction: -1 | 1) => {
    setContent((prev) => {
      const arr = [...prev[field]];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...prev, [field]: arr };
    });
  };

  const removeSection = (field: SectionField, index: number) => {
    setContent((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    setShowSaveConfirm(false);
    try {
      const today = new Date().toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const withDates: LegalContent = {
        ...content,
        termsLastUpdated: today,
        privacyLastUpdated: today,
      };
      legalContentStore.saveContent(withDates);
      setContent(withDates);
      setShowSavedPopup(true);
    } catch {
      toast.error("Could not save your changes to browser storage. Please try again.");
    }
  };

  const handleReset = () => {
    try {
      legalContentStore.resetContent();
      setContent(legalContentStore.getContent());
      setShowResetConfirm(false);
      toast.success("Terms and privacy content reset to defaults.");
    } catch {
      setShowResetConfirm(false);
      toast.error("Could not reset the legal content. Please try again.");
    }
  };

  const handleClearAll = () => {
    setContent(prev => ({ ...prev, termsSections: [], privacySections: [] }));
    setShowClearAllConfirm(false);
    toast.success("All sections cleared.");
  };

  return (
    <Layout menuItems={adminMenuItems} title="Terms & Privacy" showBackButton>
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-2 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F2F7FF] text-[#1668D9] flex items-center justify-center shrink-0">
              <ScrollText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#10316B]">Terms &amp; Privacy</h2>
              <p className="text-gray-600 mt-1">
                Shown on the landing page, sign up and checkout. Changes apply as soon as you save.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 sm:h-10 w-full sm:w-auto bg-white border-2 border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setShowPreview(true)}
            >
              Preview
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-10 w-full sm:w-auto bg-white border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setShowResetConfirm(true)}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-10 w-full sm:w-auto bg-white border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setShowClearAllConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear All
            </Button>
            <Button
              onClick={() => setShowSaveConfirm(true)}
              className="h-11 sm:h-10 w-full sm:w-auto bg-white border-2 border-[#2F6FD6]/40 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white hover:-translate-y-0.5 hover:shadow-md"
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </div>

        {hydrating && <DetailSkeleton blocks={2} label="Loading policies" />}
        <div className={hydrating ? "hidden" : "grid grid-cols-1 lg:grid-cols-2 gap-5"}>
          <PolicyCard
            heading="Terms & Conditions"
            hint="Linked from the landing page footer, sign up and checkout."
            field="termsSections"
            title={content.termsTitle}
            lastUpdated={content.termsLastUpdated}
            sections={content.termsSections}
            onTitleChange={(v) => patch({ termsTitle: v })}
            onLastUpdatedChange={(v) => patch({ termsLastUpdated: v })}
            onSectionChange={(i, p) => patchSection("termsSections", i, p)}
            onAdd={() => addSection("termsSections")}
            onRemove={(i) => removeSection("termsSections", i)}
            onMove={(i, dir) => moveSection("termsSections", i, dir)}
          />
          <PolicyCard
            heading="Privacy Policy"
            hint="Linked from the landing page footer, sign up and checkout."
            field="privacySections"
            title={content.privacyTitle}
            lastUpdated={content.privacyLastUpdated}
            sections={content.privacySections}
            onTitleChange={(v) => patch({ privacyTitle: v })}
            onLastUpdatedChange={(v) => patch({ privacyLastUpdated: v })}
            onSectionChange={(i, p) => patchSection("privacySections", i, p)}
            onAdd={() => addSection("privacySections")}
            onRemove={(i) => removeSection("privacySections", i)}
            onMove={(i, dir) => moveSection("privacySections", i, dir)}
          />
        </div>

        <div className="flex justify-end rounded-xl border border-slate-200 bg-white p-3 shadow-sm mt-6 mb-2">
          <Button
            onClick={() => setShowSaveConfirm(true)}
            className="h-10 bg-[#2F6FD6] text-white hover:bg-[#2557b8]"
          >
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        title="Save changes?"
        description="Publish these edits everywhere the policies appear."
        confirmLabel="Save Changes"
        onConfirm={handleSave}
      />

      <ConfirmationDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset Terms & Privacy content?"
        description="The default Terms and Privacy text returns. This cannot be undone."
        confirmLabel="Reset Content"
        onConfirm={handleReset}
        requirePhrase
        destructive
      />

      <ConfirmationDialog
        open={showClearAllConfirm}
        onOpenChange={setShowClearAllConfirm}
        title="Clear all sections?"
        description="All Terms and Privacy sections will be removed. This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleClearAll}
        requirePhrase
        destructive
      />

      <ConfirmationDialog
        open={showSavedPopup}
        onOpenChange={setShowSavedPopup}
        title="Saved"
        description="Terms & Conditions, and Privacy policies have been saved and updated everywhere."
        confirmLabel="OK"
        onConfirm={() => setShowSavedPopup(false)}
        success
        hideCancel
      />

      <LegalPolicyDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        contentOverride={content}
        initialTab="terms"
      />
    </Layout>
  );
}
