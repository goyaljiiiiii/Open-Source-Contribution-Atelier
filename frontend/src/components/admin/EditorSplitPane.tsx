import React, { useState, useMemo } from "react";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import { LessonDraftData } from "../../hooks/useContentDraft";
import { LessonPreview } from "./LessonPreview";
import { Eye, Edit3, Columns } from "lucide-react";
import api from "../../api";

interface EditorSplitPaneProps {
  lesson: LessonDraftData;
  onChangeContent: (content: string) => void;
}

export function EditorSplitPane({
  lesson,
  onChangeContent,
}: EditorSplitPaneProps) {
  const [viewMode, setViewMode] = useState<"split" | "editor" | "preview">("split");

  const mdeOptions = useMemo(
    () => ({
      spellChecker: false,
      placeholder: "Write your lesson markdown content here...",
      status: false,
      toolbar: [
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "code",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "image",
      ],
      autosave: {
        enabled: false,
        uniqueId: `lesson-mde-${lesson.id || "new"}`,
      },
      uploadImage: true,
      imageUploadFunction: (
        file: File,
        onSuccess: (url: string) => void,
        onError: (error: string) => void,
      ) => {
        const formData = new FormData();
        formData.append("file", file);
        api
          .post<{ url: string }>("/uploads/", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          .then((res) => {
            if (res.data?.url) {
              onSuccess(res.data.url);
            } else {
              onError("Image upload failed");
            }
          })
          .catch((err) => {
            onError(err.message || "Failed to upload image");
          });
      },
    }),
    [lesson.id],
  );

  return (
    <div className="w-full flex flex-col gap-3 min-w-0">
      {/* View Mode Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-[#151411] border border-slate-200 dark:border-[#2e2924] rounded-xl shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>Editor View:</span>
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-[#0a0a0f] p-1 rounded-lg border border-slate-200 dark:border-[#2e2924]">
          <button
            onClick={() => setViewMode("editor")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
              viewMode === "editor"
                ? "bg-accent text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Code Editor
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
              viewMode === "split"
                ? "bg-accent text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Columns className="w-3.5 h-3.5" /> Split View
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
              viewMode === "preview"
                ? "bg-accent text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Live Preview
          </button>
        </div>
      </div>

      {/* Editor & Preview Workspace */}
      <div className="w-full min-w-0 flex flex-col 2xl:flex-row gap-4 h-[650px] items-stretch">
        {(viewMode === "editor" || viewMode === "split") && (
          <div
            className={`min-w-0 h-full p-3 bg-white dark:bg-[#151411] border-2 border-slate-200 dark:border-[#2e2924] rounded-xl flex flex-col overflow-hidden shadow-sm ${
              viewMode === "split" ? "w-full 2xl:w-1/2" : "w-full"
            }`}
          >
            <div className="text-xs font-bold text-slate-500 dark:text-[#a0988c] pb-2 border-b border-slate-200 dark:border-[#2e2924] flex items-center justify-between shrink-0">
              <span>Markdown Code Editor</span>
              <span className="text-[11px] font-mono text-slate-400">
                {(lesson.content || "").length} characters
              </span>
            </div>
            <div className="flex-1 overflow-y-auto pt-2 text-slate-900 dark:text-[#f0ebe2] min-w-0">
              <SimpleMDE
                value={lesson.content || ""}
                onChange={onChangeContent}
                options={mdeOptions as any}
              />
            </div>
          </div>
        )}

        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className={`min-w-0 h-full overflow-hidden ${
              viewMode === "split" ? "w-full 2xl:w-1/2" : "w-full"
            }`}
          >
            <LessonPreview lesson={lesson} />
          </div>
        )}
      </div>
    </div>
  );
}
