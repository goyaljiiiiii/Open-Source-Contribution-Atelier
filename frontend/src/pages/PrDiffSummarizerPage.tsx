import React, { useState } from "react";
import { SectionCard } from "../components/ui/SectionCard";
import { PrDiffSummarizer } from "../components/ui/PrDiffSummarizer";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "../components/ui/UnsavedChangesDialog";

export function PrDiffSummarizerPage() {
  const [isDirty, setIsDirty] = useState(false);

  const { isBlocked, message, stay, discard } = useUnsavedChanges({
    isDirty,
    message: "You have unsaved PR notes. Are you sure you want to leave?",
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      <SectionCard
        eyebrow="Contribution Workflow"
        title="PR Description Diff Summarizer"
      >
        <p className="max-w-3xl text-sm leading-6 text-muted dark:text-[#c4bbae] font-bold">
          Paste your changed files (or{" "}
          <code className="bg-surface-low dark:bg-black px-1.5 py-0.5 rounded font-mono">
            git diff --name-only
          </code>
          ) and get a beginner-friendly PR checklist + description template — no
          API keys, fully client-side.
        </p>
      </SectionCard>

      <PrDiffSummarizer onDirtyChange={setIsDirty} />

      <UnsavedChangesDialog
        open={isBlocked}
        message={message}
        onStay={stay}
        onDiscard={discard}
      />
    </div>
  );
}

export default PrDiffSummarizerPage;

