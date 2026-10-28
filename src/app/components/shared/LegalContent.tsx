// Shared rendering for the Terms & Conditions / Privacy Policy content.
// Reads from legalContentStore (unless a content override is passed, which the
// admin Terms & Privacy editor uses to preview unsaved edits).

import React, { useState, useEffect } from "react";
import {
  legalContentStore,
  type LegalContent,
} from "../../utils/legalContentStore";

export type PolicyTab = "terms" | "privacy";

export function useLegalContent(contentOverride?: LegalContent): LegalContent {
  const [content, setContent] = useState<LegalContent>(() =>
    contentOverride ?? legalContentStore.getContent(),
  );

  useEffect(() => {
    if (contentOverride) {
      setContent(contentOverride);
      return;
    }
    const load = () => setContent(legalContentStore.getContent());
    return legalContentStore.subscribe(load);
  }, [contentOverride]);

  return content;
}

// Renders a stored body string. A line starting with "- " becomes a bullet
// list item; blank lines separate paragraphs.
export function renderLegalBody(body: string): React.ReactNode[] {
  const blocks = body.split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    const isList = lines.every((line) => line.startsWith("- "));
    if (isList) {
      return (
        <ul key={i} className="list-disc ml-6 mt-2 space-y-1">
          {lines.map((line, j) => (
            <li key={j}>{line.slice(2)}</li>
          ))}
        </ul>
      );
    }
    return <p key={i} className="mb-4 last:mb-0">{lines.join(" ")}</p>;
  });
}

export function LegalBody({
  content,
  tab,
}: {
  content: LegalContent;
  tab: PolicyTab;
}) {
  const isTerms = tab === "terms";
  const sections = isTerms ? content.termsSections : content.privacySections;
  return (
    <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
      {sections.map((section, i) => (
        <section key={i}>
          <h3 className="font-semibold text-[#10316B] mb-2">
            {i + 1}. {section.title}
          </h3>
          {renderLegalBody(section.body)}
        </section>
      ))}
    </div>
  );
}