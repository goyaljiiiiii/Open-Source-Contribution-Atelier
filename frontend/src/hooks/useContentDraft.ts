import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";

export interface QuizDraftData {
  id?: number;
  lesson?: number;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  order?: number;
}

export interface LessonDraftData {
  id?: number;
  module?: number | null;
  title: string;
  slug: string;
  description?: string;
  content: string;
  difficulty: string;
  tags: string[];
  estimatedMinutes: number;
  order?: number;
  isPublished: boolean;
  learningObjectives?: string[];
  quizzes?: QuizDraftData[];
}

export interface ModuleDraftData {
  id: number;
  title: string;
  slug: string;
  description?: string;
  order: number;
  lessons: LessonDraftData[];
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useContentDraft(initialLessonId?: number) {
  const [modules, setModules] = useState<ModuleDraftData[]>([]);
  const [activeLesson, setActiveLesson] = useState<LessonDraftData | null>(
    null,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isLoading, setIsLoading] = useState(true);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeLessonRef = useRef<LessonDraftData | null>(activeLesson);
  activeLessonRef.current = activeLesson;

  const fetchModules = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get<ModuleDraftData[]>("/content/modules/").catch(() => null);
      if (res && res.data && res.data.length > 0) {
        setModules(res.data);
        if (initialLessonId) {
          const found = res.data.flatMap((m) => m.lessons).find((l) => l.id === initialLessonId);
          if (found) setActiveLesson(found);
        } else if (res.data[0]?.lessons[0]) {
          setActiveLesson(res.data[0].lessons[0]);
        }
      } else {
        const savedNotesMap = JSON.parse(localStorage.getItem("atelier_saved_notes_map") || "{}");
        const currRes = await fetch("/content/curriculum.json").catch(() => null);
        if (currRes && currRes.ok) {
          const currData = await currRes.json();
          const mappedModules: ModuleDraftData[] = (currData.modules || []).map((m: any, idx: number) => ({
            id: m.id ? idx + 1 : idx + 1,
            title: m.title || `Module ${idx + 1}`,
            slug: m.id || `module-${idx + 1}`,
            description: m.description || "",
            order: idx + 1,
            lessons: (m.lessons || []).map((l: any, lIdx: number) => {
              const lesId = (idx + 1) * 100 + lIdx + 1;
              const savedNote = savedNotesMap[lesId] || (localStorage.getItem(`atelier_study_note_${lesId}`) ? JSON.parse(localStorage.getItem(`atelier_study_note_${lesId}`)!) : null);
              return savedNote || {
                id: lesId,
                module: idx + 1,
                title: l.title,
                slug: l.slug,
                description: l.description || "",
                content: `# ${l.title}\n\n${l.description || "Welcome to your study notes."}\n\n\`\`\`typescript\nfunction startLesson() {\n  console.log("Interactive curriculum ready!");\n}\n\`\`\`\n`,
                difficulty: l.difficulty || "beginner",
                tags: ["git", "open-source"],
                estimatedMinutes: l.estimatedMinutes || 10,
                order: lIdx + 1,
                isPublished: true,
                quizzes: l.quizzes || [],
              };
            }),
          }));
          setModules(mappedModules);
          if (mappedModules[0]?.lessons[0]) {
            setActiveLesson(mappedModules[0].lessons[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch content draft modules:", err);
    } finally {
      setIsLoading(false);
    }
  }, [initialLessonId]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const saveDraft = useCallback(async (draft: LessonDraftData) => {
    const targetId = draft?.id || Date.now();
    setSaveStatus("saving");
    
    // 1. Guaranteed LocalStorage Persistence
    try {
      const updatedDraft = { ...draft, id: targetId };
      localStorage.setItem(`atelier_study_note_${targetId}`, JSON.stringify(updatedDraft));
      const savedNotesMap = JSON.parse(localStorage.getItem("atelier_saved_notes_map") || "{}");
      savedNotesMap[targetId] = updatedDraft;
      localStorage.setItem("atelier_saved_notes_map", JSON.stringify(savedNotesMap));
    } catch (err) {
      console.warn("LocalStorage save issue:", err);
    }

    // 2. Silent Backend Sync
    try {
      await api.put(`/content/lessons/${targetId}/`, draft).catch(() => null);
    } catch {
      // Backend offline fallback
    }

    setSaveStatus("saved");
    setIsDirty(false);
    setTimeout(() => {
      setSaveStatus("idle");
    }, 2000);
  }, []);

  const updateActiveLesson = useCallback(
    (updates: Partial<LessonDraftData>) => {
      setActiveLesson((prev) => {
        if (!prev) return null;
        const next = { ...prev, ...updates };
        setIsDirty(true);
        setSaveStatus("idle");

        // Immediately update localStorage for instant persistence
        if (next.id) {
          try {
            localStorage.setItem(`atelier_study_note_${next.id}`, JSON.stringify(next));
          } catch {}
        }

        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
          saveDraft(next);
        }, 1500);

        return next;
      });
    },
    [saveDraft],
  );

  // Browser unload warning when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [isDirty]);

  return {
    modules,
    setModules,
    activeLesson,
    setActiveLesson,
    updateActiveLesson,
    isDirty,
    saveStatus,
    saveDraft: () => activeLesson && saveDraft(activeLesson),
    isLoading,
    refetchModules: fetchModules,
  };
}
