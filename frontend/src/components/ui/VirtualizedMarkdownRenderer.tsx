import React, { useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface VirtualizedMarkdownRendererProps {
  content: string;
}

function splitContentIntoSections(content: string): string[] {
  const lines = content.split("\n");
  const sections: string[] = [];
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ") && currentLines.length > 0) {
      sections.push(currentLines.join("\n"));
      currentLines = [line];
    } else if (line.startsWith("# ") && currentLines.length > 0) {
      sections.push(currentLines.join("\n"));
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push(currentLines.join("\n"));
  }

  return sections;
}

const SECTION_ESTIMATED_HEIGHT = 200;

function SectionRenderer({ content }: { content: string }) {
  return <MarkdownRenderer content={content} />;
}

export const VirtualizedMarkdownRenderer = React.memo(
  function VirtualizedMarkdownRenderer({
    content,
  }: VirtualizedMarkdownRendererProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    const sections = useMemo(() => splitContentIntoSections(content), [content]);

    const getEstimatedHeight = useCallback(() => SECTION_ESTIMATED_HEIGHT, []);

    const virtualizer = useVirtualizer({
      count: sections.length,
      getScrollElement: () => parentRef.current,
      estimateSize: getEstimatedHeight,
      overscan: 2,
    });

    if (sections.length <= 1) {
      return (
        <div className="space-y-2">
          <MarkdownRenderer content={content} />
        </div>
      );
    }

    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <SectionRenderer content={sections[virtualItem.index]} />
            </div>
          ))}
        </div>
      </div>
    );
  },
);
