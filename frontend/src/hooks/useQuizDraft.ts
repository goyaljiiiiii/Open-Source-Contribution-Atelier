import { useCallback, useRef } from "react";

const STORAGE_PREFIX = "quiz_draft_";

export interface QuizDraft {
  quizId: string;
  currentQuizIndex: number;
  selectedOption: number | null;
  quizFeedback: "correct" | "incorrect" | "timeout" | null;
  timeLeft: number | null;
  savedAt: number;
}

function getStorageKey(quizId: string): string {
  return `${STORAGE_PREFIX}${quizId}`;
}

function readDraft(quizId: string | undefined): QuizDraft | null {
  if (!quizId) return null;
  try {
    const raw = sessionStorage.getItem(getStorageKey(quizId));
    if (raw) return JSON.parse(raw) as QuizDraft;
  } catch {
    // Ignore corrupt data
  }
  return null;
}

export function useQuizDraft(quizId: string | undefined) {
  const draftRef = useRef<QuizDraft | null>(() => readDraft(quizId));

  const saveDraft = useCallback(
    (
      currentQuizIndex: number,
      selectedOption: number | null,
      quizFeedback: "correct" | "incorrect" | "timeout" | null,
      timeLeft: number | null,
    ) => {
      if (!quizId) return;
      const draft: QuizDraft = {
        quizId,
        currentQuizIndex,
        selectedOption,
        quizFeedback,
        timeLeft,
        savedAt: Date.now(),
      };
      draftRef.current = draft;
      try {
        sessionStorage.setItem(getStorageKey(quizId), JSON.stringify(draft));
      } catch {
        // Storage quota exceeded or unavailable
      }
    },
    [quizId],
  );

  const getDraft = useCallback((): QuizDraft | null => {
    return draftRef.current;
  }, []);

  const clearDraft = useCallback(() => {
    if (!quizId) return;
    draftRef.current = null;
    try {
      sessionStorage.removeItem(getStorageKey(quizId));
    } catch {
      // Ignore storage errors
    }
  }, [quizId]);

  return { saveDraft, getDraft, clearDraft };
}
