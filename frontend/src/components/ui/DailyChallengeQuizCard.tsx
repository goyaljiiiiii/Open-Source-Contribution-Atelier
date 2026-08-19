import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trophy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useCurriculum } from "../../hooks/useCurriculum";
import { fetchApi } from "../../lib/api";

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  lessonTitle?: string;
}

const FALLBACK_QUIZZES: QuizQuestion[] = [
  {
    question: "What is the primary defining characteristic of open-source software?",
    options: [
      "It is always completely free of charge.",
      "Its source code is publicly accessible, allowing anyone to view, modify, and distribute it.",
      "It can only be developed by large non-profit foundations.",
      "It has no copyright licenses associated with it."
    ],
    answer: 1,
    explanation: "Open-source software is defined by its source code being publicly available for anyone to inspect, modify, and enhance under open licenses.",
    lessonTitle: "What is Open Source?"
  },
  {
    question: "Which Git command is used to record changes to the repository?",
    options: [
      "git push",
      "git stage",
      "git commit",
      "git checkout"
    ],
    answer: 2,
    explanation: "git commit creates a new commit containing the current contents of the index and the given log message describing the changes.",
    lessonTitle: "Git Basics"
  },
  {
    question: "What is the primary purpose of a pull request (PR)?",
    options: [
      "To download code locally",
      "To propose changes and request review before merging into a target branch",
      "To delete a Git branch automatically",
      "To bypass automated CI tests"
    ],
    answer: 1,
    explanation: "Pull requests let you tell others about changes you've pushed to a branch in a repository and discuss/review potential changes before they are merged.",
    lessonTitle: "Pull Requests & Code Review"
  }
];

export function DailyChallengeQuizCard() {
  const queryClient = useQueryClient();
  const { data: curriculumCatalog } = useCurriculum();

  // Extract all quizzes across all modules and lessons
  const allQuizzes = useMemo<QuizQuestion[]>(() => {
    if (!curriculumCatalog?.modules) return FALLBACK_QUIZZES;
    const list: QuizQuestion[] = [];
    for (const mod of curriculumCatalog.modules) {
      for (const lesson of mod.lessons || []) {
        if (lesson.quizzes && Array.isArray(lesson.quizzes)) {
          for (const q of lesson.quizzes as any[]) {
            if (q && q.question && Array.isArray(q.options) && typeof q.answer === "number") {
              list.push({
                question: q.question,
                options: q.options,
                answer: q.answer,
                explanation: q.explanation || "",
                lessonTitle: lesson.title,
              });
            }
          }
        }
      }
    }
    return list.length > 0 ? list : FALLBACK_QUIZZES;
  }, [curriculumCatalog]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Deterministically select a quiz question based on today's date string
  const dailyQuiz = useMemo<QuizQuestion>(() => {
    let hash = 0;
    for (let i = 0; i < todayStr.length; i++) {
      hash = (hash * 31 + todayStr.charCodeAt(i)) % 2147483647;
    }
    const index = Math.abs(hash) % allQuizzes.length;
    return allQuizzes[index];
  }, [todayStr, allQuizzes]);

  const storageKey = `daily_challenge_quiz_${todayStr}`;

  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.completed) {
          return {
            isCompleted: true,
            selectedOption: parsed.selectedOption,
            isSubmitted: true,
            earnedXp: parsed.earnedXp || 15,
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      isCompleted: false,
      selectedOption: null,
      isSubmitted: false,
      earnedXp: 0,
    };
  };

  const [initial] = useState(getInitialState);
  const [selectedOption, setSelectedOption] = useState<number | null>(initial.selectedOption);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(initial.isSubmitted);
  const [isCompleted, setIsCompleted] = useState<boolean>(initial.isCompleted);
  const [earnedXp, setEarnedXp] = useState<number>(initial.earnedXp);

  const handleSubmit = async () => {
    if (selectedOption === null || isSubmitted) return;
    setIsSubmitted(true);

    const isCorrect = selectedOption === dailyQuiz.answer;
    const xpReward = isCorrect ? 15 : 5;
    setEarnedXp(xpReward);
    setIsCompleted(true);

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        completed: true,
        selectedOption,
        earnedXp: xpReward,
        date: todayStr,
      }),
    );

    // Call progress / XP API to award points if authenticated
    try {
      await fetchApi("/progress/xp/", {
        method: "POST",
        body: JSON.stringify({
          xp_delta: xpReward,
          source_type: "daily_challenge",
          description: `Completed Daily Challenge Quiz for ${todayStr}`,
        }),
        suppressErrorToast: true,
      });
      queryClient.invalidateQueries({ queryKey: ["contributorStats"] });
      queryClient.invalidateQueries({ queryKey: ["contributorDashboardStats"] });
    } catch {
      // Ignored if offline or endpoint not directly accepting manual delta
    }
  };

  const isCorrect = selectedOption === dailyQuiz.answer;

  return (
    <div className="rounded-[2rem] border-4 border-black bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-[#241f17] dark:to-[#1a1712] dark:border-[#2e2924] p-6 shadow-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 text-black p-3 rounded-2xl border-2 border-black flex-shrink-0 shadow-card-sm">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-[10px] uppercase tracking-wider bg-amber-200 text-black px-2.5 py-0.5 rounded-full border border-black/20">
                Daily Challenge
              </span>
              {dailyQuiz.lessonTitle && (
                <span className="text-xs font-bold text-gray-500 dark:text-[#c4bbae]">
                  • {dailyQuiz.lessonTitle}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black dark:text-[#f0ebe2] mt-0.5">
              Daily Brain Boost
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-black text-xs text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700">
          <Sparkles className="w-4 h-4" />
          <span>+15 XP</span>
        </div>
      </div>

      {isCompleted ? (
        /* Completed / Come back tomorrow state */
        <div className="space-y-4 pt-2">
          <div
            className={`p-4 rounded-2xl border-4 ${
              isCorrect
                ? "bg-green-50 border-green-500 text-green-900 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300"
                : "bg-orange-50 border-orange-500 text-orange-900 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              )}
              <h4 className="font-black text-sm">
                {isCorrect ? "Correct! Well done!" : "Nice attempt!"} (+{earnedXp} XP)
              </h4>
            </div>
            <p className="text-xs font-bold leading-relaxed">{dailyQuiz.explanation}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-black/10 bg-white/60 dark:bg-black/20 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-[#c4bbae]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>You've completed today's challenge! Come back tomorrow for a new question.</span>
            </div>
            <span className="bg-black text-white dark:bg-white dark:text-black px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">
              Done for today
            </span>
          </div>
        </div>
      ) : (
        /* Active Quiz Question State */
        <div className="space-y-4 pt-1">
          <p className="font-bold text-sm text-gray-800 dark:text-[#f0ebe2] leading-relaxed">
            {dailyQuiz.question}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {dailyQuiz.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedOption(idx)}
                  className={`p-3 text-left rounded-xl border-2 font-bold text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? "border-black bg-amber-300 text-black shadow-card-sm dark:border-white dark:bg-amber-400 dark:text-black"
                      : "border-black/20 bg-white hover:border-black hover:bg-amber-50 dark:bg-[#1f1c18] dark:border-[#2e2924] dark:text-[#f0ebe2] dark:hover:bg-black/40"
                  }`}
                >
                  <span>{option}</span>
                  <span
                    className={`w-5 h-5 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      isSelected ? "bg-black text-white" : "bg-transparent text-black dark:text-white"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className="px-6 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black font-black text-xs border-2 border-black shadow-card-sm hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              Submit Answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DailyChallengeQuizCard;
