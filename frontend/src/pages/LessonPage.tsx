import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { lessons, Lesson } from "../lib/lessons";
import { useUserProgress } from "../hooks/useUserProgress";

export function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { progress, syncProgress, isLessonCompleted, isLoading } = useUserProgress();

  const [lesson, setLesson] = useState<Lesson | undefined>(undefined);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [showHint, setShowHint] = useState(false);

  // Load lesson based on slug
  useEffect(() => {
    const found = lessons.find((l) => l.slug === slug);
    if (!found) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setLesson(found);
    setFeedback("");
    setInput("");
    setShowHint(false);
  }, [slug, navigate]);

  // Guard navigation: if user tries to access a lesson they haven't unlocked yet
  useEffect(() => {
    if (!lesson || isLoading) return;
    
    const lessonIdx = lessons.findIndex((l) => l.slug === lesson.slug);
    if (lessonIdx === 0) return; // Intro is always accessible
    
    // Check if the previous lesson was completed
    const previousLesson = lessons[lessonIdx - 1];
    if (previousLesson && !isLessonCompleted(previousLesson.slug)) {
      navigate(`/lessons/${previousLesson.slug}`, { replace: true });
    }
  }, [lesson, isLoading, isLessonCompleted, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesson) return;
    
    const isCorrect = lesson.expected.test(input.trim());
    if (isCorrect) {
      setFeedback("correct");
      
      // Sync to backend!
      syncProgress({ 
        lesson_slug: lesson.slug, 
        score: 100, 
        completed: true 
      });

      // Advance after short delay
      setTimeout(() => {
        const currentIdx = lessons.findIndex((l) => l.slug === lesson.slug);
        const nextLesson = lessons[currentIdx + 1];
        if (nextLesson) {
          navigate(`/lessons/${nextLesson.slug}`);
        } else {
          navigate("/dashboard");
        }
      }, 1500);
    } else {
      setFeedback("error");
      setShowHint(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-text drop-shadow-[2px_2px_0_#FF3B30]">{lesson.title}</h1>
        {isLessonCompleted(lesson.slug) && (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black border-2 border-green-700">
            COMPLETED ✅
          </span>
        )}
      </div>
      
      <p className="text-xl text-muted">{lesson.description}</p>
      
      <div className="p-4 bg-surface-low rounded-2xl border-4 border-black shadow-card">
        <p className="text-text">{lesson.explanation}</p>
      </div>

      {lesson.tips && lesson.tips.length > 0 && (
        <div className="p-4 bg-white rounded-2xl border-4 border-black shadow-card">
          <h2 className="font-bold text-lg mb-2">Tips & Common Mistakes</h2>
          <ul className="list-disc list-inside space-y-1">
            {lesson.tips.map((tip, i) => (
              <li key={i} className="text-sm text-muted">{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-primary">$</span>
          <input
            className="flex-1 rounded-xl border-4 border-black bg-surface-lowest px-4 py-2 text-text font-bold outline-none placeholder:text-muted/60"
            placeholder="Type your git command here"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={feedback === "correct"}
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white font-bold rounded-xl border-4 border-black shadow-gel hover:bg-[#E62814] disabled:opacity-50"
            disabled={feedback === "correct"}
          >
            Run
          </button>
        </div>
        
        {feedback === "correct" && (
          <div className="text-green-700 font-bold bg-green-50 p-3 rounded-xl border-2 border-green-700 animate-bounce">
            ✅ Correct! Progress synced to backend.
          </div>
        )}
        
        {feedback === "error" && (
          <div className="text-red-700 font-bold bg-red-50 p-3 rounded-xl border-2 border-red-700">
            ❌ Not quite. Command didn't match requirements.
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowHint(!showHint)}
          className="text-sm underline text-muted font-bold"
        >
          {showHint ? "Hide Hint" : "Show Hint?"}
        </button>
        
        {showHint && (
          <div className="p-3 bg-surface-low rounded-xl border-2 border-black italic text-sm">
            💡 {lesson.hint}
          </div>
        )}
      </form>
    </div>
  );
}
