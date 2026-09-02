import React, { useMemo, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import SimpleMdeReact from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  id?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  id,
  className,
}: RichTextEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const options = useMemo(() => {
    return {
      spellChecker: false,
      placeholder: placeholder || "Type your markdown here...",
      status: ["lines", "words", "cursor"],
      toolbar: [
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "code",
        "table",
        "|",
        "preview",
        "side-by-side",
        /* Keep EasyMDE's own fullscreen in the toolbar; the custom header
           toggle below drives a full-viewport wrapper overlay (with the
           split-pane preview) that EasyMDE alone cannot provide. */
        "fullscreen",
        "|",
        "guide",
      ],
    } as any;
  }, [placeholder]);

  const toggleFullscreen = () => setIsFullscreen((fs) => !fs);

  /* When fullscreen, the wrapper becomes a fixed full-viewport overlay so the
     live preview split pane is also enlarged, not just the EasyMDE surface. */
  const wrapperClassName = `rich-text-editor-wrapper ${className || ""} ${disabled ? "opacity-60 pointer-events-none" : ""} ${
      isFullscreen
        ? "fixed inset-0 z-[9999] bg-surface dark:bg-[#0f0e0c] rounded-none border-4 border-black m-0"
        : ""
    }`;

  return (
    <div className={wrapperClassName} data-testid="rich-text-editor">
      {/* Header bar with the maximize/fullscreen toggle */}
      <div
        className={`flex items-center justify-between border-b-4 border-black dark:border-[#2e2924] bg-surface-lowest px-3 py-1.5 ${
          isFullscreen ? "bg-[#151411] dark:bg-[#0f0e0c]" : "bg-white dark:bg-[#151411]"
        }`}
      >
        <span className="text-xs font-black text-muted dark:text-[#c4bbae]">
          Editor
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Maximize editor"}
          aria-pressed={isFullscreen}
          className="inline-flex items-center justify-center rounded-lg border-2 border-black bg-white dark:bg-[#1f1c18] p-1.5 text-xs font-black text-black dark:text-[#f0ebe2] shadow-card-sm hover:bg-gray-100 dark:hover:bg-[#25211c] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="overflow-hidden bg-white dark:bg-[#151411]">
        <SimpleMdeReact
          id={id}
          value={value}
          onChange={onChange}
          options={options}
        />
      </div>
      {maxLength && (
        <p
          className={`text-xs font-black text-right mt-1 ${
            value.length > maxLength
              ? "text-red-600"
              : "text-muted dark:text-[#c4bbae]"
          }`}
        >
          {value.length} / {maxLength} characters
        </p>
      )}
    </div>
  );
}
