// Shared Terms & Conditions / Privacy Policy dialog.
// Used at checkout, the landing footer, and sign up so users can read the
// policies before agreeing. Content comes from legalContentStore (edited by
// the admin Terms & Privacy page); an optional contentOverride lets the admin
// preview unsaved edits.

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { FileText, ShieldCheck } from "lucide-react";
import { useLegalContent, LegalBody, type PolicyTab } from "./LegalContent";
import type { LegalContent as LegalContentType } from "../../utils/legalContentStore";

export default function LegalPolicyDialog({
  open,
  onOpenChange,
  initialTab = "terms",
  contentOverride,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: PolicyTab;
  contentOverride?: LegalContentType;
}) {
  const [tab, setTab] = useState<PolicyTab>(initialTab);
  const content = useLegalContent(contentOverride);
  const isTerms = tab === "terms";
  const title = isTerms ? content.termsTitle : content.privacyTitle;
  const lastUpdated = isTerms
    ? content.termsLastUpdated
    : content.privacyLastUpdated;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#10316B]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Last updated: {lastUpdated}
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800">
          <strong>Draft — for review only.</strong> These policies are a
          placeholder pending client approval and are not yet finalized legal
          text.
        </div>

        <div className="flex gap-2">
          <Button
            variant={isTerms ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("terms")}
            className={
              isTerms
                ? "bg-[#1668D9] text-white"
                : "border-blue-200 text-[#1668D9] hover:bg-[#F2F7FF]"
            }
          >
            <FileText className="w-4 h-4 mr-1" /> Terms & Conditions
          </Button>
          <Button
            variant={isTerms ? "outline" : "default"}
            size="sm"
            onClick={() => setTab("privacy")}
            className={
              isTerms
                ? "border-blue-200 text-[#1668D9] hover:bg-[#F2F7FF]"
                : "bg-[#1668D9] text-white"
            }
          >
            <ShieldCheck className="w-4 h-4 mr-1" /> Privacy Policy
          </Button>
        </div>

        <LegalBody content={content} tab={tab} />

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto h-10"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}