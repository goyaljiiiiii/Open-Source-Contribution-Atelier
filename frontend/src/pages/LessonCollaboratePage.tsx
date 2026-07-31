import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LessonCollaborativeEditor } from "../components/editor/LessonCollaborativeEditor";
import { fetchApi } from "../lib/api";

export function LessonCollaboratePage() {
  const { slug } = useParams<{ slug: string }>();
  const [lesson, setLesson] = useState<{ id: number; title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchApi(`/published-lessons/`, { requireAuth: false })
      .then((data) => {
        const lessons = Array.isArray(data) ? data : [];
        const found = lessons.find((l: { slug: string }) => l.slug === slug);
        if (found) {
          setLesson({
            id: found.id,
            title: found.title,
            content: found.content ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted dark:text-[#a0988c]">
        Loading lesson...
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="p-8 text-center text-muted dark:text-[#a0988c]">
        Lesson not found.
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-text dark:text-[#f0ebe2]">
            Collaborative Editing: {lesson.title}
          </h1>
          <p className="text-xs text-muted dark:text-[#a0988c] font-mono">
            /{slug}
          </p>
        </div>
      </div>

      <LessonCollaborativeEditor
        slug={slug!}
        initialContent={lesson.content}
      />
    </div>
  );
}
