import React, { useState, useEffect } from "react";
import {
  FileText,
  Folder,
  Plus,
  Trash2,
  Download,
  Upload,
  Eye,
  Edit3,
  Check,
  Tag,
  Clock,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Columns,
  Search,
  Sparkles,
  Layers,
  BookMarked,
  Terminal,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { MarkdownRenderer } from "../../components/ui/MarkdownRenderer";
import { ContentSuggestionsPanel } from "../../components/admin/ContentSuggestionsPanel";


export interface QuizItem {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface NoteItem {
  id: string;
  folderId: string;
  title: string;
  content: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  updatedAt: string;
  quizzes: QuizItem[];
}

export interface FolderItem {
  id: string;
  title: string;
  icon: string;
  color: string;
}

const DEFAULT_FOLDERS: FolderItem[] = [
  { id: "folder-git", title: "Git & Branch Workflows", icon: "git", color: "from-amber-500/20 to-orange-500/10 border-amber-500/30" },
  { id: "folder-opensource", title: "Open Source Etiquette", icon: "community", color: "from-blue-500/20 to-indigo-500/10 border-blue-500/30" },
  { id: "folder-devops", title: "DevOps & CLI Reference", icon: "devops", color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30" },
];

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: "note-1",
    folderId: "folder-git",
    title: "Git Rebase & Interactive Squashing",
    content: `# Git Rebase & Branching Masterclass

## 🚀 Interactive Rebase Commands

\`\`\`bash
# Rebase feature branch onto latest main
git fetch origin
git rebase origin/main

# Squash last 3 commits into one clean commit
git rebase -i HEAD~3

# Abort if conflicts get messy
git rebase --abort
\`\`\`

> 💡 **Pro-Tip**: Always run \`git status\` to verify working directory before continuing.
`,
    tags: ["git", "rebase", "cli"],
    difficulty: "beginner",
    estimatedMinutes: 5,
    updatedAt: new Date().toISOString(),
    quizzes: [
      {
        id: 1,
        question: "What flag allows interactive commit squashing during a rebase?",
        options: ["-i or --interactive", "-f or --force", "-m or --message", "-b or --branch"],
        answer: 0,
        explanation: "git rebase -i opens an interactive editor to pick, squash, or edit commits.",
      },
    ],
  },
  {
    id: "note-2",
    folderId: "folder-opensource",
    title: "Maintainer Code Review & PR Tone Guide",
    content: `# Code Review & Communication Etiquette

## 📖 Key Maintainer Principles

1. **Be Constructive**: Explain the rationale behind requested changes.
2. **Highlight Excellence**: Applaud well-tested modules and clean code.
3. **Use Nitpick Labels**: Mark non-blocking comments as \`[nit]\`.

\`\`\`typescript
// Example: Safe Nullish Coalescing
const userEmail = response?.data?.user?.email ?? "N/A";
\`\`\`
`,
    tags: ["code-review", "open-source"],
    difficulty: "intermediate",
    estimatedMinutes: 8,
    updatedAt: new Date().toISOString(),
    quizzes: [],
  },
];

export function ContentStudioPage() {
  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const saved = localStorage.getItem("atelier_notes_folders_v3");
      return saved ? JSON.parse(saved) : DEFAULT_FOLDERS;
    } catch {
      return DEFAULT_FOLDERS;
    }
  });

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem("atelier_notes_items_v3");
      return saved ? JSON.parse(saved) : DEFAULT_NOTES;
    } catch {
      return DEFAULT_NOTES;
    }
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => notes[0]?.id || "");
  const [viewMode, setViewMode] = useState<"split" | "editor" | "preview" | "meta" | "quizzes">("split");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Auto-persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("atelier_notes_folders_v3", JSON.stringify(folders));
    } catch {}
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem("atelier_notes_items_v3", JSON.stringify(notes));
    } catch {}
  }, [notes]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const updateActiveNote = (updates: Partial<NoteItem>) => {
    if (!activeNote) return;
    setSaveStatus("saving");
    const updated = { ...activeNote, ...updates, updatedAt: new Date().toISOString() };
    setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? updated : n)));
    setTimeout(() => setSaveStatus("saved"), 300);
  };

  const handleAddFolder = () => {
    const title = prompt("New Category Folder Name:", "New Category");
    if (!title) return;
    const colors = [
      "from-amber-500/20 to-orange-500/10 border-amber-500/30",
      "from-blue-500/20 to-indigo-500/10 border-blue-500/30",
      "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
      "from-purple-500/20 to-pink-500/10 border-purple-500/30",
    ];
    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      title,
      icon: "git",
      color: colors[folders.length % colors.length],
    };
    setFolders((prev) => [...prev, newFolder]);
    toast.success(`Category "${title}" added!`);
  };

  const handleAddNote = (folderId: string) => {
    const title = prompt("New Note Title:", "New Study Note");
    if (!title) return;
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      folderId,
      title,
      content: `# ${title}\n\nStart typing notes or code snippets...\n\n\`\`\`typescript\nfunction demo() {\n  return "Atelier Knowledge Studio";\n}\n\`\`\`\n`,
      tags: ["notes"],
      difficulty: "beginner",
      estimatedMinutes: 5,
      updatedAt: new Date().toISOString(),
      quizzes: [],
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    toast.success(`Note "${title}" created!`);
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this study note?")) return;
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (activeNoteId === id && remaining.length > 0) setActiveNoteId(remaining[0].id);
    toast.success("Note removed");
  };

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this category folder and its notes?")) return;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) => prev.filter((n) => n.folderId !== id));
    toast.success("Category folder removed");
  };

  const handleInsertFormatting = (prefix: string, suffix: string = "") => {
    if (!activeNote) return;
    const textarea = document.getElementById("studio-content-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = activeNote.content.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const newContent = activeNote.content.substring(0, start) + replacement + activeNote.content.substring(end);
    updateActiveNote({ content: newContent });
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        updateActiveNote({ content });
        toast.success(`Imported "${file.name}" into study note!`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportNotes = () => {
    const jsonStr = JSON.stringify({ folders, notes }, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atelier-knowledge-studio.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Knowledge Studio exported!");
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Symmetrical Header Deck */}
      <div className="w-full bg-gradient-to-r from-[#181528] via-[#13111f] to-[#0d0c14] border-2 border-black/10 dark:border-[#2e2924] rounded-3xl p-6 shadow-card-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400 shadow-card-sm">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Studio Deck &amp; Knowledge Base
              </h1>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Sync
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              Personalized Knowledge Vault • Git Cheat Sheets, Code Snippets &amp; Custom Annotations
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-300">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{saveStatus === "saving" ? "Saving..." : "100% Persisted"}</span>
          </div>

          <label className="flex items-center gap-1.5 text-xs font-black px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-all shadow-card-sm">
            <Upload className="w-4 h-4" /> Import .md
            <input type="file" accept=".md,.txt" onChange={handleImportMarkdown} className="hidden" />
          </label>

          <button
            onClick={handleExportNotes}
            className="flex items-center gap-1.5 text-xs font-black px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-card-sm"
          >
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>
      </div>

      {/* Main Symmetrical Workspace: Left Directory Deck + Right Editor Deck */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Category Cards & Notes Directory (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4 w-full min-w-0">
          {/* Directory Search & Add Bar */}
          <div className="bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl p-4 space-y-3 shadow-card-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-black text-base text-text dark:text-[#f0ebe2] flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-indigo-500" /> Knowledge Folders
              </h2>
              <button
                onClick={handleAddFolder}
                className="flex items-center gap-1 text-xs font-black px-3 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-card-sm"
              >
                <Plus className="w-3.5 h-3.5" /> New Folder
              </button>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-low dark:bg-[#0f0e0c] border border-black/10 dark:border-[#2e2924] rounded-xl text-muted text-xs">
              <Search className="w-4 h-4 shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-text dark:text-[#f0ebe2] placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Folder & Notes Grid Cards */}
          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
            {folders.map((folder) => {
              const folderNotes = filteredNotes.filter((n) => n.folderId === folder.id);
              const isCollapsed = collapsedFolders[folder.id];

              return (
                <div
                  key={folder.id}
                  className={`bg-gradient-to-br ${folder.color} bg-white dark:bg-[#151411] border-2 rounded-2xl overflow-hidden shadow-card-sm transition-all`}
                >
                  {/* Folder Card Title Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-surface-low/80 dark:bg-[#1a1714] border-b border-black/10 dark:border-[#2e2924]">
                    <button
                      onClick={() =>
                        setCollapsedFolders((prev) => ({
                          ...prev,
                          [folder.id]: !prev[folder.id],
                        }))
                      }
                      className="flex items-center gap-2.5 font-bold text-sm text-text dark:text-[#f0ebe2] hover:text-indigo-400 transition-colors text-left flex-1 truncate"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{folder.title}</span>
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        {folderNotes.length} notes
                      </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAddNote(folder.id)}
                        title="Add Note to Folder"
                        className="p-1.5 text-xs font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Note
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(folder.id, e)}
                        title="Delete Folder"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notes List inside Folder Card */}
                  {!isCollapsed && (
                    <div className="p-2 space-y-1.5">
                      {folderNotes.length === 0 ? (
                        <div className="text-xs text-slate-400 italic px-4 py-3 text-center">
                          No notes in this category yet.
                        </div>
                      ) : (
                        folderNotes.map((note) => {
                          const isActive = note.id === activeNote?.id;
                          return (
                            <div
                              key={note.id}
                              onClick={() => setActiveNoteId(note.id)}
                              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                                isActive
                                  ? "bg-indigo-600 text-white border-indigo-400 shadow-card-sm"
                                  : "bg-white/60 dark:bg-black/30 border-black/5 dark:border-[#2e2924] hover:bg-white dark:hover:bg-black/50 text-text dark:text-[#f0ebe2]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <FileText className="w-4 h-4 shrink-0 opacity-80" />
                                <span className="truncate">{note.title}</span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {note.tags[0] && (
                                  <span
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                                      isActive
                                        ? "bg-white/20 text-white"
                                        : "bg-surface-low dark:bg-black/40 text-slate-400"
                                    }`}
                                  >
                                    #{note.tags[0]}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => handleDeleteNote(note.id, e)}
                                  className={`p-1 rounded hover:bg-red-500 hover:text-white transition-colors ${
                                    isActive ? "text-white/80" : "text-slate-400"
                                  }`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Studio Editor Workspace Deck (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4 w-full min-w-0 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-3xl p-5 sm:p-6 shadow-card-sm">
          {activeNote ? (
            <>
              {/* Studio Workspace Header Bar - Clean 2-Row Layout */}
              <div className="space-y-4 pb-4 border-b-2 border-black/10 dark:border-[#2e2924]">
                {/* Row 1: Note Title & Metadata */}
                <div className="space-y-1.5 w-full min-w-0">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => updateActiveNote({ title: e.target.value })}
                    className="font-black text-xl sm:text-2xl bg-transparent text-text dark:text-[#f0ebe2] border-b-2 border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors w-full tracking-tight"
                    placeholder="Note Title..."
                  />
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" /> {new Date(activeNote.updatedAt).toLocaleTimeString()}
                    </span>
                    <span>•</span>
                    <span>{activeNote.content.length} characters</span>
                    {activeNote.tags.length > 0 && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          {activeNote.tags.map((tag) => (
                            <span key={tag} className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-bold">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 2: Symmetrical View Mode Segment Pills */}
                <div className="w-full bg-surface-low dark:bg-[#0a0a0f] p-1.5 rounded-2xl border-2 border-black/10 dark:border-[#2e2924] flex flex-wrap sm:flex-nowrap items-center justify-start sm:justify-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setViewMode("split")}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                      viewMode === "split"
                        ? "bg-indigo-600 text-white shadow-card-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" /> Split
                  </button>

                  <button
                    onClick={() => setViewMode("editor")}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                      viewMode === "editor"
                        ? "bg-indigo-600 text-white shadow-card-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Code Editor
                  </button>

                  <button
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                      viewMode === "preview"
                        ? "bg-indigo-600 text-white shadow-card-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>

                  <button
                    onClick={() => setViewMode("meta")}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                      viewMode === "meta"
                        ? "bg-indigo-600 text-white shadow-card-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" /> Meta
                  </button>
                  <button
                    onClick={() => setViewMode("quizzes")}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                      viewMode === "quizzes"
                        ? "bg-indigo-600 text-white shadow-card-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Quiz ({activeNote.quizzes.length})
                  </button>

                  <button
                    onClick={() => setViewMode("ai_suggestions")}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                      viewMode === "ai_suggestions"
                        ? "bg-indigo-600 text-white shadow-card-sm"
                        : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> AI Suggestions
                  </button>
                </div>
              </div>

              {/* View Viewports */}
              {viewMode === "ai_suggestions" && (
                <div className="py-2">
                  <ContentSuggestionsPanel
                    markdown={activeNote.content}
                    onApplyFix={(fix) => {
                      if (fix.suggestedFix) {
                        const updated = activeNote.content + "\n\n" + fix.suggestedFix;
                        handleUpdateNoteContent(updated);
                        toast.success("Applied suggestion to lesson!");
                      }
                    }}
                  />
                </div>
              )}
              {viewMode === "split" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-[550px] items-stretch">
                  {/* Editor Left */}
                  <div className="flex flex-col border-2 border-black/10 dark:border-[#2e2924] rounded-2xl overflow-hidden bg-surface-low/30 dark:bg-[#0a0a0f]">
                    <div className="flex items-center gap-1 p-2 bg-surface-low dark:bg-[#1a1714] border-b border-black/10 dark:border-[#2e2924]">
                      <button
                        onClick={() => handleInsertFormatting("# ")}
                        className="px-2 py-1 text-xs font-black rounded hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        H1
                      </button>
                      <button
                        onClick={() => handleInsertFormatting("## ")}
                        className="px-2 py-1 text-xs font-black rounded hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        H2
                      </button>
                      <button
                        onClick={() => handleInsertFormatting("**", "**")}
                        className="px-2 py-1 text-xs font-bold rounded hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        B
                      </button>
                      <button
                        onClick={() => handleInsertFormatting("*", "*")}
                        className="px-2 py-1 text-xs italic font-bold rounded hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        I
                      </button>
                      <button
                        onClick={() => handleInsertFormatting("\n\`\`\`typescript\n", "\n\`\`\`\n")}
                        className="px-2 py-1 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 rounded"
                      >
                        Code
                      </button>
                    </div>
                    <textarea
                      id="studio-content-textarea"
                      value={activeNote.content}
                      onChange={(e) => updateActiveNote({ content: e.target.value })}
                      className="flex-1 p-4 bg-transparent font-mono text-xs sm:text-sm text-text dark:text-[#f0ebe2] outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* Preview Right */}
                  <div className="p-4 border-2 border-black/10 dark:border-[#2e2924] rounded-2xl overflow-y-auto bg-surface-low/20 dark:bg-[#0a0a0f]">
                    <MarkdownRenderer content={activeNote.content} />
                  </div>
                </div>
              )}

              {viewMode === "editor" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5 bg-surface-low dark:bg-[#1a1714] p-2 rounded-2xl border border-black/10 dark:border-[#2e2924]">
                    <button
                      onClick={() => handleInsertFormatting("# ")}
                      className="px-3 py-1 text-xs font-black rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      Heading 1
                    </button>
                    <button
                      onClick={() => handleInsertFormatting("## ")}
                      className="px-3 py-1 text-xs font-black rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      Heading 2
                    </button>
                    <button
                      onClick={() => handleInsertFormatting("**", "**")}
                      className="px-3 py-1 text-xs font-bold rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      Bold
                    </button>
                    <button
                      onClick={() => handleInsertFormatting("*", "*")}
                      className="px-3 py-1 text-xs italic font-bold rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      Italic
                    </button>
                    <button
                      onClick={() => handleInsertFormatting("\n\`\`\`typescript\n", "\n\`\`\`\n")}
                      className="px-3 py-1 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 rounded-lg"
                    >
                      Code Block
                    </button>
                    <button
                      onClick={() => handleInsertFormatting("- ")}
                      className="px-3 py-1 text-xs font-bold rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      List Item
                    </button>
                    <button
                      onClick={() => handleInsertFormatting("> ")}
                      className="px-3 py-1 text-xs font-bold rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      Quote Callout
                    </button>
                  </div>

                  <textarea
                    id="studio-content-textarea"
                    rows={18}
                    value={activeNote.content}
                    onChange={(e) => updateActiveNote({ content: e.target.value })}
                    className="w-full p-4 bg-surface-low/50 dark:bg-[#0a0a0f] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl font-mono text-sm text-text dark:text-[#f0ebe2] outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                  />
                </div>
              )}

              {viewMode === "preview" && (
                <div className="p-6 bg-surface-low/30 dark:bg-[#0a0a0f] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl min-h-[500px] max-h-[650px] overflow-y-auto">
                  <MarkdownRenderer content={activeNote.content} />
                </div>
              )}

              {viewMode === "meta" && (
                <div className="space-y-4 p-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={activeNote.tags.join(", ")}
                      onChange={(e) =>
                        updateActiveNote({
                          tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                        })
                      }
                      className="w-full p-3 bg-surface-low dark:bg-[#0a0a0f] border border-black/10 dark:border-[#2e2924] rounded-xl font-mono text-sm outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Difficulty Rating
                      </label>
                      <select
                        value={activeNote.difficulty}
                        onChange={(e) =>
                          updateActiveNote({
                            difficulty: e.target.value as any,
                          })
                        }
                        className="w-full p-3 bg-surface-low dark:bg-[#0a0a0f] border border-black/10 dark:border-[#2e2924] rounded-xl font-bold text-sm outline-none"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Estimated Reading Time (mins)
                      </label>
                      <input
                        type="number"
                        value={activeNote.estimatedMinutes}
                        onChange={(e) =>
                          updateActiveNote({ estimatedMinutes: Number(e.target.value) })
                        }
                        className="w-full p-3 bg-surface-low dark:bg-[#0a0a0f] border border-black/10 dark:border-[#2e2924] rounded-xl font-bold text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "quizzes" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-text dark:text-[#f0ebe2]">
                      Quiz Questions ({activeNote.quizzes.length})
                    </h3>
                    <button
                      onClick={() => {
                        const newQ: QuizItem = {
                          id: Date.now(),
                          question: "New Self-Test Question?",
                          options: ["Option A", "Option B", "Option C", "Option D"],
                          answer: 0,
                          explanation: "Explanation for the correct choice.",
                        };
                        updateActiveNote({ quizzes: [...activeNote.quizzes, newQ] });
                        toast.success("Question added!");
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-card-sm"
                    >
                      + Add Question
                    </button>
                  </div>

                  {activeNote.quizzes.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-sm italic">
                      No quiz questions in this study note. Click "+ Add Question" to create self-test quizzes.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeNote.quizzes.map((quiz, qIdx) => (
                        <div
                          key={quiz.id}
                          className="p-4 bg-surface-low/50 dark:bg-[#0a0a0f] border border-black/10 dark:border-[#2e2924] rounded-2xl space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-indigo-400">
                              Question #{qIdx + 1}
                            </span>
                            <button
                              onClick={() => {
                                const remaining = activeNote.quizzes.filter((q) => q.id !== quiz.id);
                                updateActiveNote({ quizzes: remaining });
                              }}
                              className="text-xs text-red-500 hover:underline font-bold"
                            >
                              Delete Question
                            </button>
                          </div>

                          <input
                            type="text"
                            value={quiz.question}
                            onChange={(e) => {
                              const updated = activeNote.quizzes.map((q) =>
                                q.id === quiz.id ? { ...q, question: e.target.value } : q
                              );
                              updateActiveNote({ quizzes: updated });
                            }}
                            className="w-full p-2.5 bg-white dark:bg-[#1a1714] border border-black/10 dark:border-[#2e2924] rounded-xl font-bold text-sm outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-24 text-slate-400 text-sm">
              No note selected. Select a note from the left directory or click "+ Note" to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContentStudioPage;
